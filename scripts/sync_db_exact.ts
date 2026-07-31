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
import { getLocalProducts } from "../src/utils/productStorage";

async function syncExact() {
  const local = getLocalProducts();
  console.log(`📦 Carregados ${local.length} produtos unificados do products.json.`);

  if (isNeonConfigured()) {
    console.log("🌐 Sincronizando Neon DB com exatamente 244 produtos...");
    await sql`TRUNCATE TABLE products`;

    for (const p of local) {
      await sql`
        INSERT INTO products (
          id, name, sku, base_price, shopee_stock, shopee_synced, shopee_item_id,
          ml_stock, ml_synced, ml_item_id, total_stock, last_sync, description, image_url, is_checked
        ) VALUES (
          ${p.id}, ${p.name}, ${p.sku}, ${p.basePrice}, ${p.shopeeStock}, ${p.shopeeSynced}, ${p.shopeeItemId ?? null},
          ${p.mlStock}, ${p.mlSynced}, ${p.mlItemId ?? null}, ${p.totalStock}, ${p.lastSync}, ${p.description ?? null}, ${p.imageUrl ?? null}, ${p.isChecked ?? false}
        )
        ON CONFLICT (sku) DO UPDATE SET
          name = EXCLUDED.name,
          base_price = EXCLUDED.base_price,
          ml_stock = EXCLUDED.ml_stock,
          ml_item_id = EXCLUDED.ml_item_id,
          total_stock = EXCLUDED.total_stock,
          image_url = EXCLUDED.image_url
      `;
    }

    const countRes = await sql`SELECT count(*) as count FROM products`;
    console.log(`✅ Sucesso! Tabela products no Neon DB agora tem exatamente ${countRes[0]?.count} produtos!`);
  }
}

syncExact().catch(console.error);
