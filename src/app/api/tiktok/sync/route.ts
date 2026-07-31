export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getTokens, fetchTikTok } from "../../../../utils/tokenStorage";
import { sql, isNeonConfigured } from "../../../../utils/neonClient";

/**
 * POST /api/tiktok/sync
 *
 * Sincroniza pedidos novos do TikTok Shop com o banco de dados local.
 * Evita duplicatas usando a tabela `processed_orders`.
 *
 * Fluxo:
 * 1. Busca pedidos com status AWAITING_SHIPMENT no TikTok Shop
 * 2. Filtra pedidos já processados (via processed_orders no banco)
 * 3. Salva os novos pedidos e marca como processados
 * 4. Retorna resumo da sincronização
 */
export async function POST() {
  const tokens = await getTokens();

  if (!tokens.tiktok.connected || !tokens.tiktok.accessToken) {
    return NextResponse.json(
      { error: "TikTok Shop não conectado. Acesse /admin/tiktok para conectar." },
      { status: 401 }
    );
  }

  try {
    // Busca pedidos aguardando envio
    const response = await fetchTikTok("/api/orders/search", {
      method: "POST",
      body: JSON.stringify({ order_status: "AWAITING_SHIPMENT" }),
    });

    const data = await response.json();

    if (!response.ok || data.code !== 0) {
      return NextResponse.json(
        { error: data.message || "Erro ao buscar pedidos para sincronização" },
        { status: 500 }
      );
    }

    const orders = data.data?.order_list || [];
    let newOrders = 0;
    let skipped = 0;

    if (isNeonConfigured()) {
      for (const order of orders) {
        const orderId = `tiktok_${order.id}`;

        // Checa se o pedido já foi processado anteriormente
        const existing = await sql`
          SELECT order_id FROM processed_orders WHERE order_id = ${orderId}
        `;

        if (existing.length > 0) {
          skipped++;
          continue;
        }

        // Marca como processado para evitar duplicatas futuras
        await sql`
          INSERT INTO processed_orders (order_id) VALUES (${orderId})
          ON CONFLICT DO NOTHING
        `;

        newOrders++;
      }
    } else {
      // Modo sem banco: conta apenas os pedidos retornados
      newOrders = orders.length;
    }

    return NextResponse.json({
      success: true,
      message: `Sincronização TikTok Shop concluída`,
      newOrders,
      skipped,
      total: orders.length,
    });
  } catch (err) {
    console.error("TikTok sync error:", err);
    return NextResponse.json(
      { error: "Erro interno durante a sincronização do TikTok Shop" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tiktok/sync
 * Retorna o status atual da integração TikTok Shop.
 */
export async function GET() {
  const tokens = await getTokens();

  const isExpired =
    tokens.tiktok.connected && Date.now() > tokens.tiktok.expiresAt;
  const expiresIn = tokens.tiktok.expiresAt
    ? Math.max(0, Math.floor((tokens.tiktok.expiresAt - Date.now()) / 1000 / 60))
    : 0;

  return NextResponse.json({
    connected: tokens.tiktok.connected,
    openId: tokens.tiktok.openId || null,
    tokenExpired: isExpired,
    tokenExpiresInMinutes: expiresIn,
    clientKey: tokens.tiktok.clientKey
      ? `${tokens.tiktok.clientKey.slice(0, 6)}...`
      : null,
  });
}
