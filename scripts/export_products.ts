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
import { getDBProducts } from "../src/utils/productStorage";

async function exportProducts() {
  // Get ALL products from Neon DB (the full set including FS-JOIA + old ones)
  const allProducts = await getDBProducts();
  console.log(`getDBProducts returned: ${allProducts.length} products`);
  
  // Also get the 19 old products from production that exist in git
  // We need to keep those too since they're real ML listings
  const allFromNeon = await sql`SELECT * FROM products ORDER BY sku ASC`;
  console.log(`Raw Neon DB has: ${allFromNeon.length} rows`);

  // Now also load the existing products.json from git to merge old ones
  const existingFile = path.join(process.cwd(), "products.json");
  let existingProducts: any[] = [];
  try {
    existingProducts = JSON.parse(fs.readFileSync(existingFile, "utf8"));
    console.log(`Existing products.json has: ${existingProducts.length} products`);
  } catch (e) {
    console.log("No existing products.json or couldn't read it");
  }

  // Merge: start with all Neon products, add any from existing that aren't duplicates
  const mergedMap = new Map<string, any>();
  
  // Add all Neon products
  for (const p of allProducts) {
    mergedMap.set(p.id, p);
  }
  
  // Add existing products that don't conflict
  for (const p of existingProducts) {
    if (!mergedMap.has(p.id)) {
      // Check if it's not in the deleted set
      const isDuplicate = Array.from(mergedMap.values()).some(
        (mp: any) => mp.sku === p.sku || mp.mlItemId === p.mlItemId
      );
      if (!isDuplicate) {
        mergedMap.set(p.id, p);
      }
    }
  }

  const finalProducts = Array.from(mergedMap.values());
  console.log(`\nFinal merged products count: ${finalProducts.length}`);
  
  // Write to products.json
  fs.writeFileSync(existingFile, JSON.stringify(finalProducts, null, 2), "utf8");
  console.log(`Written to products.json: ${finalProducts.length} products`);
  
  // Show stats
  const fsJoiaCount = finalProducts.filter((p: any) => p.sku?.startsWith("FS-JOIA")).length;
  const oldCount = finalProducts.filter((p: any) => !p.sku?.startsWith("FS-JOIA")).length;
  console.log(`  FS-JOIA products: ${fsJoiaCount}`);
  console.log(`  Old/other products: ${oldCount}`);
}

exportProducts().catch(console.error);
