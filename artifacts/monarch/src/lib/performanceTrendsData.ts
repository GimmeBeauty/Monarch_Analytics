/**
 * Performance Trends Data Engine
 *
 * Generates deterministic mock data for:
 * 1. Per-channel efficiency metric trends (ROAS, CPC, CTR, CVR, CPM, CPA, CAC, AOV)
 * 2. Day-of-week revenue & spend seasonality
 * 3. Daily revenue vs spend composition
 * 4. ROAS anomaly detection (±40% from period average, top 6 by magnitude)
 *
 * Follows the same deterministic PRNG pattern as overviewData.ts.
 */

import { STORES } from "./storeData";
import { getChannelsForStores, type ChannelMapping } from "./channelStoreMapping";
import { type PricingMode, getWholesaleRate } from "./wholesaleData";

// ─── Public Types ──────────────────────────────────────────────────────────────

export type EfficiencyMetric = "roas" | "cpc" | "ctr" | "cvr" | "cpm" | "cpa" | "cac" | "aov";

export interface EfficiencyMetricMeta {
  id: EfficiencyMetric;
  label: string;
  description: string;
  prefix: string;
  suffix: string;
  decimals: number;
  higherIsBetter: boolean;
}

export const EFFICIENCY_METRICS: EfficiencyMetricMeta[] = [
  { id: "roas", label: "ROAS", description: "Return on Ad Spend",          prefix: "",  suffix: "x",  decimals: 2, higherIsBetter: true  },
  { id: "cpc",  label: "CPC",  description: "Cost Per Click",              prefix: "$", suffix: "",   decimals: 2, higherIsBetter: false },
  { id: "ctr",  label: "CTR",  description: "Click-Through Rate",          prefix: "",  suffix: "%",  decimals: 2, higherIsBetter: true  },
  { id: "cvr",  label: "CVR",  description: "Conversion Rate",             prefix: "",  suffix: "%",  decimals: 2, higherIsBetter: true  },
  { id: "cpm",  label: "CPM",  description: "Cost Per Mille (1K impr.)",   prefix: "$", suffix: "",   decimals: 2, higherIsBetter: false },
  { id: "cpa",  label: "CPA",  description: "Cost Per Acquisition",        prefix: "$", suffix: "",   decimals: 0, higherIsBetter: false },
  { id: "cac",  label: "CAC",  description: "Customer Acquisition Cost",   prefix: "$", suffix: "",   decimals: 0, higherIsBetter: false },
  { id: "aov",  label: "AOV",  description: "Average Order Value",         prefix: "$", suffix: "",   decimals: 2, higherIsBetter: true  },
];

export type TrendSignal = "improving" | "declining" | "stable";

export interface ChannelMetricSeries {
  channelId: string;
  channelLabel: string;
  color: string;
  signal: TrendSignal;
  signalPct: number;
  latestValue: number;
  avgValue: number;
}

export type ChartRow = Record<string, string | number | null | undefined>;

export interface DowDataPoint {
  day: string;
  dayFull: string;
  jsDay: number;
  avgRevenue: number;
  avgSpend: number;
}

export interface RevSpendPoint {
  date: string;
  label: string;
  revenue: number;
  spend: number;
}

export interface ROASAnomaly {
  date: string;
  label: string;
  channelId: string;
  channelLabel: string;
  channelColor: string;
  roasValue: number;
  avgRoas: number;
  deviationPct: number;
  type: "above" | "below";
}

export interface PerformanceTrendsData {
  channels: ChannelMapping[];
  channelSeries: ChannelMetricSeries[];
  chartRows: ChartRow[];
  dowData: DowDataPoint[];
  bestDay: DowDataPoint;
  slowestDay: DowDataPoint;
  revSpendSeries: RevSpendPoint[];
  anomalies: ROASAnomaly[];
}

