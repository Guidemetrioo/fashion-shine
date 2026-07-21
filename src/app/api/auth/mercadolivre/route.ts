import { NextRequest, NextResponse } from "next/server";
import { getTokens } from "../../../../utils/tokenStorage";

export async function GET(request: NextRequest) {
  const tokens = await getTokens();
  const clientId = tokens.mercadolivre.clientId || process.env.ML_CLIENT_ID || "";
  
  // Use request origin dynamically for redirect URI
  const requestOrigin = request.nextUrl ? request.nextUrl.origin : "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || requestOrigin || "http://localhost:3000";

  if (!clientId || clientId === "insira-seu-client-id-aqui") {
    return NextResponse.json({
      error: "ML_CLIENT_ID não configurado",
      instructions: "Insira suas credenciais da aplicação Mercado Livre no painel de configurações do administrador."
    }, { status: 400 });
  }

  const redirectUri = `${appUrl}/api/auth/mercadolivre/callback`;
  const mlAuthUrl = `https://auth.mercadolivre.com.br/authorization?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return NextResponse.redirect(mlAuthUrl);
}
