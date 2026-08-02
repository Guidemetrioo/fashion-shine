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

// ─── CORRECT CATEGORY MAPPING ─────────────────────────────────────────────────
// MLB1432  = Brincos (Joias e Relógios > Joias e Bijuterias > Brincos) ✅
// MLB457383 = Colares (Joias e Relógios > Joias e Bijuterias > Colares) ✅ CORRECT
// MLB457416 = Colares (Festas > Fantasias e Cosplay > Colares) ❌ WRONG - cosplay category!
// MLB1434  = Pulseiras e Braceletes (Joias e Relógios > Joias e Bijuterias > Pulseiras) ✅
// MLB8378  = Óculos de Sol (Calçados, Roupas e Bolsas > Acessórios > Óculos > De Sol) ✅

const WRONG_NECKLACE_CATEGORY = "MLB457416";
const CORRECT_NECKLACE_CATEGORY = "MLB457383";
const EARRING_CATEGORY = "MLB1432";

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
  console.log(`   Modo: ${isDryRun ? "DRY-RUN (nenhuma alteração será feita)" : "EXECUÇÃO REAL"}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  const tokens = await getTokens();
  if (!tokens.mercadolivre.connected || !tokens.mercadolivre.accessToken) {
    throw new Error("❌ Mercado Livre não está conectado! Conecte a conta antes de rodar.");
  }

  // 1. Buscar todos os itens da conta
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

  // 2. Buscar detalhes em batches de 20
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
    // Rate limit
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`✅ Detalhes obtidos para ${allItems.length} itens.\n`);

  // 3. Classificar e corrigir
  const results: FixResult[] = [];
  let categoryFixes = 0;
  let attributeFixes = 0;
  let stockFixes = 0;
  let alreadyCorrect = 0;

  for (const resItem of allItems) {
    const item = resItem.body;
    if (!item) continue;

    const itemId = item.id;
    const categoryId = item.category_id;
    const attributes: any[] = item.attributes || [];
    const status = item.status;

    // Extract SKU
    const skuAttr = attributes.find((a: any) => a.id === "SELLER_SKU");
    const sku = skuAttr?.value_name || "";

    const fixes: string[] = [];
    const updatePayload: Record<string, any> = {};

    // ─── FIX 1: Wrong category for necklaces ───
    if (categoryId === WRONG_NECKLACE_CATEGORY) {
      fixes.push(`Categoria ${WRONG_NECKLACE_CATEGORY} → ${CORRECT_NECKLACE_CATEGORY}`);
      updatePayload.category_id = CORRECT_NECKLACE_CATEGORY;
    }

    // ─── FIX 2: Missing WITH_GEMSTONE for earrings ───
    if (categoryId === EARRING_CATEGORY) {
      const hasWithGemstone = attributes.some((a: any) => a.id === "WITH_GEMSTONE");
      if (!hasWithGemstone) {
        fixes.push("Adicionando WITH_GEMSTONE: Não");
        if (!updatePayload.attributes) updatePayload.attributes = [];
        updatePayload.attributes.push({ id: "WITH_GEMSTONE", value_name: "Não" });
      }
    }

    // ─── FIX 3: Missing SALE_FORMAT ───
    const hasSaleFormat = attributes.some((a: any) => a.id === "SALE_FORMAT");
    if (!hasSaleFormat) {
      fixes.push("Adicionando SALE_FORMAT: Unidade");
      if (!updatePayload.attributes) updatePayload.attributes = [];
      updatePayload.attributes.push({ id: "SALE_FORMAT", value_name: "Unidade" });
    }

    // ─── FIX 4: Stock is 0, restore to 1 ───
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
    console.log(`   Categoria atual: ${categoryId}`);
    fixes.forEach(f => console.log(`   → ${f}`));

    if (isDryRun) {
      console.log(`   [DRY-RUN] Nenhuma alteração feita.`);
      results.push({ itemId, sku, action: fixes.join("; "), success: true });
      if (updatePayload.category_id) categoryFixes++;
      if (updatePayload.attributes?.some((a: any) => a.id === "WITH_GEMSTONE")) attributeFixes++;
      continue;
    }

    try {
      // Apply the update
      const updateRes = await fetchMeli(`/items/${itemId}`, {
        method: "PUT",
        body: JSON.stringify(updatePayload)
      });

      if (!updateRes.ok) {
        const errData = await updateRes.json();
        const errMsg = errData.message || JSON.stringify(errData);
        console.log(`   ❌ Erro: ${errMsg}`);

        // If combined update failed, try individual updates
        if (updatePayload.category_id) {
          console.log(`   🔄 Tentando alterar apenas a categoria...`);
          const catOnlyRes = await fetchMeli(`/items/${itemId}`, {
            method: "PUT",
            body: JSON.stringify({ category_id: updatePayload.category_id })
          });
          if (catOnlyRes.ok) {
            console.log(`   ✅ Categoria corrigida com sucesso!`);
            categoryFixes++;
          } else {
            const catErr = await catOnlyRes.json();
            console.log(`   ❌ Falha na categoria: ${catErr.message || JSON.stringify(catErr)}`);
          }
        }

        if (updatePayload.attributes && updatePayload.attributes.length > 0) {
          const attrRes = await fetchMeli(`/items/${itemId}`, {
            method: "PUT",
            body: JSON.stringify({ attributes: updatePayload.attributes })
          });
          if (attrRes.ok) {
            console.log(`   ✅ Atributos corrigidos com sucesso!`);
            attributeFixes++;
          }
        }

        if (updatePayload.available_quantity !== undefined) {
          const stockRes = await fetchMeli(`/items/${itemId}`, {
            method: "PUT",
            body: JSON.stringify({ available_quantity: updatePayload.available_quantity })
          });
          if (stockRes.ok) {
            console.log(`   ✅ Estoque restaurado com sucesso!`);
          }
        }

        results.push({ itemId, sku, action: fixes.join("; "), success: false, error: errMsg });
      } else {
        console.log(`   ✅ Correção aplicada com sucesso!`);
        if (updatePayload.category_id) categoryFixes++;
        if (updatePayload.attributes?.some((a: any) => a.id === "WITH_GEMSTONE")) attributeFixes++;
        results.push({ itemId, sku, action: fixes.join("; "), success: true });
      }

      // Reactivate if paused
      if (status === "paused") {
        const activateRes = await fetchMeli(`/items/${itemId}`, {
          method: "PUT",
          body: JSON.stringify({ status: "active" })
        });
        if (activateRes.ok) {
          console.log(`   ✅ Anúncio reativado!`);
        } else {
          console.log(`   ⚠️ Não foi possível reativar (pode precisar de correção manual)`);
        }
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 500));
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
  console.log(`Categorias corrigidas (Colares): ${categoryFixes}`);
  console.log(`Atributos adicionados (WITH_GEMSTONE etc): ${attributeFixes}`);
  console.log(`Estoques restaurados (0→1): ${stockFixes}`);
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
