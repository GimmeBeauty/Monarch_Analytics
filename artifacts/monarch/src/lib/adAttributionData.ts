/**
 * Ad Attribution Data Engine
 *
 * Generates deterministic mock data for the Ad Attribution dashboard.
 * Provides channel-level paid ad metrics, funnel analysis, signal detection,
 * daily ROAS trends, and advanced intelligence metrics.
 *
 * Architecture:
 * - Pure functions (no React deps, no side effects)
 * - Deterministic PRNG seeded by (channel, date) — same inputs → same outputs
 * - getChannelsForStores() respects store selection
 * - Signal detection via current vs prior period with realistic biases per channel
 */

import { getChannelsForStores, type ChannelMapping } from "./channelStoreMapping";
import { type PricingMode, getBlendedWholesaleMultiplier } from "./wholesaleData";

// ─── PRNG ─────────────────────────────────────────────────────────────────────

function makePrng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 0x100000000; };
}

function hashStr(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0;
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
  const s = parseDate(start);
  const e = parseDate(end);
  const c = new Date(s);
  while (c <= e) { days.push(dateToStr(new Date(c))); c.setDate(c.getDate() + 1); }
  return days;
}

function priorPeriod(start: string, end: string): { start: string; end: string } {
  const s = parseDate(start);
  const e = parseDate(end);
  const ms = e.getTime() - s.getTime() + 86_400_000;
  const pe = new Date(s.getTime() - 86_400_000);
  const ps = new Date(pe.getTime() - ms + 86_400_000);
  return { start: dateToStr(ps), end: dateToStr(pe) };
}

function fmtAxisDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

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

function pct(cur: number, prv: number): number {
  return prv === 0 ? 0 : Math.round(((cur - prv) / prv) * 1000) / 10;
}

const BASE_EPOCH_MS = new Date("2024-01-01").getTime();
function trendFactor(dateStr: string): number {
  return 1 + ((parseDate(dateStr).getTime() - BASE_EPOCH_MS) / (365.25 * 86_400_000)) * 0.18;
}

// ─── Channel Ad Config ────────────────────────────────────────────────────────

interface ChannelAdConfig {
  cpmBaseline: number;        // $ per 1,000 impressions
  ctrBaseline: number;        // % click-through rate
  cvrBaseline: number;        // % conversion rate of clicks
  frequencyBaseline: number;  // avg ad exposures per unique user per period
  elasticity: number;         // 0–1: revenue sensitivity to spend changes
  incrementalLift: number;    // 0–1: fraction of revenue attributable to advertising
  decayRate: number;          // 0–1: performance degradation rate as spend scales
}

// Biases applied to the CURRENT period only to simulate realistic performance trends.
// Creates meaningful signal detection vs prior period.
interface SignalBias {
  ctrFactor?: number;   // multiplier on clicks/CTR
  roasFactor?: number;  // multiplier on revenue/ROAS
  freqFactor?: number;  // multiplier on frequency
  cpaMod?: number;      // inflate CPA (reduce effective conversions)
}

const SIGNAL_BIASES: Record<string, SignalBias> = {
  "meta-ads":         { freqFactor: 1.22, cpaMod: 1.28 },          // fatigue + rising CPA
  "tiktok-ads":       { ctrFactor: 0.76, freqFactor: 1.18 },       // declining CTR + fatigue
  "applovin-axon":    { roasFactor: 0.68, freqFactor: 1.32, ctrFactor: 0.88 }, // critical signals
  "ctv-programmatic": { cpaMod: 1.30 },                             // rising CPA
};

