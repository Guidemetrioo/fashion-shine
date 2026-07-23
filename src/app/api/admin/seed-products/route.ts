import { NextResponse } from "next/server";
import { sql, isNeonConfigured } from "@/utils/neonClient";
import { getLocalProducts } from "@/utils/productStorage";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!isNeonConfigured()) {
    return NextResponse.json({ error: "Neon database not configured" }, { status: 500 });
  }

  const products = getLocalProducts();

  if (products.length === 0) {
    return NextResponse.json({ error: "No products found in local file" }, { status: 400 });
  }

  try {
    // Clear existing products first
    await sql(`DELETE FROM products`, []);

    // Insert all products in one batch
    const placeholders: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const p of products) {
      const row = [
        `$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`,
        `$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`,
        `$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`,
        `$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`,
        `$${paramIndex++}`
      ];
      placeholders.push(`(${row.join(",")})`);
      params.push(
        p.id, p.name ?? "", p.sku, p.basePrice ?? 0,
        p.shopeeStock ?? 0, p.shopeeSynced ?? false, p.shopeeItemId ?? null,
        p.mlStock ?? 0, p.mlSynced ?? false, p.mlItemId ?? null,
        p.totalStock ?? 0, p.lastSync ?? "",
        p.description ?? null, p.imageUrl ?? null,
        p.shopeeCategoryId ?? null, p.shopeeBrandId ?? null,
        p.shopeeIsPreOrder ?? false, p.shopeeDaysToShip ?? null,
        p.shopeeLogistics ? p.shopeeLogistics.join(",") : null,
        p.tiktokCategoryId ?? null, p.tiktokBrandId ?? null
      );
    }

    const query = `
      INSERT INTO products (
        id, name, sku, base_price, shopee_stock, shopee_synced, shopee_item_id,
        ml_stock, ml_synced, ml_item_id, total_stock, last_sync, description, image_url,
        shopee_category_id, shopee_brand_id, shopee_is_pre_order, shopee_days_to_ship,
        shopee_logistics, tiktok_category_id, tiktok_brand_id
      ) VALUES ${placeholders.join(",")}
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, sku = EXCLUDED.sku, base_price = EXCLUDED.base_price,
        ml_stock = EXCLUDED.ml_stock, ml_synced = EXCLUDED.ml_synced,
        ml_item_id = EXCLUDED.ml_item_id, total_stock = EXCLUDED.total_stock,
        image_url = EXCLUDED.image_url, description = EXCLUDED.description
    `;

    await sql(query, params);

    const count = await sql(`SELECT COUNT(*) as total FROM products`, []);
    const total = parseInt((count as any)[0]?.total ?? "0");

    return NextResponse.json({
      success: true,
      seeded: products.length,
      in_database: total,
      products: products.map(p => ({ sku: p.sku, name: p.name }))
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
