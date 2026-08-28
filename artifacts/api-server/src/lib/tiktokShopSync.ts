import { db, integrationsTable, tiktokShopDailyMetricsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  refreshTikTokShopToken, getAuthorizedShop, fetchShopAdsPerformance,
  TikTokShopAuthError,
} from "./tiktokShop.js";
import { logger } from "./logger.js";

const TIKTOK_SHOP_APP_KEY = process.env.TIKTOK_SHOP_APP_KEY;
const TIKTOK_SHOP_SECRET  = process.env.TIKTOK_SHOP_SECRET;

/** How far back to pull on each sync — TikTok Shop's default reporting window. */
const SYNC_LOOKBACK_DAYS = 30;
/** Minimum time between live syncs; the channel is read from Postgres in between. */
const SYNC_MIN_INTERVAL_MS = 30 * 60 * 1000;

export type TikTokShopChannelStatus = "connected" | "stale" | "needs_reconnect" | "not_connected";

interface TikTokShopMeta {
  refreshToken?: string;
  shopId?: string;
  shopCipher?: string;
  lastSyncedAt?: string;
  lastSyncError?: string;
}

function parseMeta(raw: string | null | undefined): TikTokShopMeta {
  if (!raw) return {};
  try { return JSON.parse(raw) as TikTokShopMeta; } catch { return {}; }
}

let syncInFlight: Promise<void> | null = null;

/**
 * Pulls the last SYNC_LOOKBACK_DAYS of TikTok Shop ad performance and upserts
 * it into tiktok_shop_daily_metrics. Updates the integration row's status and
 * metadata so callers can tell "connected" apart from "needs reconnect".
 */
async function runSync(): Promise<void> {
  if (!TIKTOK_SHOP_APP_KEY || !TIKTOK_SHOP_SECRET) return;

  const rows = await db.select().from(integrationsTable)
    .where(eq(integrationsTable.provider, "tiktok_shop")).limit(1);
  const row = rows[0];
  if (!row) return;

  const meta = parseMeta(row.metadata);
  let accessToken = row.accessToken;
  let refreshToken = meta.refreshToken;

  const markNeedsReconnect = async (errMessage: string) => {
    await db.update(integrationsTable)
      .set({
        status: "expired",
        metadata: JSON.stringify({ ...meta, lastSyncError: errMessage }),
        updatedAt: new Date(),
      })
      .where(eq(integrationsTable.provider, "tiktok_shop"));
  };

  const markSyncFailure = async (errMessage: string) => {
    await db.update(integrationsTable)
      .set({
        metadata: JSON.stringify({ ...meta, lastSyncError: errMessage }),
        updatedAt: new Date(),
      })
      .where(eq(integrationsTable.provider, "tiktok_shop"));
  };

  try {
    let shopCipher = meta.shopCipher;

    // Resolve shop_cipher once; cache it since it doesn't change.
    if (!shopCipher) {
      const shop = await getAuthorizedShop(TIKTOK_SHOP_APP_KEY, TIKTOK_SHOP_SECRET, accessToken);
      if (!shop) throw new TikTokShopAuthError("No authorized shop found for this TikTok Shop connection");
      shopCipher = shop.cipher;
    }

    const end   = new Date();
    const start = new Date(end.getTime() - SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const startStr = start.toISOString().slice(0, 10);
    const endStr   = end.toISOString().slice(0, 10);

    let metrics;
    try {
      metrics = await fetchShopAdsPerformance(
        TIKTOK_SHOP_APP_KEY, TIKTOK_SHOP_SECRET, accessToken, shopCipher, startStr, endStr,
      );
    } catch (err) {
      if (!(err instanceof TikTokShopAuthError)) throw err;
      // Access token may simply be expired — try a refresh before giving up.
      if (!refreshToken) throw err;
      const fresh = await refreshTikTokShopToken(TIKTOK_SHOP_APP_KEY, TIKTOK_SHOP_SECRET, refreshToken);
      if (!fresh) throw err;
      accessToken  = fresh.accessToken;
      refreshToken = fresh.refreshToken;
      metrics = await fetchShopAdsPerformance(
        TIKTOK_SHOP_APP_KEY, TIKTOK_SHOP_SECRET, accessToken, shopCipher, startStr, endStr,
      );
    }

    // Upsert each day's metrics — re-syncing updates existing rows, never duplicates.
    for (const m of metrics) {
      await db.insert(tiktokShopDailyMetricsTable)
        .values({
          date:        m.date,
          spend:       m.spend.toFixed(2),
          impressions: Math.round(m.impressions),
          clicks:      Math.round(m.clicks),
          conversions: Math.round(m.conversions),
          revenue:     m.revenue.toFixed(2),
        })
        .onConflictDoUpdate({
          target: tiktokShopDailyMetricsTable.date,
          set: {
            spend:       m.spend.toFixed(2),
            impressions: Math.round(m.impressions),
            clicks:      Math.round(m.clicks),
            conversions: Math.round(m.conversions),
            revenue:     m.revenue.toFixed(2),
            updatedAt:   new Date(),
          },
        });
    }

    await db.update(integrationsTable)
      .set({
        accessToken,
        status: "connected",
        metadata: JSON.stringify({
          ...meta, refreshToken, shopCipher,
          lastSyncedAt: new Date().toISOString(),
          lastSyncError: undefined,
        }),
        updatedAt: new Date(),
      })
      .where(eq(integrationsTable.provider, "tiktok_shop"));

    logger.info({ days: metrics.length }, "[tiktokShopSync] Synced TikTok Shop ad metrics");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof TikTokShopAuthError) {
      logger.warn({ err: message }, "[tiktokShopSync] Auth failure — marking needs reconnect");
      await markNeedsReconnect(message);
    } else {
      logger.warn({ err: message }, "[tiktokShopSync] Sync failed — keeping last-known data");
      await markSyncFailure(message);
    }
  }
}