const CHANNEL_AD_CONFIG: Record<string, ChannelAdConfig> = {
  "meta-ads":         { cpmBaseline: 12, ctrBaseline: 2.8, cvrBaseline: 3.2, frequencyBaseline: 3.8, elasticity: 0.68, incrementalLift: 0.72, decayRate: 0.18 },
  "google-ads":       { cpmBaseline:  8, ctrBaseline: 5.2, cvrBaseline: 4.5, frequencyBaseline: 2.1, elasticity: 0.82, incrementalLift: 0.84, decayRate: 0.12 },
  "tiktok-ads":       { cpmBaseline:  7, ctrBaseline: 4.1, cvrBaseline: 2.8, frequencyBaseline: 4.2, elasticity: 0.55, incrementalLift: 0.61, decayRate: 0.22 },
  "pinterest-ads":    { cpmBaseline: 10, ctrBaseline: 1.9, cvrBaseline: 2.5, frequencyBaseline: 2.8, elasticity: 0.51, incrementalLift: 0.58, decayRate: 0.15 },
  "applovin-axon":    { cpmBaseline:  5, ctrBaseline: 3.8, cvrBaseline: 2.1, frequencyBaseline: 5.1, elasticity: 0.44, incrementalLift: 0.48, decayRate: 0.31 },
  "ctv-programmatic": { cpmBaseline: 22, ctrBaseline: 0.4, cvrBaseline: 1.8, frequencyBaseline: 2.3, elasticity: 0.38, incrementalLift: 0.41, decayRate: 0.09 },
  "amazon-ads":       { cpmBaseline:  6, ctrBaseline: 6.8, cvrBaseline: 7.2, frequencyBaseline: 1.9, elasticity: 0.88, incrementalLift: 0.91, decayRate: 0.08 },
  "pattern-predict":  { cpmBaseline:  8, ctrBaseline: 5.5, cvrBaseline: 6.1, frequencyBaseline: 2.2, elasticity: 0.74, incrementalLift: 0.79, decayRate: 0.11 },
  "walmart-connect":  { cpmBaseline:  7, ctrBaseline: 4.9, cvrBaseline: 5.3, frequencyBaseline: 2.5, elasticity: 0.71, incrementalLift: 0.76, decayRate: 0.13 },
  "target-roundel":   { cpmBaseline:  9, ctrBaseline: 4.2, cvrBaseline: 4.8, frequencyBaseline: 2.4, elasticity: 0.69, incrementalLift: 0.74, decayRate: 0.14 },
  "criteo":           { cpmBaseline: 14, ctrBaseline: 2.7, cvrBaseline: 4.2, frequencyBaseline: 3.4, elasticity: 0.64, incrementalLift: 0.69, decayRate: 0.16 },
  "criteo-ads":       { cpmBaseline: 14, ctrBaseline: 2.7, cvrBaseline: 4.2, frequencyBaseline: 3.4, elasticity: 0.64, incrementalLift: 0.69, decayRate: 0.16 },
};

// ─── Day-level Data ───────────────────────────────────────────────────────────

interface DayData {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  frequency: number;
}

function getChannelDayData(channel: ChannelMapping, date: string, cfg: ChannelAdConfig): DayData {
  const d = parseDate(date);
  const dow = d.getDay();
  const wf = dow === 0 || dow === 6 ? 0.75 : 1.0;
  const tf = trendFactor(date);

  // Spend (uses same seed as overviewData for consistency)
  const spendRng = makePrng(hashStr(`${channel.channelId}|${date}|spend`));
  const spend = channel.dailySpendBaseline * tf * wf * (0.88 + spendRng() * 0.24);

  // Impressions derived from CPM
  const cpmRng = makePrng(hashStr(`${channel.channelId}|${date}|cpm`));
  const cpm = cfg.cpmBaseline * (0.85 + cpmRng() * 0.30);
  const impressions = Math.round((spend / cpm) * 1000);

  // CTR → clicks
  const ctrRng = makePrng(hashStr(`${channel.channelId}|${date}|ctr`));
  const ctr = cfg.ctrBaseline * (0.80 + ctrRng() * 0.40) / 100;
  const clicks = Math.round(impressions * Math.max(ctr, 0.001));

  // CVR → conversions
  const cvrRng = makePrng(hashStr(`${channel.channelId}|${date}|cvr`));
  const cvr = cfg.cvrBaseline * (0.80 + cvrRng() * 0.40) / 100;
  const conversions = Math.round(clicks * Math.max(cvr, 0.001));

  // Revenue (wsMultiplier applied by caller after aggregation)
  const revRng = makePrng(hashStr(`${channel.channelId}|${date}|revenue`));
  const revenue = spend * channel.baseRoas * (0.85 + revRng() * 0.30);

  // Frequency
  const freqRng = makePrng(hashStr(`${channel.channelId}|${date}|freq`));
  const frequency = cfg.frequencyBaseline * (0.88 + freqRng() * 0.24);

  return { spend, impressions, clicks, conversions, revenue, frequency };
}

