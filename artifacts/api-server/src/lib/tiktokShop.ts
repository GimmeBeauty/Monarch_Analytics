import crypto from "crypto";

/**
 * TikTok Shop Partner API client.
 *
 * Auth model: the app's OAuth token (obtained via the Partner OAuth flow in
 * routes/oauth.ts) authorizes calls against a single connected shop. Every
 * request must be signed with HMAC-SHA256 using the app secret, per TikTok
 * Shop's documented request-signing algorithm:
 *
 *   1. Take all query params except `sign` and `access_token`, sorted by key.
 *   2. Concatenate as `key` + `value` pairs (no separators), prefixed by the
 *      request path.
 *   3. Wrap with the app secret on both ends: secret + path + params + secret.
 *   4. HMAC-SHA256 the result with the app secret as the key, hex-encoded.
 */

const API_BASE = "https://open-api.tiktokglobalshop.com";
const AUTH_BASE = "https://auth.tiktok-shops.com";

export class TikTokShopAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TikTokShopAuthError";
  }
}

export class TikTokShopApiError extends Error {
  code?: number;
  constructor(message: string, code?: number) {
    super(message);
    this.name = "TikTokShopApiError";
    this.code = code;
  }
}

/**
 * A failure that says nothing about the request itself — rate limiting,
 * a 5xx, a network hiccup, or a malformed response. Callers must retry these
 * (with backoff) rather than treat them as a meaningful API rejection: unlike
 * TikTokShopApiError, a transient error carries no information about whether
 * an older date range is actually unavailable.
 */
export class TikTokShopTransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TikTokShopTransientError";
  }
}

function signRequest(
  path: string,
  params: Record<string, string>,
  appSecret: string,
  body?: string,
): string {
  const sortedKeys = Object.keys(params)
    .filter((k) => k !== "sign" && k !== "access_token")
    .sort();
  let input = path;
  for (const key of sortedKeys) {
    input += key + params[key];
  }
  if (body) input += body;
  input = appSecret + input + appSecret;
  return crypto.createHmac("sha256", appSecret).update(input).digest("hex");
}

function buildUrl(
  path: string,
  appKey: string,
  appSecret: string,
  accessToken: string | undefined,
  extraParams: Record<string, string> = {},
  body?: string,
): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params: Record<string, string> = {
    app_key: appKey,
    timestamp,
    ...extraParams,
  };
  const sign = signRequest(path, params, appSecret, body);
  const qs = new URLSearchParams({ ...params, sign });
  if (accessToken) qs.set("access_token", accessToken);
  return `${API_BASE}${path}?${qs.toString()}`;
}

interface TikTokShopEnvelope<T> {
  code: number;
  message: string;
  request_id?: string;
  data?: T;
}

