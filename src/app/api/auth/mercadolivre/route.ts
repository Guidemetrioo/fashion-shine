import { NextResponse } from "next/server";
import { getTokens } from "../../../../utils/tokenStorage";

export async function GET() {
  const tokens = await getTokens();
  const clientId = tokens.mercadolivre.clientId || process.env.ML_CLIENT_ID || "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!clientId || clientId === "insira-seu-client-id-aqui") {
    return NextResponse.json({
      error: "ML_CLIENT_ID no configurado",
      instructions: "Insira suas credenciais da aplicação Mercado Livre no painel de configurações (Settings) do administrador."
    }, { status: 400 });
  }

  const mlAuthUrl = `https://auth.mercadolivre.com.br/authorization?client_id=${clientId}&response_type=code&redirect_uri=${appUrl}/api/auth/mercadolivre/callback`;

  return NextResponse.redirect(mlAuthUrl);
}
