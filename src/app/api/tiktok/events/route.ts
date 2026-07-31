export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { sendTikTokEvent, TikTokEventPayload } from "../../../../utils/tiktokEvents";

/**
 * POST /api/tiktok/events
 * Envia um evento para a API de Eventos do TikTok.
 * 
 * Exemplo de body:
 * {
 *   "eventName": "PageView", // ou "ViewContent", "AddToCart", "CompletePayment", "TestEvent"
 *   "url": "https://localhost:3000/products/123",
 *   "value": 199.90,
 *   "currency": "BRL"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const userAgent = request.headers.get("user-agent") || "";
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "";

    const eventName = body.eventName || "PageView";
    const payload: TikTokEventPayload = {
      eventName,
      eventId: body.eventId,
      url: body.url || request.headers.get("referer") || undefined,
      userAgent,
      ip,
      currency: body.currency || "BRL",
      value: body.value ?? 0,
      contents: body.contents,
    };

    const result = await sendTikTokEvent(payload);

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Internal server error processing TikTok event",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tiktok/events
 * Endpoint rápido para testar o envio do evento de servidor PageView
 */
export async function GET(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") || "";
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "";

  const result = await sendTikTokEvent({
    eventName: "PageView",
    url: request.nextUrl.origin,
    userAgent,
    ip,
    value: 0,
    currency: "BRL",
  });

  return NextResponse.json(result);
}
