import { NextRequest, NextResponse } from "next/server";
import { getTokens } from "../../../../utils/tokenStorage";
import { getDBProducts, getProcessedOrders, registerProcessedOrder } from "../../../../utils/productStorage";
import { processChannelSale } from "../../../../utils/syncEngine";

export async function GET() {
  return NextResponse.json({
    status: "active",
    description: "Mercado Livre Webhook Endpoint. Configure this URL in the Mercado Livre Developer Console.",
    topic: "orders"
  });
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    console.log("[ML Webhook Received]:", payload);

    const { resource, topic, user_id } = payload;

    // Check if the topic is orders
    if (topic === "orders" && resource) {
      const orderId = resource.split("/").pop(); // Gets the number from /orders/1234567890

      if (!orderId) {
        return NextResponse.json({ error: "Could not parse order ID" }, { status: 400 });
      }

      const processedOrders = getProcessedOrders();
      if (processedOrders.includes(orderId)) {
        console.log(`[ML Webhook]: Order ${orderId} already processed. Skipping deduction.`);
        return NextResponse.json({ status: "already_processed", orderId });
      }

      const tokens = getTokens();
      if (!tokens.mercadolivre.connected) {
        console.warn("[ML Webhook]: ML account not connected. Cannot fetch order details.");
        return NextResponse.json({ error: "Mercado Livre integration not connected on server" }, { status: 400 });
      }

      // Fetch order details from Mercado Livre
      const orderDetailsUrl = `https://api.mercadolibre.com${resource}`;
      const response = await fetch(orderDetailsUrl, {
        headers: {
          Authorization: `Bearer ${tokens.mercadolivre.accessToken}`,
        },
      });

      if (!response.ok) {
        console.error(`[ML Webhook]: Failed to fetch order details for ${resource}.`);
        return NextResponse.json({ error: "Failed to fetch order details from ML API" }, { status: 500 });
      }

      const orderData = await response.json();
      const orderItems = orderData.order_items || [];

      console.log(`[ML Webhook]: Processing order ${orderId} containing ${orderItems.length} listings.`);

      const products = getDBProducts();

      for (const item of orderItems) {
        const mlItemId = item.item.id;
        const qty = item.quantity || 1;

        // Find product with matching mlItemId
        const product = products.find(p => p.mlItemId === mlItemId);
        if (product) {
          console.log(`[ML Webhook]: Found matching product for item ${mlItemId}. Deducting ${qty} units from SKU ${product.sku}.`);
          await processChannelSale(product.sku, qty, "mercadolivre");
        } else {
          console.warn(`[ML Webhook]: Mapped product not found for ML Item ID ${mlItemId}.`);
        }
      }

      // Mark order as processed
      registerProcessedOrder(orderId);
      return NextResponse.json({ status: "success", orderId, processed: true });
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("[ML Webhook error]:", error);
    return NextResponse.json({ error: "Webhook processing failed", details: error.message }, { status: 500 });
  }
}
