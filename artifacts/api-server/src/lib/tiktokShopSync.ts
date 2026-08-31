import { db, integrationsTable, tiktokShopDailyMetricsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  refreshTikTokShopToken, getAuthorizedShop, fetchShopAdsPerformance,
  TikTokShopAuthError, TikTokShopApiError, TikTokShopTransientError,
} from "./tiktokShop.js";
import { logger } from "./logger.js";

const TIKTOK_SHOP_APP_KEY = process.env.TIKTOK_SHOP_APP_KEY;
const TIKTOK_SHOP_SECRET  = process.env.TIKTOK_SHOP_SECRET;

/** How far back to pull on each rolling sync — TikTok Shop's default reporting window. */
const SYNC_LOOKBACK_DAYS = 30;
/** Minimum time between live rolling syncs; the channel is read from Postgres in between. */
const SYNC_MIN_INTERVAL_MS = 30 * 60 * 1000;

/**
 * How far back the one-time historical backfill attempts to reach. TikTok
 * Shop's ads reporting endpoint doesn't publicly document a maximum lookback
 * or an error contract for "no data exists before this date" (see the task
 * tracking confirmation of the real report format/limits), so this backfill
 * deliberately does NOT try to guess a boundary from error content: any
 * non-auth API error is retried with backoff forever, and the job is only
 * ever marked complete once it actually reaches this target depth. If the
 * shop's real history is shallower than this and the API keeps rejecting
 * older ranges, the backfill just keeps retrying at a capped, infrequent
 * interval indefinitely — harmless, and honest about not knowing the real
 * limit rather than falsely claiming completion.
 */
const HISTORY_BACKFILL_TARGET_DAYS = 730;
/** Chunk size for backfill requests — mirrors the rolling window's span, which is the
 *  one query range we know the API accepts. */
const BACKFILL_CHUNK_DAYS = 30;
/** Base backoff between backfill attempts after a transient failure; doubles per
 *  consecutive failure (capped) so a rate-limited or flaky API can't be hammered. */
const BACKFILL_RETRY_BASE_INTERVAL_MS = 10 * 60 * 1000;
const BACKFILL_RETRY_MAX_INTERVAL_MS  = 6 * 60 * 60 * 1000;

export type TikTokShopChannelStatus = "connected" | "stale" | "needs_reconnect" | "not_connected";

interface TikTokShopMeta {
  refreshToken?: string;
  shopId?: string;
  shopCipher?: string;
  lastSyncedAt?: string;
  lastSyncError?: string;
  /** Earliest date (YYYY-MM-DD) successfully backfilled so far. */
  historyBackfillEarliestDate?: string;
  /** Set once the backfill has reached its target depth (HISTORY_BACKFILL_TARGET_DAYS). */
  historyBackfillComplete?: boolean;
  historyBackfillCompletedAt?: string;
  /** Last time a backfill attempt ran (success or failure), to throttle retries. */
  historyBackfillAttemptedAt?: string;
  /** Consecutive transient-failure count, used to back off retries. */
  historyBackfillFailureCount?: number;
}

function parseMeta(raw: string | null | undefined): TikTokShopMeta {
  if (!raw) return {};
  try { return JSON.parse(raw) as TikTokShopMeta; } catch { return {}; }
}

/**
 * All reads and writes of the tiktok_shop integration row go through this
 * mutex. Both the rolling sync and the historical backfill do a
 * read-modify-write of the same JSON metadata blob across several awaited API
 * calls; without serializing them, one job's write can clobber fields the
 * other just persisted (e.g. a backfill checkpoint overwritten by a rolling
 * sync that started with an older snapshot). This process is the only writer
 * of this row (no external cron/scheduler), so an in-process mutex is enough.
 */
let integrationMutex: Promise<unknown> = Promise.resolve();
function withIntegrationLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = integrationMutex.then(fn, fn);
  integrationMutex = run.then(() => undefined, () => undefined);
  return run;
}

/**
 * Exposed so any other writer of the tiktok_shop integration row (currently
 * just the OAuth reconnect callback) can serialize with the sync/backfill
 * jobs instead of racing their read-modify-write against an in-flight one.
 */
export function withTikTokShopIntegrationLock<T>(fn: () => Promise<T>): Promise<T> {
  return withIntegrationLock(fn);
}

async function loadIntegration(): Promise<{ row: typeof integrationsTable.$inferSelect; meta: TikTokShopMeta } | null> {
  const rows = await db.select().from(integrationsTable)
    .where(eq(integrationsTable.provider, "tiktok_shop")).limit(1);
  const row = rows[0];
  if (!row) return null;
  return { row, meta: parseMeta(row.metadata) };
}

/** Merges `patch` into the metadata currently stored on the row (fetched fresh, under the
 *  lock) rather than a possibly-stale in-memory snapshot, then writes it back. */
async function patchIntegration(patch: Record<string, unknown>, metaPatch: Partial<TikTokShopMeta>): Promise<void> {
  const current = await loadIntegration();
  const mergedMeta = { ...(current?.meta ?? {}), ...metaPatch };
  await db.update(integrationsTable)
    .set({ ...patch, metadata: JSON.stringify(mergedMeta), updatedAt: new Date() })
    .where(eq(integrationsTable.provider, "tiktok_shop"));
}

