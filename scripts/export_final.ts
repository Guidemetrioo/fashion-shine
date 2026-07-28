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

import { sql } from "../src/utils/neonClient";
import { getDeletedIdentifiers } from "../src/utils/productStorage";

async function exportFinal() {
  // 1. Get all Neon DB products (raw, no filtering)
  const allFromNeon = await sql`SELECT * FROM products ORDER BY sku ASC`;
  console.log(`Neon DB rows: ${allFromNeon.length}`);

  // 2. Get the deleted identifiers
  const deletedSet = await getDeletedIdentifiers();
  console.log(`Deleted identifiers count: ${deletedSet.size}`);

  // 3. Get old git products
  const { execSync } = require("child_process");
  let gitProducts: any[] = [];
  try {
    const gitContent = execSync("git show HEAD:products.json", { encoding: "utf8" });
    gitProducts = JSON.parse(gitContent);
    console.log(`Git products.json: ${gitProducts.length} products`);
  } catch (e) {
    console.log("No git products.json");
  }

  // 4. Map Neon products
  const neonProducts = allFromNeon.map((row: any) => ({
    id: row.id,
    name: row.name,
    sku: row.sku,
    basePrice: Number(row.base_price ?? 0),
    shopeeStock: row.shopee_stock ?? 0,
    shopeeSynced: row.shopee_synced ?? false,
    shopeeItemId: row.shopee_item_id ?? undefined,
    mlStock: row.ml_stock ?? 0,
    mlSynced: row.ml_synced ?? false,
    mlItemId: row.ml_item_id ?? undefined,
    totalStock: row.total_stock ?? 0,
    lastSync: row.last_sync ?? "",
    description: row.description ?? undefined,
    imageUrl: row.image_url ?? undefined,
    isChecked: row.is_checked ?? false,
    shopeeIsPreOrder: row.shopee_is_pre_order ?? false,
    shopeeLogistics: row.shopee_logistics ? row.shopee_logistics.split(",") : [],
  }));

  // 5. Merge: Neon products + Git products (avoiding duplicates)
  const mergedMap = new Map<string, any>();
  
  for (const p of neonProducts) {
    mergedMap.set(p.id, p);
  }

  for (const p of gitProducts) {
    if (!mergedMap.has(p.id)) {
      const isDuplicate = Array.from(mergedMap.values()).some(
        (mp: any) => mp.sku === p.sku || (mp.mlItemId && p.mlItemId && mp.mlItemId === p.mlItemId)
      );
      if (!isDuplicate) {
        mergedMap.set(p.id, p);
      }
    }
  }

  // 6. Filter out deleted products (same logic as getDBProducts)
  const finalProducts: any[] = [];
  let filteredOut = 0;
  
  for (const [id, p] of mergedMap) {
    const isDeleted = 
      deletedSet.has(p.id) || 
      deletedSet.has(p.sku) || 
      (p.mlItemId && deletedSet.has(p.mlItemId)) ||
      (p.shopeeItemId && deletedSet.has(p.shopeeItemId));
    
    if (isDeleted) {
      filteredOut++;
      console.log(`  FILTERED: ${p.sku} (${p.id})`);
    } else {
      finalProducts.push(p);
    }
  }

  console.log(`\nFiltered out: ${filteredOut}`);
  console.log(`Final count: ${finalProducts.length}`);
  
  const fsJoiaCount = finalProducts.filter((p: any) => p.sku?.startsWith("FS-JOIA")).length;
  const oldCount = finalProducts.filter((p: any) => !p.sku?.startsWith("FS-JOIA")).length;
  console.log(`  FS-JOIA: ${fsJoiaCount}`);
  console.log(`  Old/other: ${oldCount}`);

  // Write final products.json
  fs.writeFileSync(
    path.join(process.cwd(), "products.json"),
    JSON.stringify(finalProducts, null, 2),
    "utf8"
  );
  console.log("\n✅ products.json updated with final merged list!");
}

exportFinal().catch(console.error);
