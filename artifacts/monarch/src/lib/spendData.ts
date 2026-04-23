/**
 * Spend Optimizer Data Engine — MMM / Incrementality Layer
 *
 * Models each channel using a Hill (diminishing-returns) response function,
 * adstock/carryover effects, and incrementality adjustments.
 *
 * Key math:
 *   Hill function:  f(s) = α · sᵞ / (κᵞ + sᵞ)
 *   Marginal ROAS:  mROAS = ROAS · γ / (1 + rᵞ),  r = s / κ
 *   Adstock:        effectiveSpend = nominalSpend / (1 – decay)
 *
 * All computations are pure — no React dependencies.
 * Replace generateSpendData() with real API calls in production.
 */

import { getChannelsForStores, type ChannelMapping, type ChannelFamily } from "./channelStoreMapping";
import { type PricingMode, getBlendedWholesaleMultiplier } from "./wholesaleData";

export type { ChannelFamily } from "./channelStoreMapping";

// ─── Public Types ─────────────────────────────────────────────────────────────

export type SaturationStatus = "under-invested" | "efficient" | "saturated" | "over-invested";
export type Recommendation   = "increase" | "decrease" | "maintain";
export type Confidence       = "high" | "medium" | "low";
export type InsightType      = "opportunity" | "risk" | "observation" | "model";
export type InsightPriority  = "critical" | "high" | "medium" | "low";

export interface SaturationPoint {
  spend: number;        // nominal spend (x-axis)
  revenue: number;      // projected revenue at that spend
  marginalRoas: number; // marginal ROAS at that spend
  isCurrent: boolean;   // marks the current operating point
}

export interface ChannelMMM {
  channelId: string;
  channelLabel: string;
  color: string;
  /**
   * Reporting family — segmentation layer only.
   * Does NOT change model calculations; only affects aggregation scope.
   * core = off-platform paid media | rmn = Retail Media Networks | experimental = emerging
   */
  channelFamily: ChannelFamily;

  // ── Spend & Revenue ─────────────────────────────────────────────────────────
  spend: number;
  attributedRevenue: number;
  roas: number;
  cpa: number;

  // ── MMM Decomposition ───────────────────────────────────────────────────────
  baseRevenue: number;          // organic floor (independent of this channel's spend)
  incrementalRevenue: number;   // causally driven by this channel's spend
  incrementalContribPct: number; // incrementalRevenue / totalIncrementalRevenue %

  // ── Incrementality ──────────────────────────────────────────────────────────
  iroas: number;
  iroasLow: number;             // 95% CI lower bound
  iroasHigh: number;            // 95% CI upper bound
  pValue: number;
  incrementalConversions: number;
  iCpa: number;                 // incremental cost per acquisition

  // ── Halo ────────────────────────────────────────────────────────────────────
  haloRevenue: number;
  haloChannels: string[];       // downstream channels benefiting from this channel's halo

  // ── Efficiency ──────────────────────────────────────────────────────────────
  merContribPct: number;        // this channel's share of total MER contribution

  // ── Marginal Analysis ───────────────────────────────────────────────────────
  marginalRoas: number;
  marginalLiftAt10pct: number;  // % revenue change if spend +10%

  // ── Saturation ──────────────────────────────────────────────────────────────
  saturationRatio: number;      // current effective spend / half-saturation spend
  saturationStatus: SaturationStatus;
  saturationLevelPct: number;   // 0–100: how full the response curve is (= rᵞ/(1+rᵞ) × 100)
  saturationCurve: SaturationPoint[];

  // ── Adstock ─────────────────────────────────────────────────────────────────
  adstockDecay: number;         // per-week carryover decay
  peakLagDays: number;          // days to peak effect
  effectiveSpend: number;       // nominal spend × 1/(1-decay)

  // ── Model Quality ───────────────────────────────────────────────────────────
  rSquared: number;
  mape: number;
  confidence: Confidence;

  // ── Recommendation ──────────────────────────────────────────────────────────
  recommendedSpend: number;
  recommendation: Recommendation;
  recommendationReason: string;
  expectedRevenueDelta: number;
  expectedEfficiencyDelta: number; // marginalROAS change

  // ── Hill Params (for scenario simulation) ───────────────────────────────────
  hillAlpha: number;
  hillGamma: number;
  hillKappa: number;  // in effective-spend space
}

export interface SpendInsight {
  id: string;
  type: InsightType;
  priority: InsightPriority;
  title: string;
  body: string;
  impact: string;
  confidence: Confidence;
  channelId?: string;
  channelLabel?: string;
  actionLabel: string;
}

