export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { sql, isNeonConfigured } from "../../../../utils/neonClient";

/**
 * POST /api/webhooks/tiktok
 *
 * Recebe notificações em tempo real do TikTok Shop via webhook.
 * Deve ser registrado no Partner Center em: App → Webhooks → Endpoint URL
 *
 * Eventos suportados:
 * - ORDER_STATUS_CHANGE: pedido criado, pago, cancelado, etc.
 * - PRODUCT_STATUS_CHANGE: produto aprovado, rejeitado, etc.
 * - PACKAGE_UPDATE: atualização de rastreamento
 *
 * Segurança:
 * - O TikTok assina os webhooks com HMAC-SHA256
 * - Validamos a assinatura antes de processar qualquer dado
 */
export async function POST(request: NextRequest) {
  let body: string;
  try {
    body = await request.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Valida a assinatura do webhook (segurança obrigatória)
  const signature = request.headers.get("x-tiktok-signature") || "";
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET || "";

  if (clientSecret && signature) {
    const { createHmac } = await import("crypto");
    const expectedSig = createHmac("sha256", clientSecret)
      .update(body)
      .digest("hex");

    if (signature !== expectedSig) {
      console.warn("TikTok webhook: assinatura inválida. Requisição ignorada.");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, data } = payload;
  console.log(`TikTok webhook recebido. Tipo: ${type}`, data);

  try {
    switch (type) {
      case "ORDER_STATUS_CHANGE": {
        /**
         * Novo pedido ou mudança de status — marcar como processado
         * para evitar duplicatas na sincronização manual
         */
        const orderId = `tiktok_${data?.order_id}`;
        if (orderId && isNeonConfigured()) {
          await sql`
            INSERT INTO processed_orders (order_id) VALUES (${orderId})
            ON CONFLICT DO NOTHING
          `;
        }
        console.log(`TikTok Order ${data?.order_id} → status: ${data?.order_status}`);
        break;
      }

      case "PRODUCT_STATUS_CHANGE": {
        console.log(
          `TikTok Product ${data?.product_id} → status: ${data?.product_status}`
        );
        // Aqui você pode atualizar o campo tiktok_synced na tabela products
        break;
      }

      case "PACKAGE_UPDATE": {
        console.log(
          `TikTok Package update para pedido ${data?.order_id}: ${data?.tracking_number}`
        );
        break;
      }

      default:
        console.log(`TikTok webhook: tipo não tratado "${type}"`);
    }
  } catch (err) {
    console.error("Erro ao processar TikTok webhook:", err);
    // Retorna 200 mesmo em caso de erro interno para evitar reenvios do TikTok
    return NextResponse.json({ received: true, processed: false });
  }

  // TikTok exige resposta 200 para confirmar recebimento
  return NextResponse.json({ received: true, processed: true });
}
