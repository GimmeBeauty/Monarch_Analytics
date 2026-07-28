/**
 * Overview Data Engine
 *
 * Generates deterministic mock data for the Overview dashboard.
 * All outputs respect store selection and channel-store mapping.
 *
 * Architecture notes:
 * - Pure functions: no side effects, no React dependencies
 * - Deterministic PRNG keyed by (entity, date) — same inputs → same outputs
 * - Designed for memoisation in React (stable refs for same params)
 * - Replace generateOverviewData() with real API calls in production
 */

import { STORES, storeById } from "./storeData";
import { getChannelsForStores, CHANNEL_STORE_MAPPINGS, type ChannelMapping } from "./channelStoreMapping";
import { type PricingMode, getWholesaleRate, getBlendedWholesaleMultiplier } from "./wholesaleData";

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface OverviewParams {
  startDate: string;
  endDate: string;
  selectedStoreIds: string[]; // empty = all stores
  /** Optional: if provided, used for period comparisons instead of auto-prior */
  compareStart?: string;
  compareEnd?: string;
  pricingMode?: PricingMode;
}

export interface KPIMetric {
  id: string;
  label: string;
  value: number;
  formatted: string;
  change: number;       // % change vs prior period (e.g. 12.3 = +12.3%)
  positive: boolean;   // whether "up" is good for this metric
  format: "currency" | "number" | "ratio" | "percent";
  description: string;
}

export interface TrendPoint {
  date: string;        // YYYY-MM-DD
  label: string;       // "Apr 10" — for x-axis
  revenue: number;
  spend: number;
  mer: number;
  roas: number;
}

export interface StoreBreakdown {
  storeId: string;
  label: string;
  revenue: number;
  formattedRevenue: string;
  contribution: number;  // 0–100
  change: number;        // % vs prior period
  color: string;
}

export interface ChannelBreakdown {
  channelId: string;
  label: string;
  spend: number;
  attributedRevenue: number;
  roas: number;
  contribution: number;  // % of total spend
  change: number;        // spend % vs prior period
  formattedSpend: string;
  formattedRevenue: string;
  color: string;
}

export interface ContributionSlice {
  name: string;
  value: number;   // 0–100
  color: string;
}

export type ActivityCategory = "product" | "alert" | "integration" | "data";
export type ActivitySeverity = "info" | "warning" | "critical";

export interface ActivityEvent {
  id: string;
  title: string;
  description: string;
  timestamp: Date;
  category: ActivityCategory;
  severity: ActivitySeverity;
  relatedStore?: string;
  relatedChannel?: string;
  linkTo?: string;
}

export interface OverviewData {
  kpis: KPIMetric[];
  trendSeries: TrendPoint[];
  storeBreakdown: StoreBreakdown[];
  channelBreakdown: ChannelBreakdown[];
  contributionByStore: ContributionSlice[];
  contributionByChannel: ContributionSlice[];
  activityFeed: ActivityEvent[];
}

// ─── PRNG ─────────────────────────────────────────────────────────────────────

/** Deterministic seeded PRNG — returns a function that produces [0, 1) values. */
function makePrng(seed: number): () => number {
  let s = seed >>> 0;
  return (): number => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 0x100000000;
  };
}

