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
import { getDBProducts, saveDBProducts, DBProduct } from "../src/utils/productStorage";
import { sql, isNeonConfigured } from "../src/utils/neonClient";

async function relistEarrings() {
  console.log("=== RE-PUBLISHING ALL PRODUCTS DIRECTLY IN CATEGORY MLB1432 (BRINCOS) ===\n");

  const products = await getDBProducts();
  console.log(`Total system products to verify: ${products.length}`);

  const tokens = await getTokens();
  if (!tokens.mercadolivre.connected) {
    console.error("Mercado Livre account not connected!");
    return;
  }

  let activeOkCount = 0;
  let recreatedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    console.log(`\n[${i + 1}/${products.length}] SKU: ${p.sku} | Name: "${p.name}"`);

    let itemInfo: any = null;
    if (p.mlItemId) {
      const detailRes = await fetchMeli(`/items/${p.mlItemId}`);
      if (detailRes.ok) {
        itemInfo = await detailRes.json();
      }
    }

    const isCorrectCategory = itemInfo && itemInfo.category_id === "MLB1432";
    const isActive = itemInfo && itemInfo.status === "active";

    console.log(`  Current ML ID: ${p.mlItemId || 'None'}`);
    console.log(`  Current Category: ${itemInfo?.category_id || 'Unknown'} (Correct: ${isCorrectCategory})`);
    console.log(`  Current Status: ${itemInfo?.status || 'Unknown'}`);

    if (itemInfo && isCorrectCategory && isActive) {
      console.log(`  ✅ Item is active and in correct category MLB1432.`);
      activeOkCount++;
      continue;
    }

    // Publish a clean, official listing in category MLB1432 (Brincos)
    console.log(`  🚀 Creating official listing in category MLB1432 (Brincos)...`);
    try {
      const titleStr = p.name.substring(0, 60);
      const newMlPayload: Record<string, any> = {
        family_name: titleStr,
        category_id: "MLB1432", // Official Brincos Category
        price: p.basePrice || 40,
        currency_id: "BRL",
        available_quantity: p.mlStock || 1,
        buying_mode: "buy_it_now",
        listing_type_id: "gold_special",
        condition: "new",
        attributes: [
          { id: "BRAND", value_name: "Fashion Shine" },
          { id: "SELLER_SKU", value_name: p.sku },
          { id: "MATERIAL", value_name: "Banhado a Ouro 18k" },
          { id: "WITH_GEMSTONE", value_name: "Sim" },
        ],
      };

      if (p.imageUrl) {
        newMlPayload.pictures = [{ source: p.imageUrl }];
      }

      const createRes = await fetchMeli("/items", {
        method: "POST",
        body: JSON.stringify(newMlPayload),
      });

      const createData = await createRes.json();
      if (createRes.ok && createData.id) {
        const newMlItemId = createData.id;
        console.log(`  🎉 SUCCESS! Created new active listing ${newMlItemId} in category MLB1432 for SKU ${p.sku}`);
        
        // Optionally close the old inactive/paused item if it existed
        if (p.mlItemId && p.mlItemId !== newMlItemId) {
          try {
            await fetchMeli(`/items/${p.mlItemId}`, {
              method: "PUT",
              body: JSON.stringify({ status: "closed" })
            });
          } catch (e) {
            // ignore
          }
        }

        p.mlItemId = newMlItemId;
        p.id = `prod-ml-${newMlItemId}`;
        p.mlSynced = true;
        p.lastSync = new Date().toLocaleTimeString("pt-BR");
        recreatedCount++;
      } else {
        console.error(`  ❌ Failed to create listing in MLB1432:`, createData.message || createData.cause || createData);
        errorCount++;
      }
    } catch (createErr) {
      console.error(`  ❌ Exception creating listing for ${p.sku}:`, createErr);
      errorCount++;
    }
  }

  // Save back updated product list with new mlItemIds
  await saveDBProducts(products);

  // Direct Neon update if configured
  if (isNeonConfigured()) {
    try {
      for (const p of products) {
        await sql`
          UPDATE products
          SET id = ${p.id}, ml_item_id = ${p.mlItemId ?? null}, ml_synced = ${p.mlSynced}, last_sync = ${p.lastSync}
          WHERE sku = ${p.sku}
        `;
      }
      console.log("Updated Neon DB references successfully.");
    } catch (dbErr) {
      console.error("Neon DB batch update error:", dbErr);
    }
  }

  console.log(`\n=== FINAL SUMMARY ===`);
  console.log(`Already Active in MLB1432: ${activeOkCount}`);
  console.log(`Re-published Clean Listings in MLB1432 (Brincos): ${recreatedCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Total Active Brincos: ${activeOkCount + recreatedCount}/${products.length}`);
}

relistEarrings().catch(console.error);
