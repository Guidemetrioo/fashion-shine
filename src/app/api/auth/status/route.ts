import { NextResponse } from "next/server";
import { getTokens, saveTokens } from "../../../../utils/tokenStorage";

export async function GET() {
  const tokens = await getTokens();

  const mlClientId = tokens.mercadolivre.clientId || process.env.ML_CLIENT_ID || "";
  const mlClientSecret = tokens.mercadolivre.clientSecret || process.env.ML_CLIENT_SECRET || "";
  const mlClientIdConfigured = !!mlClientId && mlClientId !== "insira-seu-client-id-aqui";

  const shopeePartnerId = tokens.shopee.partnerId || process.env.SHOPEE_PARTNER_ID || "";
  const shopeeConfigured = !!shopeePartnerId && shopeePartnerId !== "insira-seu-partner-id-aqui";

  return NextResponse.json({
    shopee: {
      connected: tokens.shopee.connected,
      configured: shopeeConfigured,
      partnerId: shopeePartnerId
    },
    mercadolivre: {
      connected: tokens.mercadolivre.connected,
      nickname: tokens.mercadolivre.nickname || "Desconectado",
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
            userId: "12345678",
            nickname: nickname || "Fashion Shine Oficial"
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
            nickname: ""
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

    // Save Credentials
    if (channel === "mercadolivre" && clientId) {
      await saveTokens({
        mercadolivre: {
          clientId,
          clientSecret: clientSecret || "",
          connected: false,
          accessToken: "",
          refreshToken: "",
          expiresAt: 0,
          userId: "",
          nickname: ""
        }
      });
      return NextResponse.json({ success: true });
    }

    if (channel === "shopee" && partnerId) {
      await saveTokens({
        shopee: {
          partnerId,
          partnerKey: partnerKey || "",
          connected: false,
          accessToken: "",
          refreshToken: "",
          expiresAt: 0,
          shopId: ""
        }
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
