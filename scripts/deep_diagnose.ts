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

import { sql, isNeonConfigured } from "../src/utils/neonClient";

async function deepDiagnose() {
  console.log("=== DEEP DIAGNOSIS ===\n");
  console.log("isNeonConfigured:", isNeonConfigured());
  
  // 1. How many rows in products table?
  const countResult = await sql`SELECT COUNT(*) as count FROM products`;
  console.log("1. Total rows in 'products' table:", countResult[0].count);

  // 2. How many rows in deleted_products table?
  const deletedCount = await sql`SELECT COUNT(*) as count FROM deleted_products`;
  console.log("2. Total rows in 'deleted_products' table:", deletedCount[0].count);

  // 3. Build the deletedSet exactly as getDeletedIdentifiers() does
  const deletedSet = new Set<string>();
  
  // From local file
  const DELETED_PRODUCTS_FILE = path.join(process.cwd(), "deleted_products.json");
  try {
    if (fs.existsSync(DELETED_PRODUCTS_FILE)) {
      const data = JSON.parse(fs.readFileSync(DELETED_PRODUCTS_FILE, "utf8"));
      if (Array.isArray(data)) {
        data.forEach((id: string) => deletedSet.add(String(id)));
      }
      console.log("3a. Local deleted_products.json entries:", data.length);
    } else {
      console.log("3a. No local deleted_products.json found");
    }
  } catch (e) {
    console.log("3a. Error reading deleted_products.json:", e);
  }

  // From Neon DB
  const rows = await sql`SELECT identifier, sku, ml_item_id, shopee_item_id FROM deleted_products`;
  for (const r of rows) {
    if (r.identifier) deletedSet.add(String(r.identifier));
    if (r.sku) deletedSet.add(String(r.sku));
    if (r.ml_item_id) deletedSet.add(String(r.ml_item_id));
    if (r.shopee_item_id) deletedSet.add(String(r.shopee_item_id));
  }
  console.log("3b. Total entries in deletedSet (after merging local+neon):", deletedSet.size);

  // 4. Now load ALL products from Neon and check which ones get filtered out
  const allProducts = await sql`SELECT id, name, sku, ml_item_id, shopee_item_id, ml_stock, total_stock FROM products ORDER BY sku ASC`;
  console.log("\n4. Checking each product against deletedSet:");
  
  let keptCount = 0;
  let filteredCount = 0;
  const filteredProducts: any[] = [];
  const keptProducts: any[] = [];

  for (const p of allProducts) {
    const isFilteredById = deletedSet.has(p.id);
    const isFilteredBySku = deletedSet.has(p.sku);
    const isFilteredByMlId = p.ml_item_id && deletedSet.has(p.ml_item_id);
    const isFilteredByShopeeId = p.shopee_item_id && deletedSet.has(p.shopee_item_id);
    
    const isFiltered = isFilteredById || isFilteredBySku || isFilteredByMlId || isFilteredByShopeeId;
    
    if (isFiltered) {
      filteredCount++;
      filteredProducts.push({
        sku: p.sku,
        id: p.id,
        ml_item_id: p.ml_item_id,
        reason: [
          isFilteredById ? `id '${p.id}' in deletedSet` : null,
          isFilteredBySku ? `sku '${p.sku}' in deletedSet` : null,
          isFilteredByMlId ? `ml_item_id '${p.ml_item_id}' in deletedSet` : null,
          isFilteredByShopeeId ? `shopee_item_id '${p.shopee_item_id}' in deletedSet` : null,
        ].filter(Boolean).join(", ")
      });
    } else {
      keptCount++;
      keptProducts.push({ sku: p.sku, name: p.name });
    }
  }

  console.log(`\n   KEPT: ${keptCount} products`);
  console.log(`   FILTERED OUT: ${filteredCount} products`);

  if (filteredProducts.length > 0) {
    console.log("\n5. FILTERED OUT products (these are HIDDEN from inventory):");
    for (const fp of filteredProducts) {
      console.log(`   ❌ SKU: ${fp.sku} | ID: ${fp.id} | ML: ${fp.ml_item_id} | Reason: ${fp.reason}`);
    }
  }

  console.log("\n6. KEPT products (these SHOW in inventory):");
  for (const kp of keptProducts) {
    console.log(`   ✅ ${kp.sku}: ${kp.name}`);
  }

  // 7. Now check: which deleted_products entries match FS-JOIA products?
  console.log("\n7. Checking if any deleted_products SKUs match FS-JOIA products:");
  const fsJoiaSkus = allProducts.filter((p: any) => p.sku.startsWith("FS-JOIA")).map((p: any) => p.sku);
  for (const sku of fsJoiaSkus) {
    if (deletedSet.has(sku)) {
      console.log(`   ⚠️ FS-JOIA product SKU '${sku}' is in deletedSet!`);
    }
  }

  // 8. Check what's on the original 19 products
  console.log("\n8. Products NOT starting with FS-JOIA or prod-ml-:");
  const otherProducts = allProducts.filter((p: any) => !p.sku.startsWith("FS-JOIA"));
  for (const p of otherProducts) {
    const filtered = deletedSet.has(p.id) || deletedSet.has(p.sku) || (p.ml_item_id && deletedSet.has(p.ml_item_id));
    console.log(`   ${filtered ? '❌' : '✅'} SKU: ${p.sku} | ID: ${p.id} | ML: ${p.ml_item_id}`);
  }
}

deepDiagnose().catch(console.error);