async function upsertDailyMetrics(metrics: Array<{
  date: string; spend: number; impressions: number; clicks: number; conversions: number; revenue: number;
}>): Promise<void> {
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
}

let syncInFlight: Promise<void> | null = null;

/**
 * Pulls the last SYNC_LOOKBACK_DAYS of TikTok Shop ad performance and upserts
 * it into tiktok_shop_daily_metrics. Updates the integration row's status and
 * metadata so callers can tell "connected" apart from "needs reconnect".
 */
async function runSync(): Promise<void> {
  if (!TIKTOK_SHOP_APP_KEY || !TIKTOK_SHOP_SECRET) return;

  const loaded = await loadIntegration();
  if (!loaded) return;
  const { row } = loaded;

  let accessToken = row.accessToken;
  let refreshToken = loaded.meta.refreshToken;

  try {
    let shopCipher = loaded.meta.shopCipher;

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
    await upsertDailyMetrics(metrics);

    await patchIntegration(
      { accessToken, status: "connected" },
      { refreshToken, shopCipher, lastSyncedAt: new Date().toISOString(), lastSyncError: undefined },
    );

    logger.info({ days: metrics.length }, "[tiktokShopSync] Synced TikTok Shop ad metrics");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof TikTokShopAuthError) {
      logger.warn({ err: message }, "[tiktokShopSync] Auth failure — marking needs reconnect");
      await patchIntegration({ status: "expired" }, { lastSyncError: message });
    } else {
      logger.warn({ err: message }, "[tiktokShopSync] Sync failed — keeping last-known data");
      await patchIntegration({}, { lastSyncError: message });
    }
  }

  // Once the rolling sync has a working token/shop_cipher, use the same
  // connection to keep making progress on the one-time historical backfill.
  triggerHistoricalBackfill();
}

/** Triggers a rolling sync in the background (fire-and-forget) if one isn't already running. */
function triggerBackgroundSync(): void {
  if (syncInFlight) return;
  syncInFlight = withIntegrationLock(runSync).finally(() => { syncInFlight = null; });
}

let backfillInFlight: Promise<void> | null = null;

/**
 * Walks backward from the oldest date already synced (the rolling sync's
 * window, or wherever a prior backfill left off) toward
 * HISTORY_BACKFILL_TARGET_DAYS ago, fetching BACKFILL_CHUNK_DAYS at a time and
 * upserting into tiktok_shop_daily_metrics. Progress is persisted after every
 * chunk (historyBackfillEarliestDate) so a restart or any failure resumes
 * instead of starting over. Only marks itself complete on reaching the target
 * depth — any other API error (rate limit, 5xx, network error, or any other
 * non-auth rejection) is retried later with backoff, never treated as a
 * signal that history is exhausted, since this endpoint's error contract for
 * that case isn't confirmed.
 */
