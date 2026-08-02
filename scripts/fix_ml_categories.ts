import fs from "fs";
import path from "path";

// Load .env.local
function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const [key, ...valParts] = trimmed.split("=");
        process.env[key.trim()] = valParts.join("=").trim();
      }
    }
  }
}
loadEnvLocal();

import { fetchMeli, getTokens } from "../src/utils/tokenStorage";
import { getDBProducts, saveDBProducts } from "../src/utils/productStorage";

// ─── CORRECT CATEGORY MAPPING (verified from ML API) ──────────────────────────
// MLB1432   = Brincos (Joias e Relógios > Joias e Bijuterias > Brincos)
// MLB457383 = Colares (Joias e Relógios > Joias e Bijuterias > Colares)
// MLB1434   = Pulseiras e Braceletes (Joias e Relógios > Joias e Bijuterias > Pulseiras)
// MLB8378   = Óculos de Sol (Calçados, Roupas e Bolsas > Acessórios > Óculos > De Sol)
// MLB1440   = Outros (Joias e Relógios > Joias e Bijuterias > Outros) — FALLBACK category, WRONG

function getCorrectCategoryBySku(sku: string): { categoryId: string; categoryName: string } {
  const upperSku = sku.toUpperCase();
  if (upperSku.includes("BRINCO")) {
    return { categoryId: "MLB1432", categoryName: "Brincos" };
  }
  if (upperSku.includes("COLAR")) {
    return { categoryId: "MLB457383", categoryName: "Colares" };
  }
  if (upperSku.includes("PULSEIRA")) {
    return { categoryId: "MLB1434", categoryName: "Pulseiras e Braceletes" };
  }
  if (upperSku.includes("OCULOS")) {
    return { categoryId: "MLB8378", categoryName: "Óculos de Sol" };
  }
  // Default: keep in Outros (MLB1440)
  return { categoryId: "MLB1440", categoryName: "Joias - Outros" };
}

function getRequiredAttributesBySku(sku: string, existingAttrs: any[]): any[] {
  const upperSku = sku.toUpperCase();
  const missingAttrs: any[] = [];

  // SALE_FORMAT is needed for all jewelry categories
  if (!existingAttrs.some(a => a.id === "SALE_FORMAT")) {
    missingAttrs.push({ id: "SALE_FORMAT", value_name: "Unidade" });
  }

  // EMPTY_GTIN_REASON — needed when GTIN is not provided
  if (!existingAttrs.some(a => a.id === "GTIN") && !existingAttrs.some(a => a.id === "EMPTY_GTIN_REASON")) {
    missingAttrs.push({ id: "EMPTY_GTIN_REASON", value_name: "O produto não tem código cadastrado" });
  }

  // WITH_GEMSTONE is required for Brincos (MLB1432)
  if (upperSku.includes("BRINCO")) {
    if (!existingAttrs.some(a => a.id === "WITH_GEMSTONE")) {
      missingAttrs.push({ id: "WITH_GEMSTONE", value_name: "Não" });
    }
  }

  return missingAttrs;
}

interface FixResult {
  itemId: string;
  sku: string;
  action: string;
  success: boolean;
  error?: string;
}

