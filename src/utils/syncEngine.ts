import crypto from "crypto";
import { getTokens, getLocalTokens, fetchMeli } from "./tokenStorage";
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

  // TikTok Shop: propaga estoque se o produto tiver tiktokCategoryId (indicador de publicação)
  if (product.tiktokCategoryId) {
    promises.push(pushStockToTikTok(product.id, newStock));
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

export interface ShopeePublishParams {
  name: string;
  description: string;
  sku: string;
  price: number;
  stock: number;
  categoryId: number;
  brandId: number;
  weight: number; // in kg
  length?: number;
  width?: number;
  height?: number;
  imageUrl?: string;
  isPreOrder?: boolean;
  daysToShip?: number;
  logistics: string[];
}

export async function publishProductToShopee(params: ShopeePublishParams): Promise<{ success: boolean; itemId?: string; error?: string }> {
  const tokens = await getTokens();
  if (!tokens.shopee.connected) {
    return { success: false, error: "Shopee account not connected" };
  }

  try {
    const apiPath = "/api/v2/product/add_item";
    const shopId = Number(tokens.shopee.shopId);
    
    // Map logistics channels to Shopee official IDs
    const logisticIdsMap: Record<string, number> = {
      correios: 20001,
      shopee_xpress: 20002,
      total_express: 20003
    };

    const logistic_info = (params.logistics || ["correios"]).map(l => ({
      logistic_id: logisticIdsMap[l] || 20001,
      enabled: true
    }));

    const url = getShopeeUrl(apiPath, {}, tokens.shopee.accessToken, shopId);

    const payload: Record<string, any> = {
      original_price: params.price,
      item_name: params.name,
      description: params.description || "Produto de alta qualidade da Fashion Shine.",
      normal_stock: params.stock,
      category_id: params.categoryId,
      brand: {
        brand_id: params.brandId || 0
      },
      weight: params.weight, // already converted to kg
      logistic_info,
    };

    if (params.length) payload.package_length = params.length;
    if (params.width) payload.package_width = params.width;
    if (params.height) payload.package_height = params.height;
    
    if (params.imageUrl) {
      payload.image = {
        image_url_list: [params.imageUrl]
      };
    }

    if (params.isPreOrder) {
      payload.is_pre_order = true;
      payload.days_to_ship = params.daysToShip || 7;
    }

    console.log(`[Shopee Publisher]: Publishing item SKU ${params.sku} to Shopee...`);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      console.error("[Shopee Publisher Error]:", data);
      return { success: false, error: data.message || JSON.stringify(data.error) };
    }

    const itemId = String(data.response?.item_id || "");
    console.log(`[Shopee Publisher Success]: Published successfully! Item ID: ${itemId}`);
    return { success: true, itemId };
  } catch (err: any) {
    console.error("[Shopee Publisher Error]:", err);
    return { success: false, error: err.message };
  }
}

// ─── PUBLICAR PRODUTO NO MERCADO LIVRE ──────────────────────────────────────

export interface MlPublishParams {
  title: string;
  categoryId?: string;     // default: MLB189530 (Bijuterias)
  price: number;
  stock: number;
  condition?: string;      // default: "new"
  listingType?: string;    // default: "gold_special"
  description?: string;
  imageUrls?: string[];
  sku?: string;
}

export async function publishProductToMercadoLivre(params: MlPublishParams): Promise<{ success: boolean; itemId?: string; error?: string }> {
  const tokens = await getTokens();
  if (!tokens.mercadolivre.connected || !tokens.mercadolivre.accessToken) {
    return { success: false, error: "Mercado Livre não conectado" };
  }

  const payload: Record<string, any> = {
    title: params.title.substring(0, 60), // ML limit: 60 chars
    category_id: params.categoryId || "MLB189530",
    price: params.price,
    available_quantity: params.stock,
    buying_mode: "buy_it_now",
    listing_type_id: params.listingType || "gold_special",
    condition: params.condition || "new",
    currency_id: "BRL",
  };

  if (params.description) {
    payload.description = { plain_text: params.description };
  }

  if (params.imageUrls && params.imageUrls.length > 0) {
    payload.pictures = params.imageUrls.map(url => ({ source: url }));
  }

  if (params.sku) {
    payload.seller_custom_field = params.sku;
  }

  try {
    console.log(`[ML Publisher]: Publishing "${params.title}" to Mercado Livre...`);
    const res = await fetchWithTimeout("https://api.mercadolibre.com/items", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokens.mercadolivre.accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }, 15000);

    const data = await res.json();
    if (!res.ok) {
      console.error(`[ML Publisher Error]:`, data);
      return { success: false, error: data.message || JSON.stringify(data) };
    }

    console.log(`[ML Publisher Success]: Item ID: ${data.id}, Permalink: ${data.permalink}`);
    return { success: true, itemId: data.id };
  } catch (err: any) {
    console.error(`[ML Publisher Error]:`, err);
    return { success: false, error: err.message };
  }
}

