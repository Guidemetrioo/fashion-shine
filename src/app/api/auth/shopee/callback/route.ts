import { NextRequest, NextResponse } from "next/server";
import { getTokens, saveTokens } from "../../../../../utils/tokenStorage";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const shopIdStr = searchParams.get("shop_id");

  if (!code || !shopIdStr) {
    return NextResponse.json({ error: "Missing authorization code or shop_id" }, { status: 400 });
  }

  const tokens = await getTokens();
  const partnerId = tokens.shopee.partnerId || process.env.SHOPEE_PARTNER_ID || "";
  const partnerKey = tokens.shopee.partnerKey || process.env.SHOPEE_PARTNER_KEY || "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const shopId = Number(shopIdStr);

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const path = "/api/v2/auth/token/get";
    const baseString = `${partnerId}${path}${timestamp}`;
    const sign = crypto
      .createHmac("sha256", partnerKey)
      .update(baseString)
      .digest("hex");

    const url = `https://partner.shopeemobile.com${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        code,
        partner_id: Number(partnerId),
        shop_id: shopId,
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error("Shopee Token Exchange Error:", data);
      return NextResponse.json({ error: "Failed to exchange Shopee code", details: data }, { status: 500 });
    }

    // Store tokens
    await saveTokens({
      shopee: {
        connected: true,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
        shopId: String(shopId),
      },
    });

    // Redirect to admin dashboard
    return NextResponse.redirect(`${appUrl}/admin?status=shopee_connected`);
  } catch (error: any) {
    console.error("Shopee OAuth exchange failed:", error);
    return NextResponse.json({ error: "OAuth exchange failed", details: error.message }, { status: 500 });
  }
}