export interface SpendSummary {
  totalSpend: number;
  totalAttributedRevenue: number;
  totalBaseRevenue: number;
  totalIncrementalRevenue: number;
  blendedRoas: number;
  blendedIroas: number;
  overallMer: number;
  recommendedTotalSpend: number;
  projectedRevenue: number;
  reallocationUpside: number;
  modelRSquared: number;
  modelMape: number;
}

export interface ScenarioResult {
  totalSpend: number;
  totalRevenue: number;
  incrementalRevenue: number;
  baseRevenue: number;
  mer: number;
  roas: number;
  iroas: number;
  revenueDelta: number;
  merDelta: number;
  channelRevenues: Record<string, number>;
}

export interface SpendData {
  channels: ChannelMMM[];
  summary: SpendSummary;
  insights: SpendInsight[];
  /** Pure simulation function — usable in React useMemo without re-running generateSpendData */
  simulate: (multipliers: Record<string, number>) => ScenarioResult;
  totalBaseRevenue: number; // organic revenue independent of all channels
}

export interface SpendParams {
  startDate: string;
  endDate: string;
  selectedStoreIds: string[];
  pricingMode?: PricingMode;
  /** If provided, use real spend per channel (from Snowflake) instead of dailySpendBaseline */
  realSpendByChannel?: Record<string, number>;
  /** If provided, use real conversion value per channel instead of spend × baseRoas */
  conversionValueByChannel?: Record<string, number>;
}

// ─── Per-channel MMM Configuration ───────────────────────────────────────────
// These parameters encode the marketing science model for each channel.
// In production these would be calibrated from historical A/B tests and MMM.

interface MMMConfig {
  /** Hill exponent γ: 1=linear, 2+=concave diminishing returns */
  gamma: number;
  /** r = currentSpend / halfSaturation — position on the response curve */
  saturationRatio: number;
  /** Fraction of attributed revenue that is truly incremental (iROAS = ROAS × this) */
  incrementalityFactor: number;
  /** Geometric decay per week (0=no carry, 0.5=50% carry each week) */
  adstockDecay: number;
  /** Days until the spend has peak impact */
  peakLagDays: number;
  /** Estimated halo revenue as a fraction of direct incremental revenue */
  haloFactor: number;
  /** Channel IDs that benefit from this channel's awareness halo */
  haloChannels: string[];
  /** Model R-squared */
  rSquared: number;
  /** Mean Absolute Percentage Error */
  mape: number;
  /** P-value for incrementality estimate */
  pValue: number;
}

const MMM_CONFIGS: Record<string, MMMConfig> = {
  "meta-ads": {
    gamma: 2.1, saturationRatio: 1.38,
    incrementalityFactor: 0.52,
    adstockDecay: 0.38, peakLagDays: 2,
    haloFactor: 0.06, haloChannels: ["google-ads"],
    rSquared: 0.87, mape: 0.092, pValue: 0.003,
  },
  "google-ads": {
    gamma: 1.8, saturationRatio: 0.62,
    incrementalityFactor: 0.81,
    adstockDecay: 0.18, peakLagDays: 1,
    haloFactor: 0.02, haloChannels: [],
    rSquared: 0.92, mape: 0.068, pValue: 0.001,
  },
  "tiktok-ads": {
    gamma: 1.5, saturationRatio: 0.38,
    incrementalityFactor: 0.74,
    adstockDecay: 0.28, peakLagDays: 3,
    haloFactor: 0.04, haloChannels: ["meta-ads"],
    rSquared: 0.73, mape: 0.142, pValue: 0.04,
  },
  "pinterest-ads": {
    gamma: 1.7, saturationRatio: 0.58,
    incrementalityFactor: 0.67,
    adstockDecay: 0.25, peakLagDays: 2,
    haloFactor: 0.03, haloChannels: [],
    rSquared: 0.79, mape: 0.118, pValue: 0.02,
  },
  "applovin-axon": {
    gamma: 2.3, saturationRatio: 1.05,
    incrementalityFactor: 0.45,
    adstockDecay: 0.20, peakLagDays: 1,
    haloFactor: 0.01, haloChannels: [],
    rSquared: 0.75, mape: 0.138, pValue: 0.06,
  },
  "amazon-ads": {
    gamma: 1.6, saturationRatio: 0.82,
    incrementalityFactor: 0.87,
    adstockDecay: 0.15, peakLagDays: 1,
    haloFactor: 0.09, haloChannels: ["pattern-predict"],
    rSquared: 0.93, mape: 0.058, pValue: 0.001,
  },
  "pattern-predict": {
    gamma: 1.5, saturationRatio: 0.71,
    incrementalityFactor: 0.80,
    adstockDecay: 0.12, peakLagDays: 2,
    haloFactor: 0.05, haloChannels: [],
    rSquared: 0.85, mape: 0.089, pValue: 0.005,
  },
  "walmart-connect": {
    gamma: 1.7, saturationRatio: 0.76,
    incrementalityFactor: 0.74,
    adstockDecay: 0.22, peakLagDays: 2,
    haloFactor: 0.03, haloChannels: [],
    rSquared: 0.82, mape: 0.105, pValue: 0.008,
  },
  "target-roundel": {
    gamma: 1.8, saturationRatio: 0.81,
    incrementalityFactor: 0.77,
    adstockDecay: 0.19, peakLagDays: 2,
    haloFactor: 0.04, haloChannels: [],
    rSquared: 0.83, mape: 0.098, pValue: 0.006,
  },
  "criteo": {
    gamma: 2.0, saturationRatio: 1.12,
    incrementalityFactor: 0.56,
    adstockDecay: 0.18, peakLagDays: 1,
    haloFactor: 0.02, haloChannels: [],
    rSquared: 0.80, mape: 0.112, pValue: 0.015,
  },
  "ctv-programmatic": {
    gamma: 1.3, saturationRatio: 0.28,
    incrementalityFactor: 0.62,
    adstockDecay: 0.45, peakLagDays: 7,
    haloFactor: 0.12, haloChannels: ["google-ads", "amazon-ads"],
    rSquared: 0.65, mape: 0.182, pValue: 0.12,
  },
};

