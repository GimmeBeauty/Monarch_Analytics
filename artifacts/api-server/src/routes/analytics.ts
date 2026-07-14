import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import { querySnowflake } from "../lib/snowflake.js";

const router = Router();
router.use(authenticate);

const DB_NAME = process.env.SNOWFLAKE_DATABASE ?? "MONARCH_RAW";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ─── Store → Channel mapping (mirrors data.ts CHANNEL_META) ──────────────────

/** Which channels are active given a set of storeIds.
 *  Empty storeIds → all channels (no filter). */
const CHANNEL_STORE_MAP: Record<string, string[]> = {
  meta_ads:       ["shopify"],
  google_ads:     ["shopify"],
  pinterest_ads:  ["shopify"],
  criteo_ads:     ["ulta"],
  roundel_target: ["target"],
  amazon_ads:     ["amazon"],
  ctv_programmatic: ["target", "amazon"],
  display_ads:      ["target", "amazon"],
};

const CHANNEL_LABELS: Record<string, string> = {
  meta_ads:       "Meta Ads",
  google_ads:     "Google Ads",
  pinterest_ads:  "Pinterest Ads",
  criteo_ads:     "Criteo (Ulta)",
  roundel_target: "Roundel (Target)",
  amazon_ads:     "Amazon Ads",
  ctv_programmatic: "CTV / Programmatic",
  display_ads:      "Display",
};

function activeChannels(storeIds: string[]): string[] {
  if (!storeIds.length) return Object.keys(CHANNEL_STORE_MAP);
  return Object.entries(CHANNEL_STORE_MAP)
    .filter(([, stores]) => stores.some(s => storeIds.includes(s)))
    .map(([ch]) => ch);
}

function channelFilter(storeIds: string[]): string {
  const channels = activeChannels(storeIds);
  return channels.map(c => `'${c}'`).join(", ");
}

// ─── Query helpers ────────────────────────────────────────────────────────────

function defaultDateRange(): { start: string; end: string } {
  const end   = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 30);
  return {
    start: start.toISOString().slice(0, 10),
    end:   end.toISOString().slice(0, 10),
  };
}

function parseParams(query: Record<string, string>): {
  start: string; end: string; storeIds: string[];
} {
  const defaults = defaultDateRange();
  return {
    start:    DATE_RE.test(query.startDate ?? "") ? query.startDate : defaults.start,
    end:      DATE_RE.test(query.endDate   ?? "") ? query.endDate   : defaults.end,
    storeIds: query.storeIds
      ? query.storeIds.split(",").map(s => s.trim().toLowerCase()).filter(Boolean)
      : [],
  };
}