/** Triggers a sync in the background (fire-and-forget) if one isn't already running. */
function triggerBackgroundSync(): void {
  if (syncInFlight) return;
  syncInFlight = runSync().finally(() => { syncInFlight = null; });
}

export interface TikTokShopChannelResult {
  status: TikTokShopChannelStatus;
  lastSyncedAt: string | null;
  rows: Array<{ date: string; spend: number; impressions: number; clicks: number; conversions: number; revenue: number }>;
}

/**
 * Returns TikTok Shop's daily metrics for [start, end] from Postgres, and
 * kicks off a background refresh if the connection is stale. Never blocks
 * the caller on a live TikTok API call — always serves last-known data
 * (which may be empty for a freshly-connected shop) so a slow/unreachable
 * TikTok API can't hang the Attribution/Spend pages.
 */
export async function getTikTokShopChannelData(start: string, end: string): Promise<TikTokShopChannelResult> {
  const rows = await db.select().from(integrationsTable)
    .where(eq(integrationsTable.provider, "tiktok_shop")).limit(1);
  const row = rows[0];
  if (!row) return { status: "not_connected", lastSyncedAt: null, rows: [] };

  const meta = parseMeta(row.metadata);
  const lastSyncedAt = meta.lastSyncedAt ?? null;
  const lastSyncedMs = lastSyncedAt ? Date.parse(lastSyncedAt) : 0;
  const isDue = Date.now() - lastSyncedMs > SYNC_MIN_INTERVAL_MS;

  if (isDue) triggerBackgroundSync();

  let status: TikTokShopChannelStatus;
  if (row.status === "expired") {
    status = "needs_reconnect";
  } else if (!lastSyncedAt || Date.now() - lastSyncedMs > SYNC_MIN_INTERVAL_MS * 4) {
    // Never synced yet, or sync has been failing for a while (>2h with no success).
    status = lastSyncedAt ? "stale" : "connected";
  } else {
    status = "connected";
  }

  const metricRows = await db.select().from(tiktokShopDailyMetricsTable)
    .where(sql`${tiktokShopDailyMetricsTable.date} BETWEEN ${start} AND ${end}`)
    .orderBy(tiktokShopDailyMetricsTable.date);

  return {
    status,
    lastSyncedAt,
    rows: metricRows.map(r => ({
      date:        r.date,
      spend:       Number(r.spend),
      impressions: r.impressions,
      clicks:      r.clicks,
      conversions: r.conversions,
      revenue:     Number(r.revenue),
    })),
  };
}
