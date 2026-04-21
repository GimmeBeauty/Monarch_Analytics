import { Router } from "express";
import { db, integrationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate.js";
import { querySnowflake } from "../lib/snowflake.js";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Validate that a date string is exactly YYYY-MM-DD and return it — throws on invalid input. */
function requireDate(val: unknown, name = "date"): string {
  if (typeof val !== "string" || !DATE_RE.test(val)) {
    throw Object.assign(new Error(`Invalid ${name}: must be YYYY-MM-DD`), { status: 400 });
  }
  return val;
}

/** Parse an optional comma-separated storeIds param (e.g. "shopify,amazon"). */
function parseStoreIds(raw: unknown): string[] {
  if (!raw || typeof raw !== "string") return [];
  return raw.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
}

/** Return only the AD_SOURCES whose storeIds overlap with the requested storeIds.
 *  If storeIds is empty, returns all sources (no filtering). */
function filterAdSources(storeIds: string[]): typeof AD_SOURCES {
  if (!storeIds.length) return AD_SOURCES;
  return AD_SOURCES.filter(src =>
    src.storeIds.some(id => storeIds.includes(id.toLowerCase())),
  );
}

function parseMeta(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try { return JSON.parse(raw) as Record<string, string>; } catch { return {}; }
}

async function refreshGoogleToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "refresh_token",
        client_id:     clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }).toString(),
    });
    if (!res.ok) return null;
    const d = await res.json() as { access_token?: string };
    return d.access_token ?? null;
  } catch { return null; }
}

// ─── Source → Channel/Store Mapping ──────────────────────────────────────────

const DB_NAME = process.env.SNOWFLAKE_DATABASE ?? "MONARCH_RAW";

interface AdSourceConfig {
  table: string;
  channelId: string;
  channelLabel: string;
  color: string;
  channelFamily: "core" | "rmn" | "experimental";
  storeIds: string[];
}

interface CommerceSourceConfig {
  table: string;
  storeId: string;
  dateField: string;   // JSON path within raw_data used for date filtering
}

/** Central mapping from commerce data sources to the stores they belong to. */
const COMMERCE_SOURCES: CommerceSourceConfig[] = [
  {
    table:     `${DB_NAME}.COMMERCE.SHOPIFY_ORDERS_RAW`,
    storeId:   "shopify",
    dateField: "created_at",
  },
];

/** Returns only the COMMERCE_SOURCES that are in scope given a storeIds filter. */
function filterCommerceSources(storeIds: string[]): CommerceSourceConfig[] {
  if (!storeIds.length) return COMMERCE_SOURCES;
  return COMMERCE_SOURCES.filter(src => storeIds.includes(src.storeId.toLowerCase()));
}

const AD_SOURCES: AdSourceConfig[] = [
  { table: `${DB_NAME}.ADS.META_ADS_RAW`,         channelId: "meta-ads",        channelLabel: "Meta Ads",         color: "#1877F2", channelFamily: "core", storeIds: ["shopify"] },
  { table: `${DB_NAME}.ADS.GOOGLE_ADS_RAW`,       channelId: "google-ads",      channelLabel: "Google Ads",       color: "#4285F4", channelFamily: "core", storeIds: ["shopify"] },
  { table: `${DB_NAME}.ADS.TIKTOK_ADS_RAW`,       channelId: "tiktok-ads",      channelLabel: "TikTok Ads",       color: "#69C9D0", channelFamily: "core", storeIds: ["shopify"] },
  { table: `${DB_NAME}.ADS.PINTEREST_ADS_RAW`,    channelId: "pinterest-ads",   channelLabel: "Pinterest Ads",    color: "#E60023", channelFamily: "core", storeIds: ["shopify"] },
  { table: `${DB_NAME}.ADS.AMAZON_ADS_RAW`,       channelId: "amazon-ads",      channelLabel: "Amazon Ads",       color: "#FF9900", channelFamily: "rmn",  storeIds: ["amazon"] },
  { table: `${DB_NAME}.ADS.PATTERN_PREDICT_RAW`,  channelId: "pattern-predict", channelLabel: "Pattern Predict",  color: "#7C3AED", channelFamily: "rmn",  storeIds: ["amazon"] },
  { table: `${DB_NAME}.ADS.WALMART_CONNECT_RAW`,  channelId: "walmart-connect", channelLabel: "Walmart Connect",  color: "#0071CE", channelFamily: "rmn",  storeIds: ["walmart"] },
  { table: `${DB_NAME}.ADS.TARGET_ROUNDEL_RAW`,   channelId: "target-roundel",  channelLabel: "Target Roundel",   color: "#CC0000", channelFamily: "rmn",  storeIds: ["target"] },
  { table: `${DB_NAME}.ADS.CRITEO_RAW`,           channelId: "criteo",          channelLabel: "Criteo",           color: "#F57C00", channelFamily: "rmn",  storeIds: ["walmart", "target", "kroger", "cvs", "ulta"] },
];

