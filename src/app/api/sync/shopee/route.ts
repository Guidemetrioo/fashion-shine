import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getTokens } from "../../../../utils/tokenStorage";

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

export async function GET(request: NextRequest) {
  const tokens = await getTokens();

  if (!tokens.shopee.connected) {
    return NextResponse.json({ connected: false, orders: [] });
  }

  const shopId = Number(tokens.shopee.shopId);

  try {
    const apiPath = "/api/v2/order/get_order_list";
    const url = getShopeeUrl(apiPath, {
      time_range_field: "create_time",
      time_from: String(Math.floor((Date.now() - 86400000 * 3) / 1000)),
      time_to: String(Math.floor(Date.now() / 1000)),
      page_size: "20",
    }, tokens.shopee.accessToken, shopId);

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || data.error) {
      console.warn("Shopee API returned error. Returning fallback details.", data);
      return NextResponse.json({
        connected: true,
        orders: [],
        apiStatus: "expired_or_invalid",
        error: data.error
      });
    }

    return NextResponse.json({
      connected: true,
      orders: [],
      apiStatus: "active"
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Shopee order sync failed", details: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const tokens = await getTokens();
  if (!tokens.shopee.connected) {
    return NextResponse.json({ error: "Shopee account not connected" }, { status: 400 });
  }

  try {
    const { itemId, stock } = await request.json();

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
      return NextResponse.json({ error: "Failed to update stock in Shopee", details: data }, { status: 500 });
    }

    return NextResponse.json({ success: true, updatedItemId: itemId, stock, response: data });
  } catch (error: any) {
    return NextResponse.json({ error: "Shopee stock sync failed", details: error.message }, { status: 500 });
  }
}