function toDateStr(val: unknown): string {
  if (!val) return "";
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

function fmt$(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v).toLocaleString()}`;
}

function fmtNum(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return Math.round(v).toLocaleString();
}

// ─── GET /api/analytics/overview ─────────────────────────────────────────────

/** Build a UNION of all selected store revenue branches for the given date range.
 *  Each branch selects (summary_date, revenue, spend, orders) so the outer query
 *  can SUM across all stores without branching. */
function buildStoreCte(
  dbName: string,
  storeIds: string[],
  start: string,
  end: string,
): string {
  const all = !storeIds.length;
  const branches: string[] = [];

  if (all || storeIds.includes("shopify")) {
    branches.push(`
      SELECT summary_date,
             COALESCE(total_revenue, 0) AS revenue,
             COALESCE(ad_spend,      0) AS spend,
             COALESCE(order_count,   0) AS orders
      FROM ${dbName}.COMMERCE.MONARCH_DAILY_SUMMARY
      WHERE summary_date BETWEEN '${start}' AND '${end}'`);
  }
  if (all || storeIds.includes("target")) {
    branches.push(`
      SELECT summary_date,
             COALESCE(sale_amount,   0) AS revenue,
             0                         AS spend,
             COALESCE(sale_quantity, 0) AS orders
      FROM ${dbName}.RETAIL.TARGET_DAILY_SUMMARY
      WHERE summary_date BETWEEN '${start}' AND '${end}'`);
  }
  if (all || storeIds.includes("walmart")) {
    branches.push(`
      SELECT week_date                AS summary_date,
             COALESCE(revenue,       0) AS revenue,
             0                         AS spend,
             0                         AS orders
      FROM ${dbName}.RETAIL.WALMART_WEEKLY_SUMMARY
      WHERE week_date BETWEEN '${start}' AND '${end}'`);
  }
  if (all || storeIds.includes("amazon")) {
    branches.push(`
      SELECT summary_date,
             COALESCE(ordered_product_sales, 0) AS revenue,
             0                                  AS spend,
             COALESCE(units_ordered,         0) AS orders
      FROM ${dbName}.RETAIL.AMAZON_DAILY_SUMMARY
      WHERE summary_date BETWEEN '${start}' AND '${end}'`);
  }

  if (!branches.length) return "";
  return branches.join("\n      UNION ALL\n");
}

router.get("/overview", async (req, res) => {
  const { start, end, storeIds } = parseParams(req.query as Record<string, string>);
  const chFilter = channelFilter(storeIds);
  const storeCte = buildStoreCte(DB_NAME, storeIds, start, end);

  try {
    const [summaryRows, revenueRows, adRows] = await Promise.all([
      // Aggregate revenue + spend + orders across all selected stores
      storeCte
        ? querySnowflake(`
            WITH store_data AS (${storeCte})
            SELECT
              COALESCE(SUM(revenue), 0) AS revenue,
              COALESCE(SUM(spend),   0) AS spend,
              COALESCE(SUM(orders),  0) AS orders
            FROM store_data
          `)
        : Promise.resolve([]),

      // Daily revenue time series — UNION across selected stores then group by date
      storeCte
        ? querySnowflake(`
            WITH store_data AS (${storeCte})
            SELECT summary_date, SUM(revenue) AS revenue
            FROM store_data
            GROUP BY summary_date
            ORDER BY summary_date ASC
          `)
        : Promise.resolve([]),

      // Channel ad spend (store-scoped)
      chFilter
        ? querySnowflake(`
            SELECT channel,
                   COALESCE(SUM(spend),            0) AS spend,
                   COALESCE(SUM(conversion_value), 0) AS revenue
            FROM ${DB_NAME}.ADS.DAILY_AD_SUMMARY
            WHERE summary_date BETWEEN '${start}' AND '${end}'
              AND channel IN (${chFilter})
            GROUP BY channel
            ORDER BY spend DESC
          `)
        : Promise.resolve([]),
    ]);

    const agg     = summaryRows[0] ?? {};
    const revenue = Number(agg["REVENUE"] ?? agg["revenue"] ?? 0);
    const spend   = Number(agg["SPEND"]   ?? agg["spend"]   ?? 0);
    const orders  = Number(agg["ORDERS"]  ?? agg["orders"]  ?? 0);
    const roas    = spend  > 0 ? revenue / spend  : 0;
    const aov     = orders > 0 ? revenue / orders : 0;

    const revenueTimeSeries = (revenueRows as Record<string, unknown>[]).map(row => ({
      date:  toDateStr(row["SUMMARY_DATE"] ?? row["summary_date"]),
      value: Number(row["REVENUE"] ?? row["revenue"] ?? 0),
    }));

    const totalAdRevenue = (adRows as Record<string, unknown>[])
      .reduce((s, r) => s + Number(r["REVENUE"] ?? r["revenue"] ?? 0), 0);

    const topChannels = (adRows as Record<string, unknown>[])
      .map(row => {
        const ch  = String(row["CHANNEL"] ?? row["channel"] ?? "").toLowerCase();
        const rev = Number(row["REVENUE"] ?? row["revenue"] ?? 0);
        return {
          channel: CHANNEL_LABELS[ch] ?? ch,
          revenue: Math.round(rev * 100) / 100,
          share:   totalAdRevenue > 0 ? Math.round(rev / totalAdRevenue * 1000) / 10 : 0,
        };
      })
      .filter(c => c.revenue > 0);

    res.json({
      metrics: [
        { label: "Total Revenue",    value: fmt$(revenue),          change: 0, changeLabel: "selected period", trend: "up"      },
        { label: "Total Ad Spend",   value: fmt$(spend),            change: 0, changeLabel: "selected period", trend: "neutral" },
        { label: "Blended ROAS",     value: `${roas.toFixed(2)}x`, change: 0, changeLabel: "selected period", trend: "up"      },
        { label: "Total Orders",     value: fmtNum(orders),         change: 0, changeLabel: "selected period", trend: "neutral" },
        { label: "Avg. Order Value", value: fmt$(aov),              change: 0, changeLabel: "selected period", trend: "neutral" },
      ],
      revenueTimeSeries,
      conversionTimeSeries: [],
      topChannels,
    });
  } catch (e) {
    req.log.error({ err: e }, "Failed to query overview data");
    res.status(500).json({ error: "Failed to query overview data" });
  }
});

// ─── GET /api/analytics/traffic ───────────────────────────────────────────────

router.get("/traffic", async (req, res) => {
  const { start, end, storeIds } = parseParams(req.query as Record<string, string>);
  const isShopify = !storeIds.length || storeIds.includes("shopify");

  try {
    const [aggRows, dailyRows] = await Promise.all([
      isShopify
        ? querySnowflake(`
            SELECT
              COALESCE(SUM(sessions),  0) AS sessions,
              COALESCE(SUM(pageviews), 0) AS pageviews
            FROM ${DB_NAME}.COMMERCE.GA4_DAILY_SUMMARY
            WHERE summary_date BETWEEN '${start}' AND '${end}'
          `)
        : Promise.resolve([]),
      isShopify
        ? querySnowflake(`
            SELECT summary_date,
                   COALESCE(sessions,  0) AS sessions,
                   COALESCE(pageviews, 0) AS pageviews
            FROM ${DB_NAME}.COMMERCE.GA4_DAILY_SUMMARY
            WHERE summary_date BETWEEN '${start}' AND '${end}'
            ORDER BY summary_date ASC
          `)
        : Promise.resolve([]),
    ]);

    const agg       = (aggRows as Record<string, unknown>[])[0] ?? {};
    const sessions  = Number(agg["SESSIONS"]  ?? agg["sessions"]  ?? 0);
    const pageviews = Number(agg["PAGEVIEWS"] ?? agg["pageviews"] ?? 0);

    const sessionTimeSeries = (dailyRows as Record<string, unknown>[]).map(r => ({
      date:  toDateStr(r["SUMMARY_DATE"] ?? r["summary_date"]),
      value: Number(r["SESSIONS"]  ?? r["sessions"]  ?? 0),
    }));
    const pageviewTimeSeries = (dailyRows as Record<string, unknown>[]).map(r => ({
      date:  toDateStr(r["SUMMARY_DATE"] ?? r["summary_date"]),
      value: Number(r["PAGEVIEWS"] ?? r["pageviews"] ?? 0),
    }));

    res.json({
      metrics: [
        { label: "Total Sessions",  value: fmtNum(sessions),  change: 0, changeLabel: "selected period", trend: "neutral" },
        { label: "Total Pageviews", value: fmtNum(pageviews), change: 0, changeLabel: "selected period", trend: "neutral" },
      ],
      sessionTimeSeries,
      pageviewTimeSeries,
      sourceBreakdown: [],
      topPages: [],
    });
  } catch (e) {
    req.log.error({ err: e }, "Failed to query traffic data");
    res.status(500).json({ error: "Failed to query traffic data" });
  }
});

// ─── GET /api/analytics/spend ─────────────────────────────────────────────────

router.get("/spend", async (req, res) => {
  const { start, end, storeIds } = parseParams(req.query as Record<string, string>);
  const chFilter = channelFilter(storeIds);

  try {
    const [aggRows, dailyRows] = await Promise.all([
      chFilter
        ? querySnowflake(`
            SELECT channel,
                   COALESCE(SUM(spend),            0) AS spend,
                   COALESCE(SUM(conversion_value), 0) AS revenue,
                   COALESCE(SUM(conversions),      0) AS conversions
            FROM ${DB_NAME}.ADS.DAILY_AD_SUMMARY
            WHERE summary_date BETWEEN '${start}' AND '${end}'
              AND channel IN (${chFilter})
            GROUP BY channel
            ORDER BY spend DESC
          `)
        : Promise.resolve([]),
      chFilter
        ? querySnowflake(`
            SELECT summary_date, COALESCE(SUM(spend), 0) AS spend
            FROM ${DB_NAME}.ADS.DAILY_AD_SUMMARY
            WHERE summary_date BETWEEN '${start}' AND '${end}'
              AND channel IN (${chFilter})
            GROUP BY summary_date
            ORDER BY summary_date ASC
          `)
        : Promise.resolve([]),
    ]);

    const totalSpend   = (aggRows as Record<string, unknown>[]).reduce((s, r) => s + Number(r["SPEND"]   ?? r["spend"]   ?? 0), 0);
    const totalRevenue = (aggRows as Record<string, unknown>[]).reduce((s, r) => s + Number(r["REVENUE"] ?? r["revenue"] ?? 0), 0);
    const overallRoas  = totalSpend > 0 ? totalRevenue / totalSpend : 0;

    const spendByChannel = (aggRows as Record<string, unknown>[])
      .map(row => {
        const ch          = String(row["CHANNEL"]  ?? row["channel"]  ?? "").toLowerCase();
        const spend       = Number(row["SPEND"]    ?? row["spend"]    ?? 0);
        const revenue     = Number(row["REVENUE"]  ?? row["revenue"]  ?? 0);
        const conversions = Number(row["CONVERSIONS"] ?? row["conversions"] ?? 0);
        const roas = spend > 0 ? revenue / spend    : 0;
        const cpa  = conversions > 0 ? spend / conversions : 0;
        return {
          channel:     CHANNEL_LABELS[ch] ?? ch,
          spend:       Math.round(spend * 100) / 100,
          roas:        Math.round(roas  * 100) / 100,
          cpa:         Math.round(cpa   * 100) / 100,
          recommended: Math.round(spend * 100) / 100,
        };
      })
      .filter(c => c.spend > 0);

    const spendTimeSeries = (dailyRows as Record<string, unknown>[]).map(r => ({
      date:  toDateStr(r["SUMMARY_DATE"] ?? r["summary_date"]),
      value: Math.round(Number(r["SPEND"] ?? r["spend"] ?? 0) * 100) / 100,
    }));

    res.json({
      metrics: [
        { label: "Total Spend",    value: fmt$(totalSpend),              change: 0, changeLabel: "selected period", trend: "neutral" },
        { label: "Overall ROAS",   value: `${overallRoas.toFixed(2)}x`, change: 0, changeLabel: "selected period", trend: "up"      },
        { label: "Total Revenue",  value: fmt$(totalRevenue),            change: 0, changeLabel: "selected period", trend: "up"      },
      ],
      spendByChannel,
      spendTimeSeries,
    });
  } catch (e) {
    req.log.error({ err: e }, "Failed to query spend data");
    res.status(500).json({ error: "Failed to query spend data" });
  }
});

// ─── GET /api/analytics/attribution ──────────────────────────────────────────

router.get("/attribution", async (req, res) => {
  const { start, end, storeIds } = parseParams(req.query as Record<string, string>);
  const chFilter = channelFilter(storeIds);

  try {
    const rows = chFilter
      ? await querySnowflake(`
          SELECT channel,
                 COALESCE(SUM(conversions),      0) AS conversions,
                 COALESCE(SUM(conversion_value), 0) AS revenue
          FROM ${DB_NAME}.ADS.DAILY_AD_SUMMARY
          WHERE summary_date BETWEEN '${start}' AND '${end}'
            AND channel IN (${chFilter})
          GROUP BY channel
          ORDER BY revenue DESC
        `)
      : [];

    const totalConversions = rows.reduce((s, r) => s + Number(r["CONVERSIONS"] ?? r["conversions"] ?? 0), 0);
    const totalRevenue     = rows.reduce((s, r) => s + Number(r["REVENUE"]     ?? r["revenue"]     ?? 0), 0);

    const touchpointBreakdown = rows
      .map(row => {
        const ch          = String(row["CHANNEL"]  ?? row["channel"]  ?? "").toLowerCase();
        const conversions = Number(row["CONVERSIONS"] ?? row["conversions"] ?? 0);
        const revenue     = Number(row["REVENUE"]     ?? row["revenue"]     ?? 0);
        return {
          touchpoint:  CHANNEL_LABELS[ch] ?? ch,
          conversions: Math.round(conversions),
          revenue:     Math.round(revenue * 100) / 100,
          model:       "Last Click",
        };
      })
      .filter(t => t.conversions > 0);

    res.json({
      metrics: [
        { label: "Total Conversions",  value: fmtNum(totalConversions), change: 0, changeLabel: "selected period", trend: "neutral" },
        { label: "Attributed Revenue", value: fmt$(totalRevenue),        change: 0, changeLabel: "selected period", trend: "up"      },
      ],
      touchpointBreakdown,
      conversionPaths: [],
    });
  } catch (e) {
    req.log.error({ err: e }, "Failed to query attribution data");
    res.status(500).json({ error: "Failed to query attribution data" });
  }
});

// ─── GET /api/analytics/performance ──────────────────────────────────────────

router.get("/performance", async (req, res) => {
  const { start, end, storeIds } = parseParams(req.query as Record<string, string>);
  const chFilter = channelFilter(storeIds);

  try {
    const [aggRows, dailyRows] = await Promise.all([
      chFilter
        ? querySnowflake(`
            SELECT channel,
                   COALESCE(SUM(impressions), 0) AS impressions,
                   COALESCE(SUM(clicks),      0) AS clicks,
                   COALESCE(SUM(conversions), 0) AS conversions,
                   COALESCE(SUM(spend),       0) AS spend
            FROM ${DB_NAME}.ADS.DAILY_AD_SUMMARY
            WHERE summary_date BETWEEN '${start}' AND '${end}'
              AND channel IN (${chFilter})
            GROUP BY channel
            ORDER BY impressions DESC
          `)
        : Promise.resolve([]),
      chFilter
        ? querySnowflake(`
            SELECT summary_date,
                   COALESCE(SUM(clicks),      0) AS clicks,
                   COALESCE(SUM(impressions), 0) AS impressions
            FROM ${DB_NAME}.ADS.DAILY_AD_SUMMARY
            WHERE summary_date BETWEEN '${start}' AND '${end}'
              AND channel IN (${chFilter})
            GROUP BY summary_date
            ORDER BY summary_date ASC
          `)
        : Promise.resolve([]),
    ]);

    const totalImpressions = (aggRows as Record<string, unknown>[]).reduce((s, r) => s + Number(r["IMPRESSIONS"] ?? r["impressions"] ?? 0), 0);
    const totalClicks      = (aggRows as Record<string, unknown>[]).reduce((s, r) => s + Number(r["CLICKS"]      ?? r["clicks"]      ?? 0), 0);
    const totalConversions = (aggRows as Record<string, unknown>[]).reduce((s, r) => s + Number(r["CONVERSIONS"] ?? r["conversions"] ?? 0), 0);
    const totalSpend       = (aggRows as Record<string, unknown>[]).reduce((s, r) => s + Number(r["SPEND"]       ?? r["spend"]       ?? 0), 0);
    const avgCtr           = totalImpressions > 0 ? totalClicks / totalImpressions * 100 : 0;
    const avgCpc           = totalClicks      > 0 ? totalSpend  / totalClicks             : 0;

    const channelPerformance = (aggRows as Record<string, unknown>[])
      .map(row => {
        const ch   = String(row["CHANNEL"]     ?? row["channel"]     ?? "").toLowerCase();
        const imp  = Number(row["IMPRESSIONS"] ?? row["impressions"] ?? 0);
        const clk  = Number(row["CLICKS"]      ?? row["clicks"]      ?? 0);
        const conv = Number(row["CONVERSIONS"] ?? row["conversions"] ?? 0);
        const spd  = Number(row["SPEND"]       ?? row["spend"]       ?? 0);
        return {
          channel:     CHANNEL_LABELS[ch] ?? ch,
          impressions: Math.round(imp),
          clicks:      Math.round(clk),
          ctr:         imp > 0 ? Math.round(clk / imp * 10000) / 100 : 0,
          conversions: Math.round(conv),
          cpc:         clk > 0 ? Math.round(spd / clk * 100)   / 100 : 0,
        };
      })
      .filter(c => c.impressions > 0);

    const kpiTimeSeries = (dailyRows as Record<string, unknown>[]).map(r => {
      const imp = Number(r["IMPRESSIONS"] ?? r["impressions"] ?? 0);
      const clk = Number(r["CLICKS"]     ?? r["clicks"]      ?? 0);
      return {
        date:  toDateStr(r["SUMMARY_DATE"] ?? r["summary_date"]),
        value: imp > 0 ? Math.round(clk / imp * 10000) / 100 : 0,
      };
    });

    res.json({
      metrics: [
        { label: "Total Impressions", value: fmtNum(totalImpressions), change: 0, changeLabel: "selected period", trend: "neutral" },
        { label: "Total Clicks",      value: fmtNum(totalClicks),       change: 0, changeLabel: "selected period", trend: "neutral" },
        { label: "Avg. CTR",          value: `${avgCtr.toFixed(2)}%`,   change: 0, changeLabel: "selected period", trend: "neutral" },
        { label: "Avg. CPC",          value: fmt$(avgCpc),              change: 0, changeLabel: "selected period", trend: "neutral" },
        { label: "Total Conversions", value: fmtNum(totalConversions),  change: 0, changeLabel: "selected period", trend: "neutral" },
      ],
      kpiTimeSeries,
      channelPerformance,
    });
  } catch (e) {
    req.log.error({ err: e }, "Failed to query performance data");
    res.status(500).json({ error: "Failed to query performance data" });
  }
});

// ─── GET /api/analytics/forecast ─────────────────────────────────────────────

router.get("/forecast", async (req, res) => {
  const today = new Date();
  const year  = today.getFullYear();
  const { storeIds } = parseParams(req.query as Record<string, string>);
  const isShopify  = !storeIds.length || storeIds.includes("shopify");
  const isTarget   = !storeIds.length || storeIds.includes("target");
  const isWalmart  = !storeIds.length || storeIds.includes("walmart");

  try {
    const [historicalRows, spendRows] = await Promise.all([
      // Revenue time series: sum across selected stores
      querySnowflake(`
        WITH daily AS (
          ${isShopify ? `
          SELECT summary_date, COALESCE(total_revenue, 0) AS revenue
          FROM ${DB_NAME}.COMMERCE.MONARCH_DAILY_SUMMARY
          WHERE YEAR(summary_date) = ${year}` : "SELECT NULL AS summary_date, 0 AS revenue WHERE 1=0"}
          ${isTarget ? `
          UNION ALL
          SELECT summary_date, COALESCE(sale_amount, 0)
          FROM ${DB_NAME}.RETAIL.TARGET_DAILY_SUMMARY
          WHERE YEAR(summary_date) = ${year}` : ""}
          ${isWalmart ? `
          UNION ALL
          SELECT week_date, COALESCE(revenue, 0)
          FROM ${DB_NAME}.RETAIL.WALMART_WEEKLY_SUMMARY
          WHERE YEAR(week_date) = ${year}` : ""}
        )
        SELECT summary_date, SUM(revenue) AS revenue
        FROM daily
        GROUP BY summary_date
        ORDER BY summary_date ASC
      `),
      querySnowflake(`
        SELECT COALESCE(SUM(ad_spend), 0) AS ytd_spend
        FROM ${DB_NAME}.COMMERCE.MONARCH_DAILY_SUMMARY
        WHERE YEAR(summary_date) = ${year}
      `),
    ]);

    const ytdRevenue = (historicalRows as Record<string, unknown>[])
      .reduce((s, r) => s + Number(r["REVENUE"] ?? r["revenue"] ?? 0), 0);
    const ytdSpend = Number(
      ((spendRows as Record<string, unknown>[])[0] ?? {})["YTD_SPEND"] ??
      ((spendRows as Record<string, unknown>[])[0] ?? {})["ytd_spend"] ?? 0,
    );

    const dayOfYear  = Math.ceil((today.getTime() - new Date(year, 0, 1).getTime()) / 86_400_000);
    const daysInYear = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;
    const dailyAvg   = dayOfYear > 0 ? ytdRevenue / dayOfYear : 0;

    const projectedRevenue = Math.round(dailyAvg * daysInYear);
    const projectedSpend   = dayOfYear > 0 ? Math.round((ytdSpend / dayOfYear) * daysInYear) : 0;
    const projectedRoas    = projectedSpend > 0 ? Math.round(projectedRevenue / projectedSpend * 100) / 100 : 0;

    const forecastTimeSeries: Array<{ date: string; projected: number; lower: number; upper: number; actual?: number }> = [];

    for (const row of historicalRows as Record<string, unknown>[]) {
      const date    = toDateStr(row["SUMMARY_DATE"] ?? row["summary_date"]);
      const revenue = Number(row["REVENUE"] ?? row["revenue"] ?? 0);
      if (!date) continue;
      forecastTimeSeries.push({
        date,
        projected: Math.round(dailyAvg),
        lower:     Math.round(dailyAvg * 0.80),
        upper:     Math.round(dailyAvg * 1.20),
        actual:    Math.round(revenue),
      });
    }

    for (let i = 1; i <= 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      forecastTimeSeries.push({
        date:      d.toISOString().slice(0, 10),
        projected: Math.round(dailyAvg),
        lower:     Math.round(dailyAvg * 0.80),
        upper:     Math.round(dailyAvg * 1.20),
      });
    }

    res.json({
      projectedRevenue,
      projectedSpend,
      projectedROAS:  projectedRoas,
      confidence:     dayOfYear > 30 ? 85 : 70,
      forecastTimeSeries,
      scenarioComparison: [
        { scenario: "Conservative", revenue: Math.round(dailyAvg * daysInYear * 0.90), spend: Math.round(projectedSpend * 0.90), roas: projectedRoas },
        { scenario: "Base Case",    revenue: projectedRevenue,                          spend: projectedSpend,                   roas: projectedRoas },
        { scenario: "Optimistic",   revenue: Math.round(dailyAvg * daysInYear * 1.10), spend: Math.round(projectedSpend * 1.05), roas: Math.round(projectedRoas * 1.05 * 100) / 100 },
      ],
    });
  } catch (e) {
    req.log.error({ err: e }, "Failed to query forecast data");
    res.status(500).json({ error: "Failed to query forecast data" });
  }
});

export default router;
