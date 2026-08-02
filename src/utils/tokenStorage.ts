import fs from "fs";
import path from "path";
import crypto from "crypto";
import { sql, isNeonConfigured } from "./neonClient";

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
  tiktok: {
    connected: boolean;
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    openId: string;
    clientKey: string;
    clientSecret: string;
    pixelId?: string;
    eventsAccessToken?: string;
    catalogId?: string;
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
  tiktok: {
    connected: false,
    accessToken: "",
    refreshToken: "",
    expiresAt: 0,
    openId: "",
    clientKey: "",
    clientSecret: "",
    pixelId: "",
    eventsAccessToken: "",
    catalogId: "",
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

let activeMlRefreshPromise: Promise<StoredTokens> | null = null;
let activeShopeeRefreshPromise: Promise<StoredTokens> | null = null;
let activeTikTokRefreshPromise: Promise<StoredTokens> | null = null;

export async function getTokens(): Promise<StoredTokens> {
  let tokens: StoredTokens;

  if (!isNeonConfigured()) {
    tokens = getLocalTokens();
  } else {
    try {
      const data = await sql`SELECT * FROM integration_tokens`;

      const mlRow = data?.find((r: any) => r.channel === "mercadolivre");
      const shopeeRow = data?.find((r: any) => r.channel === "shopee");
      const tiktokRow = data?.find((r: any) => r.channel === "tiktok");

      tokens = {
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
        tiktok: {
          connected: tiktokRow?.connected ?? false,
          accessToken: tiktokRow?.access_token ?? "",
          refreshToken: tiktokRow?.refresh_token ?? "",
          expiresAt: Number(tiktokRow?.expires_at ?? 0),
          openId: tiktokRow?.user_id ?? "",
          clientKey: tiktokRow?.client_id ?? "",
          clientSecret: tiktokRow?.client_secret ?? "",
        },
      };

      // Save locally as backup
      fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), "utf8");
    } catch (error) {
      console.warn("Neon load tokens error, falling back to local storage:", error);
      tokens = getLocalTokens();
    }
  }

  // Override old/empty credentials with the new Mercado Livre application keys
  if (tokens.mercadolivre.clientId === "6534119322003352" || !tokens.mercadolivre.clientId) {
    tokens.mercadolivre.clientId = "2359144603208389";
  }
  if (tokens.mercadolivre.clientSecret === "qMwiSB3NuHA3PnRRCUC4KhgtXK50NjaA" || !tokens.mercadolivre.clientSecret) {
    tokens.mercadolivre.clientSecret = "QdbVlKroptiGi8jiacjYIhwtfbcEj1ac";
  }

  // Auto-refresh Mercado Livre token if connected and expired/expiring soon
  if (
    tokens.mercadolivre.connected &&
    tokens.mercadolivre.clientId &&
    tokens.mercadolivre.clientSecret &&
    tokens.mercadolivre.refreshToken &&
    tokens.mercadolivre.refreshToken !== "mock_ml_refresh_token" &&
    tokens.mercadolivre.refreshToken !== "ml_active_refresh_token" &&
    Date.now() >= tokens.mercadolivre.expiresAt - 5 * 60 * 1000
  ) {
    if (activeMlRefreshPromise) {
      return activeMlRefreshPromise;
    }

    activeMlRefreshPromise = (async () => {
      console.log("Mercado Livre token expiring soon. Refreshing...");
      const controller = new AbortController();
      const refreshTimer = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch("https://api.mercadolibre.com/oauth/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: tokens.mercadolivre.clientId,
            client_secret: tokens.mercadolivre.clientSecret,
            refresh_token: tokens.mercadolivre.refreshToken,
          }),
          signal: controller.signal
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(`Refresh token endpoint returned status ${response.status}: ${JSON.stringify(data)}`);
        }

        const updatedTokens = await saveTokens({
          mercadolivre: {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + data.expires_in * 1000,
            userId: String(data.user_id),
          },
        });

        console.log("Mercado Livre token refreshed and saved successfully.");
        return updatedTokens;
      } catch (err) {
        console.error("Failed to refresh Mercado Livre token:", err);
        return tokens; // Return current tokens as fallback
      } finally {
        clearTimeout(refreshTimer);
        activeMlRefreshPromise = null;
      }
    })();

    return activeMlRefreshPromise;
  }

  // Auto-refresh Shopee token if connected and expired/expiring soon
  if (
    tokens.shopee.connected &&
    tokens.shopee.partnerId &&
    tokens.shopee.partnerKey &&
    tokens.shopee.refreshToken &&
    tokens.shopee.refreshToken !== "mock_shopee_refresh_token" &&
    tokens.shopee.refreshToken !== "shopee_active_refresh_token" &&
    tokens.shopee.shopId &&
    Date.now() >= tokens.shopee.expiresAt - 10 * 60 * 1000
  ) {
    if (activeShopeeRefreshPromise) {
      return activeShopeeRefreshPromise;
    }

    activeShopeeRefreshPromise = (async () => {
      console.log("Shopee token expiring soon. Refreshing...");
      try {
        const updatedTokens = await forceRefreshShopeeToken();
        console.log("Shopee token refreshed and saved successfully.");
        return updatedTokens;
      } catch (err) {
        console.error("Failed to refresh Shopee token:", err);
        return tokens;
      } finally {
        activeShopeeRefreshPromise = null;
      }
    })();

    return activeShopeeRefreshPromise;
  }

  // Auto-refresh TikTok token if connected and expired/expiring soon
  if (
    tokens.tiktok.connected &&
    tokens.tiktok.clientKey &&
    tokens.tiktok.clientSecret &&
    tokens.tiktok.refreshToken &&
    Date.now() >= tokens.tiktok.expiresAt - 5 * 60 * 1000
  ) {
    if (activeTikTokRefreshPromise) {
      return activeTikTokRefreshPromise;
    }

    activeTikTokRefreshPromise = (async () => {
      console.log("TikTok token expiring soon. Refreshing...");
      try {
        const updatedTokens = await forceRefreshTikTokToken();
        console.log("TikTok token refreshed and saved successfully.");
        return updatedTokens;
      } catch (err) {
        console.error("Failed to refresh TikTok token:", err);
        return tokens;
      } finally {
        activeTikTokRefreshPromise = null;
      }
    })();

    return activeTikTokRefreshPromise;
  }

  return tokens;
}