const DEFAULT_MMM_CONFIG: MMMConfig = {
  gamma: 1.8, saturationRatio: 0.75,
  incrementalityFactor: 0.70,
  adstockDecay: 0.22, peakLagDays: 2,
  haloFactor: 0.03, haloChannels: [],
  rSquared: 0.78, mape: 0.120, pValue: 0.02,
};

// ─── Hill Function Math ───────────────────────────────────────────────────────

function hillResponse(spend: number, alpha: number, gamma: number, kappa: number): number {
  if (spend <= 0) return 0;
  const sg = Math.pow(spend, gamma);
  const kg = Math.pow(kappa, gamma);
  return alpha * sg / (kg + sg);
}

/** Marginal ROAS at a given point: f'(s) expressed per $ of nominal spend */
function marginalRoasAt(nominalSpend: number, baseRoas: number, gamma: number, satRatio: number): number {
  // mROAS = ROAS × γ / (1 + rᵞ)
  const rGamma = Math.pow(satRatio, gamma);
  return baseRoas * gamma / (1 + rGamma);
}

// ─── Date Utilities ───────────────────────────────────────────────────────────

function getDayCount(start: string, end: string): number {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1);
}

function periodTrendFactor(start: string): number {
  const base = new Date("2024-01-01").getTime();
  const elapsed = (new Date(start + "T00:00:00").getTime() - base) / (365.25 * 86_400_000);
  return 1 + elapsed * 0.18; // ~18%/yr growth
}

// ─── Formatting Helpers ───────────────────────────────────────────────────────

function fmtCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v).toLocaleString()}`;
}

function fmtPct(v: number, decimals = 1): string {
  return `${v.toFixed(decimals)}%`;
}

// ─── Saturation Classification ────────────────────────────────────────────────

function classifySaturation(r: number): SaturationStatus {
  if (r < 0.50)  return "under-invested";
  if (r < 0.95)  return "efficient";
  if (r < 1.30)  return "saturated";
  return "over-invested";
}

function saturationLevelPct(r: number, gamma: number): number {
  const rg = Math.pow(r, gamma);
  return (rg / (1 + rg)) * 100;
}

// ─── Recommendation Logic ─────────────────────────────────────────────────────

function buildRecommendation(
  status: SaturationStatus,
  cfg: MMMConfig,
  mRoas: number,
  blendedMRoas: number,
  iRoas: number,
): { action: Recommendation; reason: string; adjustFactor: number } {
  switch (status) {
    case "over-invested":
      return {
        action: "decrease",
        reason: `Marginal ROAS (${mRoas.toFixed(2)}x) is well below blended (${blendedMRoas.toFixed(2)}x). The channel is deeply saturated — each incremental dollar is returning diminishing value. Reallocate to higher-efficiency channels.`,
        adjustFactor: 0.68,
      };
    case "saturated":
      return {
        action: "decrease",
        reason: `Saturation ratio of ${(cfg.saturationRatio * 100).toFixed(0)}% signals diminishing returns. Marginal ROAS (${mRoas.toFixed(2)}x) is below the blended benchmark. A modest reduction will improve portfolio efficiency.`,
        adjustFactor: 0.85,
      };
    case "efficient":
      if (mRoas > blendedMRoas * 1.25) {
        return {
          action: "increase",
          reason: `Strong marginal ROAS (${mRoas.toFixed(2)}x) above blended benchmark (${blendedMRoas.toFixed(2)}x). iROAS of ${iRoas.toFixed(2)}x confirms true incremental value. The channel has headroom before saturation.`,
          adjustFactor: 1.18,
        };
      }
      return {
        action: "maintain",
        reason: `Channel is operating efficiently near optimal spend. Marginal ROAS (${mRoas.toFixed(2)}x) aligns with blended benchmark. Hold allocation and monitor for shifts.`,
        adjustFactor: 1.00,
      };
    case "under-invested":
      return {
        action: "increase",
        reason: `Spend is at only ${(cfg.saturationRatio * 100).toFixed(0)}% of the half-saturation point. Marginal ROAS (${mRoas.toFixed(2)}x) substantially exceeds blended. Significant untapped incremental revenue available.`,
        adjustFactor: cfg.saturationRatio < 0.35 ? 1.45 : 1.28,
      };
  }
}

// ─── Saturation Curve Generator ───────────────────────────────────────────────

function buildSaturationCurve(
  nominalSpend: number,
  hillAlpha: number,
  hillGamma: number,
  hillKappa: number,
  adstockDecay: number,
  baseRoas: number,
  saturationRatio: number,
  numPoints = 30,
): SaturationPoint[] {
  const maxNominal = nominalSpend * 2.5;
  return Array.from({ length: numPoints }, (_, i) => {
    const s = (maxNominal / (numPoints - 1)) * i;
    const effectiveS = s / (1 - adstockDecay);
    const revenue = hillResponse(effectiveS, hillAlpha, hillGamma, hillKappa);
    const rAtS = effectiveS / hillKappa;
    const mRoas = baseRoas * hillGamma / (1 + Math.pow(rAtS, hillGamma));
    return {
      spend: s,
      revenue,
      marginalRoas: mRoas,
      isCurrent: i === Math.round(numPoints / 2.5), // approximate current point
    };
  });
}

// ─── Insight Generator ────────────────────────────────────────────────────────

function buildInsights(channels: ChannelMMM[], summary: SpendSummary): SpendInsight[] {
  const insights: SpendInsight[] = [];

  // Sort channels for insight priority
  const saturated = channels
    .filter((c) => c.saturationStatus === "saturated" || c.saturationStatus === "over-invested")
    .sort((a, b) => b.spend - a.spend);

  const underInvested = channels
    .filter((c) => c.saturationStatus === "under-invested")
    .sort((a, b) => b.iroas - a.iroas);

  const highIncr = channels
    .filter((c) => c.iroas > 3.5 && c.saturationStatus !== "over-invested")
    .sort((a, b) => b.iroas - a.iroas);

  const haloChannels = channels.filter((c) => c.haloRevenue > 0).sort((a, b) => b.haloRevenue - a.haloRevenue);
  const lowConfidence = channels.filter((c) => c.confidence === "low");

  // 1. Reallocation upside (always show if meaningful)
  if (summary.reallocationUpside > 0) {
    insights.push({
      id: "reallocation",
      type: "opportunity",
      priority: "critical",
      title: `Budget reallocation could unlock ${fmtCurrency(summary.reallocationUpside)} in revenue`,
      body: `Current allocation leaves significant efficiency on the table. Shifting budget from saturated channels (${saturated.map((c) => c.channelLabel).slice(0, 2).join(", ")}) toward under-invested channels (${underInvested.map((c) => c.channelLabel).slice(0, 2).join(", ")}) is projected to improve blended iROAS.`,
      impact: `+${fmtCurrency(summary.reallocationUpside)} projected revenue at equal spend`,
      confidence: "medium",
      actionLabel: "Apply recommendations",
    });
  }

  // 2. Most saturated channel
  if (saturated.length > 0) {
    const ch = saturated[0];
    insights.push({
      id: `saturated-${ch.channelId}`,
      type: "risk",
      priority: ch.saturationStatus === "over-invested" ? "critical" : "high",
      title: `${ch.channelLabel} is ${ch.saturationStatus === "over-invested" ? "over-invested" : "saturated"} with declining marginal returns`,
      body: `Marginal ROAS has fallen to ${ch.marginalRoas.toFixed(2)}x — below the blended benchmark of ${summary.blendedRoas.toFixed(2)}x. The channel is at ${ch.saturationLevelPct.toFixed(0)}% of its response curve capacity. Each additional dollar is generating less than optimal return.`,
      impact: `Reducing to recommended spend frees ${fmtCurrency(ch.spend - ch.recommendedSpend)} for reallocation`,
      confidence: ch.confidence,
      channelId: ch.channelId,
      channelLabel: ch.channelLabel,
      actionLabel: `Reduce ${ch.channelLabel}`,
    });
  }

  // 3. Best incremental opportunity
  if (underInvested.length > 0) {
    const ch = underInvested[0];
    insights.push({
      id: `opportunity-${ch.channelId}`,
      type: "opportunity",
      priority: "high",
      title: `${ch.channelLabel} shows strong incrementality with room to scale`,
      body: `iROAS of ${ch.iroas.toFixed(2)}x (CI: ${ch.iroasLow.toFixed(2)}–${ch.iroasHigh.toFixed(2)}x, p=${ch.pValue.toFixed(3)}) indicates genuine incremental value. Channel is operating at only ${(ch.saturationRatio * 100).toFixed(0)}% of half-saturation — the response curve is still steep here.`,
      impact: `Increasing to recommended spend projects +${fmtCurrency(ch.expectedRevenueDelta)} in incremental revenue`,
      confidence: ch.confidence,
      channelId: ch.channelId,
      channelLabel: ch.channelLabel,
      actionLabel: `Scale ${ch.channelLabel}`,
    });
  }

  // 4. Halo effect observation
  if (haloChannels.length > 0) {
    const ch = haloChannels[0];
    const beneficiaries = ch.haloChannels.map((id) => channels.find((c) => c.channelId === id)?.channelLabel ?? id).join(", ");
    insights.push({
      id: `halo-${ch.channelId}`,
      type: "observation",
      priority: "medium",
      title: `${ch.channelLabel} generates measurable halo effects across channels`,
      body: `Model estimates ${fmtCurrency(ch.haloRevenue)} in indirect revenue attributable to ${ch.channelLabel}'s awareness impact. Downstream channels benefiting: ${beneficiaries || "cross-channel lift"}. Standard last-click attribution understates this channel's true contribution.`,
      impact: `${fmtCurrency(ch.haloRevenue)} in halo revenue not captured by direct attribution`,
      confidence: ch.confidence,
      channelId: ch.channelId,
      channelLabel: ch.channelLabel,
      actionLabel: "View attribution breakdown",
    });
  }

  // 5. High iROAS channel to watch
  if (highIncr.length > 0 && highIncr[0].channelId !== underInvested[0]?.channelId) {
    const ch = highIncr[0];
    insights.push({
      id: `high-iroas-${ch.channelId}`,
      type: "opportunity",
      priority: "medium",
      title: `${ch.channelLabel} has the highest verified incremental ROAS in the portfolio`,
      body: `iROAS of ${ch.iroas.toFixed(2)}x with ${ch.confidence} statistical confidence (p=${ch.pValue.toFixed(3)}). The gap between reported ROAS (${ch.roas.toFixed(2)}x) and iROAS reflects an incrementality factor of ${((ch.iroas / ch.roas) * 100).toFixed(0)}%.`,
      impact: `${((ch.iroas / ch.roas) * 100).toFixed(0)}% of attributed revenue is genuinely incremental`,
      confidence: ch.confidence,
      channelId: ch.channelId,
      channelLabel: ch.channelLabel,
      actionLabel: "Deep dive",
    });
  }

  // 6. Model quality warning
  if (lowConfidence.length > 0) {
    insights.push({
      id: "model-quality",
      type: "model",
      priority: "low",
      title: `${lowConfidence.length} channel${lowConfidence.length > 1 ? "s" : ""} have limited model confidence`,
      body: `${lowConfidence.map((c) => c.channelLabel).join(", ")} show high MAPE or insufficient data for reliable MMM calibration. Treat recommendations for these channels as directional, not prescriptive. Increasing data coverage will improve model accuracy.`,
      impact: "Directional guidance only — p-values above 0.05 threshold",
      confidence: "low",
      actionLabel: "Review data coverage",
    });
  }

  return insights.slice(0, 5); // surface top 5
}

// ─── Scenario Simulation Closure ─────────────────────────────────────────────

function buildSimulator(
  channels: ChannelMMM[],
  totalBaseRevenue: number,
  currentTotalRevenue: number,
  currentMer: number,
) {
  return function simulate(multipliers: Record<string, number>): ScenarioResult {
    let totalSpend = 0;
    let totalRevenue = totalBaseRevenue;
    let totalIncremental = 0;
    const channelRevenues: Record<string, number> = {};

    for (const ch of channels) {
      const mult = multipliers[ch.channelId] ?? 1.0;
      const newNominalSpend = ch.spend * mult;
      const newEffectiveSpend = newNominalSpend / (1 - ch.adstockDecay);
      const newRevenue = hillResponse(newEffectiveSpend, ch.hillAlpha, ch.hillGamma, ch.hillKappa);
      // Derive incrementality factor from stored decomposition
      const incrFactor = ch.attributedRevenue > 0 ? ch.incrementalRevenue / ch.attributedRevenue : 0;
      const newIncremental = newRevenue * incrFactor;

      totalSpend += newNominalSpend;
      totalRevenue += newRevenue;
      totalIncremental += newIncremental;
      channelRevenues[ch.channelId] = newRevenue;
    }

    const mer = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    const iroas = totalSpend > 0 ? totalIncremental / totalSpend : 0;

    return {
      totalSpend,
      totalRevenue,
      incrementalRevenue: totalIncremental,
      baseRevenue: totalBaseRevenue,
      mer,
      roas,
      iroas,
      revenueDelta: totalRevenue - currentTotalRevenue,
      merDelta: mer - currentMer,
      channelRevenues,
    };
  };
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function generateSpendData(params: SpendParams): SpendData {
  const { startDate, endDate, selectedStoreIds, pricingMode = "msrp", realSpendByChannel, conversionValueByChannel } = params;
  const dayCount = getDayCount(startDate, endDate);
  const trend = periodTrendFactor(startDate);
  const channels = getChannelsForStores(selectedStoreIds);
  const wsMultiplier = getBlendedWholesaleMultiplier(selectedStoreIds, pricingMode);

  // ── Step 1: Compute raw spend per channel ──────────────────────────────────
  // When realSpendByChannel is provided, only include channels that have actual
  // spend — zero-spend entries cause alpha=NaN in the Hill calibration (0*(0+0)/0)
  // which can corrupt array sorting and silently drop channels from the chart.
  const channelSpends = channels
    .map((ch) => ({
      ch,
      nominalSpend:
        realSpendByChannel !== undefined
          ? (realSpendByChannel[ch.channelId] ?? 0)
          : ch.dailySpendBaseline * dayCount * trend,
    }))
    .filter(({ nominalSpend }) =>
      realSpendByChannel !== undefined ? nominalSpend > 0 : true
    );

  // ── Step 2: Compute Hill params and all metrics per channel ────────────────
  const totalChannelSpend = channelSpends.reduce((s, x) => s + x.nominalSpend, 0);

  // First pass: compute basic values and marginal ROAS to get blended
  const firstPass = channelSpends.map(({ ch, nominalSpend }) => {
    const cfg = MMM_CONFIGS[ch.channelId] ?? DEFAULT_MMM_CONFIG;
    const { gamma, saturationRatio } = cfg;

    const effectiveSpend = nominalSpend / (1 - cfg.adstockDecay);
    const attributedRevenue = (conversionValueByChannel && conversionValueByChannel[ch.channelId] != null)
      ? conversionValueByChannel[ch.channelId]
      : nominalSpend * ch.baseRoas * wsMultiplier;

    // Calibrate Hill: α so that f(effectiveSpend) = attributedRevenue
    const kappa = effectiveSpend / saturationRatio;
    const sg = Math.pow(effectiveSpend, gamma);
    const kg = Math.pow(kappa, gamma);
    const alpha = attributedRevenue * (kg + sg) / sg;

    const mRoas = marginalRoasAt(nominalSpend, ch.baseRoas, gamma, saturationRatio);
    return { ch, cfg, nominalSpend, effectiveSpend, attributedRevenue, alpha, kappa, mRoas };
  });

  const totalAttributedRevenue = firstPass.reduce((s, x) => s + x.attributedRevenue, 0);
  const blendedRoas = totalChannelSpend > 0 ? totalAttributedRevenue / totalChannelSpend : 0;
  const blendedMRoas = firstPass.reduce((s, x) => s + x.mRoas * (x.nominalSpend / totalChannelSpend), 0);

  // Total incremental revenue (for contribution %)
  const totalIncremental = firstPass.reduce((s, x) => s + x.attributedRevenue * x.cfg.incrementalityFactor, 0);

  // Organic floor independent of all channels
  const ORGANIC_REVENUE_FACTOR = 0.35;
  const totalBaseRevenue = totalAttributedRevenue * ORGANIC_REVENUE_FACTOR;
  const currentTotalRevenue = totalAttributedRevenue + totalBaseRevenue;
  const currentMer = totalChannelSpend > 0 ? currentTotalRevenue / totalChannelSpend : 0;

  // ── Step 3: Build ChannelMMM array ─────────────────────────────────────────
  const channelMmms: ChannelMMM[] = firstPass.map(
    ({ ch, cfg, nominalSpend, effectiveSpend, attributedRevenue, alpha, kappa, mRoas }) => {
      const { gamma, saturationRatio, incrementalityFactor, adstockDecay, peakLagDays } = cfg;

      const status = classifySaturation(saturationRatio);
      const { action, reason, adjustFactor } = buildRecommendation(
        status, cfg, mRoas, blendedMRoas, ch.baseRoas * incrementalityFactor
      );

      const recommendedSpend = nominalSpend * adjustFactor;
      const recEffective = recommendedSpend / (1 - adstockDecay);
      const recRevenue = hillResponse(recEffective, alpha, gamma, kappa);
      const expectedRevenueDelta = recRevenue - attributedRevenue;

      const incrementalRevenue = attributedRevenue * incrementalityFactor;
      const iroas = ch.baseRoas * incrementalityFactor;

      // 95% CI on iROAS — wider for low confidence
      const ciHalf = cfg.pValue < 0.01 ? 0.15 : cfg.pValue < 0.05 ? 0.28 : 0.50;
      const iroasLow  = iroas * (1 - ciHalf);
      const iroasHigh = iroas * (1 + ciHalf);

      const haloRevenue = incrementalRevenue * cfg.haloFactor;

      // Marginal lift: % revenue change if spend +10%
      const spend110pct = nominalSpend * 1.10;
      const eff110 = spend110pct / (1 - adstockDecay);
      const rev110 = hillResponse(eff110, alpha, gamma, kappa);
      const marginalLiftAt10pct = attributedRevenue > 0
        ? ((rev110 - attributedRevenue) / attributedRevenue) * 100
        : 0;

      const confidence: Confidence =
        cfg.rSquared > 0.85 && cfg.pValue < 0.01 ? "high" :
        cfg.rSquared > 0.75 && cfg.pValue < 0.05 ? "medium" : "low";

      const orders = Math.round(attributedRevenue / 85); // ~$85 AOV assumption
      const cpa = orders > 0 ? nominalSpend / orders : 0;
      const iCpa = orders * incrementalityFactor > 0 ? nominalSpend / (orders * incrementalityFactor) : 0;

      const curve = buildSaturationCurve(
        nominalSpend, alpha, gamma, kappa, adstockDecay, ch.baseRoas, saturationRatio
      );
      // Mark the actual current point in the curve
      const currentIdx = curve.findIndex((p, i) => i > 0 && curve[i - 1].spend <= nominalSpend && p.spend >= nominalSpend);
      if (currentIdx >= 0) curve[currentIdx] = { ...curve[currentIdx], isCurrent: true };

      return {
        channelId: ch.channelId,
        channelLabel: ch.channelLabel,
        color: ch.color,
        channelFamily: ch.channelFamily,

        spend: nominalSpend,
        attributedRevenue,
        roas: ch.baseRoas,
        cpa,

        baseRevenue: attributedRevenue * (1 - incrementalityFactor),
        incrementalRevenue,
        incrementalContribPct: totalIncremental > 0 ? (incrementalRevenue / totalIncremental) * 100 : 0,

        iroas,
        iroasLow,
        iroasHigh,
        pValue: cfg.pValue,
        incrementalConversions: Math.round(orders * incrementalityFactor),
        iCpa,

        haloRevenue,
        haloChannels: cfg.haloChannels,

        merContribPct: totalAttributedRevenue > 0 ? (attributedRevenue / totalAttributedRevenue) * 100 : 0,

        marginalRoas: mRoas,
        marginalLiftAt10pct,

        saturationRatio,
        saturationStatus: status,
        saturationLevelPct: saturationLevelPct(saturationRatio, gamma),
        saturationCurve: curve,

        adstockDecay,
        peakLagDays,
        effectiveSpend,

        rSquared: cfg.rSquared,
        mape: cfg.mape,
        confidence,

        recommendedSpend,
        recommendation: action,
        recommendationReason: reason,
        expectedRevenueDelta,
        expectedEfficiencyDelta: mRoas - blendedMRoas,

        hillAlpha: alpha,
        hillGamma: gamma,
        hillKappa: kappa,
      } satisfies ChannelMMM;
    }
  );

  // ── Step 4: Compute summary ────────────────────────────────────────────────
  const blendedIroas = totalChannelSpend > 0 ? totalIncremental / totalChannelSpend : 0;
  const recTotal = channelMmms.reduce((s, c) => s + c.recommendedSpend, 0);
  const projectedRevenue = channelMmms.reduce((s, c) => {
    const recEff = c.recommendedSpend / (1 - c.adstockDecay);
    return s + hillResponse(recEff, c.hillAlpha, c.hillGamma, c.hillKappa);
  }, 0) + totalBaseRevenue;
  const reallocationUpside = Math.max(0, projectedRevenue - currentTotalRevenue);

  const weightedRSq = channelMmms.reduce((s, c) => s + c.rSquared * c.spend, 0) / totalChannelSpend;
  const weightedMape = channelMmms.reduce((s, c) => s + c.mape * c.spend, 0) / totalChannelSpend;

  const summary: SpendSummary = {
    totalSpend: totalChannelSpend,
    totalAttributedRevenue,
    totalBaseRevenue,
    totalIncrementalRevenue: totalIncremental,
    blendedRoas,
    blendedIroas,
    overallMer: currentMer,
    recommendedTotalSpend: recTotal,
    projectedRevenue,
    reallocationUpside,
    modelRSquared: weightedRSq,
    modelMape: weightedMape,
  };

  // ── Step 5: Insights ──────────────────────────────────────────────────────
  const insights = buildInsights(channelMmms, summary);

  // ── Step 6: Simulator closure ─────────────────────────────────────────────
  const simulate = buildSimulator(channelMmms, totalBaseRevenue, currentTotalRevenue, currentMer);

  return { channels: channelMmms, summary, insights, simulate, totalBaseRevenue };
}

// ─── Aggregation Helper (reporting layer only) ────────────────────────────────

/**
 * Recomputes SpendSummary for an arbitrary subset of channels.
 *
 * Call this whenever the channel family filter or view mode changes.
 * The underlying channel metrics (ROAS, iROAS, mROAS, etc.) are UNCHANGED —
 * only the aggregated totals and portfolio-level ratios update.
 *
 * @param channels   The filtered channel set to aggregate
 * @param totalBase  Organic base revenue (not attributed to any channel)
 */
export function aggregateChannels(channels: ChannelMMM[], totalBase: number): SpendSummary {
  if (channels.length === 0) {
    return {
      totalSpend: 0, totalAttributedRevenue: 0, totalBaseRevenue: totalBase,
      totalIncrementalRevenue: 0, blendedRoas: 0, blendedIroas: 0, overallMer: 0,
      recommendedTotalSpend: 0, projectedRevenue: totalBase,
      reallocationUpside: 0, modelRSquared: 0, modelMape: 0,
    };
  }

  const totalSpend     = channels.reduce((s, c) => s + c.spend, 0);
  const totalRev       = channels.reduce((s, c) => s + c.attributedRevenue, 0);
  const totalIncr      = channels.reduce((s, c) => s + c.incrementalRevenue, 0);
  const recSpend       = channels.reduce((s, c) => s + c.recommendedSpend, 0);
  // projectedRevenue uses stored expectedRevenueDelta (pre-computed from Hill function)
  const projRev        = channels.reduce((s, c) => s + c.attributedRevenue + c.expectedRevenueDelta, 0) + totalBase;
  const fullRevenue    = totalRev + totalBase;
  const reallocationUpside = Math.max(0, projRev - fullRevenue);

  const weightedRSq    = totalSpend > 0 ? channels.reduce((s, c) => s + c.rSquared * c.spend, 0) / totalSpend : 0;
  const weightedMape   = totalSpend > 0 ? channels.reduce((s, c) => s + c.mape * c.spend, 0) / totalSpend : 0;

  return {
    totalSpend,
    totalAttributedRevenue: totalRev,
    totalBaseRevenue: totalBase,
    totalIncrementalRevenue: totalIncr,
    blendedRoas:  totalSpend > 0 ? totalRev / totalSpend : 0,
    blendedIroas: totalSpend > 0 ? totalIncr / totalSpend : 0,
    overallMer:   totalSpend > 0 ? fullRevenue / totalSpend : 0,
    recommendedTotalSpend: recSpend,
    projectedRevenue: projRev,
    reallocationUpside,
    modelRSquared: weightedRSq,
    modelMape: weightedMape,
  };
}

// ─── Real-data entrypoint (used by the Spend page) ────────────────────────────
// Requires actual spend per channel from Snowflake; does not fall back to the
// deterministic PRNG baseline model.

export interface RealSpendParams {
  startDate: string;
  endDate: string;
  selectedStoreIds: string[];
  pricingMode?: PricingMode;
  realSpendByChannel: Record<string, number>; // required — not optional
  conversionValueByChannel?: Record<string, number>;
}

/**
 * Build spend analytics from real Snowflake data.
 * Returns null when there is no real spend to display (empty state).
 * Never falls back to the deterministic baseline model.
 */
export function buildSpendData(params: RealSpendParams): SpendData | null {
  const hasData = Object.values(params.realSpendByChannel).some(v => v > 0);
  if (!hasData) return null;
  return generateSpendData({ ...params });
}
