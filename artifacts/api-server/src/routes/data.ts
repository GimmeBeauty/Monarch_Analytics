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

/** Maps DAILY_AD_SUMMARY channel values to display metadata. */
const CHANNEL_META: Record<string, { channelId: string; channelLabel: string; color: string; channelFamily: "core" | "rmn" | "experimental"; storeIds: string[] }> = {
  meta_ads:      { channelId: "meta-ads",      channelLabel: "Meta Ads",      color: "#1877F2", channelFamily: "core", storeIds: ["shopify"] },
  google_ads:    { channelId: "google-ads",    channelLabel: "Google Ads",    color: "#4285F4", channelFamily: "core", storeIds: ["shopify"] },
  pinterest_ads: { channelId: "pinterest-ads", channelLabel: "Pinterest Ads", color: "#E60023", channelFamily: "core", storeIds: ["shopify"] },
};

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

/** Normalise a Snowflake DATE value (may be a JS Date or string) to YYYY-MM-DD. */
function toDateStr(val: unknown): string {
  if (!val) return "";
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
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
        asp:         totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0,
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
    asp:         orders.length > 0 ? totalRevenue / orders.length : 0,
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
  const { start: _startRaw, end: _endRaw, storeIds: storeIdsRaw, priorStart: priorStartRaw, priorEnd: priorEndRaw } = req.query as Record<string, string>;
  let start: string, end: string;
  try { start = requireDate(_startRaw, "start"); end = requireDate(_endRaw, "end"); }
  catch (e) { res.status(400).json({ error: (e as Error).message }); return; }
  const storeIds = storeIdsRaw ? storeIdsRaw.split(",").map(s => s.trim().toLowerCase()) : [];
  const isTargetOnly = storeIds.length === 1 && storeIds[0] === "target";
  const includesTarget = storeIds.length === 0 || storeIds.includes("target");
  const isShopifySelected = storeIds.length === 0 || storeIds.includes("shopify");
  const isWalmartSelected = storeIds.length === 0 || storeIds.includes("walmart");
  const priorStart = DATE_RE.test(priorStartRaw ?? "") ? priorStartRaw! : "";
  const priorEnd   = DATE_RE.test(priorEndRaw   ?? "") ? priorEndRaw!   : "";
  const hasPrior   = !!(priorStart && priorEnd);

  try {
    const aggregateQuery = isTargetOnly
      ? querySnowflake(`
          SELECT
            SUM(revenue)    AS total_revenue,
            0               AS total_spend,
            SUM(units_sold) AS total_units,
            SUM(units_sold) AS total_orders
          FROM ${DB_NAME}.RETAIL.TARGET_STORE_DAILY
          WHERE summary_date BETWEEN '${start}' AND '${end}'
        `)
      : querySnowflake(`
          SELECT
            SUM(total_revenue) AS total_revenue,
            SUM(ad_spend)      AS total_spend,
            SUM(units_sold)    AS total_units,
            SUM(order_count)   AS total_orders
          FROM ${DB_NAME}.COMMERCE.MONARCH_DAILY_SUMMARY
          WHERE summary_date BETWEEN '${start}' AND '${end}'
        `);

    const dailySeriesQuery = isTargetOnly
      ? querySnowflake(`
          SELECT summary_date, sale_amount AS total_revenue, 0 AS ad_spend
          FROM ${DB_NAME}.RETAIL.TARGET_DAILY_SUMMARY
          WHERE summary_date BETWEEN '${start}' AND '${end}'
          ORDER BY summary_date ASC
        `)
      : querySnowflake(`
          SELECT summary_date, total_revenue, ad_spend
          FROM ${DB_NAME}.COMMERCE.MONARCH_DAILY_SUMMARY
          WHERE summary_date BETWEEN '${start}' AND '${end}'
          ORDER BY summary_date ASC
        `);

    const targetSummaryQuery = (includesTarget && !isTargetOnly)
      ? querySnowflake(`
          SELECT SUM(sale_amount) AS target_revenue, SUM(sale_quantity) AS target_units
          FROM ${DB_NAME}.RETAIL.TARGET_DAILY_SUMMARY
          WHERE summary_date BETWEEN '${start}' AND '${end}'
        `)
      : Promise.resolve([]);

    const walmartSummaryQuery = (isWalmartSelected && !isTargetOnly)
      ? querySnowflake(`
          SELECT SUM(revenue) AS walmart_revenue, SUM(units_sold) AS walmart_units
          FROM ${DB_NAME}.RETAIL.WALMART_STATE_DAILY
          WHERE week_date BETWEEN '${start}' AND '${end}'
        `)
      : Promise.resolve([]);

    const targetDailyQuery = (includesTarget && !isTargetOnly)
      ? querySnowflake(`
          SELECT summary_date, SUM(sale_amount) AS total_revenue
          FROM ${DB_NAME}.RETAIL.TARGET_DAILY_SUMMARY
          WHERE summary_date BETWEEN '${start}' AND '${end}'
          GROUP BY summary_date
          ORDER BY summary_date ASC
        `)
      : Promise.resolve([]);

    const shopifySummaryQuery = (isShopifySelected && !isTargetOnly)
      ? querySnowflake(`
          SELECT SUM(revenue) AS shopify_revenue, SUM(order_count) AS shopify_orders, SUM(units_sold) AS shopify_units
          FROM ${DB_NAME}.COMMERCE.SHOPIFY_DAILY_SUMMARY
          WHERE summary_date BETWEEN '${start}' AND '${end}'
        `)
      : Promise.resolve([]);

    const priorShopifyQuery = (hasPrior && isShopifySelected && !isTargetOnly)
      ? querySnowflake(`
          SELECT SUM(revenue) AS shopify_revenue, SUM(order_count) AS shopify_orders, SUM(units_sold) AS shopify_units
          FROM ${DB_NAME}.COMMERCE.SHOPIFY_DAILY_SUMMARY
          WHERE summary_date BETWEEN '${priorStart}' AND '${priorEnd}'
        `)
      : Promise.resolve([]);

    const priorTargetQuery = (hasPrior && includesTarget)
      ? querySnowflake(`
          SELECT SUM(revenue) AS target_revenue, SUM(units_sold) AS target_units
          FROM ${DB_NAME}.RETAIL.TARGET_STORE_DAILY
          WHERE summary_date BETWEEN '${priorStart}' AND '${priorEnd}'
        `)
      : Promise.resolve([]);

    const priorGa4Query = hasPrior
      ? querySnowflake(`
          SELECT SUM(sessions) AS total_sessions
          FROM ${DB_NAME}.COMMERCE.GA4_DAILY_SUMMARY
          WHERE summary_date BETWEEN '${priorStart}' AND '${priorEnd}'
        `)
      : Promise.resolve([]);

    const priorWebOrdersQuery = (hasPrior && isShopifySelected)
      ? querySnowflake(`
          SELECT COUNT(*) AS web_orders
          FROM ${DB_NAME}.COMMERCE.SHOPIFY_ORDERS_RAW
          WHERE ingestion_date BETWEEN '${priorStart}' AND '${priorEnd}'
          AND raw_data:financial_status::STRING IN ('paid','partially_paid')
          AND raw_data:source_name::STRING = 'web'
        `)
      : Promise.resolve([]);

    const [summaryRows, dailySummaryRows, adDailyRows, channelRows, ga4Rows, webOrderRows, targetSummaryRows, walmartSummaryRows, targetDailyRows, shopifySummaryRows, priorShopifyRows, priorTargetRows, priorGa4Rows, priorWebOrdersRows] = await Promise.all([
      aggregateQuery,
      dailySeriesQuery,
      // Daily conversion value and spend from DAILY_AD_SUMMARY
      querySnowflake(`
        SELECT summary_date, SUM(conversion_value) AS cv, SUM(spend) AS ad_spend
        FROM ${DB_NAME}.ADS.DAILY_AD_SUMMARY
        WHERE summary_date BETWEEN '${start}' AND '${end}'
        GROUP BY summary_date
        ORDER BY summary_date ASC
      `),
      // Channel breakdown from DAILY_AD_SUMMARY
      querySnowflake(`
        SELECT channel, SUM(spend) AS spend, SUM(conversion_value) AS revenue
        FROM ${DB_NAME}.ADS.DAILY_AD_SUMMARY
        WHERE summary_date BETWEEN '${start}' AND '${end}'
        GROUP BY channel
        ORDER BY spend DESC
      `),
      // Sessions from GA4_DAILY_SUMMARY
      querySnowflake(`
        SELECT SUM(sessions) AS total_sessions
        FROM ${DB_NAME}.COMMERCE.GA4_DAILY_SUMMARY
        WHERE summary_date BETWEEN '${start}' AND '${end}'
      `),
      // Web orders from SHOPIFY_ORDERS_RAW (for CVR numerator)
      querySnowflake(`
        SELECT COUNT(*) AS web_orders
        FROM ${DB_NAME}.COMMERCE.SHOPIFY_ORDERS_RAW
        WHERE ingestion_date BETWEEN '${start}' AND '${end}'
        AND raw_data:financial_status::STRING IN ('paid','partially_paid')
        AND raw_data:source_name::STRING = 'web'
      `),
      targetSummaryQuery,
      walmartSummaryQuery,
      targetDailyQuery,
      shopifySummaryQuery,
      priorShopifyQuery,
      priorTargetQuery,
      priorGa4Query,
      priorWebOrdersQuery,
    ]);

    const agg          = summaryRows[0] ?? {};
    const totalRevenue = Number(agg["TOTAL_REVENUE"] ?? agg["total_revenue"] ?? 0);
    const totalSpend   = Number(agg["TOTAL_SPEND"]   ?? agg["total_spend"]   ?? 0);
    const totalOrders  = Number(agg["TOTAL_ORDERS"]  ?? agg["total_orders"]  ?? 0);
    const totalUnits   = Number(agg["TOTAL_UNITS"]   ?? agg["total_units"]   ?? 0);

    // Build daily conversion-value and spend maps from DAILY_AD_SUMMARY
    const dailyCvMap: Record<string, number> = {};
    const dailyAdSpendMap: Record<string, number> = {};
    let totalAdRevenue = 0;
    let totalDailyAdSpend = 0;
    for (const row of adDailyRows) {
      const date = toDateStr(row["SUMMARY_DATE"] ?? row["summary_date"]);
      const cv   = Number(row["CV"] ?? row["cv"] ?? 0);
      const ads  = Number(row["AD_SPEND"] ?? row["ad_spend"] ?? 0);
      if (date) {
        dailyCvMap[date] = (dailyCvMap[date] ?? 0) + cv;
        dailyAdSpendMap[date] = (dailyAdSpendMap[date] ?? 0) + ads;
        totalAdRevenue += cv;
        totalDailyAdSpend += ads;
      }
    }

    // Daily series — MONARCH or TARGET_DAILY_SUMMARY depending on store selection
    let dailySeries = dailySummaryRows.map(row => {
      const date    = toDateStr(row["SUMMARY_DATE"] ?? row["summary_date"]);
      const revenue = Number(row["TOTAL_REVENUE"] ?? row["total_revenue"] ?? 0);
      const spend   = Number(row["AD_SPEND"]      ?? row["ad_spend"]      ?? 0);
      return { date, revenue, spend, adRevenue: dailyCvMap[date] ?? 0, adSpend: dailyAdSpendMap[date] ?? 0 };
    });
    let totalTargetRevForMer = 0;
    if (includesTarget && !isTargetOnly) {
      const targetDailyMap: Record<string, number> = {};
      for (const row of targetDailyRows) {
        const date = toDateStr(row["SUMMARY_DATE"] ?? row["summary_date"]);
        const rev  = Number(row["TOTAL_REVENUE"]  ?? row["total_revenue"]  ?? 0);
        if (date) { targetDailyMap[date] = rev; totalTargetRevForMer += rev; }
      }
      dailySeries = dailySeries.map(d => ({ ...d, revenue: d.revenue + (targetDailyMap[d.date] ?? 0) }));
    }

    // Channel breakdown with metadata mapping
    const channelBreakdown = channelRows
      .map(row => {
        const ch    = String(row["CHANNEL"] ?? row["channel"] ?? "").toLowerCase();
        const spend = Number(row["SPEND"]   ?? row["spend"]   ?? 0);
        const rev   = Number(row["REVENUE"] ?? row["revenue"] ?? 0);
        const meta  = CHANNEL_META[ch];
        if (!meta) return null;
        return { ...meta, spend, revenue: rev };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => b.spend - a.spend);

    const ga4Agg        = ga4Rows[0] ?? {};
    const totalSessions = Number(ga4Agg["TOTAL_SESSIONS"] ?? ga4Agg["total_sessions"] ?? 0);
    const webOrderAgg   = webOrderRows[0] ?? {};
    const webOrders     = Number(webOrderAgg["WEB_ORDERS"] ?? webOrderAgg["web_orders"] ?? 0);
    const cvr           = (isShopifySelected && totalSessions > 0) ? webOrders / totalSessions : 0;

    const roas = totalSpend > 0 ? totalAdRevenue / totalSpend : 0;

    const targetSummaryAgg = (targetSummaryRows as Array<Record<string, unknown>>)[0] ?? {};
    const targetRev   = isTargetOnly
      ? Math.round(totalRevenue * 100) / 100
      : Math.round(Number(targetSummaryAgg["TARGET_REVENUE"] ?? targetSummaryAgg["target_revenue"] ?? 0) * 100) / 100;
    const targetUnits = isTargetOnly
      ? totalUnits
      : Number(targetSummaryAgg["TARGET_UNITS"] ?? targetSummaryAgg["target_units"] ?? 0);

    const shopifySummaryAgg = (shopifySummaryRows as Array<Record<string, unknown>>)[0] ?? {};
    const shopifyRev    = (isShopifySelected && !isTargetOnly)
      ? Math.round(Number(shopifySummaryAgg["SHOPIFY_REVENUE"] ?? shopifySummaryAgg["shopify_revenue"] ?? 0) * 100) / 100
      : 0;
    const shopifyOrders = (isShopifySelected && !isTargetOnly)
      ? Number(shopifySummaryAgg["SHOPIFY_ORDERS"] ?? shopifySummaryAgg["shopify_orders"] ?? totalOrders)
      : (isTargetOnly ? 0 : totalOrders);
    const shopifyUnits  = (isShopifySelected && !isTargetOnly)
      ? Number(shopifySummaryAgg["SHOPIFY_UNITS"] ?? shopifySummaryAgg["shopify_units"] ?? 0)
      : 0;

    const walmartSummaryAgg = (walmartSummaryRows as Array<Record<string, unknown>>)[0] ?? {};
    const walmartRev   = (isWalmartSelected && !isTargetOnly) ? Math.round(Number(walmartSummaryAgg["WALMART_REVENUE"] ?? walmartSummaryAgg["walmart_revenue"] ?? 0) * 100) / 100 : 0;
    const walmartUnits = (isWalmartSelected && !isTargetOnly) ? Number(walmartSummaryAgg["WALMART_UNITS"] ?? walmartSummaryAgg["walmart_units"] ?? 0) : 0;

    const effectiveTotalRevenue = isTargetOnly ? totalRevenue : shopifyRev + targetRev + walmartRev;
    const mer = totalDailyAdSpend > 0 ? effectiveTotalRevenue / totalDailyAdSpend : 0;
    const effectiveOrders = isShopifySelected ? shopifyOrders : 0;
    const effectiveUnits  = isTargetOnly
      ? totalUnits
      : (isShopifySelected ? shopifyUnits : 0) + (includesTarget ? targetUnits : 0) + (isWalmartSelected ? walmartUnits : 0);
    const asp = effectiveUnits > 0 ? effectiveTotalRevenue / effectiveUnits : 0;

    const pct = (c: number, p: number) => p > 0 ? Math.round((c - p) / p * 1000) / 10 : 0;
    const priorShopifyAgg = (priorShopifyRows as Array<Record<string, unknown>>)[0] ?? {};
    const priorShopifyRev = (hasPrior && isShopifySelected && !isTargetOnly)
      ? Math.round(Number(priorShopifyAgg["SHOPIFY_REVENUE"] ?? priorShopifyAgg["shopify_revenue"] ?? 0) * 100) / 100
      : 0;
    const priorShopifyOrders = (hasPrior && isShopifySelected && !isTargetOnly)
      ? Number(priorShopifyAgg["SHOPIFY_ORDERS"] ?? priorShopifyAgg["shopify_orders"] ?? 0)
      : 0;
    const priorTargetAgg = (priorTargetRows as Array<Record<string, unknown>>)[0] ?? {};
    const priorTargetRev = (hasPrior && includesTarget)
      ? Math.round(Number(priorTargetAgg["TARGET_REVENUE"] ?? priorTargetAgg["target_revenue"] ?? 0) * 100) / 100
      : 0;
    const priorRevenue = isTargetOnly ? priorTargetRev : priorShopifyRev + priorTargetRev;
    const priorOrders  = isShopifySelected ? priorShopifyOrders : 0;
    const priorShopifyUnits = (hasPrior && isShopifySelected && !isTargetOnly)
      ? Number(priorShopifyAgg["SHOPIFY_UNITS"] ?? priorShopifyAgg["shopify_units"] ?? 0)
      : 0;
    const priorTargetUnits = (hasPrior && includesTarget)
      ? Number(priorTargetAgg["TARGET_UNITS"] ?? priorTargetAgg["target_units"] ?? 0)
      : 0;
    const priorUnits = (isShopifySelected ? priorShopifyUnits : 0) + (includesTarget ? priorTargetUnits : 0);
    const priorAsp   = priorUnits > 0 ? priorRevenue / priorUnits : 0;
    const priorGa4Agg  = (priorGa4Rows as Array<Record<string, unknown>>)[0] ?? {};
    const priorSessions = Number(priorGa4Agg["TOTAL_SESSIONS"] ?? priorGa4Agg["total_sessions"] ?? 0);
    const priorWebOrdersAgg = (priorWebOrdersRows as Array<Record<string, unknown>>)[0] ?? {};
    const priorWebOrders = Number(priorWebOrdersAgg["WEB_ORDERS"] ?? priorWebOrdersAgg["web_orders"] ?? 0);
    const priorCvr = (isShopifySelected && priorSessions > 0) ? priorWebOrders / priorSessions : 0;

    const storeBreakdown: Array<{ storeId: string; revenue: number }> = isTargetOnly
      ? (totalRevenue > 0 ? [{ storeId: "target", revenue: Math.round(totalRevenue * 100) / 100 }] : [])
      : [
          ...(shopifyRev  > 0 ? [{ storeId: "shopify",  revenue: shopifyRev  }] : []),
          ...(targetRev   > 0 ? [{ storeId: "target",   revenue: targetRev   }] : []),
          ...(walmartRev  > 0 ? [{ storeId: "walmart",  revenue: walmartRev  }] : []),
        ];

    const isEmpty = effectiveTotalRevenue === 0 && totalSpend === 0;

    res.json({
      revenue:   Math.round(effectiveTotalRevenue * 100) / 100,
      orders:    effectiveOrders,
      units:     effectiveUnits,
      asp:       Math.round(asp            * 100) / 100,
      spend:     Math.round(totalSpend     * 100) / 100,
      adRevenue: Math.round(totalAdRevenue * 100) / 100,
      mer:       Math.round(mer            * 1000) / 1000,
      roas:      Math.round(roas           * 1000) / 1000,
      sessions:  totalSessions,
      cvr:       Math.round(cvr * 10000) / 10000,
      revenueChange: hasPrior ? pct(effectiveTotalRevenue, priorRevenue) : 0,
      ordersChange:  hasPrior ? pct(effectiveOrders, priorOrders) : 0,
      aspChange:     hasPrior ? pct(asp, priorAsp) : 0,
      sessionsChange: hasPrior ? pct(totalSessions, priorSessions) : 0,
      cvrChange:     hasPrior ? pct(cvr, priorCvr) : 0,
      storeBreakdown,
      channelBreakdown,
      dailySeries,
      isEmpty,
      source: "snowflake-summary",
    });
  } catch (e) {
    console.error("[data/overview] Error:", e);
    res.status(500).json({ error: "Failed to query overview data", detail: String(e) });
  }
});

