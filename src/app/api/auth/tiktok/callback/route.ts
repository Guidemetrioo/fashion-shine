export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { saveTokens, getTokens } from "../../../../../utils/tokenStorage";

/**
 * GET /api/auth/tiktok/callback
 *
 * Recebe o código de autorização do TikTok Shop após o usuário aprovar o acesso.
 *
 * Fluxo:
 * 1. TikTok redireciona para esta URL com ?code=XXXX
 * 2. Trocamos o code por access_token + refresh_token via POST
 * 3. Salvamos os tokens no banco (integration_tokens, channel = 'tiktok')
 * 4. Redirecionamos o admin para a página de integração TikTok
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const errParam = searchParams.get("error");

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    request.nextUrl.origin ||
    "http://localhost:3000";

  // TikTok pode retornar um erro (ex: usuário cancelou)
  if (errParam) {
    console.error("TikTok OAuth error:", errParam);
    return NextResponse.redirect(
      `${appUrl}/admin/tiktok?error=${encodeURIComponent(errParam)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${appUrl}/admin/tiktok?error=missing_code`
    );
  }

  // Lê credenciais do banco ou .env como fallback
  const tokens = await getTokens();
  const clientKey =
    tokens.tiktok.clientKey || process.env.TIKTOK_CLIENT_KEY || "";
  const clientSecret =
    tokens.tiktok.clientSecret || process.env.TIKTOK_CLIENT_SECRET || "";
  const redirectUri = `${appUrl}/api/auth/tiktok/callback`;

  if (!clientKey || !clientSecret) {
    return NextResponse.redirect(
      `${appUrl}/admin/tiktok?error=missing_credentials`
    );
  }

  try {
    // Troca o code temporário pelos tokens de longa duração
    const tokenRes = await fetch(
      "https://auth.tiktok-shops.com/api/v2/token/get",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_key: clientKey,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      }
    );

    const result = await tokenRes.json();

    // A API do TikTok retorna code=0 quando bem-sucedida
    if (!tokenRes.ok || result.code !== 0) {
      console.error("TikTok token exchange failed:", result);
      return NextResponse.redirect(
        `${appUrl}/admin/tiktok?error=${encodeURIComponent(
          result.message || "token_exchange_failed"
        )}`
      );
    }

    const {
      access_token,
      refresh_token,
      access_token_expire_in,
      open_id,
    } = result.data;

    // Salva no banco usando o mesmo sistema dos outros canais
    await saveTokens({
      tiktok: {
        connected: true,
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: Date.now() + access_token_expire_in * 1000,
        openId: open_id,
        clientKey,
        clientSecret,
      },
    });

    console.log(`TikTok Shop conectado com sucesso. open_id: ${open_id}`);

    return NextResponse.redirect(`${appUrl}/admin/tiktok?success=true`);
  } catch (err) {
    console.error("TikTok callback error:", err);
    return NextResponse.redirect(
      `${appUrl}/admin/tiktok?error=server_error`
    );
  }
}
