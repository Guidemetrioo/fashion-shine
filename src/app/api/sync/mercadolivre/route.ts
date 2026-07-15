import { NextRequest, NextResponse } from "next/server";
import { getTokens, fetchMeli } from "../../../../utils/tokenStorage";
import { getDBProducts, getProcessedOrders, registerProcessedOrder } from "../../../../utils/productStorage";
import { processChannelSale } from "../../../../utils/syncEngine";

export async function GET(request: NextRequest) {
  const tokens = await getTokens();

  if (!tokens.mercadolivre.connected) {
    return NextResponse.json({ connected: false, nickname: "", orders: [] });
  }

  try {
    const mlResponse = await fetchMeli(`/orders/search?seller=${tokens.mercadolivre.userId}`);

    if (!mlResponse.ok) {
      console.warn("Mercado Livre API error or token expired. Returning fallback data.");
      return NextResponse.json({
        connected: true,
        nickname: tokens.mercadolivre.nickname,
        orders: [],
        apiStatus: "expired_or_invalid"
      });
    }

    const mlData = await mlResponse.json();
    const results = mlData.results || [];
    const processedOrders = await getProcessedOrders();
    const products = await getDBProducts();

    // Check for new sales to deduct stock
    for (const order of results) {
      const orderIdStr = String(order.id);
      if (!processedOrders.includes(orderIdStr)) {
        console.log(`[Polling Order Sync]: New Mercado Livre sale found: Order ID ${orderIdStr}`);
        const orderItems = order.order_items || [];
        for (const item of orderItems) {
          const mlItemId = item.item.id;
          const qty = item.quantity || 1;

          const product = products.find(p => p.mlItemId === mlItemId);
          if (product) {
            console.log(`[Polling Order Sync]: Deducting SKU ${product.sku} by ${qty} units due to order ${orderIdStr}.`);
            await processChannelSale(product.sku, qty, "mercadolivre");
          }
        }
        await registerProcessedOrder(orderIdStr);
      }
    }

    const formattedOrders = results.map((o: any) => ({
      id: `ml-${o.id}`,
      orderId: `MLB-${o.id}`,
      buyerName: `${o.buyer.first_name || ""} ${o.buyer.last_name || ""}`.trim() || "M. Livre Buyer",
      channel: "mercadolivre",
      items: (o.order_items || []).map((item: any) => ({
        name: item.item.title,
        quantity: item.quantity,
        price: item.unit_price,
      })),
      total: o.total_amount,
      status: o.status === "paid" ? "ready_to_ship" : "pending",
      trackingCode: o.shipping?.id ? `ML${o.shipping.id}BR` : "Pendente",
      date: new Date(o.date_created).toLocaleString("pt-BR"),
    }));

    return NextResponse.json({
      connected: true,
      nickname: tokens.mercadolivre.nickname,
      orders: formattedOrders,
      apiStatus: "active"
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch orders", details: error.message }, { status: 500 });
  }
}


export async function POST(request: NextRequest) {
  const tokens = await getTokens();
  if (!tokens.mercadolivre.connected) {
    return NextResponse.json({ error: "Mercado Livre account not connected" }, { status: 400 });
  }

  try {
    const { itemId, stock } = await request.json();

    if (!itemId) {
      return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
    }

    const response = await fetchMeli(`/items/${itemId}`, {
      method: "PUT",
      body: JSON.stringify({
        available_quantity: stock,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to update stock in Mercado Livre", details: data }, { status: response.status });
    }

    return NextResponse.json({ success: true, updatedItemId: itemId, stock, response: data });
  } catch (error: any) {
    return NextResponse.json({ error: "Stock sync failed", details: error.message }, { status: 500 });
  }
}
