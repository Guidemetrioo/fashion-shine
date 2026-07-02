import { NextRequest, NextResponse } from "next/server";
import { getTokens, saveTokens } from "../../../../../utils/tokenStorage";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
  }

  const tokens = await getTokens();
  const clientId = tokens.mercadolivre.clientId || process.env.ML_CLIENT_ID || "";
  const clientSecret = tokens.mercadolivre.clientSecret || process.env.ML_CLIENT_SECRET || "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
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
        redirect_uri: `${appUrl}/api/auth/mercadolivre/callback`,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("ML Token Exchange Error:", data);
      return NextResponse.json({ error: "Failed to exchange code", details: data }, { status: 500 });
    }

    // Get client info to fetch the actual seller nickname
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

    // Redirect to admin dashboard
    return NextResponse.redirect(`${appUrl}/admin?status=ml_connected`);
  } catch (error: any) {
    console.error("OAuth exchange failed:", error);
    return NextResponse.json({ error: "OAuth exchange failed", details: error.message }, { status: 500 });
  }
}
