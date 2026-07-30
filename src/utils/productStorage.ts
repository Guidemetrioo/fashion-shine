import fs from "fs";
import path from "path";
import { sql, isNeonConfigured } from "./neonClient";

const PRODUCTS_FILE = path.join(process.cwd(), "products.json");
const ORDERS_LOG_FILE = path.join(process.cwd(), "orders.json");
const DELETED_PRODUCTS_FILE = path.join(process.cwd(), "deleted_products.json");

export interface DBProduct {
  id: string;
  name: string;
  sku: string;
  basePrice: number;
  shopeeStock: number;
  shopeeSynced: boolean;
  shopeeItemId?: string;
  mlStock: number;
  mlSynced: boolean;
  mlItemId?: string;
  totalStock: number;
  lastSync: string;
  description?: string;
  imageUrl?: string;
  isChecked?: boolean;
  shopeeCategoryId?: string;
  shopeeBrandId?: string;
  shopeeIsPreOrder?: boolean;
  shopeeDaysToShip?: number;
  shopeeLogistics?: string[];
  tiktokCategoryId?: string;
  tiktokBrandId?: string;
}

export function getLocalProducts(): DBProduct[] {
  try {
    if (!fs.existsSync(PRODUCTS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(PRODUCTS_FILE, "utf8");
    return JSON.parse(data) as DBProduct[];
  } catch (error) {
    console.error("Error reading local products database:", error);
    return [];
  }
}

export async function getDeletedIdentifiers(): Promise<Set<string>> {
  const set = new Set<string>();

  // 1. Read from local backup file
  try {
    if (fs.existsSync(DELETED_PRODUCTS_FILE)) {
      const data = JSON.parse(fs.readFileSync(DELETED_PRODUCTS_FILE, "utf8"));
      if (Array.isArray(data)) {
        data.forEach(id => set.add(String(id)));
      }
    }
  } catch (e) {
    console.error("Error reading local deleted_products.json:", e);
  }

  // 2. Read from Neon DB if configured
  if (isNeonConfigured()) {
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS deleted_products (
          identifier VARCHAR(150) PRIMARY KEY,
          sku VARCHAR(100),
          ml_item_id VARCHAR(100),
          shopee_item_id VARCHAR(100),
          deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      const rows = await sql`SELECT identifier, sku, ml_item_id, shopee_item_id FROM deleted_products`;
      (rows || []).forEach((r: any) => {
        if (r.identifier) set.add(String(r.identifier));
        if (r.sku) set.add(String(r.sku));
        if (r.ml_item_id) set.add(String(r.ml_item_id));
        if (r.shopee_item_id) set.add(String(r.shopee_item_id));
      });
      // Save local backup file
      fs.writeFileSync(DELETED_PRODUCTS_FILE, JSON.stringify(Array.from(set), null, 2), "utf8");
    } catch (dbErr) {
      console.error("Failed to fetch deleted_products from Neon DB:", dbErr);
    }
  }

  return set;
}

export async function registerDeletedProduct(productToDelete: { identifier: string; id?: string; sku?: string; mlItemId?: string; shopeeItemId?: string }): Promise<void> {
  const { identifier, id, sku, mlItemId, shopeeItemId } = productToDelete;

  // 1. Save locally
  try {
    const list = Array.from(await getDeletedIdentifiers());
    [identifier, id, sku, mlItemId, shopeeItemId].filter(Boolean).forEach(val => {
      if (val && !list.includes(String(val))) list.push(String(val));
    });
    fs.writeFileSync(DELETED_PRODUCTS_FILE, JSON.stringify(list, null, 2), "utf8");
  } catch (e) {
    console.error("Failed to write local deleted_products.json:", e);
  }

  // 2. Save to Neon DB
  if (isNeonConfigured()) {
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS deleted_products (
          identifier VARCHAR(150) PRIMARY KEY,
          sku VARCHAR(100),
          ml_item_id VARCHAR(100),
          shopee_item_id VARCHAR(100),
          deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      const primaryId = identifier || id || sku || "unknown-id";
      await sql`
        INSERT INTO deleted_products (identifier, sku, ml_item_id, shopee_item_id)
        VALUES (${primaryId}, ${sku ?? null}, ${mlItemId ?? null}, ${shopeeItemId ?? null})
        ON CONFLICT (identifier) DO NOTHING
      `;
    } catch (err) {
      console.error("Failed to register deleted product in Neon DB:", err);
    }
  }
}

export function getLocalProcessedOrders(): string[] {
  try {
    if (!fs.existsSync(ORDERS_LOG_FILE)) {
      return [];
    }
    const data = fs.readFileSync(ORDERS_LOG_FILE, "utf8");
    return JSON.parse(data) as string[];
  } catch (error) {
    console.error("Error reading local orders log:", error);
    return [];
  }
}

export async function getDBProducts(): Promise<DBProduct[]> {
  const deletedSet = await getDeletedIdentifiers();

  if (!isNeonConfigured()) {
    const local = getLocalProducts();
    return local.filter(p => !deletedSet.has(p.id) && !deletedSet.has(p.sku) && (!p.mlItemId || !deletedSet.has(p.mlItemId)) && (!p.shopeeItemId || !deletedSet.has(p.shopeeItemId)));
  }

  try {
    const data = await sql`SELECT * FROM products ORDER BY sku ASC`;

    const mapped: DBProduct[] = (data || [])
      .map((row: any) => ({
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
        shopeeCategoryId: row.shopee_category_id ?? undefined,
        shopeeBrandId: row.shopee_brand_id ?? undefined,
        shopeeIsPreOrder: row.shopee_is_pre_order ?? false,
        shopeeDaysToShip: row.shopee_days_to_ship ? Number(row.shopee_days_to_ship) : undefined,
        shopeeLogistics: row.shopee_logistics ? row.shopee_logistics.split(",") : [],
        tiktokCategoryId: row.tiktok_category_id ?? undefined,
        tiktokBrandId: row.tiktok_brand_id ?? undefined,
      }))
      .filter((p: DBProduct) => !deletedSet.has(p.id) && !deletedSet.has(p.sku) && (!p.mlItemId || !deletedSet.has(p.mlItemId)) && (!p.shopeeItemId || !deletedSet.has(p.shopeeItemId)));

    // Backup locally
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(mapped, null, 2), "utf8");
    return mapped;
  } catch (err) {
    console.warn("Neon load products error, falling back to local storage:", err);
    const local = getLocalProducts();
    return local.filter(p => !deletedSet.has(p.id) && !deletedSet.has(p.sku) && (!p.mlItemId || !deletedSet.has(p.mlItemId)) && (!p.shopeeItemId || !deletedSet.has(p.shopeeItemId)));
  }
}

export async function deleteDBProduct(identifier: string): Promise<boolean> {
  if (!identifier) return false;

  let products = getLocalProducts();
  const index = products.findIndex(
    p => p.id === identifier || p.sku === identifier || p.mlItemId === identifier || p.shopeeItemId === identifier
  );

  const productToDelete = index !== -1 ? products[index] : null;

  // Register in tombstone table so imports and future syncs never recreate it
  await registerDeletedProduct({
    identifier,
    id: productToDelete?.id || identifier,
    sku: productToDelete?.sku || identifier,
    mlItemId: productToDelete?.mlItemId || (identifier.startsWith("MLB") ? identifier : undefined),
    shopeeItemId: productToDelete?.shopeeItemId || (identifier.startsWith("shp-") ? identifier : undefined),
  });

  // 1. Remove from local file
  products = products.filter(
    p => !(p.id === identifier || p.sku === identifier || (productToDelete && (p.id === productToDelete.id || p.sku === productToDelete.sku)))
  );
  try {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), "utf8");
  } catch (error) {
    console.error("Error updating local products file on deletion:", error);
  }

  // 2. Delete from Neon database if configured
  if (isNeonConfigured()) {
    try {
      const targetId = productToDelete?.id || identifier;
      const targetSku = productToDelete?.sku || identifier;
      const targetMlId = productToDelete?.mlItemId || identifier;
      const targetShopeeId = productToDelete?.shopeeItemId || identifier;

      await sql`
        DELETE FROM products 
        WHERE id = ${targetId} 
           OR sku = ${targetSku} 
           OR (ml_item_id IS NOT NULL AND ml_item_id = ${targetMlId})
           OR (shopee_item_id IS NOT NULL AND shopee_item_id = ${targetShopeeId})
           OR id = ${identifier}
           OR sku = ${identifier}
      `;
      console.log(`Successfully deleted product ${identifier} from Neon Database.`);

      // Also ensure local backup file remains in sync with DB
      const dbData = await sql`SELECT * FROM products ORDER BY sku ASC`;
      const deletedSet = await getDeletedIdentifiers();
      const mapped: DBProduct[] = (dbData || [])
        .map((row: any) => ({
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
          shopeeCategoryId: row.shopee_category_id ?? undefined,
          shopeeBrandId: row.shopee_brand_id ?? undefined,
          shopeeIsPreOrder: row.shopee_is_pre_order ?? false,
          shopeeDaysToShip: row.shopee_days_to_ship ? Number(row.shopee_days_to_ship) : undefined,
          shopeeLogistics: row.shopee_logistics ? row.shopee_logistics.split(",") : [],
          tiktokCategoryId: row.tiktok_category_id ?? undefined,
          tiktokBrandId: row.tiktok_brand_id ?? undefined,
        }))
        .filter((p: DBProduct) => !deletedSet.has(p.id) && !deletedSet.has(p.sku) && (!p.mlItemId || !deletedSet.has(p.mlItemId)) && (!p.shopeeItemId || !deletedSet.has(p.shopeeItemId)));

      fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(mapped, null, 2), "utf8");
    } catch (err) {
      console.error("Neon product deletion query failed:", err);
    }
  }

  return index !== -1 || isNeonConfigured();
}

