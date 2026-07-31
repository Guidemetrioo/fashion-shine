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

async function exportAll() {
  // Get ALL products from Neon DB - no filtering by deleted set
  const allFromNeon = await sql`SELECT * FROM products ORDER BY sku ASC`;
  console.log(`Raw Neon DB has: ${allFromNeon.length} rows`);

  // Read existing git products.json (the 19 old ones that Vercel uses)
  const existingFile = path.join(process.cwd(), "products.json");
  
  // We need to get those 19 old products from the git version
  // Let's read from git directly
  const { execSync } = require("child_process");
  let gitProducts: any[] = [];
  try {
    const gitContent = execSync("git show HEAD:products.json", { encoding: "utf8" });
    gitProducts = JSON.parse(gitContent);
    console.log(`Git products.json has: ${gitProducts.length} products`);
  } catch (e) {
    console.log("Could not read products.json from git");
  }

  // Map Neon products to DBProduct format
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

  // Merge: Neon products + old git products that aren't in Neon
  const mergedMap = new Map<string, any>();
  
  // Add all Neon products
  for (const p of neonProducts) {
    mergedMap.set(p.id, p);
  }

  // Add old git products that aren't already in the map (by id, sku, or mlItemId)
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

  const finalProducts = Array.from(mergedMap.values());
  
  // Write to products.json
  fs.writeFileSync(existingFile, JSON.stringify(finalProducts, null, 2), "utf8");
  
  const fsJoiaCount = finalProducts.filter((p: any) => p.sku?.startsWith("FS-JOIA")).length;
  const oldCount = finalProducts.filter((p: any) => !p.sku?.startsWith("FS-JOIA")).length;
  console.log(`\nFinal products.json: ${finalProducts.length} products`);
  console.log(`  FS-JOIA products: ${fsJoiaCount}`);
  console.log(`  Old/other products: ${oldCount}`);
}

exportAll().catch(console.error);