interface AdDayRow { date: string; spend: number; impressions: number; clicks: number; conversions: number; revenue: number; }

function parseAdRaw(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; }
  }
  return (raw ?? {}) as Record<string, unknown>;
}

function extractAdMetrics(raw: unknown): AdDayRow | null {
  const d = parseAdRaw(raw);
  const date = (d["date"] as string | undefined) ?? "";
  if (!date) return null;
  return {
    date,
    spend:       Number(d["spend"])       || 0,
    impressions: Number(d["impressions"]) || 0,
    clicks:      Number(d["clicks"])      || 0,
    conversions: Number(d["conversions"]) || 0,
    revenue:     Number(d["revenue"])     || 0,
  };
}

async function queryAdSource(
  src: AdSourceConfig,
  start: string,
  end: string,
): Promise<AdDayRow[]> {
  try {
    const rows = await querySnowflake(`
      SELECT raw_data
      FROM ${src.table}
      WHERE TRY_CAST(raw_data:date::STRING AS DATE) BETWEEN '${start}' AND '${end}'
      ORDER BY raw_data:date::STRING ASC
    `);
    const results: AdDayRow[] = [];
    for (const row of rows) {
      const m = extractAdMetrics(row["RAW_DATA"] ?? row["raw_data"]);
      if (m) results.push(m);
    }
    return results;
  } catch {
    return [];
  }
}