export async function saveTokens(tokens: {
  shopee?: Partial<StoredTokens["shopee"]>;
  mercadolivre?: Partial<StoredTokens["mercadolivre"]>;
  tiktok?: Partial<StoredTokens["tiktok"]>;
}): Promise<StoredTokens> {
  // Read current state from DB (not local file) to avoid data loss on serverless
  let current: StoredTokens;
  if (isNeonConfigured()) {
    try {
      const data = await sql`SELECT * FROM integration_tokens`;
      const mlRow = data?.find((r: any) => r.channel === "mercadolivre");
      const shopeeRow = data?.find((r: any) => r.channel === "shopee");
      const tiktokRow = data?.find((r: any) => r.channel === "tiktok");
      current = {
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
        tiktok: {
          connected: tiktokRow?.connected ?? false,
          accessToken: tiktokRow?.access_token ?? "",
          refreshToken: tiktokRow?.refresh_token ?? "",
          expiresAt: Number(tiktokRow?.expires_at ?? 0),
          openId: tiktokRow?.user_id ?? "",
          clientKey: tiktokRow?.client_id ?? "",
          clientSecret: tiktokRow?.client_secret ?? "",
        },
      };
    } catch (err) {
      console.warn("saveTokens: Failed to read from Neon, falling back to local:", err);
      current = getLocalTokens();
    }
  } else {
    current = getLocalTokens();
  }

  const updated = {
    ...current,
    shopee: { ...current.shopee, ...tokens.shopee },
    mercadolivre: { ...current.mercadolivre, ...tokens.mercadolivre },
    tiktok: { ...current.tiktok, ...tokens.tiktok },
  };

  // 1. Save locally
  try {
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(updated, null, 2), "utf8");
  } catch (error) {
    console.error("Error writing tokens locally:", error);
  }

  // 2. Save to Neon if configured
  if (isNeonConfigured()) {
    try {
      if (tokens.mercadolivre) {
        await sql`
          INSERT INTO integration_tokens (
            channel, connected, access_token, refresh_token, expires_at, user_id, nickname, client_id, client_secret
          ) VALUES (
            'mercadolivre',
            ${updated.mercadolivre.connected ?? false},
            ${updated.mercadolivre.accessToken ?? ""},
            ${updated.mercadolivre.refreshToken ?? ""},
            ${updated.mercadolivre.expiresAt ?? 0},
            ${updated.mercadolivre.userId ?? ""},
            ${updated.mercadolivre.nickname ?? ""},
            ${updated.mercadolivre.clientId ?? ""},
            ${updated.mercadolivre.clientSecret ?? ""}
          )
          ON CONFLICT (channel)
          DO UPDATE SET
            connected = EXCLUDED.connected,
            access_token = EXCLUDED.access_token,
            refresh_token = EXCLUDED.refresh_token,
            expires_at = EXCLUDED.expires_at,
            user_id = EXCLUDED.user_id,
            nickname = EXCLUDED.nickname,
            client_id = EXCLUDED.client_id,
            client_secret = EXCLUDED.client_secret
        `;
      }

      if (tokens.shopee) {
        await sql`
          INSERT INTO integration_tokens (
            channel, connected, access_token, refresh_token, expires_at, shop_id, partner_id, partner_key
          ) VALUES (
            'shopee',
            ${updated.shopee.connected ?? false},
            ${updated.shopee.accessToken ?? ""},
            ${updated.shopee.refreshToken ?? ""},
            ${updated.shopee.expiresAt ?? 0},
            ${updated.shopee.shopId ?? ""},
            ${updated.shopee.partnerId ?? ""},
            ${updated.shopee.partnerKey ?? ""}
          )
          ON CONFLICT (channel)
          DO UPDATE SET
            connected = EXCLUDED.connected,
            access_token = EXCLUDED.access_token,
            refresh_token = EXCLUDED.refresh_token,
            expires_at = EXCLUDED.expires_at,
            shop_id = EXCLUDED.shop_id,
            partner_id = EXCLUDED.partner_id,
            partner_key = EXCLUDED.partner_key
        `;
      }
      if (tokens.tiktok) {
        await sql`
          INSERT INTO integration_tokens (
            channel, connected, access_token, refresh_token, expires_at, user_id, client_id, client_secret
          ) VALUES (
            'tiktok',
            ${updated.tiktok.connected ?? false},
            ${updated.tiktok.accessToken ?? ""},
            ${updated.tiktok.refreshToken ?? ""},
            ${updated.tiktok.expiresAt ?? 0},
            ${updated.tiktok.openId ?? ""},
            ${updated.tiktok.clientKey ?? ""},
            ${updated.tiktok.clientSecret ?? ""}
          )
          ON CONFLICT (channel)
          DO UPDATE SET
            connected = EXCLUDED.connected,
            access_token = EXCLUDED.access_token,
            refresh_token = EXCLUDED.refresh_token,
            expires_at = EXCLUDED.expires_at,
            user_id = EXCLUDED.user_id,
            client_id = EXCLUDED.client_id,
            client_secret = EXCLUDED.client_secret
        `;
      }
    } catch (err) {
      console.error("Neon tokens upsert failed:", err);
    }
  }

  return updated;
}