export async function saveDBProducts(products: DBProduct[]): Promise<void> {
  // 1. Write locally
  try {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), "utf8");
  } catch (error) {
    console.error("Error writing products database locally:", error);
  }

  // 2. Upsert to Neon if configured
  if (isNeonConfigured() && products.length > 0) {
    try {
      if (products.length === 1) {
        const p = products[0];
        await sql`
          INSERT INTO products (
            id, name, sku, base_price, shopee_stock, shopee_synced, shopee_item_id, ml_stock, ml_synced, ml_item_id, total_stock, last_sync, description, image_url,
            shopee_category_id, shopee_brand_id, shopee_is_pre_order, shopee_days_to_ship, shopee_logistics, tiktok_category_id, tiktok_brand_id
          ) VALUES (
            ${p.id},
            ${p.name ?? ""},
            ${p.sku},
            ${p.basePrice ?? 0},
            ${p.shopeeStock ?? 0},
            ${p.shopeeSynced ?? false},
            ${p.shopeeItemId ?? null},
            ${p.mlStock ?? 0},
            ${p.mlSynced ?? false},
            ${p.mlItemId ?? null},
            ${p.totalStock ?? 0},
            ${p.lastSync ?? ""},
            ${p.description ?? null},
            ${p.imageUrl ?? null},
            ${p.shopeeCategoryId ?? null},
            ${p.shopeeBrandId ?? null},
            ${p.shopeeIsPreOrder ?? false},
            ${p.shopeeDaysToShip ?? null},
            ${p.shopeeLogistics ? p.shopeeLogistics.join(",") : null},
            ${p.tiktokCategoryId ?? null},
            ${p.tiktokBrandId ?? null}
          )
          ON CONFLICT (id)
          DO UPDATE SET
            name = EXCLUDED.name,
            sku = EXCLUDED.sku,
            base_price = EXCLUDED.base_price,
            shopee_stock = EXCLUDED.shopee_stock,
            shopee_synced = EXCLUDED.shopee_synced,
            shopee_item_id = EXCLUDED.shopee_item_id,
            ml_stock = EXCLUDED.ml_stock,
            ml_synced = EXCLUDED.ml_synced,
            ml_item_id = EXCLUDED.ml_item_id,
            total_stock = EXCLUDED.total_stock,
            last_sync = EXCLUDED.last_sync,
            description = EXCLUDED.description,
            image_url = EXCLUDED.image_url,
            shopee_category_id = EXCLUDED.shopee_category_id,
            shopee_brand_id = EXCLUDED.shopee_brand_id,
            shopee_is_pre_order = EXCLUDED.shopee_is_pre_order,
            shopee_days_to_ship = EXCLUDED.shopee_days_to_ship,
            shopee_logistics = EXCLUDED.shopee_logistics,
            tiktok_category_id = EXCLUDED.tiktok_category_id,
            tiktok_brand_id = EXCLUDED.tiktok_brand_id
          RETURNING id
        `;
        return;
      }

      const chunks: DBProduct[][] = [];
      const chunkSize = 50;
      for (let i = 0; i < products.length; i += chunkSize) {
        chunks.push(products.slice(i, i + chunkSize));
      }

      for (const chunk of chunks) {
        const placeholders: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        for (const p of chunk) {
          const rowPlaceholders = [
            `$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`,
            `$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`,
            `$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`,
            `$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`,
            `$${paramIndex++}`
          ];
          placeholders.push(`(${rowPlaceholders.join(",")})`);

          params.push(
            p.id,
            p.name ?? "",
            p.sku,
            p.basePrice ?? 0,
            p.shopeeStock ?? 0,
            p.shopeeSynced ?? false,
            p.shopeeItemId ?? null,
            p.mlStock ?? 0,
            p.mlSynced ?? false,
            p.mlItemId ?? null,
            p.totalStock ?? 0,
            p.lastSync ?? "",
            p.description ?? null,
            p.imageUrl ?? null,
            p.shopeeCategoryId ?? null,
            p.shopeeBrandId ?? null,
            p.shopeeIsPreOrder ?? false,
            p.shopeeDaysToShip ?? null,
            p.shopeeLogistics ? p.shopeeLogistics.join(",") : null,
            p.tiktokCategoryId ?? null,
            p.tiktokBrandId ?? null
          );
        }

        const query = `
          INSERT INTO products (
            id, name, sku, base_price, shopee_stock, shopee_synced, shopee_item_id, ml_stock, ml_synced, ml_item_id, total_stock, last_sync, description, image_url,
            shopee_category_id, shopee_brand_id, shopee_is_pre_order, shopee_days_to_ship, shopee_logistics, tiktok_category_id, tiktok_brand_id
          ) VALUES ${placeholders.join(",")}
          ON CONFLICT (sku)
          DO UPDATE SET
            name = EXCLUDED.name,
            sku = EXCLUDED.sku,
            base_price = EXCLUDED.base_price,
            shopee_stock = EXCLUDED.shopee_stock,
            shopee_synced = EXCLUDED.shopee_synced,
            shopee_item_id = EXCLUDED.shopee_item_id,
            ml_stock = EXCLUDED.ml_stock,
            ml_synced = EXCLUDED.ml_synced,
            ml_item_id = EXCLUDED.ml_item_id,
            total_stock = EXCLUDED.total_stock,
            last_sync = EXCLUDED.last_sync,
            description = EXCLUDED.description,
            image_url = EXCLUDED.image_url,
            shopee_category_id = EXCLUDED.shopee_category_id,
            shopee_brand_id = EXCLUDED.shopee_brand_id,
            shopee_is_pre_order = EXCLUDED.shopee_is_pre_order,
            shopee_days_to_ship = EXCLUDED.shopee_days_to_ship,
            shopee_logistics = EXCLUDED.shopee_logistics,
            tiktok_category_id = EXCLUDED.tiktok_category_id,
            tiktok_brand_id = EXCLUDED.tiktok_brand_id
          RETURNING id
        `;

        await sql(query, params);
      }
    } catch (err) {
      console.error("Neon products upsert failed:", err);
    }
  }
}