async function runHistoricalBackfill(): Promise<void> {
  if (!TIKTOK_SHOP_APP_KEY || !TIKTOK_SHOP_SECRET) return;

  const loaded = await loadIntegration();
  if (!loaded || loaded.row.status === "expired") return;
  const { row, meta } = loaded;
  if (meta.historyBackfillComplete) return;

  const failureCount = meta.historyBackfillFailureCount ?? 0;
  const backoffMs = Math.min(BACKFILL_RETRY_BASE_INTERVAL_MS * 2 ** failureCount, BACKFILL_RETRY_MAX_INTERVAL_MS);
  const lastAttemptMs = meta.historyBackfillAttemptedAt ? Date.parse(meta.historyBackfillAttemptedAt) : 0;
  if (Date.now() - lastAttemptMs < backoffMs) return;

  let accessToken  = row.accessToken;
  let refreshToken = meta.refreshToken;
  let shopCipher   = meta.shopCipher;
  let currentFailureCount = failureCount;

  const targetStart = new Date(Date.now() - HISTORY_BACKFILL_TARGET_DAYS * 24 * 60 * 60 * 1000);
  // Resume just before whatever's already covered: either a prior backfill
  // chunk, or (on the very first run) the rolling sync's own window.
  const alreadyCoveredFrom = meta.historyBackfillEarliestDate
    ? new Date(meta.historyBackfillEarliestDate)
    : new Date(Date.now() - SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  await patchIntegration({}, { historyBackfillAttemptedAt: new Date().toISOString() });

  if (alreadyCoveredFrom <= targetStart) {
    await patchIntegration({}, { historyBackfillComplete: true, historyBackfillCompletedAt: new Date().toISOString(), historyBackfillFailureCount: 0 });
    return;
  }

  try {
    if (!shopCipher) {
      const shop = await getAuthorizedShop(TIKTOK_SHOP_APP_KEY, TIKTOK_SHOP_SECRET, accessToken);
      if (!shop) throw new TikTokShopAuthError("No authorized shop found for this TikTok Shop connection");
      shopCipher = shop.cipher;
    }

    let cursor = new Date(alreadyCoveredFrom); // exclusive upper bound of the next chunk
    let daysSynced = 0;
    let earliestReached: string | null = null;

    while (cursor > targetStart) {
      const chunkEnd = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
      const earliestAllowed = new Date(chunkEnd.getTime() - (BACKFILL_CHUNK_DAYS - 1) * 24 * 60 * 60 * 1000);
      const chunkStart = earliestAllowed > targetStart ? earliestAllowed : targetStart;
      const startStr = chunkStart.toISOString().slice(0, 10);
      const endStr   = chunkEnd.toISOString().slice(0, 10);

      let metrics;
      try {
        metrics = await fetchShopAdsPerformance(
          TIKTOK_SHOP_APP_KEY, TIKTOK_SHOP_SECRET, accessToken, shopCipher, startStr, endStr,
        );
      } catch (err) {
        if (err instanceof TikTokShopAuthError) {
          if (!refreshToken) throw err;
          const fresh = await refreshTikTokShopToken(TIKTOK_SHOP_APP_KEY, TIKTOK_SHOP_SECRET, refreshToken);
          if (!fresh) throw err;
          accessToken  = fresh.accessToken;
          refreshToken = fresh.refreshToken;
          metrics = await fetchShopAdsPerformance(
            TIKTOK_SHOP_APP_KEY, TIKTOK_SHOP_SECRET, accessToken, shopCipher, startStr, endStr,
          );
        } else if (err instanceof TikTokShopTransientError || err instanceof TikTokShopApiError) {
          // Neither a rate limit/5xx/network hiccup (TikTokShopTransientError)
          // nor any other non-auth rejection (TikTokShopApiError) is treated
          // as "no data before this date" — this endpoint doesn't publish an
          // error contract for that, so guessing risks permanently stranding
          // real history behind a false "complete". Stop this run, keep the
          // checkpoint, and let the caller retry later with backoff.
          logger.warn(
            { startStr, endStr, err: err.message },
            "[tiktokShopSync] Backfill chunk failed — will retry this range later, not treating as a history boundary",
          );
          throw err;
        } else {
          throw err;
        }
      }

      await upsertDailyMetrics(metrics);
      daysSynced += metrics.length;
      earliestReached = startStr;
      currentFailureCount = 0;

      await patchIntegration(
        { accessToken },
        { refreshToken, shopCipher, historyBackfillEarliestDate: startStr, historyBackfillFailureCount: 0 },
      );

      cursor = chunkStart;
    }

    const reachedTarget = cursor <= targetStart;
    if (reachedTarget) {
      await patchIntegration(
        { accessToken },
        {
          refreshToken, shopCipher,
          historyBackfillComplete: true,
          historyBackfillCompletedAt: new Date().toISOString(),
          historyBackfillFailureCount: 0,
        },
      );
    }

    logger.info(
      { daysSynced, earliestReached, reachedTarget },
      "[tiktokShopSync] Historical backfill progress",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof TikTokShopAuthError) {
      logger.warn({ err: message }, "[tiktokShopSync] Backfill auth failure — will resume once reconnected");
      await patchIntegration({ status: "expired" }, { lastSyncError: message });
    } else {
      // Transient failure (or anything unexpected): keep the checkpoint,
      // bump the failure count so the next attempt backs off further.
      const nextFailureCount = currentFailureCount + 1;
      logger.warn(
        { err: message, nextFailureCount },
        "[tiktokShopSync] Backfill attempt failed — will retry later from last saved checkpoint",
      );
      await patchIntegration({}, { historyBackfillFailureCount: nextFailureCount });
    }
  }
}

/** Triggers the historical backfill in the background if one isn't already running. */
function triggerHistoricalBackfill(): void {
  if (backfillInFlight) return;
  backfillInFlight = withIntegrationLock(runHistoricalBackfill).finally(() => { backfillInFlight = null; });
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
  else if (!meta.historyBackfillComplete) triggerHistoricalBackfill();

  let status: TikTokShopChannelStatus;
  if (row.status === "expired") {
    status = "needs_reconnect";
  } else if (!lastSyncedAt || Date.now() - lastSyncedMs > SYNC_MIN_INTERVAL_MS * 4) {
    // Never synced yet, or sync has been failing for a while (>2h with no success).
    status = lastSyncedAt ? "stale" : "connected";
  } else {
    status = "connected";
  }

  let metricRows: Array<typeof tiktokShopDailyMetricsTable.$inferSelect> = [];
  try {
    metricRows = await db.select().from(tiktokShopDailyMetricsTable)
      .where(sql`${tiktokShopDailyMetricsTable.date} BETWEEN ${start} AND ${end}`)
      .orderBy(tiktokShopDailyMetricsTable.date);
  } catch (err) {
    // Never let a Postgres-side problem (e.g. a schema not yet migrated in
    // this environment) take down the whole Attribution/Spend page — TikTok
    // Shop is a supplementary channel, so degrade to "no rows" instead.
    logger.error({ err }, "[tiktokShopSync] Failed to query tiktok_shop_daily_metrics — returning empty rows");
  }

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
