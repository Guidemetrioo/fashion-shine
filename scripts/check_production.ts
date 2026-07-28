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

async function checkProduction() {
  // The 19 product IDs returned by production API
  const productionIds = [
    "prod-ml-MLB4447182649", "prod-ml-MLB6248894636", "prod-ml-MLB4472131465",
    "prod-ml-MLB4472060395", "prod-ml-MLB4472040943", "prod-ml-MLB6244406782",
    "prod-ml-MLB4471541247", "prod-ml-MLB4470495681", "prod-ml-MLB4470728681",
    "prod-ml-MLB4471787331", "prod-ml-MLB4470586183", "prod-ml-MLB4470741605",
    "prod-ml-MLB4471631815", "prod-ml-MLB4470586173", "prod-ml-MLB4471554295",
    "prod-ml-MLB4472060383", "prod-ml-MLB4471930695", "prod-ml-MLB4472202867",
    "prod-ml-MLB4470637973"
  ];

  console.log("=== PRODUCTION vs LOCAL COMPARISON ===\n");

  // Check if these 19 IDs exist in our Neon DB
  const allProducts = await sql`SELECT id, sku, name FROM products ORDER BY sku ASC`;
  console.log(`Total products in Neon DB: ${allProducts.length}`);

  // Check which of the 19 production IDs exist in DB
  let foundInDb = 0;
  for (const pid of productionIds) {
    const found = allProducts.find((p: any) => p.id === pid);
    if (found) {
      foundInDb++;
    } else {
      console.log(`  NOT IN DB: ${pid}`);
    }
  }
  console.log(`\nProduction IDs found in Neon DB: ${foundInDb}/${productionIds.length}`);

  // Check which DB products are NOT in the production response
  let missing = 0;
  const fsJoiaProducts = allProducts.filter((p: any) => p.sku.startsWith("FS-JOIA"));
  console.log(`\nFS-JOIA products in Neon DB: ${fsJoiaProducts.length}`);
  
  if (fsJoiaProducts.length > 0) {
    console.log("First 3 FS-JOIA products:");
    for (const p of fsJoiaProducts.slice(0, 3)) {
      console.log(`  id=${p.id} sku=${p.sku} name=${p.name}`);
    }
  }

  // Check ID prefixes
  const idPrefixes = new Map<string, number>();
  for (const p of allProducts) {
    const prefix = (p.id as string).split("-").slice(0, 2).join("-");
    idPrefixes.set(prefix, (idPrefixes.get(prefix) || 0) + 1);
  }
  console.log("\nID prefix distribution in Neon DB:");
  for (const [prefix, count] of idPrefixes) {
    console.log(`  ${prefix}: ${count}`);
  }

  // The real issue might be: does the Vercel deployment have the right DATABASE_URL?
  // Let's check if there's a different table or the FS-JOIA IDs are truly missing
  console.log("\n=== Listing all product IDs and SKUs in Neon DB ===");
  for (const p of allProducts) {
    console.log(`  ${p.id} | ${p.sku} | ${p.name?.substring(0, 40)}`);
  }
}

checkProduction().catch(console.error);
