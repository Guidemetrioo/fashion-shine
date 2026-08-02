import { NextRequest, NextResponse } from "next/server";
import { getTokens, saveTokens } from "../../../../../utils/tokenStorage";

// Handle OAuth callback - supports both GET (direct redirect) and POST (from admin page)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const requestOrigin = request.nextUrl ? request.nextUrl.origin : "";
  const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || vercelUrl || requestOrigin || "http://localhost:3000";

  // Handle ML OAuth error redirect (e.g., user denied access)
  if (error) {
    const errorMsg = searchParams.get("error_description") || error;
    return NextResponse.redirect(
      `${appUrl}/admin?status=ml_error&reason=${encodeURIComponent(errorMsg)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${appUrl}/admin?status=ml_error&reason=${encodeURIComponent("Código de autorização não recebido. Tente novamente.")}`
    );
  }

  // Exchange code for tokens
  const result = await exchangeCodeForTokens(code, appUrl);

  if (result.error) {
    return NextResponse.redirect(
      `${appUrl}/admin?status=ml_error&reason=${encodeURIComponent(result.error)}`
    );
  }

  return NextResponse.redirect(`${appUrl}/admin?status=ml_connected`);
}

// POST handler for when admin page sends the code via fetch
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const code = body.code;

    if (!code) {
      return NextResponse.json({ error: "Código de autorização ausente" }, { status: 400 });
    }

    const requestOrigin = request.nextUrl ? request.nextUrl.origin : "";
    const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || vercelUrl || requestOrigin || "http://localhost:3000";

    const result = await exchangeCodeForTokens(code, appUrl);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, nickname: result.nickname });
  } catch (error: any) {
    console.error("POST callback error:", error);
    return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 });
  }
}

async function exchangeCodeForTokens(code: string, appUrl: string): Promise<{ error?: string; nickname?: string }> {
  const tokens = await getTokens();
  let clientId = tokens.mercadolivre.clientId || process.env.ML_CLIENT_ID || "2359144603208389";
  if (clientId === "3352061070183940" || clientId === "insira-seu-client-id-aqui") {
    clientId = "2359144603208389";
  }
  const clientSecret = tokens.mercadolivre.clientSecret || process.env.ML_CLIENT_SECRET || "r7L5K7dgAo4zVXr8Dm36RX8qae980Fea";

  try {
    // redirect_uri MUST match character-by-character what was sent in the authorization request
    // AND what is registered in your App on Mercado Livre Dev Portal
    const defaultRedirectUri = `${appUrl}/api/auth/mercadolivre/callback`;
    const redirectUri = process.env.ML_REDIRECT_URI || defaultRedirectUri;

    const response = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("ML Token Exchange Error:", data);
      const errorDetail = data.message || data.error || "Falha na troca do código de autorização";
      return { error: errorDetail };
    }

    // Get seller nickname
    const userResponse = await fetch(`https://api.mercadolibre.com/users/${data.user_id}`, {
      headers: {
        Authorization: `Bearer ${data.access_token}`,
      },
    });

    let nickname = "Fashion Shine Oficial";
    if (userResponse.ok) {
      const userData = await userResponse.json();
      nickname = userData.nickname || "Fashion Shine";
    }

    // Store tokens
    await saveTokens({
      mercadolivre: {
        connected: true,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
        userId: String(data.user_id),
        nickname,
      },
    });

    return { nickname };
  } catch (error: any) {
    console.error("OAuth exchange failed:", error);
    return { error: "Erro de rede na troca OAuth. Verifique sua conexão e tente novamente." };
  }
}