// ─── Period Aggregation ───────────────────────────────────────────────────────

interface PeriodAgg {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  avgFrequency: number;
  ctr: number;
  cvr: number;
  roas: number;
  cpa: number;
  cpm: number;
  cpc: number;
}

function aggregatePeriod(channel: ChannelMapping, days: string[], cfg: ChannelAdConfig): PeriodAgg {
  let spend = 0, impressions = 0, clicks = 0, conversions = 0, revenue = 0, freqSum = 0;
  for (const date of days) {
    const d = getChannelDayData(channel, date, cfg);
    spend += d.spend; impressions += d.impressions; clicks += d.clicks;
    conversions += d.conversions; revenue += d.revenue; freqSum += d.frequency;
  }
  const n = days.length || 1;
  return {
    spend, impressions, clicks, conversions, revenue,
    avgFrequency: freqSum / n,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cvr: clicks > 0 ? (conversions / clicks) * 100 : 0,
    roas: spend > 0 ? revenue / spend : 0,
    cpa: conversions > 0 ? spend / conversions : 0,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
  };
}

function applySignalBias(agg: PeriodAgg, bias: SignalBias): PeriodAgg {
  const r = { ...agg };
  if (bias.ctrFactor !== undefined) {
    r.clicks = Math.round(agg.clicks * bias.ctrFactor);
    r.ctr = r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0;
    r.cvr = r.clicks > 0 ? (agg.conversions / r.clicks) * 100 : 0;
    r.cpc = r.clicks > 0 ? agg.spend / r.clicks : 0;
  }
  if (bias.roasFactor !== undefined) {
    r.revenue = agg.revenue * bias.roasFactor;
    r.roas = agg.spend > 0 ? r.revenue / agg.spend : 0;
  }
  if (bias.freqFactor !== undefined) {
    r.avgFrequency = agg.avgFrequency * bias.freqFactor;
  }
  if (bias.cpaMod !== undefined) {
    // Inflate CPA by treating effective conversions as lower
    const effConv = agg.conversions / bias.cpaMod;
    r.cpa = effConv > 0 ? agg.spend / effConv : 0;
  }
  return r;
}

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface AdAttributionParams {
  startDate: string;
  endDate: string;
  selectedStoreIds: string[];  // empty = all stores
  filterChannelIds?: string[]; // if provided, restrict to only these channel IDs
  pricingMode?: PricingMode;
}

export interface AdChannelRow {
  channelId: string;
  channelLabel: string;
  color: string;
  channelFamily: string;
  spend: number;
  revenue: number;
  conversions: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cvr: number;
  roas: number;
  cpa: number;
  cpm: number;
  cpc: number;
  frequency: number;
}

export interface BlendedMetric {
  id: string;
  label: string;
  value: number;
  formatted: string;
  change: number;
  positiveIsUp: boolean;
  description: string;
}

export type SignalType = "ad-fatigue" | "declining-ctr" | "rising-cpa" | "declining-roas";

export interface AdSignal {
  id: string;
  channelId: string;
  channelLabel: string;
  color: string;
  type: SignalType;
  severity: "warning" | "critical";
  issue: string;
  explanation: string;
  recommendation: string;
  currentValue: string;
  priorValue: string;
  changeText: string;
}

export interface FunnelStage {
  name: string;
  value: number;
  formatted: string;
  rate: number | null;      // CTR or CVR %, null for first stage
  dropOff: number;          // % not advancing to this stage (0 for first)
  relativeWidth: number;    // 0–100 for bar visualization
  isLargestDropOff: boolean;
}

export interface ChannelFunnel {
  channelId: string;
  channelLabel: string;
  color: string;
  roas: number;
  revenue: number;
  stages: FunnelStage[];
}

export interface RoasTrendPoint {
  date: string;
  label: string;
  [channelId: string]: number | string;
}

