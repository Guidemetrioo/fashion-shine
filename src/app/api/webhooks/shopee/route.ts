import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getTokens } from "../../../../utils/tokenStorage";
import { getDBProducts, getProcessedOrders, registerProcessedOrder } from "../../../../utils/productStorage";
import { processChannelSale } from "../../../../utils/syncEngine";

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

export async function GET() {
  return NextResponse.json({
    status: "active",
    description: "Shopee Webhook Endpoint. Configure this URL in the Shopee Partner Console."
  });
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    console.log("[Shopee Webhook Received]:", payload);

    const { code, shop_id, data } = payload;

    // Shopee webhook code 3 corresponds to order status update
    if (data && data.ordersn) {
      const orderSn = data.ordersn;

      const processedOrders = getProcessedOrders();
      if (processedOrders.includes(orderSn)) {
        console.log(`[Shopee Webhook]: Order ${orderSn} already processed. Skipping deduction.`);
        return NextResponse.json({ status: "already_processed", orderSn });
      }

      const tokens = getTokens();
      if (!tokens.shopee.connected) {
        console.warn("[Shopee Webhook]: Shopee account not connected. Cannot fetch order details.");
        return NextResponse.json({ error: "Shopee integration not connected on server" }, { status: 400 });
      }

      // Fetch order details from Shopee API to get items list
      const apiPath = "/api/v2/order/get_order_detail";
      const url = getShopeeUrl(apiPath, {
        order_sn_list: orderSn,
        response_optional_fields: "item_list"
      }, tokens.shopee.accessToken, Number(tokens.shopee.shopId));

      const response = await fetch(url);
      const resData = await response.json();

      if (!response.ok || resData.error) {
        console.error("[Shopee Webhook]: Failed to fetch order details from Shopee API:", resData);
        return NextResponse.json({ error: "Failed to fetch order details from Shopee API" }, { status: 500 });
      }

      const orderList = resData.response?.order_list || [];
      if (orderList.length === 0) {
        return NextResponse.json({ error: "Order details empty" }, { status: 404 });
      }

      const orderDetail = orderList[0];
      const itemsList = orderDetail.item_list || [];

      console.log(`[Shopee Webhook]: Processing order ${orderSn} containing ${itemsList.length} listings.`);

      const products = getDBProducts();

      for (const item of itemsList) {
        const shopeeItemId = String(item.item_id);
        const qty = item.model_quantity_purchased || 1;

        // Find product with matching shopeeItemId
        const product = products.find(p => p.shopeeItemId === shopeeItemId);
        if (product) {
          console.log(`[Shopee Webhook]: Found matching product for item ${shopeeItemId}. Deducting ${qty} units from SKU ${product.sku}.`);
          await processChannelSale(product.sku, qty, "shopee");
        } else {
          console.warn(`[Shopee Webhook]: Mapped product not found for Shopee Item ID ${shopeeItemId}.`);
        }
      }

      // Mark order as processed
      registerProcessedOrder(orderSn);
      return NextResponse.json({ status: "success", orderSn, processed: true });
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("[Shopee Webhook error]:", error);
    return NextResponse.json({ error: "Webhook processing failed", details: error.message }, { status: 500 });
  }
}
