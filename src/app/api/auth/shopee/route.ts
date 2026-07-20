import { NextResponse } from "next/server";
import { getTokens } from "../../../../utils/tokenStorage";
import crypto from "crypto";

export async function GET() {
  const tokens = await getTokens();
  const partnerId = tokens.shopee.partnerId || process.env.SHOPEE_PARTNER_ID || "";
  const partnerKey = tokens.shopee.partnerKey || process.env.SHOPEE_PARTNER_KEY || "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!partnerId || partnerId === "insira-seu-partner-id-aqui" || !partnerKey) {
    return NextResponse.json({
      error: "SHOPEE_PARTNER_ID ou SHOPEE_PARTNER_KEY não configurado",
      instructions: "Insira suas credenciais da API da Shopee no painel de configurações (Settings) do administrador."
    }, { status: 400 });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const path = "/api/v2/shop/auth_partner";
  const baseString = `${partnerId}${path}${timestamp}`;
  const sign = crypto
    .createHmac("sha256", partnerKey)
    .update(baseString)
    .digest("hex");

  const shopeeAuthUrl = `https://partner.shopeemobile.com${path}?partner_id=${partnerId}&redirect=${appUrl}/api/auth/shopee/callback&sign=${sign}&timestamp=${timestamp}`;

  return NextResponse.redirect(shopeeAuthUrl);
}
