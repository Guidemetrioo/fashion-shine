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
import { getDBProducts, saveDBProducts, DBProduct } from "../src/utils/productStorage";

// ─── CORRECT CATEGORY MAPPING ──────────────────────────────────────────────────
function getCorrectCategoryBySku(sku: string): { categoryId: string; categoryName: string } {
  const upperSku = sku.toUpperCase();
  if (upperSku.includes("BRINCO")) return { categoryId: "MLB1432", categoryName: "Brincos" };
  if (upperSku.includes("COLAR")) return { categoryId: "MLB457383", categoryName: "Colares" };
  if (upperSku.includes("PULSEIRA")) return { categoryId: "MLB1434", categoryName: "Pulseiras" };
  if (upperSku.includes("OCULOS")) return { categoryId: "MLB8378", categoryName: "Óculos de Sol" };
  return { categoryId: "MLB1440", categoryName: "Joias - Outros" };
}

function buildAttributes(sku: string, categoryId: string): any[] {
  const attrs: any[] = [
    { id: "BRAND", value_name: "Fashion Shine" },
    { id: "MODEL", value_name: sku },
    { id: "SELLER_SKU", value_name: sku },
    { id: "SALE_FORMAT", value_id: "1359391" },  // "Unidade"
    { id: "UNITS_PER_PACK", value_name: "1" },
    { id: "EMPTY_GTIN_REASON", value_name: "O produto não tem código cadastrado" },
  ];

  const upperSku = sku.toUpperCase();

  if (upperSku.includes("OCULOS")) {
    attrs.push({ id: "MATERIAL", value_name: "Acetato / Metal" });
    attrs.push({ id: "GENDER", value_name: "Sem gênero" });
  } else {
    attrs.push({ id: "MATERIAL", value_name: "Banhado a Ouro 18k" });
  }

  // WITH_GEMSTONE is required for Brincos (MLB1432)
  if (categoryId === "MLB1432") {
    attrs.push({ id: "WITH_GEMSTONE", value_name: "Não" });
  }

  // NECKLACE_STYLES and GENDER are required for Colares (MLB457383)
  if (categoryId === "MLB457383") {
    attrs.push({ id: "NECKLACE_STYLES", value_name: "Moderno" });
    attrs.push({ id: "GENDER", value_name: "Feminino" });
  }

  // GENDER is required for Óculos (MLB8378) - already added above

  return attrs;
}