export async function getProcessedOrders(): Promise<string[]> {
  if (!isNeonConfigured()) {
    return getLocalProcessedOrders();
  }

  try {
    const data = await sql`SELECT order_id FROM processed_orders`;
    const list = (data || []).map((r: any) => r.order_id);
    
    // Backup locally
    fs.writeFileSync(ORDERS_LOG_FILE, JSON.stringify(list, null, 2), "utf8");
    return list;
  } catch (err) {
    console.warn("Neon load orders error, falling back to local storage:", err);
    return getLocalProcessedOrders();
  }
}

export async function registerProcessedOrder(orderId: string): Promise<void> {
  // 1. Write locally
  try {
    const orders = getLocalProcessedOrders();
    if (!orders.includes(orderId)) {
      orders.push(orderId);
      fs.writeFileSync(ORDERS_LOG_FILE, JSON.stringify(orders, null, 2), "utf8");
    }
  } catch (error) {
    console.error("Error writing orders log locally:", error);
  }

  // 2. Write to Neon if configured
  if (isNeonConfigured()) {
    try {
      await sql`
        INSERT INTO processed_orders (order_id)
        VALUES (${orderId})
        ON CONFLICT (order_id) DO NOTHING
      `;
    } catch (err) {
      console.error("Neon order insert failed:", err);
    }
  }
}