// ─── GET /api/data/attribution ────────────────────────────────────────────────

router.get("/attribution", authenticate, async (req, res) => {
  const { start: _startRaw, end: _endRaw } = req.query as Record<string, string>;
  let start: string, end: string;
  try { start = requireDate(_startRaw, "start"); end = requireDate(_endRaw, "end"); }
  catch (e) { res.status(400).json({ error: (e as Error).message }); return; }

  try {
    const [aggRows, dailyRows] = await Promise.all([
      // Aggregated metrics per channel
      querySnowflake(`
        SELECT
          channel,
          SUM(spend)            AS spend,
          SUM(impressions)      AS impressions,
          SUM(clicks)           AS clicks,
          SUM(conversions)      AS conversions,
          SUM(conversion_value) AS revenue
        FROM ${DB_NAME}.ADS.DAILY_AD_SUMMARY
        WHERE summary_date BETWEEN '${start}' AND '${end}'
        GROUP BY channel
      `),
      // Daily series per channel
      querySnowflake(`
        SELECT
          summary_date,
          channel,
          spend,
          impressions,
          clicks,
          conversions,
          conversion_value AS revenue
        FROM ${DB_NAME}.ADS.DAILY_AD_SUMMARY
        WHERE summary_date BETWEEN '${start}' AND '${end}'
        ORDER BY summary_date ASC
      `),
    ]);

    // Group daily rows by channel
    const dailyByChannel: Record<string, Array<{ date: string; spend: number; impressions: number; clicks: number; conversions: number; revenue: number }>> = {};
    for (const row of dailyRows) {
      const ch   = String(row["CHANNEL"] ?? row["channel"] ?? "").toLowerCase();
      const date = toDateStr(row["SUMMARY_DATE"] ?? row["summary_date"]);
      if (!ch || !date) continue;
      if (!dailyByChannel[ch]) dailyByChannel[ch] = [];
      dailyByChannel[ch].push({
        date,
        spend:       Number(row["SPEND"]       ?? row["spend"]       ?? 0),
        impressions: Number(row["IMPRESSIONS"] ?? row["impressions"] ?? 0),
        clicks:      Number(row["CLICKS"]      ?? row["clicks"]      ?? 0),
        conversions: Number(row["CONVERSIONS"] ?? row["conversions"] ?? 0),
        revenue:     Number(row["REVENUE"]     ?? row["revenue"]     ?? 0),
      });
    }

    const channels = aggRows
      .map(row => {
        const ch   = String(row["CHANNEL"] ?? row["channel"] ?? "").toLowerCase();
        const meta = CHANNEL_META[ch];
        if (!meta) return null;
        return {
          ...meta,
          spend:       Number(row["SPEND"]       ?? row["spend"]       ?? 0),
          impressions: Number(row["IMPRESSIONS"] ?? row["impressions"] ?? 0),
          clicks:      Number(row["CLICKS"]      ?? row["clicks"]      ?? 0),
          conversions: Number(row["CONVERSIONS"] ?? row["conversions"] ?? 0),
          revenue:     Number(row["REVENUE"]     ?? row["revenue"]     ?? 0),
          dailySeries: dailyByChannel[ch] ?? [],
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    res.json({ channels, isEmpty: channels.length === 0 });
  } catch (e) {
    console.error("[data/attribution] Error:", e);
    res.status(500).json({ error: "Failed to query attribution data", detail: String(e) });
  }
});

// ─── GET /api/data/traffic ────────────────────────────────────────────────────

router.get("/traffic", authenticate, async (req, res) => {
  const { start: _startRaw, end: _endRaw, storeIds: storeIdsRaw, priorStart: priorStartRaw, priorEnd: priorEndRaw } = req.query as Record<string, string>;
  let start: string, end: string;
  try { start = requireDate(_startRaw, "start"); end = requireDate(_endRaw, "end"); }
  catch (e) { res.status(400).json({ error: (e as Error).message }); return; }
  const storeIds = storeIdsRaw ? storeIdsRaw.split(",").map(s => s.trim().toLowerCase()) : [];
  const isTargetOnly = storeIds.length === 1 && storeIds[0] === "target";
  const includesTarget = storeIds.length === 0 || storeIds.includes("target");
  const isShopifySelected = storeIds.length === 0 || storeIds.includes("shopify");
  const isWalmartSelected = storeIds.length === 0 || storeIds.includes("walmart");
  const priorStart = DATE_RE.test(priorStartRaw ?? "") ? priorStartRaw! : "";
  const priorEnd   = DATE_RE.test(priorEndRaw   ?? "") ? priorEndRaw!   : "";
  const hasPrior   = !!(priorStart && priorEnd);

  try {
    const targetTrafficSummaryQuery = (includesTarget && !isTargetOnly)
      ? querySnowflake(`
          SELECT SUM(revenue) AS target_revenue, SUM(units_sold) AS target_units
          FROM ${DB_NAME}.RETAIL.TARGET_STORE_DAILY
          WHERE summary_date BETWEEN '${start}' AND '${end}'
        `)
      : Promise.resolve([]);

    const walmartTrafficSummaryQuery = (isWalmartSelected && !isTargetOnly)
      ? querySnowflake(`
          SELECT SUM(revenue) AS walmart_revenue, SUM(units_sold) AS walmart_units
          FROM ${DB_NAME}.RETAIL.WALMART_WEEKLY_SUMMARY
          WHERE week_date BETWEEN '${start}' AND '${end}'
        `)
      : Promise.resolve([]);

    const priorSummaryQuery = hasPrior
      ? (isTargetOnly
        ? querySnowflake(`
            SELECT SUM(revenue) AS total_revenue, SUM(units_sold) AS total_orders, SUM(units_sold) AS total_units
            FROM ${DB_NAME}.RETAIL.TARGET_STORE_DAILY
            WHERE summary_date BETWEEN '${priorStart}' AND '${priorEnd}'
          `)
        : querySnowflake(`
            SELECT SUM(revenue) AS total_revenue, SUM(order_count) AS total_orders, SUM(units_sold) AS total_units
            FROM ${DB_NAME}.COMMERCE.SHOPIFY_DAILY_SUMMARY
            WHERE summary_date BETWEEN '${priorStart}' AND '${priorEnd}'
          `))
      : Promise.resolve([]);

    const priorTrafficTargetQuery = (hasPrior && includesTarget && !isTargetOnly)
      ? querySnowflake(`
          SELECT SUM(revenue) AS target_revenue
          FROM ${DB_NAME}.RETAIL.TARGET_STORE_DAILY
          WHERE summary_date BETWEEN '${priorStart}' AND '${priorEnd}'
        `)
      : Promise.resolve([]);

    const priorTrafficGa4Query = hasPrior
      ? querySnowflake(`
          SELECT SUM(sessions) AS total_sessions
          FROM ${DB_NAME}.COMMERCE.GA4_DAILY_SUMMARY
          WHERE summary_date BETWEEN '${priorStart}' AND '${priorEnd}'
        `)
      : Promise.resolve([]);

    const priorTrafficWebOrdersQuery = (hasPrior && isShopifySelected)
      ? querySnowflake(`
          SELECT COUNT(*) AS web_orders
          FROM ${DB_NAME}.COMMERCE.SHOPIFY_ORDERS_RAW
          WHERE ingestion_date BETWEEN '${priorStart}' AND '${priorEnd}'
          AND raw_data:financial_status::STRING IN ('paid','partially_paid')
          AND raw_data:source_name::STRING = 'web'
        `)
      : Promise.resolve([]);

    const summaryQuery = isTargetOnly
      ? querySnowflake(`
          SELECT SUM(revenue) AS total_revenue, SUM(units_sold) AS total_orders, SUM(units_sold) AS total_units
          FROM ${DB_NAME}.RETAIL.TARGET_STORE_DAILY
          WHERE summary_date BETWEEN '${start}' AND '${end}'
        `)
      : querySnowflake(`
          SELECT SUM(revenue) AS total_revenue, SUM(order_count) AS total_orders, SUM(units_sold) AS total_units
          FROM ${DB_NAME}.COMMERCE.SHOPIFY_DAILY_SUMMARY
          WHERE summary_date BETWEEN '${start}' AND '${end}'
        `);

    const [summaryRows, productRows, geoRows, ga4Rows, webOrderRows, targetTrafficSummaryRows, walmartTrafficSummaryRows, priorSummaryRows, priorTrafficTargetRows, priorTrafficGa4Rows, priorTrafficWebOrdersRows] = await Promise.all([
      summaryQuery,
      // Product performance from SHOPIFY_PRODUCT_DAILY
      querySnowflake(`
        SELECT
          product_id,
          title,
          sku,
          SUM(revenue)     AS revenue,
          SUM(units_sold)  AS units_sold,
          SUM(order_count) AS order_count,
          AVG(avg_price)   AS avg_price
        FROM ${DB_NAME}.COMMERCE.SHOPIFY_PRODUCT_DAILY
        WHERE summary_date BETWEEN '${start}' AND '${end}'
        GROUP BY product_id, title, sku
        ORDER BY revenue DESC
        LIMIT 50
      `),
      // Geographic breakdown from SHOPIFY_GEO_DAILY
      querySnowflake(`
        SELECT state, SUM(revenue) AS revenue, SUM(order_count) AS order_count
        FROM ${DB_NAME}.COMMERCE.SHOPIFY_GEO_DAILY
        WHERE summary_date BETWEEN '${start}' AND '${end}'
        GROUP BY state
        ORDER BY revenue DESC
      `),
      // Sessions from GA4_DAILY_SUMMARY
      querySnowflake(`
        SELECT SUM(sessions) AS total_sessions
        FROM ${DB_NAME}.COMMERCE.GA4_DAILY_SUMMARY
        WHERE summary_date BETWEEN '${start}' AND '${end}'
      `),
      // Web orders from SHOPIFY_ORDERS_RAW (for CVR numerator)
      querySnowflake(`
        SELECT COUNT(*) AS web_orders
        FROM ${DB_NAME}.COMMERCE.SHOPIFY_ORDERS_RAW
        WHERE ingestion_date BETWEEN '${start}' AND '${end}'
        AND raw_data:financial_status::STRING IN ('paid','partially_paid')
        AND raw_data:source_name::STRING = 'web'
      `),
      targetTrafficSummaryQuery,
      walmartTrafficSummaryQuery,
      priorSummaryQuery,
      priorTrafficTargetQuery,
      priorTrafficGa4Query,
      priorTrafficWebOrdersQuery,
    ]);

    const summaryAgg   = summaryRows[0] ?? {};
    const totalRevenue = Number(summaryAgg["TOTAL_REVENUE"] ?? summaryAgg["total_revenue"] ?? 0);
    const totalOrders  = Number(summaryAgg["TOTAL_ORDERS"]  ?? summaryAgg["total_orders"]  ?? 0);
    const totalUnits   = Number(summaryAgg["TOTAL_UNITS"]   ?? summaryAgg["total_units"]   ?? 0);

    const targetTrafficAgg = (targetTrafficSummaryRows as Array<Record<string, unknown>>)[0] ?? {};
    const targetTrafficRev   = Math.round(Number(targetTrafficAgg["TARGET_REVENUE"] ?? targetTrafficAgg["target_revenue"] ?? 0) * 100) / 100;
    const targetTrafficUnits = Number(targetTrafficAgg["TARGET_UNITS"] ?? targetTrafficAgg["target_units"] ?? 0);
    const walmartTrafficAgg = (walmartTrafficSummaryRows as Array<Record<string, unknown>>)[0] ?? {};
    const walmartTrafficRev   = (isWalmartSelected && !isTargetOnly) ? Math.round(Number(walmartTrafficAgg["WALMART_REVENUE"] ?? walmartTrafficAgg["walmart_revenue"] ?? 0) * 100) / 100 : 0;
    const walmartTrafficUnits = (isWalmartSelected && !isTargetOnly) ? Number(walmartTrafficAgg["WALMART_UNITS"] ?? walmartTrafficAgg["walmart_units"] ?? 0) : 0;
    const shopifyTrafficRev = isShopifySelected && !isTargetOnly ? totalRevenue : 0;
    const effectiveRevenue = isTargetOnly
      ? totalRevenue
      : shopifyTrafficRev + (includesTarget ? targetTrafficRev : 0) + (isWalmartSelected ? walmartTrafficRev : 0);

    const effectiveOrders = isShopifySelected ? totalOrders : 0;
    const effectiveUnits  = isTargetOnly
      ? totalOrders
      : (isShopifySelected ? totalUnits : 0) + (includesTarget ? targetTrafficUnits : 0) + (isWalmartSelected ? walmartTrafficUnits : 0);
    const asp = effectiveUnits > 0 ? effectiveRevenue / effectiveUnits : 0;

    const ga4Agg        = ga4Rows[0] ?? {};
    const totalSessions = Number(ga4Agg["TOTAL_SESSIONS"] ?? ga4Agg["total_sessions"] ?? 0);
    const webOrderAgg   = webOrderRows[0] ?? {};
    const webOrders     = Number(webOrderAgg["WEB_ORDERS"] ?? webOrderAgg["web_orders"] ?? 0);
    const cvr           = (isShopifySelected && totalSessions > 0) ? webOrders / totalSessions : 0;
    console.log("[data/traffic] totalSessions:", totalSessions);

    const pct = (c: number, p: number) => p > 0 ? Math.round((c - p) / p * 1000) / 10 : 0;
    const priorSummaryAgg   = (priorSummaryRows as Array<Record<string, unknown>>)[0] ?? {};
    const priorTotalRevenue = Number(priorSummaryAgg["TOTAL_REVENUE"] ?? priorSummaryAgg["total_revenue"] ?? 0);
    const priorTotalOrders  = Number(priorSummaryAgg["TOTAL_ORDERS"]  ?? priorSummaryAgg["total_orders"]  ?? 0);
    const priorTotalUnits   = Number(priorSummaryAgg["TOTAL_UNITS"]   ?? priorSummaryAgg["total_units"]   ?? 0);
    const priorTargetAgg    = (priorTrafficTargetRows as Array<Record<string, unknown>>)[0] ?? {};
    const priorTargetRev    = Math.round(Number(priorTargetAgg["TARGET_REVENUE"] ?? priorTargetAgg["target_revenue"] ?? 0) * 100) / 100;
    const priorShopifyRev   = isShopifySelected && !isTargetOnly ? priorTotalRevenue : 0;
    const priorEffectiveRevenue = isTargetOnly
      ? priorTotalRevenue
      : priorShopifyRev + (includesTarget ? priorTargetRev : 0);
    const priorEffectiveOrders = isShopifySelected ? priorTotalOrders : 0;
    const priorEffectiveUnits = isTargetOnly ? priorTotalOrders : (isShopifySelected ? priorTotalUnits : 0);
    const priorAsp = priorEffectiveUnits > 0 ? priorEffectiveRevenue / priorEffectiveUnits : 0;
    const priorGa4Agg       = (priorTrafficGa4Rows as Array<Record<string, unknown>>)[0] ?? {};
    const priorSessions     = Number(priorGa4Agg["TOTAL_SESSIONS"] ?? priorGa4Agg["total_sessions"] ?? 0);
    const priorWebOrdersAgg = (priorTrafficWebOrdersRows as Array<Record<string, unknown>>)[0] ?? {};
    const priorWebOrders    = Number(priorWebOrdersAgg["WEB_ORDERS"] ?? priorWebOrdersAgg["web_orders"] ?? 0);
    const priorCvr = (isShopifySelected && priorSessions > 0) ? priorWebOrders / priorSessions : 0;

    const products = productRows.map(row => ({
      id:          String(row["PRODUCT_ID"]  ?? row["product_id"]  ?? ""),
      productName: String(row["TITLE"]       ?? row["title"]       ?? "Unknown Product"),
      sku:         String(row["SKU"]         ?? row["sku"]         ?? ""),
      revenue:     Math.round(Number(row["REVENUE"]     ?? row["revenue"]     ?? 0) * 100) / 100,
      orders:      Number(row["ORDER_COUNT"] ?? row["order_count"] ?? 0),
      units:       Number(row["UNITS_SOLD"]  ?? row["units_sold"]  ?? 0),
    }));

    const stateRevenue = geoRows.map(row => ({
      stateCode: String(row["STATE"]       ?? row["state"]       ?? "").toUpperCase(),
      revenue:   Math.round(Number(row["REVENUE"]     ?? row["revenue"]     ?? 0) * 100) / 100,
      orders:    Number(row["ORDER_COUNT"] ?? row["order_count"] ?? 0),
    }));

    const isEmpty = effectiveRevenue === 0 && products.length === 0 && totalSessions === 0;

    res.json({
      revenue:     Math.round(effectiveRevenue * 100) / 100,
      orders:      effectiveOrders,
      units:       effectiveUnits,
      asp:         Math.round(asp * 100) / 100,
      sessions:    totalSessions,
      cvr:         Math.round(cvr * 10000) / 10000,
      revenueChange: hasPrior ? pct(effectiveRevenue, priorEffectiveRevenue) : 0,
      ordersChange:  hasPrior ? pct(effectiveOrders, priorEffectiveOrders) : 0,
      aspChange:     hasPrior ? pct(asp, priorAsp) : 0,
      sessionsChange: hasPrior ? pct(totalSessions, priorSessions) : 0,
      cvrChange:     hasPrior ? pct(cvr, priorCvr) : 0,
      products,
      stateRevenue,
      isEmpty,
      source: "snowflake-summary",
    });
  } catch (e) {
    console.error("[data/traffic] Error:", e);
    res.status(500).json({ error: "Failed to query traffic data", detail: String(e) });
  }
});

// ─── GET /api/data/spend ──────────────────────────────────────────────────────

router.get("/spend", authenticate, async (req, res) => {
  const { start: _startRaw, end: _endRaw } = req.query as Record<string, string>;
  let start: string, end: string;
  try { start = requireDate(_startRaw, "start"); end = requireDate(_endRaw, "end"); }
  catch (e) { res.status(400).json({ error: (e as Error).message }); return; }

  try {
    const rows = await querySnowflake(`
      SELECT summary_date, channel, spend, conversion_value
      FROM ${DB_NAME}.ADS.DAILY_AD_SUMMARY
      WHERE summary_date BETWEEN '${start}' AND '${end}'
      ORDER BY summary_date ASC
    `);

    // Group rows by channelId (mapped from DB channel name)
    const channelMap: Record<string, { totalSpend: number; totalConversionValue: number; dailySpend: Array<{ date: string; spend: number }> }> = {};
    for (const row of rows) {
      const ch   = String(row["CHANNEL"] ?? row["channel"] ?? "").toLowerCase();
      const meta = CHANNEL_META[ch];
      if (!meta) continue;
      const cid   = meta.channelId;
      const date  = toDateStr(row["SUMMARY_DATE"] ?? row["summary_date"]);
      const spend = Number(row["SPEND"] ?? row["spend"] ?? 0);
      const cv    = Number(row["CONVERSION_VALUE"] ?? row["conversion_value"] ?? 0);
      if (!channelMap[cid]) channelMap[cid] = { totalSpend: 0, totalConversionValue: 0, dailySpend: [] };
      channelMap[cid].totalSpend += spend;
      channelMap[cid].totalConversionValue += cv;
      if (date) channelMap[cid].dailySpend.push({ date, spend });
    }

    const channels = Object.entries(channelMap).map(([channelId, v]) => ({
      channelId,
      totalSpend:           Math.round(v.totalSpend * 100) / 100,
      totalConversionValue: Math.round(v.totalConversionValue * 100) / 100,
      dailySpend:           v.dailySpend,
    }));
    console.log("[data/spend] conversionValue by channel:", channels.map(c => `${c.channelId}=${c.totalConversionValue}`).join(", "));

    res.json({ channels, isEmpty: channels.length === 0 });
  } catch (e) {
    console.error("[data/spend] Error:", e);
    res.status(500).json({ error: "Failed to query spend data", detail: String(e) });
  }
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

// ─── GET /api/data/target/products ───────────────────────────────────────────

router.get("/target/products", authenticate, async (req, res) => {
  const { start: _startRaw, end: _endRaw } = req.query as Record<string, string>;
  let start: string, end: string;
  try { start = requireDate(_startRaw, "start"); end = requireDate(_endRaw, "end"); }
  catch (e) { res.status(400).json({ error: (e as Error).message }); return; }

  try {
    const rows = await querySnowflake(`
      SELECT
        item_description,
        barcode,
        tcin,
        SUM(revenue)     AS revenue,
        SUM(units_sold)  AS units_sold,
        SUM(store_count) AS store_count
      FROM ${DB_NAME}.RETAIL.TARGET_PRODUCT_DAILY
      WHERE summary_date BETWEEN '${start}' AND '${end}'
      GROUP BY item_description, barcode, tcin
      ORDER BY revenue DESC
      LIMIT 50
    `);

    const products = rows.map(row => ({
      itemDescription: String(row["ITEM_DESCRIPTION"] ?? row["item_description"] ?? ""),
      sku:             String(row["BARCODE"] ?? row["barcode"] ?? row["TCIN"] ?? row["tcin"] ?? ""),
      revenue:         Math.round(Number(row["REVENUE"]     ?? row["revenue"]     ?? 0) * 100) / 100,
      unitsSold:       Number(row["UNITS_SOLD"]  ?? row["units_sold"]  ?? 0),
      storeCount:      Number(row["STORE_COUNT"] ?? row["store_count"] ?? 0),
    }));

    res.json({ products, isEmpty: products.length === 0 });
  } catch (e) {
    console.error("[data/target/products] Error:", e);
    res.status(500).json({ error: "Failed to query Target product data", detail: String(e) });
  }
});

// ─── GET /api/data/target/fulfillment ────────────────────────────────────────

router.get("/target/fulfillment", authenticate, async (req, res) => {
  const { start: _startRaw, end: _endRaw } = req.query as Record<string, string>;
  let start: string, end: string;
  try { start = requireDate(_startRaw, "start"); end = requireDate(_endRaw, "end"); }
  catch (e) { res.status(400).json({ error: (e as Error).message }); return; }

  try {
    const rows = await querySnowflake(`
      SELECT
        fulfillment_type,
        SUM(revenue)    AS revenue,
        SUM(units_sold) AS units_sold
      FROM ${DB_NAME}.RETAIL.TARGET_STORE_DAILY
      WHERE summary_date BETWEEN '${start}' AND '${end}'
      GROUP BY fulfillment_type
    `);

    const fulfillment = rows.map(row => ({
      fulfillmentType: String(row["FULFILLMENT_TYPE"] ?? row["fulfillment_type"] ?? ""),
      revenue:         Math.round(Number(row["REVENUE"]    ?? row["revenue"]    ?? 0) * 100) / 100,
      unitsSold:       Number(row["UNITS_SOLD"] ?? row["units_sold"] ?? 0),
    }));

    res.json({ fulfillment, isEmpty: fulfillment.length === 0 });
  } catch (e) {
    console.error("[data/target/fulfillment] Error:", e);
    res.status(500).json({ error: "Failed to query Target fulfillment data", detail: String(e) });
  }
});

// ─── GET /api/data/target/geographic ─────────────────────────────────────────

router.get("/target/geographic", authenticate, async (req, res) => {
  const { start: _startRaw, end: _endRaw } = req.query as Record<string, string>;
  let start: string, end: string;
  try { start = requireDate(_startRaw, "start"); end = requireDate(_endRaw, "end"); }
  catch (e) { res.status(400).json({ error: (e as Error).message }); return; }

  try {
    const rows = await querySnowflake(`
      SELECT
        state,
        SUM(revenue)     AS revenue,
        SUM(units_sold)  AS units_sold,
        SUM(store_count) AS store_count
      FROM ${DB_NAME}.RETAIL.TARGET_STATE_DAILY
      WHERE summary_date BETWEEN '${start}' AND '${end}'
      GROUP BY state
      ORDER BY revenue DESC
    `);

    const locations = rows.map(row => ({
      stateCode:  String(row["STATE"]       ?? row["state"]       ?? "").toUpperCase(),
      revenue:    Math.round(Number(row["REVENUE"]     ?? row["revenue"]     ?? 0) * 100) / 100,
      unitsSold:  Number(row["UNITS_SOLD"]  ?? row["units_sold"]  ?? 0),
      storeCount: Number(row["STORE_COUNT"] ?? row["store_count"] ?? 0),
    }));

    res.json({ locations, isEmpty: locations.length === 0 });
  } catch (e) {
    console.error("[data/target/geographic] Error:", e);
    res.status(500).json({ error: "Failed to query Target geographic data", detail: String(e) });
  }
});

// ─── GET /api/data/target/locations ──────────────────────────────────────────

router.get("/target/locations", authenticate, async (req, res) => {
  const { state: stateParam, start: _startRaw, end: _endRaw } = req.query as Record<string, string>;
  let start: string, end: string;
  try { start = requireDate(_startRaw, "start"); end = requireDate(_endRaw, "end"); }
  catch (e) { res.status(400).json({ error: (e as Error).message }); return; }

  const safeState = stateParam ? stateParam.toUpperCase().replace(/[^A-Z]/g, "") : null;
  if (!safeState) { res.status(400).json({ error: "state parameter required" }); return; }

  try {
    const rows = await querySnowflake(`
      SELECT
        m.location_id, m.location_name, m.city, m.state, m.zip_code,
        COALESCE(SUM(d.revenue), 0)    AS revenue,
        COALESCE(SUM(d.units_sold), 0) AS units_sold
      FROM ${DB_NAME}.RETAIL.TARGET_LOCATION_MASTER m
      LEFT JOIN ${DB_NAME}.RETAIL.TARGET_STORE_DAILY d
        ON d.location_id = m.location_id
        AND d.summary_date BETWEEN '${start}' AND '${end}'
      WHERE m.state = '${safeState}'
      GROUP BY m.location_id, m.location_name, m.city, m.state, m.zip_code
      ORDER BY revenue DESC
    `);

    const locations = rows.map(row => ({
      locationId:   String(row["LOCATION_ID"]   ?? row["location_id"]   ?? ""),
      locationName: String(row["LOCATION_NAME"] ?? row["location_name"] ?? ""),
      city:         String(row["CITY"]          ?? row["city"]          ?? ""),
      stateCode:    String(row["STATE"]         ?? row["state"]         ?? "").toUpperCase(),
      zipCode:      String(row["ZIP_CODE"]      ?? row["zip_code"]      ?? ""),
      revenue:      Math.round(Number(row["REVENUE"]    ?? row["revenue"]    ?? 0) * 100) / 100,
      unitsSold:    Number(row["UNITS_SOLD"] ?? row["units_sold"] ?? 0),
    }));

    res.json({ locations, isEmpty: locations.length === 0 });
  } catch (e) {
    console.error("[data/target/locations] Error:", e);
    res.status(500).json({ error: "Failed to query Target location data", detail: String(e) });
  }
});

// ─── GET /api/data/walmart/summary ────────────────────────────────────────────

router.get("/walmart/summary", authenticate, async (req, res) => {
  const { start: _startRaw, end: _endRaw } = req.query as Record<string, string>;
  let start: string, end: string;
  try { start = requireDate(_startRaw, "start"); end = requireDate(_endRaw, "end"); }
  catch (e) { res.status(400).json({ error: (e as Error).message }); return; }

  try {
    const rows = await querySnowflake(`
      SELECT
        SUM(revenue)    AS walmart_revenue,
        SUM(units_sold) AS walmart_units,
        MAX(store_count) AS store_count,
        SUM(cogs)       AS walmart_cogs
      FROM ${DB_NAME}.RETAIL.WALMART_WEEKLY_SUMMARY
      WHERE week_date BETWEEN '${start}' AND '${end}'
    `);

    const agg = rows[0] ?? {};
    const revenue    = Math.round(Number(agg["WALMART_REVENUE"] ?? agg["walmart_revenue"] ?? 0) * 100) / 100;
    const unitsSold  = Number(agg["WALMART_UNITS"] ?? agg["walmart_units"] ?? 0);
    const storeCount = Number(agg["STORE_COUNT"]   ?? agg["store_count"]   ?? 0);
    const cogs       = Math.round(Number(agg["WALMART_COGS"] ?? agg["walmart_cogs"] ?? 0) * 100) / 100;

    res.json({ revenue, unitsSold, storeCount, cogs, isEmpty: revenue === 0 && unitsSold === 0 });
  } catch (e) {
    console.error("[data/walmart/summary] Error:", e);
    res.status(500).json({ error: "Failed to query Walmart summary data", detail: String(e) });
  }
});

// ─── GET /api/data/walmart/products ───────────────────────────────────────────

router.get("/walmart/products", authenticate, async (req, res) => {
  const { start: _startRaw, end: _endRaw } = req.query as Record<string, string>;
  let start: string, end: string;
  try { start = requireDate(_startRaw, "start"); end = requireDate(_endRaw, "end"); }
  catch (e) { res.status(400).json({ error: (e as Error).message }); return; }

  try {
    const rows = await querySnowflake(`
      SELECT
        product_description,
        walmart_upc,
        SUM(revenue)     AS revenue,
        SUM(units_sold)  AS units_sold,
        SUM(store_count) AS store_count
      FROM ${DB_NAME}.RETAIL.WALMART_PRODUCT_WEEKLY
      WHERE week_date BETWEEN '${start}' AND '${end}'
      GROUP BY product_description, walmart_upc
      ORDER BY revenue DESC
      LIMIT 50
    `);

    const products = rows.map(row => ({
      productDescription: String(row["PRODUCT_DESCRIPTION"] ?? row["product_description"] ?? ""),
      sku:                String(row["WALMART_UPC"] ?? row["walmart_upc"] ?? ""),
      revenue:            Math.round(Number(row["REVENUE"]     ?? row["revenue"]     ?? 0) * 100) / 100,
      unitsSold:          Number(row["UNITS_SOLD"]  ?? row["units_sold"]  ?? 0),
      storeCount:         Number(row["STORE_COUNT"] ?? row["store_count"] ?? 0),
    }));

    res.json({ products, isEmpty: products.length === 0 });
  } catch (e) {
    console.error("[data/walmart/products] Error:", e);
    res.status(500).json({ error: "Failed to query Walmart product data", detail: String(e) });
  }
});

// ─── GET /api/data/walmart/geographic ────────────────────────────────────────

router.get("/walmart/geographic", authenticate, async (req, res) => {
  const { start: _startRaw, end: _endRaw } = req.query as Record<string, string>;
  let start: string, end: string;
  try { start = requireDate(_startRaw, "start"); end = requireDate(_endRaw, "end"); }
  catch (e) { res.status(400).json({ error: (e as Error).message }); return; }

  try {
    const rows = await querySnowflake(`
      SELECT
        state,
        SUM(revenue)     AS revenue,
        SUM(units_sold)  AS units_sold,
        SUM(store_count) AS store_count
      FROM ${DB_NAME}.RETAIL.WALMART_STATE_DAILY
      WHERE week_date BETWEEN '${start}' AND '${end}'
      GROUP BY state
      ORDER BY revenue DESC
    `);

    const locations = rows.map(row => ({
      stateCode:  String(row["STATE"]       ?? row["state"]       ?? "").toUpperCase(),
      revenue:    Math.round(Number(row["REVENUE"]     ?? row["revenue"]     ?? 0) * 100) / 100,
      unitsSold:  Number(row["UNITS_SOLD"]  ?? row["units_sold"]  ?? 0),
      storeCount: Number(row["STORE_COUNT"] ?? row["store_count"] ?? 0),
    }));

    res.json({ locations, isEmpty: locations.length === 0 });
  } catch (e) {
    console.error("[data/walmart/geographic] Error:", e);
    res.status(500).json({ error: "Failed to query Walmart geographic data", detail: String(e) });
  }
});

// ─── GET /api/data/walmart/stores ────────────────────────────────────────────

router.get("/walmart/stores", authenticate, async (req, res) => {
  const { start: _startRaw, end: _endRaw, state: stateParam } = req.query as Record<string, string>;
  let start: string, end: string;
  try { start = requireDate(_startRaw, "start"); end = requireDate(_endRaw, "end"); }
  catch (e) { res.status(400).json({ error: (e as Error).message }); return; }

  const safeState = stateParam ? stateParam.toUpperCase().replace(/[^A-Z]/g, "") : null;
  const stateWhere = safeState ? `AND loc.state = '${safeState}'` : "";

  try {
    const rows = await querySnowflake(`
      SELECT
        loc.store_number,
        loc.store_name,
        loc.street_address,
        loc.city,
        loc.state,
        loc.zip_code,
        SUM(sd.revenue)    AS revenue,
        SUM(sd.units_sold) AS units_sold
      FROM MONARCH_RAW.RETAIL.WALMART_LOCATION_MASTER loc
      JOIN MONARCH_RAW.RETAIL.WALMART_STATE_DAILY sd ON sd.state = loc.state
      WHERE sd.week_date BETWEEN '${start}' AND '${end}'
      ${stateWhere}
      GROUP BY loc.store_number, loc.store_name, loc.street_address, loc.city, loc.state, loc.zip_code
      ORDER BY revenue DESC
    `);

    const stores = rows.map(row => ({
      storeNumber:   String(row["STORE_NUMBER"]   ?? row["store_number"]   ?? ""),
      storeName:     String(row["STORE_NAME"]     ?? row["store_name"]     ?? ""),
      streetAddress: String(row["STREET_ADDRESS"] ?? row["street_address"] ?? ""),
      city:          String(row["CITY"]           ?? row["city"]           ?? ""),
      stateCode:     String(row["STATE"]          ?? row["state"]          ?? "").toUpperCase(),
      zipCode:       String(row["ZIP_CODE"]       ?? row["zip_code"]       ?? ""),
      revenue:       Math.round(Number(row["REVENUE"]    ?? row["revenue"]    ?? 0) * 100) / 100,
      unitsSold:     Number(row["UNITS_SOLD"] ?? row["units_sold"] ?? 0),
    }));

    res.json({ stores, isEmpty: stores.length === 0 });
  } catch (e) {
    console.error("[data/walmart/stores] Error:", e);
    res.status(500).json({ error: "Failed to query Walmart store data", detail: String(e) });
  }
});

// ─── GET /api/data/netsuite/sales ────────────────────────────────────────────

router.get("/netsuite/sales", authenticate, async (req, res) => {
  const { start: _startRaw, end: _endRaw, store: storeRaw } = req.query as Record<string, string>;
  let start: string, end: string;
  try { start = requireDate(_startRaw, "start"); end = requireDate(_endRaw, "end"); }
  catch (e) { res.status(400).json({ error: (e as Error).message }); return; }

  const storeFilter = storeRaw ? storeRaw.trim() : null;
  const storeWhere  = storeFilter ? `AND STORE_NAME = '${storeFilter.replace(/'/g, "''")}'` : "";

  try {
    const [totalsRows, byStoreRows, productRows, dailyRows] = await Promise.all([
      querySnowflake(`
        SELECT
          SUM(REVENUE) AS total_revenue,
          SUM(UNITS)   AS total_units
        FROM ${DB_NAME}.FINANCE.NETSUITE_SALES_BY_PRODUCT
        WHERE TRANDATE BETWEEN '${start}' AND '${end}'
        ${storeWhere}
      `),
      querySnowflake(`
        SELECT
          STORE_NAME,
          STORE_TYPE,
          SUM(REVENUE)    AS revenue,
          SUM(UNITS)      AS units,
          MAX(TRANDATE)   AS last_date,
          COUNT(DISTINCT TRANDATE) AS day_count
        FROM ${DB_NAME}.FINANCE.NETSUITE_SALES_BY_PRODUCT
        WHERE TRANDATE BETWEEN '${start}' AND '${end}'
        ${storeWhere}
        GROUP BY STORE_NAME, STORE_TYPE
        ORDER BY revenue DESC
      `),
      querySnowflake(`
        SELECT
          SKU,
          PRODUCT_NAME,
          UPCCODE,
          STORE_NAME,
          SUM(REVENUE)   AS revenue,
          SUM(UNITS)     AS units
        FROM ${DB_NAME}.FINANCE.NETSUITE_SALES_BY_PRODUCT
        WHERE TRANDATE BETWEEN '${start}' AND '${end}'
        ${storeWhere}
        GROUP BY SKU, PRODUCT_NAME, UPCCODE, STORE_NAME
        ORDER BY revenue DESC
        LIMIT 50
      `),
      querySnowflake(`
        SELECT
          TRANDATE,
          SUM(REVENUE) AS daily_revenue,
          SUM(UNITS)   AS daily_units
        FROM ${DB_NAME}.FINANCE.NETSUITE_SALES_BY_PRODUCT
        WHERE TRANDATE BETWEEN '${start}' AND '${end}'
        ${storeWhere}
        GROUP BY TRANDATE
        ORDER BY TRANDATE ASC
      `),
    ]);

    const totalsAgg    = totalsRows[0] ?? {};
    const totalRevenue = Math.round(Number(totalsAgg["TOTAL_REVENUE"] ?? totalsAgg["total_revenue"] ?? 0) * 100) / 100;
    const totalUnits   = Number(totalsAgg["TOTAL_UNITS"] ?? totalsAgg["total_units"] ?? 0);

    const today = new Date();
    const byStore = byStoreRows.map(row => {
      const lastDateVal = row["LAST_DATE"] ?? row["last_date"];
      const lastDate    = lastDateVal instanceof Date ? lastDateVal.toISOString().slice(0, 10) : String(lastDateVal ?? "").slice(0, 10);
      const daysSinceLast = lastDate
        ? Math.floor((today.getTime() - new Date(lastDate).getTime()) / 86_400_000)
        : 999;
      const status = daysSinceLast <= 7 ? "synced" : daysSinceLast <= 30 ? "delayed" : "pending";
      return {
        storeName:  String(row["STORE_NAME"]  ?? row["store_name"]  ?? ""),
        storeType:  String(row["STORE_TYPE"]  ?? row["store_type"]  ?? ""),
        revenue:    Math.round(Number(row["REVENUE"]   ?? row["revenue"]   ?? 0) * 100) / 100,
        units:      Number(row["UNITS"]     ?? row["units"]     ?? 0),
        lastDate,
        status,
      };
    });

    const products = productRows.map(row => ({
      sku:         String(row["SKU"]          ?? row["sku"]          ?? ""),
      productName: String(row["PRODUCT_NAME"] ?? row["product_name"] ?? ""),
      upc:         String(row["UPCCODE"]      ?? row["upccode"]      ?? ""),
      storeName:   String(row["STORE_NAME"]   ?? row["store_name"]   ?? ""),
      revenue:     Math.round(Number(row["REVENUE"] ?? row["revenue"] ?? 0) * 100) / 100,
      units:       Number(row["UNITS"] ?? row["units"] ?? 0),
    }));

    const lastSync = byStore.length > 0
      ? byStore.map(s => s.lastDate).filter(Boolean).sort().at(-1) ?? ""
      : "";

    const dailySeries = dailyRows.map(row => {
      const dateVal = row["TRANDATE"] ?? row["trandate"];
      const date    = dateVal instanceof Date ? dateVal.toISOString().slice(0, 10) : String(dateVal ?? "").slice(0, 10);
      return {
        date,
        revenue: Math.round(Number(row["DAILY_REVENUE"] ?? row["daily_revenue"] ?? 0) * 100) / 100,
        units:   Number(row["DAILY_UNITS"] ?? row["daily_units"] ?? 0),
      };
    });

    res.json({
      totals:   { revenue: totalRevenue, units: totalUnits },
      byStore,
      products,
      dailySeries,
      lastSync,
      isEmpty:  totalRevenue === 0 && totalUnits === 0,
      source:   "snowflake-netsuite",
    });
  } catch (e) {
    console.error("[data/netsuite/sales] Error:", e);
    res.status(500).json({ error: "Failed to query NetSuite sales data", detail: String(e) });
  }
});

// ─── GET /api/data/netsuite/sync-status ──────────────────────────────────────

router.get("/netsuite/sync-status", authenticate, async (req, res) => {
  try {
    const byStoreRows = await querySnowflake(`
      SELECT
        STORE_NAME,
        STORE_TYPE,
        SUM(REVENUE)  AS revenue,
        SUM(UNITS)    AS units,
        MAX(TRANDATE) AS last_date
      FROM ${DB_NAME}.FINANCE.NETSUITE_SALES_BY_PRODUCT
      GROUP BY STORE_NAME, STORE_TYPE
      ORDER BY revenue DESC
    `);

    const today = new Date();
    const byStore = byStoreRows.map(row => {
      const lastDateVal   = row["LAST_DATE"] ?? row["last_date"];
      const lastDate      = lastDateVal instanceof Date ? lastDateVal.toISOString().slice(0, 10) : String(lastDateVal ?? "").slice(0, 10);
      const daysSinceLast = lastDate ? Math.floor((today.getTime() - new Date(lastDate).getTime()) / 86_400_000) : 999;
      const status        = daysSinceLast <= 7 ? "synced" : daysSinceLast <= 30 ? "delayed" : "pending";
      return {
        storeName: String(row["STORE_NAME"] ?? row["store_name"] ?? ""),
        storeType: String(row["STORE_TYPE"] ?? row["store_type"] ?? ""),
        revenue:   Math.round(Number(row["REVENUE"] ?? row["revenue"] ?? 0) * 100) / 100,
        units:     Number(row["UNITS"] ?? row["units"] ?? 0),
        lastDate,
        status,
      };
    });

    const lastSync = byStore.length > 0
      ? byStore.map(s => s.lastDate).filter(Boolean).sort().at(-1) ?? ""
      : "";

    res.json({
      totals:      { revenue: 0, units: 0 },
      byStore,
      products:    [],
      dailySeries: [],
      lastSync,
      isEmpty:     byStore.length === 0,
      source:      "snowflake-netsuite-sync",
    });
  } catch (e) {
    console.error("[data/netsuite/sync-status] Error:", e);
    res.status(500).json({ error: "Failed to query NetSuite sync status", detail: String(e) });
  }
});

export default router;