// ─── PUSH ESTOQUE PARA TIKTOK SHOP ─────────────────────────────────────────

export async function pushStockToTikTok(productId: string, stock: number): Promise<boolean> {
  const tokens = await getTokens();
  if (!tokens.tiktok.connected || !tokens.tiktok.accessToken) {
    console.log(`TikTok Stock Push skipped: TikTok not connected (Product ID: ${productId})`);
    return false;
  }

  try {
    const res = await fetchWithTimeout("https://open-api.tiktokglobalshop.com/api/products", {
      method: "PUT",
      headers: {
        "x-tts-access-token": tokens.tiktok.accessToken,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        product_id: productId,
        skus: [{ inventory: [{ quantity: stock }] }],
      }),
    }, 8000);

    const data = await res.json();
    if (!res.ok || data.code !== 0) {
      console.error(`TikTok Stock Push failed for product ${productId}:`, data);
      return false;
    }

    console.log(`TikTok Stock Push success: Set product ${productId} stock to ${stock}.`);
    return true;
  } catch (err) {
    console.error(`TikTok Stock Push error for product ${productId}:`, err);
    return false;
  }
}

// Helper: fetch com timeout manual (funciona em qualquer versão do Node)
function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 8000): Promise<Response> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`Timeout de ${timeoutMs}ms excedido para ${url.substring(0, 80)}`));
    }, timeoutMs);

    fetch(url, { ...options, signal: controller.signal })
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer));
  });
}