export interface AdvancedRow {
  channelId: string;
  channelLabel: string;
  color: string;
  elasticity: number;
  incrementalLift: number;     // %
  impressionsPerClick: number;
  efficiencyDecay: number;     // %
}

export interface AdAttributionData {
  blendedMetrics: BlendedMetric[];
  channels: AdChannelRow[];         // sorted by revenue desc
  signals: AdSignal[];              // sorted: critical first
  funnels: ChannelFunnel[];         // one per channel
  roasTrend: RoasTrendPoint[];      // sampled for readability
  trendChannelIds: string[];        // top-N channel IDs in trend chart
  advanced: AdvancedRow[];          // sorted by elasticity desc
}

// ─── Builders ─────────────────────────────────────────────────────────────────

function buildChannelRow(channel: ChannelMapping, agg: PeriodAgg): AdChannelRow {
  return {
    channelId: channel.channelId,
    channelLabel: channel.channelLabel,
    color: channel.color,
    channelFamily: channel.channelFamily,
    spend: agg.spend,
    revenue: agg.revenue,
    conversions: agg.conversions,
    impressions: agg.impressions,
    clicks: agg.clicks,
    ctr: agg.ctr,
    cvr: agg.cvr,
    roas: agg.roas,
    cpa: agg.cpa,
    cpm: agg.cpm,
    cpc: agg.cpc,
    frequency: agg.avgFrequency,
  };
}

function buildBlendedMetrics(rows: AdChannelRow[], priorRows: AdChannelRow[]): BlendedMetric[] {
  const sum = (key: keyof AdChannelRow) => rows.reduce((s, r) => s + (r[key] as number), 0);
  const psum = (key: keyof AdChannelRow) => priorRows.reduce((s, r) => s + (r[key] as number), 0);

  const spend = sum("spend"), revenue = sum("revenue");
  const impressions = sum("impressions"), clicks = sum("clicks"), conversions = sum("conversions");
  const priorSpend = psum("spend"), priorRevenue = psum("revenue");
  const priorImpressions = psum("impressions"), priorClicks = psum("clicks"), priorConversions = psum("conversions");

  const roas = spend > 0 ? revenue / spend : 0;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
  const cpc = clicks > 0 ? spend / clicks : 0;
  const convRate = clicks > 0 ? (conversions / clicks) * 100 : 0;

  const priorRoas = priorSpend > 0 ? priorRevenue / priorSpend : 0;
  const priorCtr = priorImpressions > 0 ? (priorClicks / priorImpressions) * 100 : 0;
  const priorCpm = priorImpressions > 0 ? (priorSpend / priorImpressions) * 1000 : 0;
  const priorCpc = priorClicks > 0 ? priorSpend / priorClicks : 0;
  const priorConvRate = priorClicks > 0 ? (priorConversions / priorClicks) * 100 : 0;

  return [
    { id: "spend",     label: "Ad Spend",      value: spend,      formatted: fmtCurrency(spend),             change: pct(spend, priorSpend),         positiveIsUp: false, description: "Total paid media spend across all active channels" },
    { id: "revenue",   label: "Ad Revenue",    value: revenue,    formatted: fmtCurrency(revenue),           change: pct(revenue, priorRevenue),     positiveIsUp: true,  description: "Total attributed revenue from paid advertising" },
    { id: "roas",      label: "Blended ROAS",  value: roas,       formatted: `${roas.toFixed(2)}x`,          change: pct(roas, priorRoas),           positiveIsUp: true,  description: "Blended Return on Ad Spend across all channels" },
    { id: "ctr",       label: "CTR",           value: ctr,        formatted: `${ctr.toFixed(2)}%`,           change: pct(ctr, priorCtr),             positiveIsUp: true,  description: "Click-through rate across all ad impressions" },
    { id: "cpm",       label: "CPM",           value: cpm,        formatted: `$${cpm.toFixed(2)}`,           change: pct(cpm, priorCpm),             positiveIsUp: false, description: "Average cost per 1,000 impressions" },
    { id: "impressions", label: "Impressions", value: impressions, formatted: fmtNumber(impressions),        change: pct(impressions, priorImpressions), positiveIsUp: true, description: "Total ad impressions served across all channels" },
    { id: "cpc",       label: "CPC",           value: cpc,        formatted: `$${cpc.toFixed(2)}`,           change: pct(cpc, priorCpc),             positiveIsUp: false, description: "Average cost per click" },
    { id: "convRate",  label: "Conv. Rate",    value: convRate,   formatted: `${convRate.toFixed(2)}%`,      change: pct(convRate, priorConvRate),   positiveIsUp: true,  description: "Conversions as % of total clicks" },
  ];
}

