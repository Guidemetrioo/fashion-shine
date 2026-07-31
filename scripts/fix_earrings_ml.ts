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
import { getDBProducts, saveDBProducts } from "../src/utils/productStorage";
import { fetchMeli, getTokens } from "../src/utils/tokenStorage";

async function fixEarrings() {
  console.log("=== FIXING ALL PRODUCT NAMES TO BRINCOS (EAR RINGS) ===\n");

  const products = await getDBProducts();
  console.log(`Total products loaded: ${products.length}`);

  let updatedCount = 0;
  let mlSyncedCount = 0;
  let mlFailCount = 0;

  const tokens = await getTokens();
  const mlConnected = tokens.mercadolivre.connected;
  console.log("Mercado Livre connected:", mlConnected);

  for (const p of products) {
    let oldName = p.name;
    let newName = oldName;

    // Fix names that contain non-earring words
    if (newName.includes("Colar Colar Pingente Banhado Ouro")) {
      newName = newName.replace("Colar Colar Pingente Banhado Ouro", "Brinco Semijoia Banhado Ouro");
    } else if (newName.startsWith("Colar ")) {
      newName = newName.replace(/^Colar\s+/, "Brinco ");
    }

    if (newName.includes("Pulseira Malha Elegante Banhada Ouro")) {
      newName = newName.replace("Pulseira Malha Elegante Banhada Ouro", "Brinco Elegante Banhado Ouro");
    } else if (newName.startsWith("Pulseira ")) {
      newName = newName.replace(/^Pulseira\s+/, "Brinco ");
    }

    if (newName.includes("Anel Solitário Cravejado Zircônias")) {
      newName = newName.replace("Anel Solitário Cravejado Zircônias", "Brinco Solitário Cravejado Zircônias");
    } else if (newName.startsWith("Anel ")) {
      newName = newName.replace(/^Anel\s+/, "Brinco ");
    }

    // Ensure title starts with Brinco if not already
    if (!newName.toLowerCase().includes("brinco") && !newName.toLowerCase().includes("argola")) {
      newName = `Brinco ${newName}`;
    }

    // Clean up duplicate words like "Brinco Brinco"
    newName = newName.replace(/^Brinco\s+Brinco\s+/, "Brinco ");
    newName = newName.trim();

    // Mercado Livre title max length is 60 chars
    if (newName.length > 60) {
      newName = newName.substring(0, 60).trim();
    }

    const nameChanged = oldName !== newName;
    p.name = newName;
    p.lastSync = new Date().toLocaleTimeString("pt-BR");

    if (nameChanged) {
      updatedCount++;
      console.log(`[NAME FIX] SKU ${p.sku}: "${oldName}" ➡️ "${newName}"`);
    }

    // Push title update to Mercado Livre
    if (mlConnected && p.mlItemId && nameChanged) {
      try {
        const res = await fetchMeli(`/items/${p.mlItemId}`, {
          method: "PUT",
          body: JSON.stringify({
            title: newName
          }),
        });

        if (res.ok) {
          mlSyncedCount++;
          console.log(`  ✅ ML Title updated for ${p.mlItemId}`);
        } else {
          const errData = await res.json();
          mlFailCount++;
          console.warn(`  ⚠️ ML title update for ${p.mlItemId} (${p.sku}):`, errData.message || JSON.stringify(errData.cause));
        }
      } catch (err) {
        mlFailCount++;
        console.error(`  ❌ ML sync error for ${p.mlItemId}:`, err);
      }
    }
  }

  // Save back to DB and products.json
  await saveDBProducts(products);

  // Direct Neon update if configured
  if (isNeonConfigured()) {
    try {
      for (const p of products) {
        await sql`
          UPDATE products
          SET name = ${p.name}, last_sync = ${p.lastSync}
          WHERE id = ${p.id} OR sku = ${p.sku}
        `;
      }
      console.log("Updated Neon DB names successfully.");
    } catch (dbErr) {
      console.error("Neon DB batch name update error:", dbErr);
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Names updated: ${updatedCount}`);
  console.log(`ML Titles Synced: ${mlSyncedCount}`);
  console.log(`ML Sync Notices/Under Review: ${mlFailCount}`);
}

fixEarrings().catch(console.error);
