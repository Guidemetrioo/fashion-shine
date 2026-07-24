export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getTokens, fetchTikTok } from "../../../../utils/tokenStorage";

/**
 * GET /api/tiktok/orders
 *
 * Busca a lista de pedidos do TikTok Shop.
 * Requer que o canal TikTok esteja conectado (token válido no banco).
 *
 * Parâmetros de query opcionais:
 * - page_size: número de pedidos por página (padrão: 20, max: 50)
 * - cursor: cursor de paginação retornado pela última chamada
 * - status: filtro de status (UNPAID, ON_HOLD, AWAITING_SHIPMENT, etc.)
 */
export async function GET(request: Request) {
  const tokens = await getTokens();

  if (!tokens.tiktok.connected || !tokens.tiktok.accessToken) {
    return NextResponse.json(
      { error: "TikTok Shop não conectado. Acesse /admin/tiktok para conectar." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const pageSize = searchParams.get("page_size") || "20";
  const cursor = searchParams.get("cursor") || "";
  const status = searchParams.get("status") || "";

  try {
    // Monta os parâmetros da query para a API do TikTok Shop
    const params = new URLSearchParams({
      page_size: pageSize,
    });
    if (cursor) params.set("cursor", cursor);
    if (status) params.set("order_status", status);

    const response = await fetchTikTok(
      `/api/orders/search?${params.toString()}`,
      { method: "POST", body: JSON.stringify({}) }
    );

    const data = await response.json();

    if (!response.ok || data.code !== 0) {
      console.error("TikTok orders API error:", data);
      return NextResponse.json(
        { error: data.message || "Erro ao buscar pedidos do TikTok Shop" },
        { status: response.status }
      );
    }

    // Normaliza os dados para o formato interno do sistema
    const orders = (data.data?.order_list || []).map((order: any) => ({
      id: order.id,
      status: order.status,
      createTime: order.create_time,
      buyerInfo: order.buyer_info,
      lineItems: order.line_items,
      paymentTotal: order.payment?.total_amount,
      currency: order.payment?.currency,
      fulfillmentType: order.fulfillment_type,
      channel: "tiktok",
    }));

    return NextResponse.json({
      orders,
      total: data.data?.total_count || orders.length,
      hasMore: data.data?.has_more || false,
      nextCursor: data.data?.next_cursor || null,
    });
  } catch (err) {
    console.error("TikTok orders route error:", err);
    return NextResponse.json(
      { error: "Erro interno ao buscar pedidos do TikTok Shop" },
      { status: 500 }
    );
  }
}
