export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getTokens } from "../../../../utils/tokenStorage";

export async function GET(request: NextRequest) {
  const tokens = await getTokens();
  const clientId = tokens.mercadolivre.clientId || process.env.ML_CLIENT_ID || "";
  
  // Use request origin dynamically for redirect URI
  const requestOrigin = request.nextUrl ? request.nextUrl.origin : "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || requestOrigin || "http://localhost:3000";

  if (!clientId || clientId === "insira-seu-client-id-aqui") {
    // Redirect back to admin with error instead of returning JSON (which the user never sees)
    const errorUrl = `${appUrl}/admin?status=ml_error&reason=${encodeURIComponent("Client ID não configurado. Preencha suas credenciais no painel de integrações.")}`;
    return NextResponse.redirect(errorUrl);
  }

  const clientSecret = tokens.mercadolivre.clientSecret || process.env.ML_CLIENT_SECRET || "";
  if (!clientSecret) {
    const errorUrl = `${appUrl}/admin?status=ml_error&reason=${encodeURIComponent("Client Secret não configurado. Preencha o Client Secret no painel de integrações.")}`;
    return NextResponse.redirect(errorUrl);
  }

  const redirectUri = `${appUrl}/api/auth/mercadolivre/callback`;
  const mlAuthUrl = `https://auth.mercadolivre.com.br/authorization?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return NextResponse.redirect(mlAuthUrl);
}
