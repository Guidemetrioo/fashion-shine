import crypto from "crypto";
import { getTokens, fetchMeli } from "./tokenStorage";
import { getDBProducts, saveDBProducts, DBProduct } from "./productStorage";

const PARTNER_ID = Number(process.env.SHOPEE_PARTNER_ID || "0");
const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY || "";
const SHOPEE_HOST = "https://api.shopee.sg";

function getShopeeUrl(apiPath: string, queryParams: Record<string, string>, accessToken?: string, shopId?: number) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac("sha256", PARTNER_KEY)
    .update(`${PARTNER_ID}${apiPath}${timestamp}${accessToken || ""}${shopId || ""}`)
    .digest("hex");

  const params = new URLSearchParams({
    partner_id: String(PARTNER_ID),
    timestamp: String(timestamp),
    sign: signature,
    ...queryParams,
  });
  if (accessToken) params.append("access_token", accessToken);
  if (shopId) params.append("shop_id", String(shopId));

  return `${SHOPEE_HOST}${apiPath}?${params.toString()}`;
}

export async function pushStockToMercadoLivre(itemId: string, stock: number): Promise<boolean> {
  const tokens = await getTokens();
  if (!tokens.mercadolivre.connected) {
    console.log(`ML Stock Push skipped: ML account not connected (Item ID: ${itemId})`);
    return false;
  }

  try {
    const response = await fetchMeli(`/items/${itemId}`, {
      method: "PUT",
      body: JSON.stringify({
        available_quantity: stock,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error(`ML Stock Push failed for item ${itemId}:`, data);
      return false;
    }

    console.log(`ML Stock Push success: Set item ${itemId} stock to ${stock}.`);
    return true;
  } catch (err) {
    console.error(`ML Stock Push error for item ${itemId}:`, err);
    return false;
  }
}

export async function pushStockToShopee(itemId: string, stock: number): Promise<boolean> {
  const tokens = await getTokens();
  if (!tokens.shopee.connected) {
    console.log(`Shopee Stock Push skipped: Shopee account not connected (Item ID: ${itemId})`);
    return false;
  }

  try {
    const apiPath = "/api/v2/product/update_stock";
    const shopId = Number(tokens.shopee.shopId);
    const url = getShopeeUrl(apiPath, {}, tokens.shopee.accessToken, shopId);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        item_id: Number(itemId),
        stock_list: [
          {
            normal_stock: stock,
          },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      console.error(`Shopee Stock Push failed for item ${itemId}:`, data);
      return false;
    }

    console.log(`Shopee Stock Push success: Set item ${itemId} stock to ${stock}.`);
    return true;
  } catch (err) {
    console.error(`Shopee Stock Push error for item ${itemId}:`, err);
    return false;
  }
}

// Syncs stock levels to channels, optionally excluding the channel that triggered the sync
export async function syncStockToChannels(sku: string, newStock: number, excludeChannel?: "shopee" | "mercadolivre" | "website"): Promise<void> {
  const products = await getDBProducts();
  const product = products.find(p => p.sku === sku);

  if (!product) {
    console.warn(`Sync Stock skipped: SKU ${sku} not found in products database.`);
    return;
  }

  const promises: Promise<boolean>[] = [];

  if (product.mlItemId && excludeChannel !== "mercadolivre") {
    promises.push(pushStockToMercadoLivre(product.mlItemId, newStock));
  }

  if (product.shopeeItemId && excludeChannel !== "shopee") {
    promises.push(pushStockToShopee(product.shopeeItemId, newStock));
  }

  await Promise.all(promises);
}

// Master central stock deduction handler
export async function processChannelSale(sku: string, quantity: number, sourceChannel: "shopee" | "mercadolivre" | "website"): Promise<DBProduct | null> {
  const products = await getDBProducts();
  const productIndex = products.findIndex(p => p.sku === sku);

  if (productIndex === -1) {
    console.warn(`Deduction skipped: SKU ${sku} not found in products database.`);
    return null;
  }

  const p = products[productIndex];
  // Calculate new consolidated stock
  const currentStock = p.totalStock;
  const newStock = Math.max(0, currentStock - quantity);

  // Update central stock values for all channels
  p.shopeeStock = newStock;
  p.mlStock = newStock;
  p.totalStock = newStock;
  p.lastSync = new Date().toLocaleTimeString("pt-BR");

  await saveDBProducts(products);
  console.log(`[Central Inventory] Deducted ${quantity} units from SKU ${sku} due to a sale on ${sourceChannel.toUpperCase()}. New shared stock: ${newStock}.`);

  // Propagate updated stock levels to the other marketplaces
  await syncStockToChannels(sku, newStock, sourceChannel);

  return p;
}