async function callSignedApi<T>(
  path: string,
  appKey: string,
  appSecret: string,
  accessToken: string,
  extraParams: Record<string, string> = {},
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const url = buildUrl(path, appKey, appSecret, accessToken, extraParams);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { "x-tts-access-token": accessToken, ...extraHeaders },
    });
  } catch (err) {
    // Network-level failure (DNS, timeout, connection reset) — says nothing
    // about the request itself, always retryable.
    throw new TikTokShopTransientError(`Network error calling TikTok Shop API: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Rate limiting and server errors are retryable and must never be treated
  // as a meaningful rejection of the request's parameters (e.g. a date range).
  if (res.status === 429 || res.status >= 500) {
    throw new TikTokShopTransientError(`TikTok Shop API returned HTTP ${res.status}`);
  }

  const bodyText = await res.text();
  let parsed: TikTokShopEnvelope<T>;
  try {
    parsed = JSON.parse(bodyText) as TikTokShopEnvelope<T>;
  } catch {
    // A non-JSON body on an otherwise-non-error status is a malformed/transient
    // response, not a real rejection — retry it rather than giving up.
    throw new TikTokShopTransientError(`Non-JSON response from TikTok Shop API (status ${res.status})`);
  }
  if (!res.ok || parsed.code !== 0) {
    const msg = parsed.message ?? `HTTP ${res.status}`;
    // TikTok Shop auth-related error codes: expired/invalid access token,
    // insufficient scope/permission for this API. The exact code list isn't
    // fully confirmed against a real approved app yet, so also catch
    // permission/scope wording in the message rather than relying on codes alone —
    // under-detecting an auth problem just means it's retried forever instead of
    // surfacing "needs reconnect", which is the safer failure mode of the two.
    const looksLikeAuthOrPermission =
      [105002, 105003, 105005, 401, 403].includes(parsed.code) ||
      res.status === 401 || res.status === 403 ||
      /\b(scope|permission|unauthori[sz]ed|not authoriz)/i.test(msg);
    if (looksLikeAuthOrPermission) {
      throw new TikTokShopAuthError(msg);
    }
    // Any other well-formed rejection is NOT assumed to mean "no data exists for
    // this range" — TikTok Shop doesn't publish an error contract for that, so
    // callers must treat this the same as a transient failure (retry with
    // backoff, never treat as a completion signal) rather than guessing.
    throw new TikTokShopApiError(msg, parsed.code);
  }
  if (parsed.data === undefined) {
    throw new TikTokShopApiError("TikTok Shop API returned no data");
  }
  return parsed.data;
}

// ─── Token Refresh ─────────────────────────────────────────────────────────────

export interface RefreshedToken {
  accessToken: string;
  refreshToken: string;
}

/** Exchanges a stored refresh_token for a new access_token via the Partner OAuth API. */
export async function refreshTikTokShopToken(
  appKey: string,
  appSecret: string,
  refreshToken: string,
): Promise<RefreshedToken | null> {
  try {
    const res = await fetch(
      `${AUTH_BASE}/api/v2/token/refresh` +
      `?app_key=${encodeURIComponent(appKey)}` +
      `&app_secret=${encodeURIComponent(appSecret)}` +
      `&refresh_token=${encodeURIComponent(refreshToken)}` +
      `&grant_type=refresh_token`,
    );
    const bodyText = await res.text();
    if (!res.ok) return null;
    const body = JSON.parse(bodyText) as {
      data?: { access_token?: string; refresh_token?: string };
      access_token?: string; refresh_token?: string;
    };
    const td = body.data ?? body;
    if (!td.access_token) return null;
    return {
      accessToken:  td.access_token,
      refreshToken: td.refresh_token ?? refreshToken,
    };
  } catch {
    return null;
  }
}

// ─── Authorized Shop Lookup ────────────────────────────────────────────────────

interface AuthorizedShop {
  id: string;
  cipher: string;
  code: string;
  name: string;
}

/** Looks up the shop_cipher required for shop-scoped endpoints. */
export async function getAuthorizedShop(
  appKey: string,
  appSecret: string,
  accessToken: string,
): Promise<AuthorizedShop | null> {
  const data = await callSignedApi<{ shops?: AuthorizedShop[] }>(
    "/authorization/202309/shops",
    appKey,
    appSecret,
    accessToken,
  );
  return data.shops?.[0] ?? null;
}

// ─── Ads Performance ───────────────────────────────────────────────────────────

export interface TikTokShopDayMetric {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
}

/**
 * Fetches daily-level Shop Ads performance (spend, impressions, clicks,
 * orders/conversions, gross revenue) for the connected shop.
 *
 * Requires the Marketing API scope on the Partner app. Throws
 * TikTokShopAuthError when the token is invalid/expired or the app lacks the
 * Marketing scope, so callers can distinguish "needs reconnect" from a
 * transient failure.
 */
export async function fetchShopAdsPerformance(
  appKey: string,
  appSecret: string,
  accessToken: string,
  shopCipher: string,
  start: string,
  end: string,
): Promise<TikTokShopDayMetric[]> {
  const data = await callSignedApi<{
    performance_list?: Array<{
      stat_time_day?: string;
      metrics?: {
        spend?: string; cost?: string;
        impressions?: string; clicks?: string;
        orders?: string; conversions?: string;
        gross_revenue?: string; revenue?: string;
      };
    }>;
  }>(
    "/marketing/202409/reports/performance/get",
    appKey,
    appSecret,
    accessToken,
    {
      shop_cipher: shopCipher,
      start_date:  start,
      end_date:    end,
      dimensions:  JSON.stringify(["stat_time_day"]),
      metrics:     JSON.stringify(["spend", "impressions", "clicks", "orders", "gross_revenue"]),
    },
    { "x-tts-shop-cipher": shopCipher },
  );

  const rows = data.performance_list ?? [];
  return rows
    .map((r): TikTokShopDayMetric | null => {
      const date = r.stat_time_day;
      if (!date) return null;
      const m = r.metrics ?? {};
      return {
        date,
        spend:       Number(m.spend ?? m.cost ?? 0) || 0,
        impressions: Number(m.impressions ?? 0) || 0,
        clicks:      Number(m.clicks ?? 0) || 0,
        conversions: Number(m.orders ?? m.conversions ?? 0) || 0,
        revenue:     Number(m.gross_revenue ?? m.revenue ?? 0) || 0,
      };
    })
    .filter((r): r is TikTokShopDayMetric => r !== null);
}
