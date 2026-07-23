import { NextResponse } from "next/server";
import { getTokens, saveTokens } from "../../../../utils/tokenStorage";

export const dynamic = "force-dynamic";

export async function GET() {
  const tokens = await getTokens();

  const mlClientId = tokens.mercadolivre.clientId || process.env.ML_CLIENT_ID || "";
  const mlClientSecret = tokens.mercadolivre.clientSecret || process.env.ML_CLIENT_SECRET || "";
  const mlClientIdConfigured = !!mlClientId && mlClientId !== "insira-seu-client-id-aqui";

  const shopeePartnerId = tokens.shopee.partnerId || process.env.SHOPEE_PARTNER_ID || "";
  const shopeeConfigured = !!shopeePartnerId && shopeePartnerId !== "insira-seu-partner-id-aqui";

  // Check if actually connected with real tokens
  const isMlConnected = tokens.mercadolivre.connected && !!tokens.mercadolivre.accessToken && tokens.mercadolivre.accessToken !== "ml_active_access_token";
  const isShopeeConnected = tokens.shopee.connected && !!tokens.shopee.accessToken && tokens.shopee.accessToken !== "shopee_active_access_token";

  return NextResponse.json({
    shopee: {
      connected: isShopeeConnected,
      configured: shopeeConfigured,
      partnerId: shopeePartnerId
    },
    mercadolivre: {
      connected: isMlConnected,
      nickname: tokens.mercadolivre.nickname || "fashionshine",
      configured: mlClientIdConfigured,
      clientId: mlClientId,
      clientSecret: mlClientSecret ? "••••••••••••••••" : ""
    }
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { channel, disconnect, simulate, nickname, clientId, clientSecret, partnerId, partnerKey } = body;

    if (simulate) {
      if (channel === "mercadolivre") {
        await saveTokens({
          mercadolivre: {
            connected: true,
            accessToken: "mock_ml_access_token",
            refreshToken: "mock_ml_refresh_token",
            expiresAt: Date.now() + 3600 * 1000 * 24 * 365,
            userId: "6534119322003352",
            nickname: nickname || "fashionshine"
          }
        });
      } else if (channel === "shopee") {
        await saveTokens({
          shopee: {
            connected: true,
            accessToken: "mock_shopee_access_token",
            refreshToken: "mock_shopee_refresh_token",
            expiresAt: Date.now() + 3600 * 1000 * 24 * 365,
            shopId: "99812739",
            partnerId: "1002938",
            partnerKey: "mock_key"
          }
        });
      }
      return NextResponse.json({ success: true });
    }

    if (disconnect) {
      if (channel === "mercadolivre") {
        await saveTokens({
          mercadolivre: {
            connected: false,
            accessToken: "",
            refreshToken: "",
            expiresAt: 0,
            userId: "",
            nickname: "Desconectado"
          }
        });
      } else if (channel === "shopee") {
        await saveTokens({
          shopee: {
            connected: false,
            accessToken: "",
            refreshToken: "",
            expiresAt: 0,
            shopId: ""
          }
        });
      }
      return NextResponse.json({ success: true });
    }

    // Save Credentials for Mercado Livre (without fake tokens)
    if (channel === "mercadolivre" && clientId) {
      const current = await getTokens();
      const finalSecret = (clientSecret && clientSecret !== "••••••••••••••••") 
        ? clientSecret 
        : current.mercadolivre.clientSecret;

      await saveTokens({
        mercadolivre: {
          clientId,
          clientSecret: finalSecret
        }
      });
      return NextResponse.json({ success: true });
    }

    // Save Credentials for Shopee
    if (channel === "shopee" && partnerId) {
      const current = await getTokens();
      const finalKey = (partnerKey && partnerKey !== "••••••••••••••••")
        ? partnerKey
        : current.shopee.partnerKey;

      await saveTokens({
        shopee: {
          partnerId,
          partnerKey: finalKey
        }
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
