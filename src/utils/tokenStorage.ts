import fs from "fs";
import path from "path";
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

let activeMlRefreshPromise: Promise<StoredTokens> | null = null;

export async function getTokens(): Promise<StoredTokens> {
  let tokens: StoredTokens;

  if (!isNeonConfigured()) {
    tokens = getLocalTokens();
  } else {
    try {
      const data = await sql`SELECT * FROM integration_tokens`;

      const mlRow = data?.find((r: any) => r.channel === "mercadolivre");
      const shopeeRow = data?.find((r: any) => r.channel === "shopee");

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
      };

      // Save locally as backup
      fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), "utf8");
    } catch (error) {
      console.warn("Neon load tokens error, falling back to local storage:", error);
      tokens = getLocalTokens();
    }
  }

  // Auto-refresh Mercado Livre token if connected and expired/expiring soon
  if (
    tokens.mercadolivre.connected &&
    tokens.mercadolivre.clientId &&
    tokens.mercadolivre.clientSecret &&
    tokens.mercadolivre.refreshToken &&
    Date.now() >= tokens.mercadolivre.expiresAt - 5 * 60 * 1000
  ) {
    if (activeMlRefreshPromise) {
      return activeMlRefreshPromise;
    }

    activeMlRefreshPromise = (async () => {
      console.log("Mercado Livre token expiring soon. Refreshing...");
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
        activeMlRefreshPromise = null;
      }
    })();

    return activeMlRefreshPromise;
  }

  return tokens;
}

export async function saveTokens(tokens: {
  shopee?: Partial<StoredTokens["shopee"]>;
  mercadolivre?: Partial<StoredTokens["mercadolivre"]>;
}): Promise<StoredTokens> {
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

  // 2. Save to Neon if configured
  if (isNeonConfigured()) {
    try {
      if (tokens.mercadolivre) {
        await sql`
          INSERT INTO integration_tokens (
            channel, connected, access_token, refresh_token, expires_at, user_id, nickname, client_id, client_secret
          ) VALUES (
            'mercadolivre',
            ${updated.mercadolivre.connected},
            ${updated.mercadolivre.accessToken},
            ${updated.mercadolivre.refreshToken},
            ${updated.mercadolivre.expiresAt},
            ${updated.mercadolivre.userId},
            ${updated.mercadolivre.nickname},
            ${updated.mercadolivre.clientId},
            ${updated.mercadolivre.clientSecret}
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
            ${updated.shopee.connected},
            ${updated.shopee.accessToken},
            ${updated.shopee.refreshToken},
            ${updated.shopee.expiresAt},
            ${updated.shopee.shopId},
            ${updated.shopee.partnerId},
            ${updated.shopee.partnerKey}
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
    } catch (err) {
      console.error("Neon tokens upsert failed:", err);
    }
  }

  return updated;
}

export async function forceRefreshMlToken(): Promise<StoredTokens> {
  const tokens = getLocalTokens();
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
