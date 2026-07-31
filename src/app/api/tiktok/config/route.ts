export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { saveTokens, getTokens } from "../../../../utils/tokenStorage";

/**
 * POST /api/tiktok/config
 * Salva as credenciais do TikTok (Events Access Token, Pixel ID, App Key, App Secret)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { eventsAccessToken, pixelId, clientKey, clientSecret } = body;

    const currentTokens = await getTokens();

    const updatedTikTok = {
      ...currentTokens.tiktok,
      ...(eventsAccessToken !== undefined ? { eventsAccessToken } : {}),
      ...(pixelId !== undefined ? { pixelId } : {}),
      ...(clientKey !== undefined ? { clientKey } : {}),
      ...(clientSecret !== undefined ? { clientSecret } : {}),
    };

    await saveTokens({ tiktok: updatedTikTok });

    return NextResponse.json({
      success: true,
      message: "Configurações do TikTok salvas com sucesso!",
      tiktok: {
        pixelId: updatedTikTok.pixelId,
        eventsAccessTokenConfigured: !!updatedTikTok.eventsAccessToken,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Erro ao salvar configurações do TikTok" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tiktok/config
 */
export async function GET() {
  const tokens = await getTokens();
  return NextResponse.json({
    pixelId: tokens.tiktok.pixelId || process.env.TIKTOK_PIXEL_ID || "D9KK9TRC77UA1IJTKGEG",
    eventsAccessTokenConfigured: !!(
      tokens.tiktok.eventsAccessToken || process.env.TIKTOK_EVENTS_ACCESS_TOKEN
    ),
  });
}
