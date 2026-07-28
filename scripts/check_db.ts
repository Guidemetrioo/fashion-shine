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
import { getDBProducts } from "../src/utils/productStorage";

async function checkDb() {
  console.log("isNeonConfigured:", isNeonConfigured());

  // Count products in Neon
  const countResult = await sql`SELECT COUNT(*) as count FROM products`;
  console.log("Neon DB product count:", countResult);

  // Get sample products
  const sample = await sql`SELECT id, name, sku, ml_stock, total_stock, ml_item_id FROM products LIMIT 5`;
  console.log("Sample products from Neon:");
  for (const row of sample) {
    console.log(`  - ${row.sku}: ${row.name} | ml_stock=${row.ml_stock} | total_stock=${row.total_stock} | ml_item_id=${row.ml_item_id}`);
  }

  // Check getDBProducts (this is what the API endpoint calls)
  const dbProducts = await getDBProducts();
  console.log("\ngetDBProducts() returned:", dbProducts.length, "products");
  if (dbProducts.length > 0) {
    console.log("First 3 products from getDBProducts:");
    for (const p of dbProducts.slice(0, 3)) {
      console.log(`  - ${p.sku}: ${p.name} | mlStock=${p.mlStock} | totalStock=${p.totalStock} | mlSynced=${p.mlSynced}`);
    }
  }

  // Check deleted_products too
  const deleted = await sql`SELECT COUNT(*) as count FROM deleted_products`;
  console.log("\nDeleted products count:", deleted);
}

checkDb().catch(console.error);