export async function forceRefreshMlToken(): Promise<StoredTokens> {
  const tokens = await getTokens();
  if (
    !tokens.mercadolivre.clientId ||
    !tokens.mercadolivre.clientSecret ||
    !tokens.mercadolivre.refreshToken
  ) {
    throw new Error("Missing Mercado Livre credentials for token refresh");
  }

  console.log("Refreshing Mercado Livre access token...");
  const response = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: tokens.mercadolivre.clientId,
      client_secret: tokens.mercadolivre.clientSecret,
      refresh_token: tokens.mercadolivre.refreshToken,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Refresh token endpoint failed [${response.status}]: ${JSON.stringify(data)}`);
  }

  const updatedTokens = await saveTokens({
    mercadolivre: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      userId: String(data.user_id),
    },
  });

  return updatedTokens;
}

export async function forceRefreshShopeeToken(): Promise<StoredTokens> {
  const tokens = await getTokens();
  if (
    !tokens.shopee.partnerId ||
    !tokens.shopee.partnerKey ||
    !tokens.shopee.refreshToken ||
    !tokens.shopee.shopId
  ) {
    throw new Error("Missing Shopee credentials for token refresh");
  }

  const partnerId = Number(tokens.shopee.partnerId);
  const partnerKey = tokens.shopee.partnerKey;
  const shopId = Number(tokens.shopee.shopId);
  const timestamp = Math.floor(Date.now() / 1000);
  const path = "/api/v2/auth/access_token/get";
  const baseString = `${partnerId}${path}${timestamp}`;
  const sign = crypto
    .createHmac("sha256", partnerKey)
    .update(baseString)
    .digest("hex");

  const host = "https://partner.shopeemobile.com";
  const url = `${host}${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      refresh_token: tokens.shopee.refreshToken,
      partner_id: partnerId,
      shop_id: shopId,
    }),
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(`Shopee refresh token endpoint failed: ${JSON.stringify(data)}`);
  }

  const updatedTokens = await saveTokens({
    shopee: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    },
  });

  return updatedTokens;
}