function buildSignals(
  channels: ChannelMapping[],
  currentAggs: Map<string, PeriodAgg>,
  priorAggs: Map<string, PeriodAgg>,
): AdSignal[] {
  const signals: AdSignal[] = [];

  for (const ch of channels) {
    const cur = currentAggs.get(ch.channelId);
    const prv = priorAggs.get(ch.channelId);
    if (!cur || !prv) continue;

    // ── Ad Fatigue (high frequency) ──────────────────────────────────────────
    if (cur.avgFrequency > 3.5) {
      const sev = cur.avgFrequency > 4.5 ? "critical" : "warning";
      const freqDelta = prv.avgFrequency > 0 ? ((cur.avgFrequency / prv.avgFrequency) - 1) * 100 : 0;
      signals.push({
        id: `${ch.channelId}-fatigue`,
        channelId: ch.channelId, channelLabel: ch.channelLabel, color: ch.color,
        type: "ad-fatigue", severity: sev,
        issue: "Ad Fatigue Detected",
        explanation: `${ch.channelLabel} is averaging ${cur.avgFrequency.toFixed(1)} impressions per user — well above the healthy ceiling of 3.5. Repeated overexposure is eroding audience engagement and driving diminishing returns.`,
        recommendation: "Rotate creative assets immediately, implement frequency caps, or expand audience targeting to reach fresh users and reduce overexposure.",
        currentValue: `${cur.avgFrequency.toFixed(1)}x freq`,
        priorValue: `${prv.avgFrequency.toFixed(1)}x freq`,
        changeText: `+${freqDelta.toFixed(0)}% vs prior period`,
      });
    }

    // ── Declining CTR ─────────────────────────────────────────────────────────
    const ctrChange = prv.ctr > 0 ? (cur.ctr - prv.ctr) / prv.ctr : 0;
    if (ctrChange < -0.10) {
      const sev = ctrChange < -0.20 ? "critical" : "warning";
      signals.push({
        id: `${ch.channelId}-ctr`,
        channelId: ch.channelId, channelLabel: ch.channelLabel, color: ch.color,
        type: "declining-ctr", severity: sev,
        issue: "Declining CTR",
        explanation: `Click-through rate on ${ch.channelLabel} has dropped ${Math.abs(Math.round(ctrChange * 100))}% vs prior period (${prv.ctr.toFixed(2)}% → ${cur.ctr.toFixed(2)}%). Audiences may be ignoring stale creatives or the targeting has drifted toward lower-intent users.`,
        recommendation: "Test fresh ad creatives, update audience segments, and A/B test new messaging angles to reverse the engagement decline.",
        currentValue: `${cur.ctr.toFixed(2)}% CTR`,
        priorValue: `${prv.ctr.toFixed(2)}% CTR`,
        changeText: `${Math.round(ctrChange * 100)}% vs prior period`,
      });
    }

    // ── Rising CPA ────────────────────────────────────────────────────────────
    const cpaChange = prv.cpa > 0 ? (cur.cpa - prv.cpa) / prv.cpa : 0;
    if (cpaChange > 0.15) {
      const sev = cpaChange > 0.30 ? "critical" : "warning";
      signals.push({
        id: `${ch.channelId}-cpa`,
        channelId: ch.channelId, channelLabel: ch.channelLabel, color: ch.color,
        type: "rising-cpa", severity: sev,
        issue: "Rising CPA",
        explanation: `Cost per acquisition on ${ch.channelLabel} has risen ${Math.round(cpaChange * 100)}% from ${fmtCurrency(prv.cpa)} to ${fmtCurrency(cur.cpa)}. Each new conversion is costing significantly more, compressing margin.`,
        recommendation: "Exclude low-intent audience segments, shift budget toward higher-converting ad sets, and audit bidding strategy for inefficiencies.",
        currentValue: `${fmtCurrency(cur.cpa)} CPA`,
        priorValue: `${fmtCurrency(prv.cpa)} CPA`,
        changeText: `+${Math.round(cpaChange * 100)}% vs prior period`,
      });
    }

    // ── Declining ROAS ────────────────────────────────────────────────────────
    const roasChange = prv.roas > 0 ? (cur.roas - prv.roas) / prv.roas : 0;
    if (roasChange < -0.15) {
      const sev = roasChange < -0.25 ? "critical" : "warning";
      signals.push({
        id: `${ch.channelId}-roas`,
        channelId: ch.channelId, channelLabel: ch.channelLabel, color: ch.color,
        type: "declining-roas", severity: sev,
        issue: "Declining ROAS",
        explanation: `Return on ad spend for ${ch.channelLabel} has fallen ${Math.abs(Math.round(roasChange * 100))}% from ${prv.roas.toFixed(1)}x to ${cur.roas.toFixed(1)}x. Revenue efficiency is weakening relative to spend, signaling audience saturation or creative burnout.`,
        recommendation: "Pause underperforming ad sets, reallocate budget to higher-ROAS channels, and review audience overlap and bidding strategy.",
        currentValue: `${cur.roas.toFixed(1)}x ROAS`,
        priorValue: `${prv.roas.toFixed(1)}x ROAS`,
        changeText: `${Math.round(roasChange * 100)}% vs prior period`,
      });
    }
  }

  return signals.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
    return 0;
  });
}

