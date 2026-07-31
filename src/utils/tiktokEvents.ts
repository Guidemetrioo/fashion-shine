import { getTokens } from "./tokenStorage";

export interface TikTokEventPayload {
  eventName: "PageView" | "ViewContent" | "AddToCart" | "InitiateCheckout" | "PlaceAnOrder" | "CompletePayment" | "Search";
  eventId?: string;
  url?: string;
  userAgent?: string;
  ip?: string;
  currency?: string;
  value?: number;
  contents?: Array<{
    content_id: string;
    content_type?: string;
    content_name?: string;
    quantity?: number;
    price?: number;
  }>;
}

/**
 * Envia um evento de servidor para a API de Eventos do TikTok (v1.3).
 * Documentação oficial: https://business-api.tiktok.com/open_api/v1.3/event/track/
 */
export async function sendTikTokEvent(payload: TikTokEventPayload) {
  try {
    const tokens = await getTokens();
    const pixelCode =
      tokens.tiktok.pixelId ||
      process.env.TIKTOK_PIXEL_ID ||
      process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID ||
      "D9KK9TRC77UA1IJTKGEG";

    const accessToken =
      tokens.tiktok.eventsAccessToken ||
      process.env.TIKTOK_EVENTS_ACCESS_TOKEN ||
      tokens.tiktok.accessToken ||
      "";

    const eventId = payload.eventId || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();

    const bodyData = {
      pixel_code: pixelCode,
      event: payload.eventName,
      event_id: eventId,
      timestamp: timestamp,
      ...(accessToken ? { access_token: accessToken } : {}),
      context: {
        page: {
          url: payload.url || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        },
        user: {
          user_agent: payload.userAgent || "Server-Side TikTok Events API Client",
          ...(payload.ip ? { ip: payload.ip } : {}),
        },
      },
      properties: {
        currency: payload.currency || "BRL",
        value: payload.value ?? 0,
        ...(payload.contents && payload.contents.length > 0
          ? { contents: payload.contents }
          : {}),
      },
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (accessToken) {
      headers["Access-Token"] = accessToken;
      headers["access-token"] = accessToken;
    }

    console.log(`Sending TikTok Server Event '${payload.eventName}' for Pixel ${pixelCode} (AccessToken configured: ${!!accessToken})...`);

    const response = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
      method: "POST",
      headers,
      body: JSON.stringify(bodyData),
    });

    const resJson = await response.json().catch(() => ({}));

    if (!response.ok || (resJson.code !== undefined && resJson.code !== 0)) {
      console.warn("TikTok Events API response warning/error:", resJson);
      return {
        success: false,
        code: resJson.code ?? response.status,
        message: resJson.message || "TikTok Events API request returned error",
        pixelCode,
        eventId,
        data: resJson,
      };
    }

    console.log("✅ TikTok Server Event sent successfully:", resJson);
    return {
      success: true,
      code: 0,
      message: "Event tracked successfully",
      pixelCode,
      eventId,
      data: resJson,
    };
  } catch (error: any) {
    console.error("Error sending TikTok event:", error);
    return {
      success: false,
      code: 500,
      message: error?.message || "Failed to reach TikTok Events API",
    };
  }
}