export interface PerformanceTrendsParams {
  startDate: string;
  endDate: string;
  selectedStoreIds: string[];
  metric: EfficiencyMetric;
  /** If provided, only these channel IDs are included. Empty/undefined = all channels. */
  channelIds?: string[];
  pricingMode?: PricingMode;
}

// ─── PRNG ─────────────────────────────────────────────────────────────────────

function makePrng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 0x100000000;
  };
}

function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  }
  return h;
}

// ─── Date Utilities ───────────────────────────────────────────────────────────

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDaysInRange(start: string, end: string): string[] {
  const days: string[] = [];
  const cur = parseDate(start);
  const e = parseDate(end);
  while (cur <= e) {
    days.push(dateToStr(new Date(cur)));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function fmtAxisDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const BASE_EPOCH_MS = new Date("2024-01-01").getTime();
function trendFactor(dateStr: string): number {
  return 1 + ((parseDate(dateStr).getTime() - BASE_EPOCH_MS) / (365.25 * 86_400_000)) * 0.18;
}

// ─── Store Revenue ────────────────────────────────────────────────────────────

const STORE_REVENUE_CONFIG: Record<string, { baseline: number; seasonality: number[] }> = {
  shopify:   { baseline: 52000, seasonality: [0.90, 1.10, 1.15, 1.10, 1.20, 1.05, 0.85] },
  amazon:    { baseline: 65000, seasonality: [1.10, 1.00, 0.95, 1.00, 1.05, 1.20, 1.15] },
  walmart:   { baseline: 38000, seasonality: [1.20, 0.90, 0.90, 0.95, 0.95, 1.10, 1.30] },
  target:    { baseline: 32000, seasonality: [1.15, 0.90, 0.90, 0.95, 1.00, 1.10, 1.25] },
  kroger:    { baseline: 21000, seasonality: [1.10, 0.90, 0.90, 0.95, 1.00, 1.15, 1.20] },
  cvs:       { baseline: 19000, seasonality: [1.05, 1.00, 1.00, 1.00, 1.05, 1.10, 1.10] },
  publix:    { baseline: 16000, seasonality: [1.20, 0.85, 0.85, 0.90, 0.95, 1.10, 1.30] },
  ulta:      { baseline: 13000, seasonality: [1.00, 1.00, 1.00, 1.05, 1.10, 1.15, 1.10] },
  walgreens: { baseline:  9000, seasonality: [1.00, 1.00, 1.00, 1.00, 1.05, 1.05, 1.00] },
};

function getStoreDayRevenue(storeId: string, date: string): number {
  const cfg = STORE_REVENUE_CONFIG[storeId];
  if (!cfg) return 0;
  const dow = parseDate(date).getDay();
  const rng = makePrng(hashStr(`${storeId}|${date}`));
  const noise = 0.85 + rng() * 0.30;
  return cfg.baseline * trendFactor(date) * cfg.seasonality[dow] * noise;
}

// ─── Channel Spend ────────────────────────────────────────────────────────────

function getChannelDaySpend(channel: ChannelMapping, date: string): number {
  const dow = parseDate(date).getDay();
  const weekendFactor = dow === 0 || dow === 6 ? 0.75 : 1.0;
  const rng = makePrng(hashStr(`${channel.channelId}|${date}|spend`));
  const noise = 0.88 + rng() * 0.24;
  return channel.dailySpendBaseline * trendFactor(date) * weekendFactor * noise;
}

// ─── Channel Metric Configs ───────────────────────────────────────────────────

interface ChannelMetricConfig {
  ctrBase: number;
  cpmBase: number;
  cvrBase: number;
  aovBase: number;
  newCustRate: number;
}

const CHANNEL_METRIC_CONFIGS: Record<string, ChannelMetricConfig> = {
  "meta-ads":         { ctrBase: 2.0,  cpmBase: 17,   cvrBase: 3.5,  aovBase: 85,  newCustRate: 0.35 },
  "google-ads":       { ctrBase: 3.5,  cpmBase: 42,   cvrBase: 5.2,  aovBase: 95,  newCustRate: 0.28 },
  "tiktok-ads":       { ctrBase: 1.2,  cpmBase: 7.8,  cvrBase: 2.1,  aovBase: 72,  newCustRate: 0.52 },
  "pinterest-ads":    { ctrBase: 0.8,  cpmBase: 3.6,  cvrBase: 2.8,  aovBase: 68,  newCustRate: 0.40 },
  "applovin-axon":    { ctrBase: 3.2,  cpmBase: 9.5,  cvrBase: 1.8,  aovBase: 55,  newCustRate: 0.45 },
  "ctv-programmatic": { ctrBase: 0.3,  cpmBase: 28,   cvrBase: 0.9,  aovBase: 105, newCustRate: 0.38 },
  "amazon-ads":       { ctrBase: 7.5,  cpmBase: 95,   cvrBase: 12.0, aovBase: 42,  newCustRate: 0.20 },
  "pattern-predict":  { ctrBase: 5.8,  cpmBase: 72,   cvrBase: 9.5,  aovBase: 45,  newCustRate: 0.22 },
  "walmart-connect":  { ctrBase: 4.2,  cpmBase: 52,   cvrBase: 7.8,  aovBase: 38,  newCustRate: 0.25 },
  "target-roundel":   { ctrBase: 4.8,  cpmBase: 58,   cvrBase: 8.5,  aovBase: 40,  newCustRate: 0.23 },
  "criteo":           { ctrBase: 2.5,  cpmBase: 22,   cvrBase: 4.2,  aovBase: 62,  newCustRate: 0.30 },
};

const DEFAULT_METRIC_CONFIG: ChannelMetricConfig = {
  ctrBase: 2.0, cpmBase: 15, cvrBase: 3.0, aovBase: 70, newCustRate: 0.30,
};

// ─── Per-Channel Daily Metrics ────────────────────────────────────────────────

type RawMetrics = {
  roas: number; cpc: number; ctr: number; cvr: number;
  cpm: number; cpa: number; cac: number; aov: number;
};

function getChannelDayMetrics(channel: ChannelMapping, date: string, spend: number): RawMetrics {
  const cfg = CHANNEL_METRIC_CONFIGS[channel.channelId] ?? DEFAULT_METRIC_CONFIG;

  const rngRoas  = makePrng(hashStr(`${channel.channelId}|${date}|roas`));
  const rngRoasX = makePrng(hashStr(`${channel.channelId}|${date}|roas_x`));
  const rngCtr   = makePrng(hashStr(`${channel.channelId}|${date}|ctr`));
  const rngCvr   = makePrng(hashStr(`${channel.channelId}|${date}|cvr`));
  const rngCpm   = makePrng(hashStr(`${channel.channelId}|${date}|cpm`));
  const rngAov   = makePrng(hashStr(`${channel.channelId}|${date}|aov`));

  // ROAS: occasional extreme spikes ensure anomalies appear in the data
  const extremeRoll = rngRoasX();
  let roasNoise: number;
  if (extremeRoll < 0.04) {
    roasNoise = 1.5 + rngRoas() * 0.35;   // +50–85% spike
  } else if (extremeRoll < 0.08) {
    roasNoise = 0.38 + rngRoas() * 0.20;  // −42–62% dip
  } else {
    roasNoise = 0.82 + rngRoas() * 0.36;  // normal ±18%
  }
  const roas = channel.baseRoas * roasNoise;

  const ctr = cfg.ctrBase  * (0.85 + rngCtr() * 0.30);
  const cpm = cfg.cpmBase  * (0.88 + rngCpm() * 0.24);
  const cpc = ctr > 0 ? cpm / (ctr * 10) : 0;
  const cvr = cfg.cvrBase  * (0.85 + rngCvr() * 0.30);
  const aov = cfg.aovBase  * (0.92 + rngAov() * 0.16);

  const impressions  = cpm > 0 ? (spend * 1000) / cpm : 0;
  const clicks       = impressions * (ctr / 100);
  const conversions  = clicks * (cvr / 100);
  const cpa = conversions > 0 ? spend / conversions : 0;
  const cac = conversions > 0 ? spend / (conversions * cfg.newCustRate) : 0;

  return { roas, cpc, ctr, cvr, cpm, cpa, cac, aov };
}

// ─── Moving Averages ──────────────────────────────────────────────────────────

function computeMA(values: number[], window: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < window - 1) return null;
    const slice = values.slice(i - window + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

// ─── Trend Signal ─────────────────────────────────────────────────────────────

function computeTrendSignal(values: number[], higherIsBetter: boolean): { signal: TrendSignal; signalPct: number } {
  if (values.length < 4) return { signal: "stable", signalPct: 0 };
  const half = Math.floor(values.length / 2);
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const first  = avg(values.slice(0, half));
  const second = avg(values.slice(-half));
  if (first === 0) return { signal: "stable", signalPct: 0 };
  const pct = ((second - first) / Math.abs(first)) * 100;
  if (Math.abs(pct) < 3) return { signal: "stable", signalPct: pct };
  const improving = higherIsBetter ? pct > 0 : pct < 0;
  return { signal: improving ? "improving" : "declining", signalPct: pct };
}

// ─── Day-of-Week Seasonality ─────────────────────────────────────────────────

const DOW_LABELS   = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const DOW_FULL     = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const DOW_TO_JSDAY = [1, 2, 3, 4, 5, 6, 0]; // Mon=1 … Sat=6, Sun=0

function buildDowData(days: string[], storeIds: string[], channels: ChannelMapping[], pricingMode: PricingMode = "msrp"): DowDataPoint[] {
  const effectiveStoreIds = storeIds.length ? storeIds : STORES.map((s) => s.id);
  const revByJsDow: number[][]   = Array.from({ length: 7 }, () => []);
  const spendByJsDow: number[][] = Array.from({ length: 7 }, () => []);

  for (const date of days) {
    const jsDay = parseDate(date).getDay();
    let rev = 0;
    for (const sid of effectiveStoreIds) rev += getStoreDayRevenue(sid, date) * getWholesaleRate(sid, pricingMode);
    revByJsDow[jsDay].push(rev);

    let spend = 0;
    for (const ch of channels) spend += getChannelDaySpend(ch, date);
    spendByJsDow[jsDay].push(spend);
  }

  return DOW_LABELS.map((day, idx) => {
    const jsDay    = DOW_TO_JSDAY[idx];
    const revArr   = revByJsDow[jsDay];
    const spendArr = spendByJsDow[jsDay];
    const avgRevenue = revArr.length   ? revArr.reduce((a, b) => a + b, 0) / revArr.length     : 0;
    const avgSpend   = spendArr.length ? spendArr.reduce((a, b) => a + b, 0) / spendArr.length : 0;
    return { day, dayFull: DOW_FULL[idx], jsDay, avgRevenue, avgSpend };
  });
}

// ─── Revenue vs Spend Series ──────────────────────────────────────────────────

function buildRevSpendSeries(days: string[], storeIds: string[], channels: ChannelMapping[], pricingMode: PricingMode = "msrp"): RevSpendPoint[] {
  const effectiveStoreIds = storeIds.length ? storeIds : STORES.map((s) => s.id);
  return days.map((date) => {
    let revenue = 0;
    for (const sid of effectiveStoreIds) revenue += getStoreDayRevenue(sid, date) * getWholesaleRate(sid, pricingMode);
    let spend = 0;
    for (const ch of channels) spend += getChannelDaySpend(ch, date);
    return { date, label: fmtAxisDate(date), revenue, spend };
  });
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function generatePerformanceTrendsData(params: PerformanceTrendsParams): PerformanceTrendsData {
  const { startDate, endDate, selectedStoreIds, metric, channelIds, pricingMode = "msrp" } = params;
  const days        = getDaysInRange(startDate, endDate);
  const allChannels = getChannelsForStores(selectedStoreIds);
  const channels    = channelIds?.length
    ? allChannels.filter((ch) => channelIds.includes(ch.channelId))
    : allChannels;
  const metricMeta = EFFICIENCY_METRICS.find((m) => m.id === metric)!;

  // ── Per-channel daily values for selected metric ──────────────────────────
  const rawValues: Record<string, number[]> = {};
  for (const ch of channels) {
    rawValues[ch.channelId] = days.map((date) => {
      const spend = getChannelDaySpend(ch, date);
      return getChannelDayMetrics(ch, date, spend)[metric];
    });
  }

  // ── Flat chart rows (recharts-ready) ──────────────────────────────────────
  const chartRows: ChartRow[] = days.map((date, i) => {
    const row: ChartRow = { date, label: fmtAxisDate(date) };
    for (const ch of channels) row[ch.channelId] = rawValues[ch.channelId][i];
    return row;
  });

  // Append MA columns
  for (const ch of channels) {
    const values = rawValues[ch.channelId];
    const ma7  = computeMA(values, 7);
    const ma30 = computeMA(values, 30);
    chartRows.forEach((row, i) => {
      row[`${ch.channelId}_ma7`]  = ma7[i];
      row[`${ch.channelId}_ma30`] = ma30[i];
    });
  }

  // ── Channel series metadata ───────────────────────────────────────────────
  const channelSeries: ChannelMetricSeries[] = channels.map((ch) => {
    const values = rawValues[ch.channelId];
    const { signal, signalPct } = computeTrendSignal(values, metricMeta.higherIsBetter);
    const avgValue = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    return {
      channelId:    ch.channelId,
      channelLabel: ch.channelLabel,
      color:        ch.color,
      signal,
      signalPct,
      latestValue: values[values.length - 1] ?? 0,
      avgValue,
    };
  });

  // ── DOW Seasonality ───────────────────────────────────────────────────────
  const dowData    = buildDowData(days, selectedStoreIds, channels, pricingMode);
  const bestDay    = dowData.reduce((b, d) => d.avgRevenue > b.avgRevenue ? d : b, dowData[0]);
  const slowestDay = dowData.reduce((s, d) => d.avgRevenue < s.avgRevenue ? d : s, dowData[0]);

  // ── Revenue vs Spend ──────────────────────────────────────────────────────
  const revSpendSeries = buildRevSpendSeries(days, selectedStoreIds, channels, pricingMode);

  // ── ROAS Anomalies ────────────────────────────────────────────────────────
  const allAnomalies: ROASAnomaly[] = [];
  for (const ch of channels) {
    const dailyRoas = days.map((date) => {
      const spend = getChannelDaySpend(ch, date);
      return getChannelDayMetrics(ch, date, spend).roas;
    });
    const avgRoas = dailyRoas.reduce((a, b) => a + b, 0) / dailyRoas.length;

    dailyRoas.forEach((roasValue, i) => {
      if (!avgRoas) return;
      const deviationPct = ((roasValue - avgRoas) / avgRoas) * 100;
      if (Math.abs(deviationPct) >= 40) {
        allAnomalies.push({
          date: days[i],
          label: fmtAxisDate(days[i]),
          channelId:    ch.channelId,
          channelLabel: ch.channelLabel,
          channelColor: ch.color,
          roasValue,
          avgRoas,
          deviationPct,
          type: deviationPct > 0 ? "above" : "below",
        });
      }
    });
  }

  allAnomalies.sort((a, b) => Math.abs(b.deviationPct) - Math.abs(a.deviationPct));

  return {
    channels,
    channelSeries,
    chartRows,
    dowData,
    bestDay,
    slowestDay,
    revSpendSeries,
    anomalies: allAnomalies.slice(0, 6),
  };
}
