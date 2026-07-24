export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getTokens } from "../../../../utils/tokenStorage";

/**
 * GET /api/auth/tiktok
 *
 * Inicia o fluxo OAuth 2.0 do TikTok Shop.
 * Redireciona o usuário para a tela de autorização do TikTok.
 *
 * Fluxo:
 * 1. Lê as credenciais (clientKey) do banco ou .env
 * 2. Monta a URL de autorização com redirect_uri
 * 3. Redireciona o navegador do admin para o TikTok
 */
export async function GET(request: NextRequest) {
  const tokens = await getTokens();
  const clientKey =
    tokens.tiktok.clientKey || process.env.TIKTOK_CLIENT_KEY || "";

  // Determina a URL base dinamicamente para funcionar em localhost e produção
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    request.nextUrl.origin ||
    "http://localhost:3000";

  if (!clientKey || clientKey === "insira-seu-app-key-aqui") {
    return NextResponse.json(
      {
        error: "TIKTOK_CLIENT_KEY não configurado",
        instructions:
          "Insira o App Key do TikTok Shop no painel de configurações do administrador ou no arquivo .env.local.",
      },
      { status: 400 }
    );
  }

  const redirectUri = `${appUrl}/api/auth/tiktok/callback`;

  // Parâmetro state para mitigar CSRF — em produção, use um valor aleatório
  const state = Buffer.from(Date.now().toString()).toString("base64");

  const authUrl = new URL("https://services.tiktokshop.com/open/authorize");
  authUrl.searchParams.set("client_key", clientKey);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}