export async function fetchMeli(endpoint: string, options: RequestInit = {}): Promise<Response> {
  let tokens = await getTokens();
  if (!tokens.mercadolivre.connected) {
    throw new Error("Mercado Livre not connected");
  }

  const url = `https://api.mercadolibre.com${endpoint}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${tokens.mercadolivre.accessToken}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  let response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    console.log("Mercado Livre API returned 401. Attempting token refresh...");
    try {
      tokens = await forceRefreshMlToken();
      headers.Authorization = `Bearer ${tokens.mercadolivre.accessToken}`;
      response = await fetch(url, { ...options, headers });
    } catch (err) {
      console.error("Token refresh failed during fetchMeli retry:", err);
    }
  }

  return response;
}

export async function forceRefreshTikTokToken(): Promise<StoredTokens> {
  const tokens = await getTokens();
  if (
    !tokens.tiktok.clientKey ||
    !tokens.tiktok.clientSecret ||
    !tokens.tiktok.refreshToken
  ) {
    throw new Error("Missing TikTok Shop credentials for token refresh");
  }

  console.log("Refreshing TikTok Shop access token...");
  const response = await fetch("https://auth.tiktok-shops.com/api/v2/token/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_key: tokens.tiktok.clientKey,
      client_secret: tokens.tiktok.clientSecret,
      refresh_token: tokens.tiktok.refreshToken,
    }),
  });

  const data = await response.json();
  if (!response.ok || data.code !== 0) {
    throw new Error(`TikTok token refresh failed [${response.status}]: ${JSON.stringify(data)}`);
  }

  const updatedTokens = await saveTokens({
    tiktok: {
      accessToken: data.data.access_token,
      refreshToken: data.data.refresh_token,
      expiresAt: Date.now() + data.data.access_token_expire_in * 1000,
      openId: data.data.open_id,
    },
  });

  return updatedTokens;
}

/**
 * Helper para fazer chamadas autenticadas à API do TikTok Shop.
 * Renova o token automaticamente se receber 401.
 */
export async function fetchTikTok(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  let tokens = await getTokens();
  if (!tokens.tiktok.connected) {
    throw new Error("TikTok Shop not connected");
  }

  const baseUrl = "https://open-api.tiktokglobalshop.com";
  const url = `${baseUrl}${endpoint}`;
  const headers: Record<string, string> = {
    "x-tts-access-token": tokens.tiktok.accessToken,
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };

  let response = await fetch(url, { ...options, headers });

  // Token expirado — tenta renovar e repetir a requisição
  if (response.status === 401) {
    console.log("TikTok Shop API returned 401. Attempting token refresh...");
    try {
      tokens = await forceRefreshTikTokToken();
      headers["x-tts-access-token"] = tokens.tiktok.accessToken;
      response = await fetch(url, { ...options, headers });
    } catch (err) {
      console.error("Token refresh failed during fetchTikTok retry:", err);
    }
  }

  return response;
}
