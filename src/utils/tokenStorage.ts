import fs from "fs";
import path from "path";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

const TOKENS_FILE = path.join(process.cwd(), "tokens.json");

export interface StoredTokens {
  shopee: {
    connected: boolean;
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    shopId: string;
    partnerId: string;
    partnerKey: string;
  };
  mercadolivre: {
    connected: boolean;
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    userId: string;
    nickname: string;
    clientId: string;
    clientSecret: string;
  };
}

const defaultTokens: StoredTokens = {
  shopee: {
    connected: false,
    accessToken: "",
    refreshToken: "",
    expiresAt: 0,
    shopId: "",
    partnerId: "",
    partnerKey: "",
  },
  mercadolivre: {
    connected: false,
    accessToken: "",
    refreshToken: "",
    expiresAt: 0,
    userId: "",
    nickname: "",
    clientId: "",
    clientSecret: "",
  },
};

export function getLocalTokens(): StoredTokens {
  try {
    if (!fs.existsSync(TOKENS_FILE)) {
      fs.writeFileSync(TOKENS_FILE, JSON.stringify(defaultTokens, null, 2), "utf8");
      return defaultTokens;
    }
    const data = fs.readFileSync(TOKENS_FILE, "utf8");
    return JSON.parse(data) as StoredTokens;
  } catch (error) {
    console.error("Error reading tokens storage file:", error);
    return defaultTokens;
  }
}

export async function getTokens(): Promise<StoredTokens> {
  if (!isSupabaseConfigured()) {
    return getLocalTokens();
  }

  try {
    const { data, error } = await supabase
      .from("integration_tokens")
      .select("*");

    if (error) throw error;

    const mlRow = data?.find(r => r.channel === "mercadolivre");
    const shopeeRow = data?.find(r => r.channel === "shopee");

    const tokens: StoredTokens = {
      shopee: {
        connected: shopeeRow?.connected ?? false,
        accessToken: shopeeRow?.access_token ?? "",
        refreshToken: shopeeRow?.refresh_token ?? "",
        expiresAt: Number(shopeeRow?.expires_at ?? 0),
        shopId: shopeeRow?.shop_id ?? "",
        partnerId: shopeeRow?.partner_id ?? "",
        partnerKey: shopeeRow?.partner_key ?? "",
      },
      mercadolivre: {
        connected: mlRow?.connected ?? false,
        accessToken: mlRow?.access_token ?? "",
        refreshToken: mlRow?.refresh_token ?? "",
        expiresAt: Number(mlRow?.expires_at ?? 0),
        userId: mlRow?.user_id ?? "",
        nickname: mlRow?.nickname ?? "",
        clientId: mlRow?.client_id ?? "",
        clientSecret: mlRow?.client_secret ?? "",
      },
    };

    // Save locally as backup
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), "utf8");

    return tokens;
  } catch (error) {
    console.warn("Supabase load tokens error, falling back to local storage:", error);
    return getLocalTokens();
  }
}

export async function saveTokens(tokens: Partial<StoredTokens>): Promise<StoredTokens> {
  const current = getLocalTokens();
  const updated = {
    ...current,
    shopee: { ...current.shopee, ...tokens.shopee },
    mercadolivre: { ...current.mercadolivre, ...tokens.mercadolivre },
  };

  // 1. Save locally
  try {
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(updated, null, 2), "utf8");
  } catch (error) {
    console.error("Error writing tokens locally:", error);
  }

  // 2. Save to Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const promises = [];

      if (tokens.mercadolivre) {
        promises.push(
          supabase.from("integration_tokens").upsert({
            channel: "mercadolivre",
            connected: updated.mercadolivre.connected,
            access_token: updated.mercadolivre.accessToken,
            refresh_token: updated.mercadolivre.refreshToken,
            expires_at: updated.mercadolivre.expiresAt,
            user_id: updated.mercadolivre.userId,
            nickname: updated.mercadolivre.nickname,
            client_id: updated.mercadolivre.clientId,
            client_secret: updated.mercadolivre.clientSecret,
          })
        );
      }

      if (tokens.shopee) {
        promises.push(
          supabase.from("integration_tokens").upsert({
            channel: "shopee",
            connected: updated.shopee.connected,
            access_token: updated.shopee.accessToken,
            refresh_token: updated.shopee.refreshToken,
            expires_at: updated.shopee.expiresAt,
            shop_id: updated.shopee.shopId,
            partner_id: updated.shopee.partnerId,
            partner_key: updated.shopee.partnerKey,
          })
        );
      }

      const results = await Promise.all(promises);
      const errors = results.map(r => r.error).filter(Boolean);
      if (errors.length > 0) {
        console.error("Supabase tokens upsert warning:", errors);
      }
    } catch (err) {
      console.error("Supabase tokens upsert failed:", err);
    }
  }

  return updated;
}