async function republishAllItems() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const limitArgIdx = args.indexOf("--limit");
  const limit = limitArgIdx >= 0 ? parseInt(args[limitArgIdx + 1], 10) : 0;

  console.log("═══════════════════════════════════════════════════════════");
  console.log("🔄 REPUBLICAÇÃO DE ANÚNCIOS (FECHAR + RECRIAR)");
  console.log(`   Modo: ${isDryRun ? "DRY-RUN" : "⚡ EXECUÇÃO REAL ⚡"}`);
  console.log(`   Limite: ${limit > 0 ? limit : "Sem limite (todos)"}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  const tokens = await getTokens();
  if (!tokens.mercadolivre.connected || !tokens.mercadolivre.accessToken) {
    throw new Error("❌ Mercado Livre não está conectado!");
  }

  // 1. Fetch all current items
  console.log("📋 Buscando todos os itens da conta...");
  const allItemIds: string[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const searchRes = await fetchMeli(`/users/${tokens.mercadolivre.userId}/items/search?limit=100&offset=${offset}`);
    if (!searchRes.ok) break;
    const searchData = await searchRes.json();
    const batchIds: string[] = searchData.results || [];
    allItemIds.push(...batchIds);
    const total = searchData.paging?.total || 0;
    offset += 100;
    hasMore = offset < total && batchIds.length > 0;
  }

  console.log(`✅ Total de itens: ${allItemIds.length}\n`);

  // 2. Fetch details
  console.log("📦 Buscando detalhes...");
  const allItems: any[] = [];
  for (let i = 0; i < allItemIds.length; i += 20) {
    const batchIds = allItemIds.slice(i, i + 20).join(",");
    const detailRes = await fetchMeli(`/items?ids=${batchIds}`);
    if (detailRes.ok) {
      const data = await detailRes.json();
      allItems.push(...data);
    }
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`✅ Detalhes: ${allItems.length} itens\n`);

  // Filter items that need republishing (under_review or inactive or wrong category)
  const itemsToRepublish = allItems.filter(resItem => {
    const item = resItem.body;
    if (!item) return false;
    const status = item.status;
    return status === "under_review" || status === "inactive";
  });

  console.log(`🔄 Itens a republicar: ${itemsToRepublish.length}\n`);

  const dbProducts = await getDBProducts();
  let republished = 0;
  let closed = 0;
  let errors = 0;
  let processed = 0;

  for (const resItem of itemsToRepublish) {
    if (limit > 0 && processed >= limit) {
      console.log(`\n🛑 Limite de ${limit} atingido.`);
      break;
    }

    const item = resItem.body;
    const oldItemId = item.id;
    const title = item.title;
    const price = item.price;
    const pictures = (item.pictures || []).map((p: any) => ({ id: p.id }));
    const description = item.descriptions?.[0]?.plain_text || "";
    const attributes = item.attributes || [];

    // Extract SKU
    const skuAttr = attributes.find((a: any) => a.id === "SELLER_SKU");
    const sku = skuAttr?.value_name || "";

    if (!sku) {
      console.log(`⚠️ Item ${oldItemId} sem SKU, pulando.`);
      continue;
    }

    const { categoryId: correctCategory, categoryName } = getCorrectCategoryBySku(sku);
    const correctAttrs = buildAttributes(sku, correctCategory);

    console.log(`\n────────────────────────────────────────`);
    console.log(`[${processed + 1}] ${oldItemId} | SKU: ${sku} | Status: ${item.status}`);
    console.log(`   Título: ${title}`);
    console.log(`   Categoria: ${item.category_id} → ${correctCategory} (${categoryName})`);
    console.log(`   Fotos: ${pictures.length}`);

    processed++;

    if (isDryRun) {
      console.log(`   [DRY-RUN] Seria fechado e recriado.`);
      republished++;
      continue;
    }

    try {
      // Step 1: Close the old item
      console.log(`   🔴 Fechando anúncio antigo ${oldItemId}...`);
      const closeRes = await fetchMeli(`/items/${oldItemId}`, {
        method: "PUT",
        body: JSON.stringify({ status: "closed" })
      });
      if (closeRes.ok) {
        console.log(`   ✅ Anúncio fechado.`);
        closed++;
      } else {
        const closeErr = await closeRes.json();
        console.log(`   ⚠️ Não conseguiu fechar: ${closeErr.message || JSON.stringify(closeErr)}`);
        console.log(`   ⏩ Continuando com a criação do novo anúncio mesmo assim...`);
      }

      await new Promise(r => setTimeout(r, 500));

      // Step 2: Fetch the description separately (multi-get doesn't include it)
      let itemDescription = "";
      try {
        const descRes = await fetchMeli(`/items/${oldItemId}/description`);
        if (descRes.ok) {
          const descData = await descRes.json();
          itemDescription = descData.plain_text || descData.text || "";
        }
      } catch {}

      // Step 3: Create new item with correct category and attributes
      console.log(`   🟢 Criando novo anúncio com categoria ${correctCategory}...`);
      const newPayload: any = {
        family_name: title,
        category_id: correctCategory,
        price: price,
        currency_id: "BRL",
        available_quantity: 1,
        buying_mode: "buy_it_now",
        listing_type_id: "gold_special",
        condition: "new",
        pictures: pictures,
        attributes: correctAttrs,
      };

      if (itemDescription) {
        newPayload.description = { plain_text: itemDescription };
      }

      console.log(`   📋 Payload: ${JSON.stringify({ category_id: newPayload.category_id, title: newPayload.title, attrs: correctAttrs.map((a: any) => a.id).join(',') })}`);

      const createRes = await fetchMeli("/items", {
        method: "POST",
        body: JSON.stringify(newPayload)
      });

      if (createRes.ok) {
        const newData = await createRes.json();
        const newItemId = newData.id;
        console.log(`   ✅ Novo anúncio criado: ${newItemId}`);
        console.log(`   🔗 ${newData.permalink}`);

        // Update local DB
        const dbProduct = dbProducts.find(p => p.sku === sku || p.mlItemId === oldItemId);
        if (dbProduct) {
          dbProduct.mlItemId = newItemId;
          dbProduct.mlSynced = true;
          dbProduct.mlStock = 1;
          dbProduct.totalStock = 1;
          dbProduct.lastSync = new Date().toLocaleTimeString("pt-BR");
        }

        republished++;
      } else {
        const errData = await createRes.json();
        console.log(`   ❌ Erro ao criar: ${JSON.stringify(errData, null, 2).slice(0, 500)}`);
        errors++;
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 800));
    } catch (err: any) {
      console.log(`   ❌ Erro: ${err.message}`);
      errors++;
    }
  }

  // Save updated DB
  if (!isDryRun && republished > 0) {
    await saveDBProducts(dbProducts);
    console.log(`\n💾 Banco local atualizado com os novos IDs.`);
  }

  // Summary
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("📊 RELATÓRIO DE REPUBLICAÇÃO");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`Total processados: ${processed}`);
  console.log(`Anúncios fechados: ${closed}`);
  console.log(`Anúncios republicados: ${republished}`);
  console.log(`Erros: ${errors}`);
  console.log("═══════════════════════════════════════════════════════════");
}

republishAllItems().catch(err => {
  console.error("❌ Erro fatal:", err);
  process.exit(1);
});
