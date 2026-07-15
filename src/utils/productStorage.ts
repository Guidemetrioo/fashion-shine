import fs from "fs";
import path from "path";
import { sql, isNeonConfigured } from "./neonClient";

const PRODUCTS_FILE = path.join(process.cwd(), "products.json");
const ORDERS_LOG_FILE = path.join(process.cwd(), "orders.json");

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
  if (!isNeonConfigured()) {
    return getLocalProducts();
  }

  try {
    const data = await sql`SELECT * FROM products ORDER BY sku ASC`;

    const mapped: DBProduct[] = (data || []).map((row: any) => ({
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
    }));

    // Backup locally
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(mapped, null, 2), "utf8");
    return mapped;
  } catch (err) {
    console.warn("Neon load products error, falling back to local storage:", err);
    return getLocalProducts();
  }
}

export async function saveDBProducts(products: DBProduct[]): Promise<void> {
  // 1. Write locally
  try {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), "utf8");
  } catch (error) {
    console.error("Error writing products database locally:", error);
  }

  // 2. Upsert to Neon if configured
  if (isNeonConfigured()) {
    try {
      for (const p of products) {
        await sql`
          INSERT INTO products (
            id, name, sku, base_price, shopee_stock, shopee_synced, shopee_item_id, ml_stock, ml_synced, ml_item_id, total_stock, last_sync, description, image_url
          ) VALUES (
            ${p.id}, ${p.name}, ${p.sku}, ${p.basePrice}, ${p.shopeeStock}, ${p.shopeeSynced}, ${p.shopeeItemId || null}, ${p.mlStock}, ${p.mlSynced}, ${p.mlItemId || null}, ${p.totalStock}, ${p.lastSync}, ${p.description || null}, ${p.imageUrl || null}
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
            image_url = EXCLUDED.image_url
        `;
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
