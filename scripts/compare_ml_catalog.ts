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
import { getDBProducts, getDeletedIdentifiers } from "../src/utils/productStorage";

async function compareCatalog() {
  console.log("=== COMPARING MERCADO LIVRE ACCOUNT vs LOCAL SYSTEM ===\n");

  const tokens = await getTokens();
  const userId = tokens.mercadolivre.userId;
  console.log("Seller User ID:", userId);

  // 1. Fetch ALL items from ML (paginated)
  const allMlItemIds: string[] = [];
  let offset = 0;
  const limit = 100;
  let totalMlItems = 0;

  while (true) {
    const res = await fetchMeli(`/users/${userId}/items/search?limit=${limit}&offset=${offset}`);
    if (!res.ok) {
      console.error("Failed to search ML items:", await res.text());
      break;
    }
    const data = await res.json();
    totalMlItems = data.paging?.total || 0;
    const results: string[] = data.results || [];
    allMlItemIds.push(...results);

    offset += limit;
    if (offset >= totalMlItems || results.length === 0) break;
  }

  console.log(`Total active/listed items returned by Mercado Livre search: ${totalMlItems}`);
  console.log(`Total item IDs collected: ${allMlItemIds.length}`);

  // 2. Fetch details for all ML items in batches of 20
  const mlItemsDetail: any[] = [];
  const batchSize = 20;
  for (let i = 0; i < allMlItemIds.length; i += batchSize) {
    const batch = allMlItemIds.slice(i, i + batchSize).join(",");
    const detailRes = await fetchMeli(`/items?ids=${batch}`);
    if (detailRes.ok) {
      const detailData = await detailRes.json();
      mlItemsDetail.push(...detailData);
    }
  }

  // 3. Get system DB products and deleted set
  const dbProducts = await getDBProducts();
  const deletedSet = await getDeletedIdentifiers();

  console.log(`\nSystem DBProducts count: ${dbProducts.length}`);
  console.log(`Deleted set size: ${deletedSet.size}`);

  const dbMlItemIds = new Set(dbProducts.map(p => p.mlItemId).filter(Boolean));
  const dbSkus = new Set(dbProducts.map(p => p.sku).filter(Boolean));

  // 4. Compare ML items against system DB
  const missingFromSystem: any[] = [];
  const deletedInSystem: any[] = [];
  const presentInSystem: any[] = [];

  for (const itemWrapper of mlItemsDetail) {
    const item = itemWrapper.body;
    if (!item) continue;

    const mlId = item.id;
    const skuAttr = (item.attributes || []).find((a: any) => a.id === "SELLER_SKU");
    const sku = skuAttr ? skuAttr.value_name : "";
    const title = item.title;
    const status = item.status;

    const isDeleted = deletedSet.has(mlId) || (sku && deletedSet.has(sku));
    const isPresent = dbMlItemIds.has(mlId) || (sku && dbSkus.has(sku));

    if (isPresent) {
      presentInSystem.push({ id: mlId, sku, title, status });
    } else if (isDeleted) {
      deletedInSystem.push({ id: mlId, sku, title, status });
    } else {
      missingFromSystem.push({ id: mlId, sku, title, status });
    }
  }

  console.log(`\n=== COMPARISON RESULTS ===`);
  console.log(`✅ Present in System: ${presentInSystem.length}`);
  console.log(`🗑️ In Deleted/Tombstone Set: ${deletedInSystem.length}`);
  console.log(`❓ Listed in ML but NOT in System Catalog: ${missingFromSystem.length}`);

  if (missingFromSystem.length > 0) {
    console.log(`\nItems on Mercado Livre missing from your system:`);
    missingFromSystem.forEach((item, idx) => {
      console.log(`  ${idx + 1}. [${item.id}] SKU: ${item.sku || 'N/A'} | Status: ${item.status} | Title: "${item.title}"`);
    });
  }

  if (deletedInSystem.length > 0) {
    console.log(`\nItems on Mercado Livre that were previously deleted/hidden in your system:`);
    deletedInSystem.forEach((item, idx) => {
      console.log(`  ${idx + 1}. [${item.id}] SKU: ${item.sku || 'N/A'} | Status: ${item.status} | Title: "${item.title}"`);
    });
  }
}

compareCatalog().catch(console.error);
