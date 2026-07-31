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

async function main() {
  // Check deleted identifiers from Neon
  const rows = await sql`SELECT identifier, sku, ml_item_id FROM deleted_products`;
  console.log("=== Deleted products in Neon DB ===");
  for (const r of rows) {
    console.log(`  identifier=${r.identifier} | sku=${r.sku} | ml_item_id=${r.ml_item_id}`);
  }

  // Check the full merged set from getDeletedIdentifiers
  const deletedSet = await getDeletedIdentifiers();
  console.log(`\n=== getDeletedIdentifiers() set size: ${deletedSet.size} ===`);
  const arr = Array.from(deletedSet);
  for (const id of arr) {
    console.log(`  ${id}`);
  }

  // Check if any of the FS-JOIA products match the deleted set
  const allProducts = await sql`SELECT sku, id, ml_item_id FROM products WHERE sku LIKE 'FS-JOIA-%'`;
  let blockedCount = 0;
  for (const p of allProducts) {
    const isBlocked =
      deletedSet.has(p.id) ||
      deletedSet.has(p.sku) ||
      (p.ml_item_id && deletedSet.has(p.ml_item_id));
    if (isBlocked) {
      blockedCount++;
      console.log(`  BLOCKED: ${p.sku} (id=${p.id}, ml_item_id=${p.ml_item_id})`);
    }
  }
  console.log(`\nTotal FS-JOIA products in DB: ${allProducts.length}`);
  console.log(`Blocked by deleted_products: ${blockedCount}`);
  console.log(`Will show in stock: ${allProducts.length - blockedCount}`);
}

main().catch(console.error);
