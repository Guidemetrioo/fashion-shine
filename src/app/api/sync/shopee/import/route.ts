import { NextRequest, NextResponse } from "next/server";
import { getTokens } from "../../../../../utils/tokenStorage";
import { getDBProducts, saveDBProducts, DBProduct } from "../../../../../utils/productStorage";
import crypto from "crypto";

const PARTNER_ID = Number(process.env.SHOPEE_PARTNER_ID || "0");
const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY || "";
const HOST = "https://api.shopee.sg";

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

  return `${HOST}${apiPath}?${params.toString()}`;
}

export async function POST(request: NextRequest) {
  const tokens = await getTokens();

  if (!tokens.shopee.connected) {
    return NextResponse.json({ error: "Shopee account not connected" }, { status: 400 });
  }

  const shopId = Number(tokens.shopee.shopId);
  const accessToken = tokens.shopee.accessToken;

  try {
    // 1. Get item list
    const listPath = "/api/v2/product/get_item_list";
    const listUrl = getShopeeUrl(listPath, {
      offset: "0",
      page_size: "100",
      item_status: "NORMAL"
    }, accessToken, shopId);

    const listRes = await fetch(listUrl);
    const listData = await listRes.json();

    if (!listRes.ok || listData.error) {
      console.error("Failed to fetch Shopee product list:", listData);
      return NextResponse.json({ error: "Shopee API error fetching item list", details: listData }, { status: listRes.status });
    }

    const itemObjects = listData.response?.item_list || [];
    const itemIds: number[] = itemObjects.map((item: any) => item.item_id);

    if (itemIds.length === 0) {
      return NextResponse.json({
        success: true,
        importedCount: 0,
        updatedCount: 0,
        message: "Nenhum produto encontrado na conta da Shopee."
      });
    }

    // 2. Fetch base info for item IDs (limit 50 per request)
    const allShopeeProducts: any[] = [];
    const batchSize = 50;
    for (let i = 0; i < itemIds.length; i += batchSize) {
      const batchIds = itemIds.slice(i, i + batchSize).join(",");
      const infoPath = "/api/v2/product/get_item_base_info";
      const infoUrl = getShopeeUrl(infoPath, {
        item_id_list: batchIds
      }, accessToken, shopId);

      const infoRes = await fetch(infoUrl);
      if (infoRes.ok) {
        const infoData = await infoRes.json();
        if (infoData.response?.item_list) {
          allShopeeProducts.push(...infoData.response.item_list);
        }
      }
    }

    const dbProducts = await getDBProducts();
    let importedCount = 0;
    let updatedCount = 0;

    for (const item of allShopeeProducts) {
      const shopeeItemId = String(item.item_id);
      const name = item.item_name;
      const sku = item.item_sku ? item.item_sku.trim() : "";
      const basePrice = item.price_info?.[0]?.original_price || item.price_info?.[0]?.current_price || 0;
      
      // Stock parsing (Shopee API can return normal_stock inside stock_info)
      const shopeeStock = item.stock_info?.[0]?.normal_stock ?? item.stock_info?.normal_stock ?? item.stock_info?.total_stock ?? 0;

      // Find existing
      let existingProduct = dbProducts.find(p => p.shopeeItemId === shopeeItemId);
      if (!existingProduct && sku) {
        existingProduct = dbProducts.find(p => p.sku === sku);
      }

      if (existingProduct) {
        // Update
        existingProduct.shopeeItemId = shopeeItemId;
        existingProduct.shopeeStock = shopeeStock;
        existingProduct.shopeeSynced = true;
        existingProduct.totalStock = existingProduct.mlStock + shopeeStock;
        existingProduct.lastSync = new Date().toLocaleTimeString("pt-BR");
        
        if (!existingProduct.name) {
          existingProduct.name = name;
        }
        updatedCount++;
      } else {
        // Create new product
        const newProduct: DBProduct = {
          id: `shp-prod-${shopeeItemId}`,
          name: name,
          sku: sku || shopeeItemId,
          basePrice: basePrice,
          shopeeStock: shopeeStock,
          shopeeSynced: true,
          shopeeItemId: shopeeItemId,
          mlStock: 0,
          mlSynced: false,
          totalStock: shopeeStock,
          lastSync: new Date().toLocaleTimeString("pt-BR")
        };
        dbProducts.push(newProduct);
        importedCount++;
      }
    }

    // Save database
    await saveDBProducts(dbProducts);

    return NextResponse.json({
      success: true,
      importedCount,
      updatedCount,
      totalCount: dbProducts.length
    });
  } catch (error: any) {
    console.error("Shopee Catalog Import failed:", error);
    return NextResponse.json({ error: "Catalog import failed", details: error.message }, { status: 500 });
  }
}
