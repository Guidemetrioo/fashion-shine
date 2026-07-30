import fs from "fs";
import path from "path";

// 1. Carregar variáveis de ambiente do .env.local
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

function isUnifiedSku(sku: string = "") {
  const upper = sku.toUpperCase();
  return upper.startsWith("FS-BRINCO_") || 
         upper.startsWith("FS-COLARE_") || 
         upper.startsWith("FS-PULSEIRA_") || 
         upper.startsWith("FS-OCULOS_");
}

async function fetchAllUserMeliItemIds(userId: string): Promise<string[]> {
  let itemIds: string[] = [];
  let scrollId: string | null = null;
  let hasMore = true;
  let offset = 0;
  const limit = 50;

  console.log(`🔎 Buscando todos os anúncios da conta Mercado Livre (User ID: ${userId})...`);

  while (hasMore) {
    let url = `/users/${userId}/items/search?limit=${limit}&offset=${offset}`;
    if (scrollId) {
      url += `&scroll_id=${scrollId}`;
    }

    const res = await fetchMeli(url);
    if (!res.ok) {
      const errTxt = await res.text();
      console.error(`❌ Erro ao buscar anúncios (offset ${offset}): ${errTxt}`);
      break;
    }

    const data = await res.json();
    const results: string[] = data.results || [];
    const total = data.paging?.total || 0;
    scrollId = data.scroll_id || null;

    if (results.length === 0) {
      hasMore = false;
    } else {
      itemIds.push(...results);
      offset += results.length;
      console.log(`  └─ Coletados ${itemIds.length} / ${total} anúncios...`);

      if (itemIds.length >= total) {
        hasMore = false;
      }
    }

    await new Promise(r => setTimeout(r, 150));
  }

  return itemIds;
}

async function cleanAccountAndSyncOfficialCatalog() {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes("--close");

  console.log("=================================================");
  console.log("🧹 SINCRONIZAÇÃO E EXPURGO TOTAL NO MERCADO LIVRE");
  console.log(`Modo: ${isDryRun ? 'DRY-RUN (Simulação)' : 'EXECUÇÃO REAL (--close)'}`);
  console.log("=================================================\n");

  const tokens = await getTokens();
  if (!tokens.mercadolivre.connected || !tokens.mercadolivre.userId) {
    throw new Error("❌ Mercado Livre não conectado ou User ID ausente em tokens.json!");
  }

  const userId = tokens.mercadolivre.userId;

  // 1. Carrega produtos atuais da base local
  const currentProducts = await getDBProducts();
  
  // Filtra estritamente os 246 produtos unificados oficiais
  const officialUnifiedProducts = currentProducts.filter(p => isUnifiedSku(p.sku));
  const oldLocalProducts = currentProducts.filter(p => !isUnifiedSku(p.sku));

  const officialMlIds = new Set<string>();
  for (const p of officialUnifiedProducts) {
    if (p.mlItemId) {
      officialMlIds.add(p.mlItemId);
    }
  }

  console.log(`📦 Produtos Unificados Oficiais no Sistema: ${officialUnifiedProducts.length} (${officialMlIds.size} com ID do ML)`);
  console.log(`📦 Produtos Legados/Antigos no Sistema para Remover: ${oldLocalProducts.length}\n`);

  // 2. Busca TODOS os anúncios na conta do Mercado Livre
  const allMeliItemIds = await fetchAllUserMeliItemIds(userId);
  console.log(`\n📊 Total de anúncios existentes na sua conta do Mercado Livre: ${allMeliItemIds.length}`);

  // 3. Identifica quais manter (os 246 oficiais) e quais fechar no ML
  const itemsToKeep: string[] = [];
  const itemsToClose: string[] = [];

  for (const mlId of allMeliItemIds) {
    if (officialMlIds.has(mlId)) {
      itemsToKeep.push(mlId);
    } else {
      itemsToClose.push(mlId);
    }
  }

  console.log(`\n---------------- DIAGNÓSTICO DA CONTA ----------------`);
  console.log(`✅ Anúncios Mantidos no Mercado Livre (Oficiais 246): ${itemsToKeep.length}`);
  console.log(`❌ Anúncios a Encerrar no Mercado Livre (Antigos/Duplicados): ${itemsToClose.length}`);
  console.log("------------------------------------------------------\n");

  if (isDryRun) {
    console.log("⚠️ Simulação concluída. Para fechar os anúncios no Mercado Livre e atualizar a base, execute:");
    console.log("   npx tsx scripts/sync_ml_account_items.ts --close\n");
    return;
  }

  // 4. Execução Real: Encerra todos os anúncios antigos/órfãos no Mercado Livre
  console.log(`🚀 Encerrando ${itemsToClose.length} anúncio(s) antigos no Mercado Livre...`);
  let closedSuccess = 0;
  let closedFail = 0;

  for (let i = 0; i < itemsToClose.length; i++) {
    const mlId = itemsToClose[i];
    console.log(`[${i + 1}/${itemsToClose.length}] Fechando anúncio ${mlId}...`);

    try {
      const res = await fetchMeli(`/items/${mlId}`, {
        method: "PUT",
        body: JSON.stringify({ status: "closed" })
      });

      if (res.ok) {
        closedSuccess++;
        console.log(`  └─ ✅ Anúncio ${mlId} encerrado com sucesso.`);
      } else {
        const errData = await res.json().catch(() => ({}));
        console.warn(`  └─ ⚠️ Erro ao fechar ${mlId}: ${JSON.stringify(errData)}`);
        closedFail++;
      }

      await new Promise(r => setTimeout(r, 200));
    } catch (err: any) {
      console.error(`  └─ ❌ Falha na requisição para ${mlId}:`, err.message || err);
      closedFail++;
    }
  }

  // 5. Atualiza o deleted_products.json com o histórico dos antigos
  const deletedPath = path.join(process.cwd(), "deleted_products.json");
  let currentDeleted: DBProduct[] = [];
  if (fs.existsSync(deletedPath)) {
    try {
      currentDeleted = JSON.parse(fs.readFileSync(deletedPath, "utf8"));
    } catch (e) {
      currentDeleted = [];
    }
  }

  const existingDeletedSkus = new Set(currentDeleted.map(p => p.sku));
  for (const p of oldLocalProducts) {
    if (!existingDeletedSkus.has(p.sku)) {
      currentDeleted.push(p);
    }
  }
  fs.writeFileSync(deletedPath, JSON.stringify(currentDeleted, null, 2), "utf8");

  // 6. Sobrescreve products.json com EXATAMENTE os 246 produtos unificados oficiais
  await saveDBProducts(officialUnifiedProducts);
  console.log(`💾 Base local (products.json) atualizada com exatamente ${officialUnifiedProducts.length} produtos unificados oficiais!`);

  console.log("\n=================================================");
  console.log("✅ CONTA DO MERCADO LIVRE E BASE SINCRONIZADAS!");
  console.log(`Anúncios Mantidos no Mercado Livre: ${itemsToKeep.length}`);
  console.log(`Anúncios Encerrados no Mercado Livre: ${closedSuccess}`);
  console.log(`Base local atualizada: ${officialUnifiedProducts.length} produtos.`);
  console.log("=================================================");
}

cleanAccountAndSyncOfficialCatalog().catch(console.error);