function buildFunnel(channel: ChannelMapping, agg: PeriodAgg): ChannelFunnel {
  const impToClickDrop = 100 - agg.ctr;
  const clickToConvDrop = 100 - agg.cvr;
  const largestIsFirstDrop = impToClickDrop >= clickToConvDrop;

  const stages: FunnelStage[] = [
    {
      name: "Impressions",
      value: agg.impressions,
      formatted: fmtNumber(agg.impressions),
      rate: null,
      dropOff: 0,
      relativeWidth: 100,
      isLargestDropOff: false,
    },
    {
      name: "Clicks",
      value: agg.clicks,
      formatted: fmtNumber(agg.clicks),
      rate: agg.ctr,
      dropOff: impToClickDrop,
      relativeWidth: Math.max((agg.clicks / Math.max(agg.impressions, 1)) * 100, 0.4),
      isLargestDropOff: largestIsFirstDrop,
    },
    {
      name: "Conversions",
      value: agg.conversions,
      formatted: fmtNumber(agg.conversions),
      rate: agg.cvr,
      dropOff: clickToConvDrop,
      relativeWidth: Math.max((agg.conversions / Math.max(agg.impressions, 1)) * 100, 0.05),
      isLargestDropOff: !largestIsFirstDrop,
    },
  ];

  return {
    channelId: channel.channelId,
    channelLabel: channel.channelLabel,
    color: channel.color,
    roas: agg.roas,
    revenue: agg.revenue,
    stages,
  };
}

function buildRoasTrend(
  channels: ChannelMapping[],
  days: string[],
  configMap: Map<string, ChannelAdConfig>,
  topChannelIds: string[],
): RoasTrendPoint[] {
  // Sample to ≤ 30 points for readability
  let sampled = days;
  if (days.length > 30) {
    const step = Math.ceil(days.length / 28);
    sampled = days.filter((_, i) => i % step === 0);
  }

  const topChannels = channels.filter(ch => topChannelIds.includes(ch.channelId));

  return sampled.map(date => {
    const point: RoasTrendPoint = { date, label: fmtAxisDate(date) };
    for (const ch of topChannels) {
      const cfg = configMap.get(ch.channelId);
      if (!cfg) continue;
      const d = getChannelDayData(ch, date, cfg);
      point[ch.channelId] = d.spend > 0 ? parseFloat((d.revenue / d.spend).toFixed(2)) : 0;
    }
    return point;
  });
}