/** FNV-1a hash of a string → 32-bit unsigned int */
function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  }
  return h;
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmtCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v).toLocaleString()}`;
}

function fmtNumber(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return Math.round(v).toLocaleString();
}

function fmtRatio(v: number): string {
  return `${v.toFixed(2)}x`;
}

function fmtPercent(v: number): string {
  return `${v.toFixed(2)}%`;
}

function fmtAxisDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ─── Date Utilities ───────────────────────────────────────────────────────────

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dateToStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDaysInRange(start: string, end: string): string[] {
  const days: string[] = [];
  const s = parseDate(start);
  const e = parseDate(end);
  const cur = new Date(s);
  while (cur <= e) {
    days.push(dateToStr(new Date(cur)));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function priorPeriod(start: string, end: string): { start: string; end: string } {
  const s = parseDate(start);
  const e = parseDate(end);
  const diffMs = e.getTime() - s.getTime() + 86_400_000; // inclusive
  const priorEnd = new Date(s.getTime() - 86_400_000);
  const priorStart = new Date(priorEnd.getTime() - diffMs + 86_400_000);
  return { start: dateToStr(priorStart), end: dateToStr(priorEnd) };
}

// ─── Store Day Data ───────────────────────────────────────────────────────────

interface StoreDayConfig {
  revenueBaseline: number;
  ordersBaseline: number;
  sessionsBaseline: number;
  /** Seasonality by day-of-week [Sun, Mon, Tue, Wed, Thu, Fri, Sat] */
  seasonality: [number, number, number, number, number, number, number];
}

const STORE_DAY_CONFIG: Record<string, StoreDayConfig> = {
  shopify:   { revenueBaseline: 52000, ordersBaseline: 420, sessionsBaseline: 12000, seasonality: [0.90, 1.10, 1.15, 1.10, 1.20, 1.05, 0.85] },
  amazon:    { revenueBaseline: 65000, ordersBaseline: 780, sessionsBaseline: 18000, seasonality: [1.10, 1.00, 0.95, 1.00, 1.05, 1.20, 1.15] },
  walmart:   { revenueBaseline: 38000, ordersBaseline: 520, sessionsBaseline:  9000, seasonality: [1.20, 0.90, 0.90, 0.95, 0.95, 1.10, 1.30] },
  target:    { revenueBaseline: 32000, ordersBaseline: 410, sessionsBaseline:  7500, seasonality: [1.15, 0.90, 0.90, 0.95, 1.00, 1.10, 1.25] },
  kroger:    { revenueBaseline: 21000, ordersBaseline: 280, sessionsBaseline:  5000, seasonality: [1.10, 0.90, 0.90, 0.95, 1.00, 1.15, 1.20] },
  cvs:       { revenueBaseline: 19000, ordersBaseline: 310, sessionsBaseline:  4500, seasonality: [1.05, 1.00, 1.00, 1.00, 1.05, 1.10, 1.10] },
  publix:    { revenueBaseline: 16000, ordersBaseline: 220, sessionsBaseline:  3800, seasonality: [1.20, 0.85, 0.85, 0.90, 0.95, 1.10, 1.30] },
  ulta:      { revenueBaseline: 13000, ordersBaseline: 180, sessionsBaseline:  3200, seasonality: [1.00, 1.00, 1.00, 1.05, 1.10, 1.15, 1.10] },
  walgreens: { revenueBaseline:  9000, ordersBaseline: 145, sessionsBaseline:  2200, seasonality: [1.00, 1.00, 1.00, 1.00, 1.05, 1.05, 1.00] },
};

/** Approximate annual growth factor — ~18%/year from 2024-01-01 baseline */
const BASE_EPOCH_MS = new Date("2024-01-01").getTime();
function trendFactor(dateStr: string): number {
  return 1 + ((parseDate(dateStr).getTime() - BASE_EPOCH_MS) / (365.25 * 86_400_000)) * 0.18;
}

interface StoreDayData {
  revenue: number;
  orders: number;
  sessions: number;
  units: number;
}

function getStoreDayData(storeId: string, date: string): StoreDayData | null {
  const cfg = STORE_DAY_CONFIG[storeId];
  if (!cfg) return null;

  const d = parseDate(date);
  const dow = d.getDay();
  const trend = trendFactor(date);
  const season = cfg.seasonality[dow];
  const rng = makePrng(hashStr(`${storeId}|${date}`));
  const noise = 0.85 + rng() * 0.30; // ±15%

  const factor = trend * season * noise;
  const revenue = cfg.revenueBaseline * factor;
  const orders = Math.round(cfg.ordersBaseline * factor);
  const sessions = Math.round(cfg.sessionsBaseline * factor);
  // 1.4–1.8 units per order
  const rng2 = makePrng(hashStr(`${storeId}|${date}|units`));
  const units = Math.round(orders * (1.4 + rng2() * 0.4));

  return { revenue, orders, sessions, units };
}

// ─── Channel Day Data ─────────────────────────────────────────────────────────

interface ChannelDayData {
  spend: number;
}

function getChannelDayData(channel: ChannelMapping, date: string): ChannelDayData {
  const d = parseDate(date);
  const dow = d.getDay();
  // Channels typically reduce spend ~25% on weekends
  const weekendFactor = dow === 0 || dow === 6 ? 0.75 : 1.0;
  const trend = trendFactor(date);
  const rng = makePrng(hashStr(`${channel.channelId}|${date}|spend`));
  const noise = 0.88 + rng() * 0.24; // ±12%

  const spend = channel.dailySpendBaseline * trend * weekendFactor * noise;
  return { spend };
}

// ─── Period Aggregation ───────────────────────────────────────────────────────

interface PeriodAgg {
  revenue: number;
  spend: number;
  orders: number;
  sessions: number;
  units: number;
  perStore: Record<string, { revenue: number; orders: number; sessions: number; units: number }>;
  perChannel: Record<string, { spend: number }>;
}

function aggregatePeriod(
  days: string[],
  storeIds: string[],   // empty = all
  channels: ChannelMapping[],
  pricingMode: PricingMode = "msrp"
): PeriodAgg {
  const effectiveStoreIds = storeIds.length
    ? storeIds
    : STORES.map((s) => s.id);

  const agg: PeriodAgg = {
    revenue: 0, spend: 0, orders: 0, sessions: 0, units: 0,
    perStore: Object.fromEntries(effectiveStoreIds.map((id) => [id, { revenue: 0, orders: 0, sessions: 0, units: 0 }])),
    perChannel: Object.fromEntries(channels.map((ch) => [ch.channelId, { spend: 0 }])),
  };

  for (const date of days) {
    for (const storeId of effectiveStoreIds) {
      const d = getStoreDayData(storeId, date);
      if (!d) continue;
      const wsRate = getWholesaleRate(storeId, pricingMode);
      const adjRevenue = d.revenue * wsRate;
      agg.perStore[storeId].revenue += adjRevenue;
      agg.perStore[storeId].orders += d.orders;
      agg.perStore[storeId].sessions += d.sessions;
      agg.perStore[storeId].units += d.units;
      agg.revenue += adjRevenue;
      agg.orders += d.orders;
      agg.sessions += d.sessions;
      agg.units += d.units;
    }
    for (const ch of channels) {
      const d = getChannelDayData(ch, date);
      agg.perChannel[ch.channelId].spend += d.spend;
      agg.spend += d.spend;
    }
  }

  return agg;
}

// ─── KPI Builder ─────────────────────────────────────────────────────────────

function buildKPIs(current: PeriodAgg, prior: PeriodAgg, channels: ChannelMapping[], wsMultiplier = 1.0): KPIMetric[] {
  const pct = (cur: number, prv: number): number =>
    prv === 0 ? 0 : Math.round(((cur - prv) / prv) * 1000) / 10;

  // Blended ROAS = spend-weighted average of per-channel baseRoas × wholesale multiplier
  const weightedRoas = channels.reduce((sum, ch) => {
    const spend = current.perChannel[ch.channelId]?.spend ?? 0;
    return sum + spend * ch.baseRoas;
  }, 0);
  const currentRoas = current.spend > 0 ? (weightedRoas / current.spend) * wsMultiplier : 0;

  const priorWeightedRoas = channels.reduce((sum, ch) => {
    const spend = prior.perChannel[ch.channelId]?.spend ?? 0;
    return sum + spend * ch.baseRoas;
  }, 0);
  const priorRoas = prior.spend > 0 ? (priorWeightedRoas / prior.spend) * wsMultiplier : 0;

  const currentMer = current.spend > 0 ? current.revenue / current.spend : 0;
  const priorMer = prior.spend > 0 ? prior.revenue / prior.spend : 0;

  const currentAov = current.orders > 0 ? current.revenue / current.orders : 0;
  const priorAov = prior.orders > 0 ? prior.revenue / prior.orders : 0;

  const currentCvr = current.sessions > 0 ? (current.orders / current.sessions) * 100 : 0;
  const priorCvr = prior.sessions > 0 ? (prior.orders / prior.sessions) * 100 : 0;

  return [
    {
      id: "revenue",
      label: "Total Revenue",
      value: current.revenue,
      formatted: fmtCurrency(current.revenue),
      change: pct(current.revenue, prior.revenue),
      positive: true,
      format: "currency",
      description: "Aggregate revenue across all selected stores",
    },
    {
      id: "spend",
      label: "Ad Spend",
      value: current.spend,
      formatted: fmtCurrency(current.spend),
      change: pct(current.spend, prior.spend),
      positive: false, // more spend isn't inherently good
      format: "currency",
      description: "Total spend across all mapped ad channels",
    },
    {
      id: "mer",
      label: "MER",
      value: currentMer,
      formatted: fmtRatio(currentMer),
      change: pct(currentMer, priorMer),
      positive: true,
      format: "ratio",
      description: "Marketing Efficiency Ratio — Total Revenue ÷ Total Ad Spend",
    },
    {
      id: "roas",
      label: "Blended ROAS",
      value: currentRoas,
      formatted: fmtRatio(currentRoas),
      change: pct(currentRoas, priorRoas),
      positive: true,
      format: "ratio",
      description: "Spend-weighted average Return on Ad Spend across all channels",
    },
    {
      id: "units",
      label: "Units Sold",
      value: current.units,
      formatted: fmtNumber(current.units),
      change: pct(current.units, prior.units),
      positive: true,
      format: "number",
      description: "Total units sold across all selected stores",
    },
    {
      id: "aov",
      label: "AOV",
      value: currentAov,
      formatted: fmtCurrency(currentAov),
      change: pct(currentAov, priorAov),
      positive: true,
      format: "currency",
      description: "Average Order Value — Total Revenue ÷ Total Orders",
    },
    {
      id: "sessions",
      label: "Sessions / Views",
      value: current.sessions,
      formatted: fmtNumber(current.sessions),
      change: pct(current.sessions, prior.sessions),
      positive: true,
      format: "number",
      description: "Total sessions and product views across all selected stores",
    },
    {
      id: "cvr",
      label: "Conversion Rate",
      value: currentCvr,
      formatted: fmtPercent(currentCvr),
      change: pct(currentCvr, priorCvr),
      positive: true,
      format: "percent",
      description: "Orders ÷ Sessions across all selected stores",
    },
  ];
}

// ─── Trend Series ─────────────────────────────────────────────────────────────

function buildTrendSeries(
  days: string[],
  storeIds: string[],
  channels: ChannelMapping[],
  pricingMode: PricingMode = "msrp"
): TrendPoint[] {
  const effectiveStoreIds = storeIds.length ? storeIds : STORES.map((s) => s.id);

  return days.map((date) => {
    let revenue = 0;
    let spend = 0;

    for (const storeId of effectiveStoreIds) {
      const d = getStoreDayData(storeId, date);
      if (d) revenue += d.revenue * getWholesaleRate(storeId, pricingMode);
    }
    for (const ch of channels) {
      spend += getChannelDayData(ch, date).spend;
    }

    const mer = spend > 0 ? revenue / spend : 0;
    const weightedRoas = channels.reduce((sum, ch) => {
      return sum + getChannelDayData(ch, date).spend * ch.baseRoas;
    }, 0);
    const roas = spend > 0 ? weightedRoas / spend : 0;

    return { date, label: fmtAxisDate(date), revenue, spend, mer, roas };
  });
}

// ─── Breakdown Builders ───────────────────────────────────────────────────────

function buildStoreBreakdown(
  current: PeriodAgg,
  prior: PeriodAgg,
  storeIds: string[]
): StoreBreakdown[] {
  const effectiveStoreIds = storeIds.length ? storeIds : STORES.map((s) => s.id);
  const totalRevenue = current.revenue;
  const pct = (cur: number, prv: number) =>
    prv === 0 ? 0 : Math.round(((cur - prv) / prv) * 1000) / 10;

  return effectiveStoreIds
    .map((id) => {
      const store = storeById(id);
      if (!store) return null;
      const rev = current.perStore[id]?.revenue ?? 0;
      const priorRev = prior.perStore[id]?.revenue ?? 0;
      return {
        storeId: id,
        label: store.label,
        revenue: rev,
        formattedRevenue: fmtCurrency(rev),
        contribution: totalRevenue > 0 ? Math.round((rev / totalRevenue) * 1000) / 10 : 0,
        change: pct(rev, priorRev),
        color: store.color,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b!.revenue - a!.revenue) as StoreBreakdown[];
}

function buildChannelBreakdown(
  current: PeriodAgg,
  prior: PeriodAgg,
  channels: ChannelMapping[],
  wsMultiplier = 1.0
): ChannelBreakdown[] {
  const totalSpend = current.spend;
  const pct = (cur: number, prv: number) =>
    prv === 0 ? 0 : Math.round(((cur - prv) / prv) * 1000) / 10;

  return channels
    .map((ch) => {
      const spend = current.perChannel[ch.channelId]?.spend ?? 0;
      const priorSpend = prior.perChannel[ch.channelId]?.spend ?? 0;
      const attributedRevenue = spend * ch.baseRoas * wsMultiplier;
      const roas = ch.baseRoas * wsMultiplier; // wholesale-adjusted per-channel ROAS

      return {
        channelId: ch.channelId,
        label: ch.channelLabel,
        spend,
        attributedRevenue,
        roas,
        contribution: totalSpend > 0 ? Math.round((spend / totalSpend) * 1000) / 10 : 0,
        change: pct(spend, priorSpend),
        formattedSpend: fmtCurrency(spend),
        formattedRevenue: fmtCurrency(attributedRevenue),
        color: ch.color,
      };
    })
    .filter((ch) => ch.spend > 0)
    .sort((a, b) => b.spend - a.spend);
}

// ─── Activity Feed ────────────────────────────────────────────────────────────

export function buildActivityFeed(
  storeIds: string[],
  _channels: ChannelMapping[],
  endDate: string
): ActivityEvent[] {
  const base = parseDate(endDate);
  const ago = (h: number): Date => new Date(base.getTime() - h * 3_600_000);

  const all: ActivityEvent[] = [
    {
      id: "ev-1",
      title: "Amazon Pattern data share connected",
      description: "Amazon sales and advertising data now flows directly from Pattern via Snowflake data share. Sell-through revenue, units, and Amazon Ads spend/ROAS are now available across Overview, Traffic, and Ad Attribution.",
      timestamp: ago(24),
      category: "integration",
      severity: "info",
      relatedStore: "amazon",
      linkTo: "/attribution",
    },
    {
      id: "ev-2",
      title: "Walmart Connect advertising data added",
      description: "Walmart Connect ad spend, impressions, clicks, and 14-day attributed sales are now live in Ad Attribution under Retail Media Network, alongside Roundel and Criteo.",
      timestamp: ago(48),
      category: "integration",
      severity: "info",
      relatedStore: "walmart",
      linkTo: "/attribution",
    },
    {
      id: "ev-3",
      title: "CTV / Programmatic and Display channels launched",
      description: "Agility and Amazon DSP campaign data are now combined into two unified channels — CTV / Programmatic and Display — visible in Ad Attribution and the Spend Optimizer.",
      timestamp: ago(72),
      category: "integration",
      severity: "info",
      linkTo: "/attribution",
    },
    {
      id: "ev-4",
      title: "Forecast page rebuilt with year-based planning",
      description: "Forecast now runs on a standalone year selector (2025/2026) with MSRP and Wholesale projections calculated separately. Scenario Comparison shows Conservative, Actual Goals, and BHAG targets pulled from Forecast Settings.",
      timestamp: ago(120),
      category: "product",
      severity: "info",
      linkTo: "/forecast",
    },
    {
      id: "ev-5",
      title: "Forecast Settings moved to Snowflake",
      description: "Monthly revenue goals and annual targets are now stored centrally in Snowflake instead of browser-local storage, so goals are shared consistently across devices and team members.",
      timestamp: ago(144),
      category: "data",
      severity: "info",
      linkTo: "/settings",
    },
    {
      id: "ev-6",
      title: "$ Per Store Per Week (PSW) metric added",
      description: "New efficiency metric showing Target in-store revenue per store per week, weighted by each SKU's own store distribution. Available on Overview, Traffic, and the Performance Over Time chart.",
      timestamp: ago(168),
      category: "product",
      severity: "info",
      relatedStore: "target",
      linkTo: "/traffic",
    },
    {
      id: "ev-7",
      title: "Ad Attribution redesigned with expandable channel table",
      description: "Meta, Google, Pinterest, Criteo, Roundel, Amazon, CTV/Programmatic, Display, and Walmart Connect each now have dedicated detail panels with campaign-level breakdowns and channel-specific KPIs.",
      timestamp: ago(192),
      category: "product",
      severity: "info",
      linkTo: "/attribution",
    },
    {
      id: "ev-8",
      title: "Item Performance sell-through data connected",
      description: "SKU-level sell-through data from Target, Walmart, and Circana now appears alongside NetSuite sell-in data, with updated velocity benchmarks by retailer channel.",
      timestamp: ago(216),
      category: "data",
      severity: "info",
      linkTo: "/item-performance",
    },
    {
      id: "ev-9",
      title: "Roundel daily ingestion fixed",
      description: "Target Roundel advertising data now updates daily instead of weekly after resolving a filename pattern mismatch in the S3 ingestion pipeline.",
      timestamp: ago(240),
      category: "integration",
      severity: "info",
      relatedStore: "target",
      linkTo: "/attribution",
    },
    {
      id: "ev-10",
      title: "NetSuite historical data restored",
      description: "Fixed a sync bug that was deleting all historical wholesale data on each run instead of only the target date range. Full sell-in history from January 2025 has been backfilled.",
      timestamp: ago(288),
      category: "data",
      severity: "info",
      linkTo: "/settings/integrations",
    },
    {
      id: "ev-11",
      title: "Target product performance data restored",
      description: "Daily product-level rebuild was added back to the scheduler after a gap left SKU-level Target data stale for several weeks. Data is now current and refreshes nightly.",
      timestamp: ago(312),
      category: "data",
      severity: "info",
      relatedStore: "target",
      linkTo: "/traffic",
    },
    {
      id: "ev-12",
      title: "Month to Date and Year to Date date ranges added",
      description: "Two new quick-select date range options are available across all dashboard pages, alongside the existing fixed period options.",
      timestamp: ago(336),
      category: "product",
      severity: "info",
      linkTo: "/overview",
    },
  ];

  // If stores are filtered, prioritize events related to those stores
  if (storeIds.length > 0) {
    const storeSet = new Set(storeIds);
    return all
      .filter((e) => !e.relatedStore || storeSet.has(e.relatedStore) || e.category === "product")
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  return all.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function generateOverviewData(params: OverviewParams): OverviewData {
  const { startDate, endDate, selectedStoreIds, pricingMode = "msrp" } = params;

  // Determine compare range
  const prior = params.compareStart && params.compareEnd
    ? { start: params.compareStart, end: params.compareEnd }
    : priorPeriod(startDate, endDate);

  const currentDays = getDaysInRange(startDate, endDate);
  const priorDays = getDaysInRange(prior.start, prior.end);
  const channels = getChannelsForStores(selectedStoreIds);
  const wsMultiplier = getBlendedWholesaleMultiplier(selectedStoreIds, pricingMode);

  const currentAgg = aggregatePeriod(currentDays, selectedStoreIds, channels, pricingMode);
  const priorAgg = aggregatePeriod(priorDays, selectedStoreIds, channels, pricingMode);

  const kpis = buildKPIs(currentAgg, priorAgg, channels, wsMultiplier);
  const trendSeries = buildTrendSeries(currentDays, selectedStoreIds, channels, pricingMode);
  const storeBreakdown = buildStoreBreakdown(currentAgg, priorAgg, selectedStoreIds);
  const channelBreakdown = buildChannelBreakdown(currentAgg, priorAgg, channels, wsMultiplier);

  const topN = 6;
  const contributionByStore: ContributionSlice[] = storeBreakdown.slice(0, topN).map((s) => ({
    name: s.label,
    value: s.contribution,
    color: s.color,
  }));
  const otherStoreContrib = storeBreakdown.slice(topN).reduce((sum, s) => sum + s.contribution, 0);
  if (otherStoreContrib > 0) contributionByStore.push({ name: "Other", value: otherStoreContrib, color: "#9CA3AF" });

  const contributionByChannel: ContributionSlice[] = channelBreakdown.slice(0, topN).map((ch) => ({
    name: ch.label,
    value: ch.contribution,
    color: ch.color,
  }));
  const otherChannelContrib = channelBreakdown.slice(topN).reduce((sum, ch) => sum + ch.contribution, 0);
  if (otherChannelContrib > 0) contributionByChannel.push({ name: "Other", value: otherChannelContrib, color: "#9CA3AF" });

  const activityFeed = buildActivityFeed(selectedStoreIds, channels, endDate);

  return {
    kpis,
    trendSeries,
    storeBreakdown,
    channelBreakdown,
    contributionByStore,
    contributionByChannel,
    activityFeed,
  };
}
