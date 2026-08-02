import fs from "fs";
import path from "path";

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
import { getDBProducts, saveDBProducts, DBProduct } from "../src/utils/productStorage";

const isDryRun = process.argv.includes("--dry-run");

async function cleanDuplicates() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`🧹 LIMPEZA E ALINHAMENTO DO MERCADO LIVRE ${isDryRun ? "[MODO SIMULAÇÃO]" : "[MODO EXECUÇÃO REAL]"}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  const tokens = await getTokens();
  if (!tokens.mercadolivre.connected || !tokens.mercadolivre.accessToken) {
    throw new Error("Mercado Livre não conectado!");
  }

  const userId = tokens.mercadolivre.userId || "3145268548";
  const catalogProducts: DBProduct[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), "products.json"), "utf8"));
  console.log(`📦 Produtos no catálogo local: ${catalogProducts.length}`);

  // Create lookup by SKU
  const catalogBySku = new Map<string, DBProduct>();
  for (const p of catalogProducts) {
    if (p.sku) catalogBySku.set(p.sku.toUpperCase(), p);
  }

  // 1. Fetch all items from ML account
  console.log("\n📋 Buscando todos os anúncios da conta no Mercado Livre...");
  let allItemIds: string[] = [];
  const firstRes = await fetchMeli(`/users/${userId}/items/search?search_type=scan&limit=100`);
  if (!firstRes.ok) throw new Error("Falha ao buscar anúncios do ML");
  const firstData = await firstRes.json();
  allItemIds = firstData.results || [];
  let scrollId = firstData.scroll_id;

  while (scrollId && allItemIds.length < (firstData.paging?.total || 0)) {
    const res = await fetchMeli(`/users/${userId}/items/search?search_type=scan&limit=100&scroll_id=${scrollId}`);
    const d = await res.json();
    if (!d.results || d.results.length === 0) break;
    allItemIds.push(...d.results);
    scrollId = d.scroll_id;
  }

  console.log(`✅ Total de anúncios encontrados no ML: ${allItemIds.length}`);

  // 2. Fetch details for all items in chunks of 20
  console.log("\n📦 Carregando detalhes dos anúncios...");
  const itemDetails: any[] = [];
  for (let i = 0; i < allItemIds.length; i += 20) {
    const chunk = allItemIds.slice(i, i + 20);
    const mRes = await fetchMeli(`/items?ids=${chunk.join(",")}`);
    if (mRes.ok) {
      const mData = await mRes.json();
      if (Array.isArray(mData)) {
        for (const item of mData) {
          if (item.body && item.body.id) {
            itemDetails.push(item.body);
          }
        }
      }
    }
  }

  console.log(`✅ Detalhes carregados: ${itemDetails.length} anúncios`);

  // Group ML items by SKU
  const itemsBySku = new Map<string, any[]>();
  const orphanItems: any[] = [];

  for (const item of itemDetails) {
    const skuAttr = (item.attributes || []).find((a: any) => a.id === "SELLER_SKU");
    let sku = skuAttr?.value_name ? skuAttr.value_name.toUpperCase() : "";

    if (!sku) {
      // Try to find matching catalog SKU by title
      for (const [catSku, p] of catalogBySku.entries()) {
        if (item.title && item.title.toUpperCase().includes(catSku.replace("FS-", "").replace(/_/g, " "))) {
          sku = catSku;
          break;
        }
      }
    }

    if (sku && catalogBySku.has(sku)) {
      if (!itemsBySku.has(sku)) itemsBySku.set(sku, []);
      itemsBySku.get(sku)!.push(item);
    } else {
      orphanItems.push(item);
    }
  }

  console.log(`\n🔍 Análise por SKU:`);
  console.log(`   • SKUs do catálogo encontrados no ML: ${itemsBySku.size}`);
  console.log(`   • Anúncios sem SKU do catálogo (órfãos): ${orphanItems.length}`);

  let kept = 0;
  let closed = 0;
  let errors = 0;

  // Process each catalog SKU
  for (const [sku, items] of itemsBySku.entries()) {
    // Sort items: priority to 'active' status, correct category, then highest ID (newest)
    items.sort((a, b) => {
      if (a.status === "active" && b.status !== "active") return -1;
      if (b.status === "active" && a.status !== "active") return 1;
      if (a.category_id !== "MLB1440" && b.category_id === "MLB1440") return -1;
      if (b.category_id !== "MLB1440" && a.category_id === "MLB1440") return 1;
      return b.id.localeCompare(a.id);
    });

    const bestItem = items[0];
    const duplicates = items.slice(1);

    // Keep best item
    kept++;
    const product = catalogBySku.get(sku);
    if (product) {
      product.mlItemId = bestItem.id;
      product.mlSynced = true;
      product.mlStock = bestItem.available_quantity || 1;
      product.totalStock = bestItem.available_quantity || 1;
    }

    // Close all duplicates
    for (const dup of duplicates) {
      if (isDryRun) {
        console.log(`   [DRY-RUN] Fecharia duplicata: ${dup.id} (${dup.status}) - ${sku}`);
        closed++;
      } else {
        try {
          const res = await fetchMeli(`/items/${dup.id}`, {
            method: "PUT",
            body: JSON.stringify({ status: "closed" })
          });
          if (res.ok) {
            console.log(`   ✅ Fechada duplicata: ${dup.id} (${dup.status}) - ${sku}`);
            closed++;
          } else {
            // Try setting deleted: true
            const delRes = await fetchMeli(`/items/${dup.id}`, {
              method: "PUT",
              body: JSON.stringify({ deleted: true })
            });
            if (delRes.ok) {
              console.log(`   ✅ Excluída duplicata: ${dup.id} - ${sku}`);
              closed++;
            } else {
              console.log(`   ⚠️ Não conseguiu fechar duplicata ${dup.id} (${dup.status})`);
              errors++;
            }
          }
          await new Promise(r => setTimeout(r, 300));
        } catch (e: any) {
          console.log(`   ❌ Erro em ${dup.id}: ${e.message}`);
          errors++;
        }
      }
    }
  }

  // Close orphan items
  for (const orphan of orphanItems) {
    if (isDryRun) {
      console.log(`   [DRY-RUN] Fecharia órfão: ${orphan.id} (${orphan.status}) - ${orphan.title?.slice(0, 30)}`);
      closed++;
    } else {
      try {
        const res = await fetchMeli(`/items/${orphan.id}`, {
          method: "PUT",
          body: JSON.stringify({ status: "closed" })
        });
        if (res.ok) {
          console.log(`   ✅ Fechado órfão: ${orphan.id}`);
          closed++;
        } else {
          errors++;
        }
        await new Promise(r => setTimeout(r, 300));
      } catch {
        errors++;
      }
    }
  }

  if (!isDryRun) {
    // Save updated products.json
    fs.writeFileSync(path.join(process.cwd(), "products.json"), JSON.stringify(catalogProducts, null, 2));
    try {
      await saveDBProducts(catalogProducts);
      console.log(`\n💾 Banco de dados local e Neon DB atualizados com os anúncios ativos de cada produto.`);
    } catch {
      console.log(`\n💾 products.json atualizado.`);
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("📊 RELATÓRIO FINAL DE LIMPEZA DO MERCADO LIVRE");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`   • Anúncios ativos mantidos (1 por SKU): ${kept}`);
  console.log(`   • Duplicatas/Órfãos fechados: ${closed}`);
  console.log(`   • Falhas: ${errors}`);
  console.log("═══════════════════════════════════════════════════════════\n");
}

cleanDuplicates().catch(e => {
  console.error("Erro na limpeza:", e);
  process.exit(1);
});