function buildAdvanced(channel: ChannelMapping, agg: PeriodAgg, cfg: ChannelAdConfig): AdvancedRow {
  return {
    channelId: channel.channelId,
    channelLabel: channel.channelLabel,
    color: channel.color,
    elasticity: cfg.elasticity,
    incrementalLift: parseFloat((cfg.incrementalLift * 100).toFixed(1)),
    impressionsPerClick: agg.clicks > 0 ? Math.round(agg.impressions / agg.clicks) : 0,
    efficiencyDecay: parseFloat((cfg.decayRate * 100).toFixed(1)),
  };
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function generateAdAttributionData(params: AdAttributionParams): AdAttributionData {
  const { startDate, endDate, selectedStoreIds, filterChannelIds, pricingMode = "msrp" } = params;
  const wsMultiplier = getBlendedWholesaleMultiplier(selectedStoreIds, pricingMode);
  let channels = getChannelsForStores(selectedStoreIds);

  // Apply channel filter if provided
  if (filterChannelIds && filterChannelIds.length > 0) {
    const filterSet = new Set(filterChannelIds);
    channels = channels.filter(ch => filterSet.has(ch.channelId));
  }

  if (channels.length === 0) {
    return { blendedMetrics: [], channels: [], signals: [], funnels: [], roasTrend: [], trendChannelIds: [], advanced: [] };
  }

  const currentDays = getDaysInRange(startDate, endDate);
  const prior = priorPeriod(startDate, endDate);
  const priorDays = getDaysInRange(prior.start, prior.end);

  const configMap = new Map<string, ChannelAdConfig>(
    channels.map(ch => [ch.channelId, CHANNEL_AD_CONFIG[ch.channelId]]).filter(([, c]) => !!c) as [string, ChannelAdConfig][]
  );

  const currentAggs = new Map<string, PeriodAgg>();
  const priorAggs = new Map<string, PeriodAgg>();

  for (const ch of channels) {
    const cfg = configMap.get(ch.channelId);
    if (!cfg) continue;
    const raw = aggregatePeriod(ch, currentDays, cfg);
    const biased = SIGNAL_BIASES[ch.channelId] ? applySignalBias(raw, SIGNAL_BIASES[ch.channelId]!) : raw;
    biased.revenue *= wsMultiplier;
    biased.roas = biased.spend > 0 ? biased.revenue / biased.spend : 0;
    currentAggs.set(ch.channelId, biased);
    const priorRaw = aggregatePeriod(ch, priorDays, cfg);
    priorRaw.revenue *= wsMultiplier;
    priorRaw.roas = priorRaw.spend > 0 ? priorRaw.revenue / priorRaw.spend : 0;
    priorAggs.set(ch.channelId, priorRaw);
  }

  const channelRows: AdChannelRow[] = channels
    .flatMap(ch => { const a = currentAggs.get(ch.channelId); return a ? [buildChannelRow(ch, a)] : []; })
    .sort((a, b) => b.revenue - a.revenue);

  const priorRows: AdChannelRow[] = channels
    .flatMap(ch => { const a = priorAggs.get(ch.channelId); return a ? [buildChannelRow(ch, a)] : []; });

  // All filtered channels go into the trend — the channel selector is the control point
  const trendChannelIds = channelRows.map(r => r.channelId);

  return {
    blendedMetrics: buildBlendedMetrics(channelRows, priorRows),
    channels: channelRows,
    signals: buildSignals(channels, currentAggs, priorAggs),
    funnels: channels
      .flatMap(ch => { const a = currentAggs.get(ch.channelId); return a ? [buildFunnel(ch, a)] : []; }),
    roasTrend: buildRoasTrend(channels, currentDays, configMap, trendChannelIds),
    trendChannelIds,
    advanced: channels
      .flatMap(ch => {
        const a = currentAggs.get(ch.channelId);
        const cfg = configMap.get(ch.channelId);
        return a && cfg ? [buildAdvanced(ch, a, cfg)] : [];
      })
      .sort((a, b) => b.elasticity - a.elasticity),
  };
}
