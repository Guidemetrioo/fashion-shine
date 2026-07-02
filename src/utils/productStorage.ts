import fs from "fs";
import path from "path";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

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
  if (!isSupabaseConfigured()) {
    return getLocalProducts();
  }

  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("sku", { ascending: true });

    if (error) throw error;

    const mapped: DBProduct[] = (data || []).map((row) => ({
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
    }));

    // Backup locally
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(mapped, null, 2), "utf8");
    return mapped;
  } catch (err) {
    console.warn("Supabase load products error, falling back to local storage:", err);
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

  // 2. Upsert to Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const dbRows = products.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        base_price: p.basePrice,
        shopee_stock: p.shopeeStock,
        shopee_synced: p.shopeeSynced,
        shopee_item_id: p.shopeeItemId,
        ml_stock: p.mlStock,
        ml_synced: p.mlSynced,
        ml_item_id: p.mlItemId,
        total_stock: p.totalStock,
        last_sync: p.lastSync,
      }));

      const { error } = await supabase.from("products").upsert(dbRows);
      if (error) throw error;
    } catch (err) {
      console.error("Supabase products upsert failed:", err);
    }
  }
}

export async function getProcessedOrders(): Promise<string[]> {
  if (!isSupabaseConfigured()) {
    return getLocalProcessedOrders();
  }

  try {
    const { data, error } = await supabase
      .from("processed_orders")
      .select("order_id");

    if (error) throw error;

    const list = (data || []).map(r => r.order_id);
    
    // Backup locally
    fs.writeFileSync(ORDERS_LOG_FILE, JSON.stringify(list, null, 2), "utf8");
    return list;
  } catch (err) {
    console.warn("Supabase load orders error, falling back to local storage:", err);
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

  // 2. Write to Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from("processed_orders")
        .insert({ order_id: orderId });
      if (error && error.code !== "23505") { // Ignore unique constraint violation
        throw error;
      }
    } catch (err) {
      console.error("Supabase order insert failed:", err);
    }
  }
}