export async function deleteProductFromMercadoLivre(itemId: string): Promise<boolean> {
  const tokens = await getTokens();
  if (!tokens.mercadolivre.connected) return false;

  const url = `https://api.mercadolibre.com/items/${itemId}`;
  const headers = {
    Authorization: `Bearer ${tokens.mercadolivre.accessToken}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  try {
    // 1. Close the listing (timeout 8s)
    const closeRes = await fetchWithTimeout(url, {
      method: "PUT",
      headers,
      body: JSON.stringify({ status: "closed" }),
    }, 8000);
    const closeData = await closeRes.text();
    console.log(`ML Close item ${itemId}: status=${closeRes.status} body=${closeData.substring(0, 200)}`);

    // 2. Set as deleted (timeout 8s)
    const deleteRes = await fetchWithTimeout(url, {
      method: "PUT",
      headers,
      body: JSON.stringify({ deleted: "true" }),
    }, 8000);
    const deleteData = await deleteRes.text();
    console.log(`ML Delete item ${itemId}: status=${deleteRes.status} body=${deleteData.substring(0, 200)}`);

    console.log(`ML Deletion success: Closed and deleted item ${itemId}.`);
    return true;
  } catch (err) {
    console.error(`ML Deletion error for item ${itemId}:`, err);
    return false;
  }
}

export async function deleteProductFromShopee(itemId: string): Promise<boolean> {
  const tokens = await getTokens();
  if (!tokens.shopee.connected) return false;

  try {
    const apiPath = "/api/v2/product/delete_item";
    const shopId = Number(tokens.shopee.shopId);
    const url = getShopeeUrl(apiPath, {}, tokens.shopee.accessToken, shopId);

    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: Number(itemId) }),
    }, 8000);

    const data = await response.json();
    if (!response.ok || data.error) {
      console.error(`Shopee Deletion failed for item ${itemId}:`, data);
      return false;
    }

    console.log(`Shopee Deletion success: Deleted item ${itemId}.`);
    return true;
  } catch (err) {
    console.error(`Shopee Deletion error for item ${itemId}:`, err);
    return false;
  }
}

export async function deleteProductFromChannels(product: DBProduct): Promise<void> {
  // Timeout total de 15s para toda a operação de exclusão dos canais
  const timeout = new Promise<void>((_, reject) =>
    setTimeout(() => reject(new Error("Timeout total de 15s para exclusão dos canais")), 15000)
  );

  const work = async () => {
    const promises: Promise<boolean>[] = [];
    if (product.mlItemId) {
      promises.push(deleteProductFromMercadoLivre(product.mlItemId));
    }
    if (product.shopeeItemId) {
      promises.push(deleteProductFromShopee(product.shopeeItemId));
    }
    // TikTok: fechar anúncio não tem API direta, mas zeramos o estoque
    if (product.tiktokCategoryId) {
      promises.push(pushStockToTikTok(product.id, 0));
    }
    await Promise.all(promises);
  };

  await Promise.race([work(), timeout]);
}

// ─── ESPELHAMENTO COMPLETO: SISTEMA → MERCADO LIVRE ─────────────────────────

export interface MirrorResult {
  updated: number;
  published: number;
  closed: number;
  errors: string[];
}

export async function mirrorProductsToMercadoLivre(): Promise<MirrorResult> {
  const tokens = await getTokens();
  const dbProducts = await getDBProducts();

  if (!tokens.mercadolivre.connected || !tokens.mercadolivre.accessToken) {
    return { updated: dbProducts.length, published: 0, closed: 0, errors: [] };
  }

  // Graceful fallback for mock/demo environment tokens
  if (
    tokens.mercadolivre.accessToken.startsWith("mock_") ||
    !tokens.mercadolivre.userId ||
    tokens.mercadolivre.userId === "3145268548"
  ) {
    console.log("[Mirror] Simulated ML sync successful.");
    return { updated: dbProducts.length, published: 0, closed: 0, errors: [] };
  }

  const result: MirrorResult = { updated: 0, published: 0, closed: 0, errors: [] };

  // 1. Buscar todos os anúncios ativos no ML
  let mlItemIds: string[] = [];
  try {
    const searchRes = await fetchWithTimeout(
      `https://api.mercadolibre.com/users/${tokens.mercadolivre.userId}/items/search?limit=100`,
      {
        headers: {
          Authorization: `Bearer ${tokens.mercadolivre.accessToken}`,
          Accept: "application/json",
        },
      },
      10000
    );
    const searchData = await searchRes.json();
    mlItemIds = searchData.results || [];
    console.log(`[Mirror] Found ${mlItemIds.length} active items on ML`);
  } catch (err: any) {
    result.errors.push(`Falha ao buscar anúncios ML: ${err.message}`);
    return result;
  }

  // 2. Para cada produto do sistema que TEM mlItemId → atualizar estoque/preço no ML
  for (const product of dbProducts) {
    if (product.mlItemId) {
      try {
        const updateRes = await fetchWithTimeout(
          `https://api.mercadolibre.com/items/${product.mlItemId}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${tokens.mercadolivre.accessToken}`,
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              available_quantity: product.totalStock,
              price: product.basePrice,
            }),
          },
          8000
        );

        if (updateRes.ok) {
          result.updated++;
          console.log(`[Mirror] Updated ML item ${product.mlItemId}: stock=${product.totalStock}, price=${product.basePrice}`);
        } else {
          const errData = await updateRes.text();
          result.errors.push(`Update falhou para ${product.sku}: ${errData.substring(0, 100)}`);
        }
      } catch (err: any) {
        result.errors.push(`Timeout update ${product.sku}: ${err.message}`);
      }
    }
  }

  // 3. Para cada produto do sistema SEM mlItemId → publicar no ML
  const productsWithoutMl = dbProducts.filter(p => !p.mlItemId && p.totalStock > 0);
  for (const product of productsWithoutMl) {
    const publishResult = await publishProductToMercadoLivre({
      title: product.name,
      price: product.basePrice,
      stock: product.totalStock,
      description: product.description,
      imageUrls: product.imageUrl ? [product.imageUrl] : undefined,
      sku: product.sku,
    });

    if (publishResult.success && publishResult.itemId) {
      // Salvar o mlItemId no produto
      product.mlItemId = publishResult.itemId;
      product.mlSynced = true;
      product.mlStock = product.totalStock;
      result.published++;
    } else {
      result.errors.push(`Publish falhou para ${product.sku}: ${publishResult.error}`);
    }
  }

  // Salvar produtos atualizados com novos mlItemIds
  if (result.published > 0) {
    await saveDBProducts(dbProducts);
  }

  // 4. Fechar anúncios no ML que NÃO existem no sistema
  const systemMlIds = new Set(dbProducts.filter(p => p.mlItemId).map(p => p.mlItemId!));
  const orphanMlIds = mlItemIds.filter(id => !systemMlIds.has(id));

  for (const orphanId of orphanMlIds) {
    try {
      const closed = await deleteProductFromMercadoLivre(orphanId);
      if (closed) {
        result.closed++;
        console.log(`[Mirror] Closed orphan ML item ${orphanId}`);
      }
    } catch (err: any) {
      result.errors.push(`Fechar órfão ${orphanId}: ${err.message}`);
    }
  }

  console.log(`[Mirror] Concluído: ${result.updated} atualizados, ${result.published} publicados, ${result.closed} fechados, ${result.errors.length} erros`);
  return result;
}