function aggregateAdRows(rows: AdDayRow[]): { spend: number; impressions: number; clicks: number; conversions: number; revenue: number } {
  return rows.reduce(
    (a, r) => ({
      spend:       a.spend       + r.spend,
      impressions: a.impressions + r.impressions,
      clicks:      a.clicks      + r.clicks,
      conversions: a.conversions + r.conversions,
      revenue:     a.revenue     + r.revenue,
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 },
  );
}

function groupByDate(rows: AdDayRow[]): Map<string, AdDayRow> {
  const m = new Map<string, AdDayRow>();
  for (const r of rows) {
    const existing = m.get(r.date);
    if (existing) {
      existing.spend       += r.spend;
      existing.impressions += r.impressions;
      existing.clicks      += r.clicks;
      existing.conversions += r.conversions;
      existing.revenue     += r.revenue;
    } else {
      m.set(r.date, { ...r });
    }
  }
  return m;
}

// ─── GET /api/data/shopify ────────────────────────────────────────────────────

router.get("/shopify", authenticate, async (req, res) => {
  const { start: _startRaw, end: _endRaw } = req.query as Record<string, string>;
  let start: string, end: string;
  try { start = requireDate(_startRaw, "start"); end = requireDate(_endRaw, "end"); }
  catch (e) { res.status(400).json({ error: (e as Error).message }); return; }

  try {
    const sql = `
      SELECT raw_data
      FROM ${DB_NAME}.COMMERCE.SHOPIFY_ORDERS_RAW
      WHERE TRY_CAST(LEFT(raw_data:created_at::STRING, 10) AS DATE) BETWEEN '${start}' AND '${end}'
      ORDER BY raw_data:created_at::STRING ASC
    `;
    const rows = await querySnowflake(sql);

    if (rows.length > 0) {
      const dailyMap: Record<string, { revenue: number; orders: number }> = {};
      let totalRevenue = 0;
      let totalOrders = 0;

      for (const row of rows) {
        let order: Record<string, unknown>;
        const raw = row["RAW_DATA"] ?? row["raw_data"];
        if (typeof raw === "string") {
          order = JSON.parse(raw) as Record<string, unknown>;
        } else {
          order = (raw ?? {}) as Record<string, unknown>;
        }

        const status = order["financial_status"] as string | undefined;
        if (status === "voided" || status === "refunded") continue;

        const price = parseFloat((order["total_price"] as string) ?? "0");
        const date  = ((order["created_at"] as string) ?? "").slice(0, 10);
        if (!date) continue;

        totalRevenue += price;
        totalOrders  += 1;
        if (!dailyMap[date]) dailyMap[date] = { revenue: 0, orders: 0 };
        dailyMap[date].revenue += price;
        dailyMap[date].orders  += 1;
      }

      const dailySeries = Object.entries(dailyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({
          date,
          revenue: Math.round(v.revenue * 100) / 100,
          orders:  v.orders,
        }));

      res.json({
        revenue:     Math.round(totalRevenue * 100) / 100,
        orders:      totalOrders,
        aov:         totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0,
        dailySeries,
        source:      "snowflake",
      });
      return;
    }
  } catch (snowflakeErr) {
    console.error("[data/shopify] Snowflake error:", snowflakeErr);
  }

  const rows = await db.select().from(integrationsTable)
    .where(eq(integrationsTable.provider, "shopify")).limit(1);
  const row = rows[0];
  if (!row?.shopDomain || !row.accessToken || row.accessToken === "manual") {
    res.status(404).json({ error: "Shopify not connected and no Snowflake data for range" }); return;
  }

  const { shopDomain, accessToken } = row;
  const orders: Array<{ created_at: string; total_price: string; financial_status?: string }> = [];
  let pageInfo: string | null = null;
  let isFirstPage = true;

  try {
    do {
      const url = new URL(`https://${shopDomain}/admin/api/2025-01/orders.json`);
      url.searchParams.set("limit", "250");

      if (isFirstPage) {
        url.searchParams.set("status",         "any");
        url.searchParams.set("created_at_min", `${start}T00:00:00Z`);
        url.searchParams.set("created_at_max", `${end}T23:59:59Z`);
        url.searchParams.set("fields", "id,created_at,total_price,financial_status");
        isFirstPage = false;
      } else {
        url.searchParams.set("page_info", pageInfo!);
      }

      const r = await fetch(url.toString(), {
        headers: { "X-Shopify-Access-Token": accessToken },
      });
      if (!r.ok) {
        const errBody = await r.text().catch(() => "");
        res.status(r.status).json({ error: "Shopify API error", detail: errBody }); return;
      }

      const d = await r.json() as { orders: Array<{ created_at: string; total_price: string; financial_status?: string }> };
      orders.push(...d.orders.filter(o =>
        !o.financial_status || o.financial_status === "paid" || o.financial_status === "partially_refunded"
      ));

      const link  = r.headers.get("link") ?? "";
      const match = link.match(/page_info=([^&>]+)[^>]*>;\s*rel="next"/);
      pageInfo = match ? match[1] : null;
    } while (pageInfo && orders.length < 10_000);
  } catch {
    res.status(502).json({ error: "Failed to reach Shopify" }); return;
  }

  const dailyMap: Record<string, { revenue: number; orders: number }> = {};
  let totalRevenue = 0;

  for (const order of orders) {
    const date  = order.created_at.split("T")[0];
    const price = parseFloat(order.total_price ?? "0");
    totalRevenue += price;
    if (!dailyMap[date]) dailyMap[date] = { revenue: 0, orders: 0 };
    dailyMap[date].revenue += price;
    dailyMap[date].orders  += 1;
  }

  const dailySeries = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  res.json({
    revenue:     totalRevenue,
    orders:      orders.length,
    aov:         orders.length > 0 ? totalRevenue / orders.length : 0,
    dailySeries,
    source:      "shopify-live",
  });
});

// ─── GET /api/data/google_ads ─────────────────────────────────────────────────

router.get("/google_ads", authenticate, async (req, res) => {
  const { start: _startRaw, end: _endRaw } = req.query as Record<string, string>;
  let start: string, end: string;
  try { start = requireDate(_startRaw, "start"); end = requireDate(_endRaw, "end"); }
  catch (e) { res.status(400).json({ error: (e as Error).message }); return; }

  const rows = await db.select().from(integrationsTable)
    .where(eq(integrationsTable.provider, "google_ads")).limit(1);
  const row = rows[0];
  if (!row) { res.status(404).json({ error: "Google Ads not connected" }); return; }

  const meta           = parseMeta(row.metadata);
  const developerToken = meta.developerToken;
  const customerId     = meta.customerId;
  const clientId       = meta.clientId;
  const clientSecret   = meta.clientSecret;
  const refreshToken   = meta.refreshToken;

  if (!developerToken || !customerId) {
    res.status(400).json({ error: "Developer Token and Customer ID are required" }); return;
  }
  if (!clientId || !clientSecret || !refreshToken) {
    res.status(400).json({ error: "Client ID, Client Secret, and Refresh Token are required" }); return;
  }

  let accessToken = row.accessToken !== "manual" ? row.accessToken : "";

  if (!accessToken) {
    const fresh = await refreshGoogleToken(refreshToken, clientId, clientSecret);
    if (!fresh) {
      res.status(401).json({ error: "Failed to obtain Google access token — check Client ID, Secret, and Refresh Token" });
      return;
    }
    accessToken = fresh;
    await db.update(integrationsTable)
      .set({ accessToken: fresh, updatedAt: new Date() })
      .where(eq(integrationsTable.provider, "google_ads"));
  }

  const cleanCid = customerId.replace(/-/g, "");
  const query = `
    SELECT
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${start}' AND '${end}'
      AND campaign.status != 'REMOVED'
  `;

  const doFetch = (token: string) =>
    fetch(`https://googleads.googleapis.com/v15/customers/${cleanCid}/googleAds:search`, {
      method: "POST",
      headers: {
        Authorization:     `Bearer ${token}`,
        "developer-token": developerToken,
        "Content-Type":    "application/json",
      },
      body: JSON.stringify({ query }),
    });

  let gRes = await doFetch(accessToken);

  if (gRes.status === 401) {
    const newToken = await refreshGoogleToken(refreshToken, clientId, clientSecret);
    if (newToken) {
      accessToken = newToken;
      await db.update(integrationsTable)
        .set({ accessToken: newToken, updatedAt: new Date() })
        .where(eq(integrationsTable.provider, "google_ads"));
      gRes = await doFetch(newToken);
    }
  }

  if (!gRes.ok) {
    const body = await gRes.text();
    res.status(gRes.status).json({ error: "Google Ads API error", detail: body }); return;
  }

  type GRow = {
    segments?: { date?: string };
    metrics?: {
      impressions?: number; clicks?: number;
      costMicros?: number; conversions?: number; conversionsValue?: number;
    };
  };
  const gData = await gRes.json() as { results?: GRow[] };

  const dailyMap: Record<string, {
    spend: number; impressions: number; clicks: number; conversions: number; revenue: number;
  }> = {};

  for (const r of gData.results ?? []) {
    const date = r.segments?.date ?? "";
    if (!date) continue;
    if (!dailyMap[date]) dailyMap[date] = { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
    dailyMap[date].spend       += (r.metrics?.costMicros ?? 0) / 1_000_000;
    dailyMap[date].impressions += r.metrics?.impressions    ?? 0;
    dailyMap[date].clicks      += r.metrics?.clicks         ?? 0;
    dailyMap[date].conversions += r.metrics?.conversions    ?? 0;
    dailyMap[date].revenue     += r.metrics?.conversionsValue ?? 0;
  }

  const dailySeries = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  const totals = dailySeries.reduce(
    (acc, d) => ({
      spend:       acc.spend       + d.spend,
      impressions: acc.impressions + d.impressions,
      clicks:      acc.clicks      + d.clicks,
      conversions: acc.conversions + d.conversions,
      revenue:     acc.revenue     + d.revenue,
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 },
  );

  res.json({ ...totals, dailySeries });
});

// ─── GET /api/data/meta ───────────────────────────────────────────────────────

router.get("/meta", authenticate, async (req, res) => {
  const { start: _startRaw, end: _endRaw } = req.query as Record<string, string>;
  let start: string, end: string;
  try { start = requireDate(_startRaw, "start"); end = requireDate(_endRaw, "end"); }
  catch (e) { res.status(400).json({ error: (e as Error).message }); return; }

  const rows = await db.select().from(integrationsTable)
    .where(eq(integrationsTable.provider, "meta")).limit(1);
  const row = rows[0];
  if (!row) { res.status(404).json({ error: "Meta Ads not connected" }); return; }

  const meta = parseMeta(row.metadata);

  const accessToken = (meta.accessToken?.trim())
    || (row.accessToken !== "manual" ? row.accessToken : "");

  const adAccountId = meta.adAccountId?.trim();

  if (!accessToken) {
    res.status(400).json({ error: "Access Token is required — update your Meta Ads credentials" }); return;
  }
  if (!adAccountId) {
    res.status(400).json({ error: "Ad Account ID is required — update your Meta Ads credentials" }); return;
  }

  const normalizedAccountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

  const fields    = "spend,impressions,clicks,actions,action_values,frequency,reach";
  const timeRange = JSON.stringify({ since: start, until: end });

  const mRes = await fetch(
    `https://graph.facebook.com/v18.0/${normalizedAccountId}/insights` +
    `?fields=${encodeURIComponent(fields)}` +
    `&time_range=${encodeURIComponent(timeRange)}` +
    `&time_increment=1&level=account&limit=90`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!mRes.ok) {
    const body = await mRes.text();
    res.status(mRes.status).json({ error: "Meta API error", detail: body }); return;
  }

  type MRow = {
    date_start: string; spend: string; impressions: string; clicks: string;
    frequency?: string;
    actions?:       Array<{ action_type: string; value: string }>;
    action_values?: Array<{ action_type: string; value: string }>;
  };
  const mData = await mRes.json() as { data?: MRow[] };

  const dailySeries = (mData.data ?? [])
    .map(r => {
      const purchases     = r.actions?.find(a => a.action_type === "purchase");
      const purchaseValue = r.action_values?.find(a => a.action_type === "purchase");
      return {
        date:        r.date_start,
        spend:       parseFloat(r.spend       ?? "0"),
        impressions: parseInt(r.impressions   ?? "0", 10),
        clicks:      parseInt(r.clicks        ?? "0", 10),
        conversions: parseFloat(purchases?.value     ?? "0"),
        revenue:     parseFloat(purchaseValue?.value ?? "0"),
        frequency:   parseFloat(r.frequency   ?? "0"),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const totals = dailySeries.reduce(
    (acc, d) => ({
      spend:       acc.spend       + d.spend,
      impressions: acc.impressions + d.impressions,
      clicks:      acc.clicks      + d.clicks,
      conversions: acc.conversions + d.conversions,
      revenue:     acc.revenue     + d.revenue,
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 },
  );

  const avgFrequency = dailySeries.length > 0
    ? dailySeries.reduce((s, d) => s + d.frequency, 0) / dailySeries.length
    : 0;

  res.json({ ...totals, frequency: avgFrequency, dailySeries });
});

// ─── GET /api/data/overview ───────────────────────────────────────────────────

router.get("/overview", authenticate, async (req, res) => {
  const { start: _startRaw, end: _endRaw } = req.query as Record<string, string>;
  let start: string, end: string;
  try { start = requireDate(_startRaw, "start"); end = requireDate(_endRaw, "end"); }
  catch (e) { res.status(400).json({ error: (e as Error).message }); return; }

  const storeIds = parseStoreIds(req.query.storeIds);
  const adSources = filterAdSources(storeIds);
  const commerceSources = filterCommerceSources(storeIds);

  // 1. Query in-scope commerce sources (e.g. Shopify orders when storeIds includes "shopify")
  let totalRevenue = 0;
  let totalOrders = 0;
  const dailyRevenueMap: Record<string, number> = {};

  for (const src of commerceSources) {
    try {
      const rows = await querySnowflake(`
        SELECT raw_data FROM ${src.table}
        WHERE TRY_CAST(LEFT(raw_data:${src.dateField}::STRING, 10) AS DATE) BETWEEN '${start}' AND '${end}'
      `);
      for (const row of rows) {
        const raw = row["RAW_DATA"] ?? row["raw_data"];
        let order: Record<string, unknown>;
        if (typeof raw === "string") { try { order = JSON.parse(raw) as Record<string, unknown>; } catch { continue; } }
        else { order = (raw ?? {}) as Record<string, unknown>; }
        const status = order["financial_status"] as string | undefined;
        if (status === "voided" || status === "refunded") continue;
        const price = parseFloat((order["total_price"] as string) ?? "0");
        const date  = ((order[src.dateField] as string) ?? "").slice(0, 10);
        if (!date) continue;
        totalRevenue += price;
        totalOrders  += 1;
        dailyRevenueMap[date] = (dailyRevenueMap[date] ?? 0) + price;
      }
    } catch (e) {
      console.error(`[data/overview] Commerce source ${src.storeId} query error:`, e);
    }
  }

  // 2. Query all ad platform tables (filtered by store scope)
  const channelBreakdown: Array<{ channelId: string; channelLabel: string; color: string; channelFamily: string; storeIds: string[]; spend: number; revenue: number }> = [];
  const dailySpendMap: Record<string, number> = {};
  const dailyAdRevenueMap: Record<string, number> = {};

  await Promise.all(adSources.map(async (src) => {
    const rows = await queryAdSource(src, start, end);
    if (rows.length === 0) return;
    const agg = aggregateAdRows(rows);
    channelBreakdown.push({
      channelId: src.channelId,
      channelLabel: src.channelLabel,
      color: src.color,
      channelFamily: src.channelFamily,
      storeIds: src.storeIds,
      spend: agg.spend,
      revenue: agg.revenue,
    });
    for (const r of rows) {
      dailySpendMap[r.date]     = (dailySpendMap[r.date]     ?? 0) + r.spend;
      dailyAdRevenueMap[r.date] = (dailyAdRevenueMap[r.date] ?? 0) + r.revenue;
    }
  }));

  const totalSpend = channelBreakdown.reduce((s, c) => s + c.spend, 0);
  const adRevenue  = channelBreakdown.reduce((s, c) => s + c.revenue, 0);
  const mer   = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const roas  = totalSpend > 0 && adRevenue > 0 ? adRevenue / totalSpend : 0;
  const aov   = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // 3. Build daily series — include ad-attributed revenue per day for accurate ROAS
  const allDates = new Set([...Object.keys(dailyRevenueMap), ...Object.keys(dailySpendMap)]);
  const dailySeries = [...allDates].sort().map(date => ({
    date,
    revenue:   dailyRevenueMap[date]     ?? 0,
    spend:     dailySpendMap[date]       ?? 0,
    adRevenue: dailyAdRevenueMap[date]   ?? 0,
  }));

  // 4. Store breakdown — derived from queried commerce sources
  const storeBreakdown = commerceSources.length > 0 && totalRevenue > 0
    ? commerceSources.map(src => ({ storeId: src.storeId, revenue: totalRevenue }))
    : [];

  const isEmpty = totalRevenue === 0 && totalSpend === 0;

  res.json({
    revenue: Math.round(totalRevenue * 100) / 100,
    orders:  totalOrders,
    aov:     Math.round(aov * 100) / 100,
    spend:   Math.round(totalSpend * 100) / 100,
    adRevenue: Math.round(adRevenue * 100) / 100,
    mer:     Math.round(mer * 1000) / 1000,
    roas:    Math.round(roas * 1000) / 1000,
    storeBreakdown,
    channelBreakdown: channelBreakdown.sort((a, b) => b.spend - a.spend),
    dailySeries,
    isEmpty,
    source: "snowflake",
  });
});

// ─── GET /api/data/attribution ────────────────────────────────────────────────

router.get("/attribution", authenticate, async (req, res) => {
  const { start: _startRaw, end: _endRaw } = req.query as Record<string, string>;
  let start: string, end: string;
  try { start = requireDate(_startRaw, "start"); end = requireDate(_endRaw, "end"); }
  catch (e) { res.status(400).json({ error: (e as Error).message }); return; }

  const adSources = filterAdSources(parseStoreIds(req.query.storeIds));

  const results = await Promise.all(
    adSources.map(async (src) => {
      const rows = await queryAdSource(src, start, end);
      if (rows.length === 0) return null;
      const agg = aggregateAdRows(rows);
      const byDate = groupByDate(rows);
      const dailySeries = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
      return {
        channelId:     src.channelId,
        channelLabel:  src.channelLabel,
        color:         src.color,
        channelFamily: src.channelFamily,
        storeIds:      src.storeIds,
        ...agg,
        dailySeries,
      };
    }),
  );

  const channels = results.filter(Boolean);
  res.json({ channels, isEmpty: channels.length === 0 });
});

// ─── GET /api/data/traffic ────────────────────────────────────────────────────

router.get("/traffic", authenticate, async (req, res) => {
  const { start: _startRaw, end: _endRaw } = req.query as Record<string, string>;
  let start: string, end: string;
  try { start = requireDate(_startRaw, "start"); end = requireDate(_endRaw, "end"); }
  catch (e) { res.status(400).json({ error: (e as Error).message }); return; }

  let totalRevenue = 0;
  let totalOrders  = 0;
  const productMap: Record<string, { revenue: number; orders: number; units: number }> = {};
  const stateMap:   Record<string, { revenue: number; orders: number }> = {};

  // Query Shopify orders for product and geographic data
  try {
    const rows = await querySnowflake(`
      SELECT raw_data FROM ${DB_NAME}.COMMERCE.SHOPIFY_ORDERS_RAW
      WHERE TRY_CAST(LEFT(raw_data:created_at::STRING, 10) AS DATE) BETWEEN '${start}' AND '${end}'
    `);

    for (const row of rows) {
      const raw = row["RAW_DATA"] ?? row["raw_data"];
      let order: Record<string, unknown>;
      if (typeof raw === "string") { try { order = JSON.parse(raw) as Record<string, unknown>; } catch { continue; } }
      else { order = (raw ?? {}) as Record<string, unknown>; }

      const status = order["financial_status"] as string | undefined;
      if (status === "voided" || status === "refunded") continue;

      const price = parseFloat((order["total_price"] as string) ?? "0");
      totalRevenue += price;
      totalOrders  += 1;

      // Geographic — shipping address state
      const shippingAddr = (order["shipping_address"] as Record<string, unknown> | undefined) ?? {};
      const provinceCode = ((shippingAddr["province_code"] as string | undefined) ?? "").toUpperCase();
      if (provinceCode && provinceCode.length === 2) {
        if (!stateMap[provinceCode]) stateMap[provinceCode] = { revenue: 0, orders: 0 };
        stateMap[provinceCode].revenue += price;
        stateMap[provinceCode].orders  += 1;
      }

      // Product breakdown from line_items
      const lineItems = (order["line_items"] as Array<Record<string, unknown>> | undefined) ?? [];
      for (const item of lineItems) {
        const productId = String(item["product_id"] ?? "unknown");
        const title     = String(item["title"] ?? "Unknown Product");
        const qty       = Number(item["quantity"] ?? 1);
        const unitPrice = parseFloat(String(item["price"] ?? "0"));
        const lineRev   = qty * unitPrice;
        const key = productId;
        if (!productMap[key]) productMap[key] = { revenue: 0, orders: 0, units: 0 };
        productMap[key].revenue += lineRev;
        productMap[key].orders  += 1;
        productMap[key].units   += qty;
        // Store title on first occurrence
        if (!(productMap[key] as Record<string, unknown>)["title"]) {
          (productMap[key] as Record<string, unknown>)["title"] = title;
          (productMap[key] as Record<string, unknown>)["id"]    = productId;
        }
      }
    }
  } catch (e) {
    console.error("[data/traffic] Shopify orders query error:", e);
  }

  // Enrich product metadata (title, image) from SHOPIFY_PRODUCTS_RAW
  try {
    const pRows = await querySnowflake(`
      SELECT raw_data FROM ${DB_NAME}.COMMERCE.SHOPIFY_PRODUCTS_RAW
    `);
    for (const row of pRows) {
      const raw = row["RAW_DATA"] ?? row["raw_data"];
      let product: Record<string, unknown>;
      if (typeof raw === "string") { try { product = JSON.parse(raw) as Record<string, unknown>; } catch { continue; } }
      else { product = (raw ?? {}) as Record<string, unknown>; }
      const pid = String(product["id"] ?? "");
      if (!pid || !productMap[pid]) continue;
      const pm = productMap[pid] as Record<string, unknown>;
      if (product["title"]) pm["title"] = product["title"];
      const images = product["images"] as Array<{ src?: string }> | undefined;
      if (images?.[0]?.src) pm["imageSrc"] = images[0].src;
    }
  } catch (e) {
    console.error("[data/traffic] Products enrichment error:", e);
  }

  // Build product array
  const products = Object.entries(productMap)
    .map(([id, v]) => ({
      id,
      productName: (v as Record<string, unknown>)["title"] as string ?? id,
      imageSrc:    (v as Record<string, unknown>)["imageSrc"] as string | undefined,
      revenue:     Math.round(v.revenue * 100) / 100,
      orders:      v.orders,
      units:       v.units,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 50);

  // Build state revenue array
  const stateRevenue = Object.entries(stateMap)
    .map(([stateCode, v]) => ({
      stateCode,
      revenue: Math.round(v.revenue * 100) / 100,
      orders:  v.orders,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const isEmpty = totalRevenue === 0 && products.length === 0;

  res.json({
    revenue:  Math.round(totalRevenue * 100) / 100,
    orders:   totalOrders,
    aov:      totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0,
    products,
    stateRevenue,
    isEmpty,
    source: "snowflake",
  });
});

// ─── GET /api/data/spend ──────────────────────────────────────────────────────

router.get("/spend", authenticate, async (req, res) => {
  const { start: _startRaw, end: _endRaw } = req.query as Record<string, string>;
  let start: string, end: string;
  try { start = requireDate(_startRaw, "start"); end = requireDate(_endRaw, "end"); }
  catch (e) { res.status(400).json({ error: (e as Error).message }); return; }

  const results = await Promise.all(
    AD_SOURCES.map(async (src) => {
      const rows = await queryAdSource(src, start, end);
      if (rows.length === 0) return null;
      const byDate = groupByDate(rows);
      const dailySpend = [...byDate.values()]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(r => ({ date: r.date, spend: r.spend }));
      const totalSpend = dailySpend.reduce((s, r) => s + r.spend, 0);
      return { channelId: src.channelId, totalSpend, dailySpend };
    }),
  );

  const channels = results.filter(Boolean);
  res.json({ channels, isEmpty: channels.length === 0 });
});

// ─── GET /api/data/performance ────────────────────────────────────────────────

router.get("/performance", authenticate, async (req, res) => {
  const { start: _startRaw, end: _endRaw } = req.query as Record<string, string>;
  let start: string, end: string;
  try { start = requireDate(_startRaw, "start"); end = requireDate(_endRaw, "end"); }
  catch (e) { res.status(400).json({ error: (e as Error).message }); return; }

  const adSources = filterAdSources(parseStoreIds(req.query.storeIds));

  const results = await Promise.all(
    adSources.map(async (src) => {
      const rows = await queryAdSource(src, start, end);
      if (rows.length === 0) return null;
      const byDate = groupByDate(rows);
      const dailySeries = [...byDate.values()]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(r => {
          const roas = r.spend > 0 ? r.revenue / r.spend : 0;
          const cpc  = r.clicks > 0 ? r.spend / r.clicks : 0;
          const ctr  = r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0;
          const cvr  = r.clicks > 0 ? (r.conversions / r.clicks) * 100 : 0;
          const cpm  = r.impressions > 0 ? (r.spend / r.impressions) * 1000 : 0;
          const cpa  = r.conversions > 0 ? r.spend / r.conversions : 0;
          return { date: r.date, spend: r.spend, revenue: r.revenue, impressions: r.impressions, clicks: r.clicks, conversions: r.conversions, roas, cpc, ctr, cvr, cpm, cpa };
        });
      return {
        channelId:    src.channelId,
        channelLabel: src.channelLabel,
        color:        src.color,
        channelFamily: src.channelFamily,
        dailySeries,
      };
    }),
  );

  const channels = results.filter(Boolean);
  res.json({ channels, isEmpty: channels.length === 0 });
});

export default router;
