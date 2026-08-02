export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getTokens } from "../../../../utils/tokenStorage";

export async function GET(request: NextRequest) {
  const tokens = await getTokens();
  let clientId = tokens.mercadolivre.clientId || process.env.ML_CLIENT_ID || "2359144603208389";
  if (clientId === "3352061070183940" || clientId === "insira-seu-client-id-aqui") {
    clientId = "2359144603208389";
  }
  
  // Use request origin dynamically for redirect URI
  const requestOrigin = request.nextUrl ? request.nextUrl.origin : "";
  const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || vercelUrl || requestOrigin || "http://localhost:3000";

  let clientSecret = process.env.ML_CLIENT_SECRET || "QdbVlKroptiGi8jiacjYIhwtfbcEj1ac";

  // redirect_uri MUST match character-by-character what is registered in your App on Mercado Livre Dev Portal
  const defaultRedirectUri = `${appUrl}/api/auth/mercadolivre/callback`;
  const redirectUri = process.env.ML_REDIRECT_URI || defaultRedirectUri;
  
  const mlAuthUrl = `https://auth.mercadolivre.com.br/authorization?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return NextResponse.redirect(mlAuthUrl);
}