async function fixMlCategoriesAndAttributes() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");

  console.log("═══════════════════════════════════════════════════════════");
  console.log("🔧 CORREÇÃO DE CATEGORIAS E ATRIBUTOS NO MERCADO LIVRE");
  console.log(`   Modo: ${isDryRun ? "DRY-RUN (nenhuma alteração será feita)" : "⚡ EXECUÇÃO REAL ⚡"}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  const tokens = await getTokens();
  if (!tokens.mercadolivre.connected || !tokens.mercadolivre.accessToken) {
    throw new Error("❌ Mercado Livre não está conectado! Conecte a conta antes de rodar.");
  }

  // 1. Fetch all item IDs from the account
  console.log("📋 Buscando todos os itens da conta no Mercado Livre...");
  const allItemIds: string[] = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const searchRes = await fetchMeli(`/users/${tokens.mercadolivre.userId}/items/search?limit=${limit}&offset=${offset}`);
    if (!searchRes.ok) {
      const err = await searchRes.text();
      throw new Error(`Erro ao buscar itens: ${err}`);
    }
    const searchData = await searchRes.json();
    const batchIds: string[] = searchData.results || [];
    allItemIds.push(...batchIds);
    const total = searchData.paging?.total || 0;
    offset += limit;
    hasMore = offset < total && batchIds.length > 0;
  }

  console.log(`✅ Total de itens encontrados: ${allItemIds.length}\n`);

  if (allItemIds.length === 0) {
    console.log("Nenhum item encontrado na conta. Saindo.");
    return;
  }

  // 2. Fetch item details in batches of 20
  console.log("📦 Buscando detalhes dos itens...");
  const allItems: any[] = [];
  const batchSize = 20;
  for (let i = 0; i < allItemIds.length; i += batchSize) {
    const batchIds = allItemIds.slice(i, i + batchSize).join(",");
    const detailRes = await fetchMeli(`/items?ids=${batchIds}`);
    if (detailRes.ok) {
      const detailData = await detailRes.json();
      allItems.push(...detailData);
    }
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`✅ Detalhes obtidos para ${allItems.length} itens.\n`);

  // 3. Analyze and fix each item
  const results: FixResult[] = [];
  let categoryFixes = 0;
  let attributeFixes = 0;
  let stockFixes = 0;
  let reactivated = 0;
  let alreadyCorrect = 0;

  for (const resItem of allItems) {
    const item = resItem.body;
    if (!item) continue;

    const itemId = item.id;
    const currentCategoryId = item.category_id;
    const attributes: any[] = item.attributes || [];
    const status = item.status;

    // Extract SKU from attributes
    const skuAttr = attributes.find((a: any) => a.id === "SELLER_SKU");
    const sku = skuAttr?.value_name || item.title || "";

    const fixes: string[] = [];
    const updatePayload: Record<string, any> = {};

    // ─── FIX 1: Wrong category (detect by SKU) ───
    const { categoryId: correctCategoryId, categoryName: correctCategoryName } = getCorrectCategoryBySku(sku);
    if (currentCategoryId !== correctCategoryId && correctCategoryId !== "MLB1440") {
      fixes.push(`Categoria ${currentCategoryId} → ${correctCategoryId} (${correctCategoryName})`);
      updatePayload.category_id = correctCategoryId;
      categoryFixes++;
    }

    // ─── FIX 2: Missing required attributes ───
    const missingAttrs = getRequiredAttributesBySku(sku, attributes);
    if (missingAttrs.length > 0) {
      for (const attr of missingAttrs) {
        fixes.push(`Adicionando ${attr.id}: ${attr.value_name}`);
      }
      updatePayload.attributes = missingAttrs;
      attributeFixes++;
    }

    // ─── FIX 3: Stock is 0 ───
    if (item.available_quantity === 0 && status !== "closed") {
      fixes.push("Restaurando estoque de 0 → 1");
      updatePayload.available_quantity = 1;
      stockFixes++;
    }

    if (fixes.length === 0) {
      alreadyCorrect++;
      continue;
    }

    console.log(`\n────────────────────────────────────────`);
    console.log(`📝 Item: ${itemId} | SKU: ${sku || "N/A"} | Status: ${status}`);
    console.log(`   Categoria atual: ${currentCategoryId} → Correta: ${correctCategoryId} (${correctCategoryName})`);
    fixes.forEach(f => console.log(`   → ${f}`));

    if (isDryRun) {
      console.log(`   [DRY-RUN] Nenhuma alteração feita.`);
      results.push({ itemId, sku, action: fixes.join("; "), success: true });
      continue;
    }

    try {
      // Strategy: try combined update first, then fallback to individual updates
      let combinedSuccess = false;

      const updateRes = await fetchMeli(`/items/${itemId}`, {
        method: "PUT",
        body: JSON.stringify(updatePayload)
      });

      if (updateRes.ok) {
        console.log(`   ✅ Correção combinada aplicada com sucesso!`);
        combinedSuccess = true;
        results.push({ itemId, sku, action: fixes.join("; "), success: true });
      } else {
        const errData = await updateRes.json();
        const errMsg = errData.message || JSON.stringify(errData);
        console.log(`   ⚠️ Erro na atualização combinada: ${errMsg}`);
        console.log(`   🔄 Tentando atualizações individuais...`);

        // Try category change alone
        if (updatePayload.category_id) {
          const catRes = await fetchMeli(`/items/${itemId}`, {
            method: "PUT",
            body: JSON.stringify({ category_id: updatePayload.category_id })
          });
          if (catRes.ok) {
            console.log(`   ✅ Categoria corrigida!`);
          } else {
            const catErr = await catRes.json();
            console.log(`   ❌ Categoria: ${catErr.message || JSON.stringify(catErr)}`);
          }
          await new Promise(r => setTimeout(r, 200));
        }

        // Try attributes alone
        if (updatePayload.attributes && updatePayload.attributes.length > 0) {
          const attrRes = await fetchMeli(`/items/${itemId}`, {
            method: "PUT",
            body: JSON.stringify({ attributes: updatePayload.attributes })
          });
          if (attrRes.ok) {
            console.log(`   ✅ Atributos corrigidos!`);
          } else {
            const attrErr = await attrRes.json();
            console.log(`   ❌ Atributos: ${attrErr.message || JSON.stringify(attrErr)}`);
          }
          await new Promise(r => setTimeout(r, 200));
        }

        // Try stock alone
        if (updatePayload.available_quantity !== undefined) {
          const stockRes = await fetchMeli(`/items/${itemId}`, {
            method: "PUT",
            body: JSON.stringify({ available_quantity: updatePayload.available_quantity })
          });
          if (stockRes.ok) {
            console.log(`   ✅ Estoque restaurado!`);
          } else {
            const stockErr = await stockRes.json();
            console.log(`   ❌ Estoque: ${stockErr.message || JSON.stringify(stockErr)}`);
          }
        }

        results.push({ itemId, sku, action: fixes.join("; "), success: false, error: errMsg });
      }

      // Reactivate paused/inactive items
      if (status === "paused" || status === "inactive") {
        await new Promise(r => setTimeout(r, 200));
        const activateRes = await fetchMeli(`/items/${itemId}`, {
          method: "PUT",
          body: JSON.stringify({ status: "active" })
        });
        if (activateRes.ok) {
          console.log(`   ✅ Anúncio reativado (${status} → active)!`);
          reactivated++;
        } else {
          const actErr = await activateRes.json();
          console.log(`   ⚠️ Não foi possível reativar: ${actErr.message || JSON.stringify(actErr)}`);
        }
      }

      // Rate limit between items
      await new Promise(r => setTimeout(r, 400));
    } catch (err: any) {
      console.log(`   ❌ Erro de rede: ${err.message}`);
      results.push({ itemId, sku, action: fixes.join("; "), success: false, error: err.message });
    }
  }

  // 4. Summary
  console.log("\n\n═══════════════════════════════════════════════════════════");
  console.log("📊 RELATÓRIO FINAL");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`Total de itens analisados: ${allItems.length}`);
  console.log(`Itens já corretos: ${alreadyCorrect}`);
  console.log(`Categorias a corrigir: ${categoryFixes}`);
  console.log(`Itens com atributos adicionados: ${attributeFixes}`);
  console.log(`Estoques a restaurar (0→1): ${stockFixes}`);
  console.log(`Anúncios reativados: ${reactivated}`);
  console.log(`Correções bem-sucedidas: ${results.filter(r => r.success).length}`);
  console.log(`Erros: ${results.filter(r => !r.success).length}`);

  if (results.filter(r => !r.success).length > 0) {
    console.log("\n⚠️ Itens com erros:");
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.itemId} (${r.sku}): ${r.error}`);
    });
  }

  console.log("═══════════════════════════════════════════════════════════\n");

  // 5. Update local DB stock to match
  if (!isDryRun) {
    console.log("💾 Atualizando estoque local...");
    const dbProducts = await getDBProducts();
    let localUpdated = 0;
    for (const p of dbProducts) {
      if (p.totalStock === 0 || p.mlStock === 0) {
        p.mlStock = 1;
        p.totalStock = 1;
        p.lastSync = new Date().toLocaleTimeString("pt-BR");
        localUpdated++;
      }
    }
    if (localUpdated > 0) {
      await saveDBProducts(dbProducts);
      console.log(`✅ ${localUpdated} produtos atualizados no banco local.`);
    } else {
      console.log("✅ Todos os produtos já têm estoque correto no banco local.");
    }
  }
}

fixMlCategoriesAndAttributes().catch(err => {
  console.error("❌ Erro fatal:", err);
  process.exit(1);
});
