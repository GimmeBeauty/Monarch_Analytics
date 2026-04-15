/**
 * Alert Engine — Monarch Performance Alerts
 *
 * Architecture:
 *  1. Mock data generator   – deterministic seeded time-series per metric/channel
 *  2. Aggregation helpers   – sum/avg with optional channel filters
 *  3. Per-type evaluators   – pure functions, one per alert type
 *  4. Scheduler             – shouldRunNow() checks schedule & cooldown
 *  5. Formatter             – notification email body
 *
 * In production: replace getAnalyticsData() with real API calls.
 * The evaluators are data-agnostic and require no changes.
 */

import type { PerformanceAlert, MetricKey, AlertType } from "../context/AlertsContext";

// ─── Metric Format Helpers ────────────────────────────────────────────────────

const METRIC_FORMATS: Record<MetricKey, "currency" | "ratio" | "percent" | "number"> = {
  revenue:        "currency",
  roas:           "ratio",
  mer:            "ratio",
  cpa:            "currency",
  ctr:            "percent",
  impressions:    "number",
  clicks:         "number",
  spend:          "currency",
  sessions:       "number",
  conversionRate: "percent",
};

export function fmtMetric(value: number, metric: MetricKey): string {
  const f = METRIC_FORMATS[metric];
  if (f === "currency") return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (f === "percent")  return `${value.toFixed(2)}%`;
  if (f === "ratio")    return `${value.toFixed(2)}x`;
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

// ─── Mock Data Generator ──────────────────────────────────────────────────────

export interface DataPoint {
  date: string;
  values: Record<MetricKey, number>;
  byChannel: Record<string, Record<MetricKey, number>>;
}

const BASELINES: Record<MetricKey, { base: number; variance: number }> = {
  revenue:        { base: 47_000, variance: 0.18 },
  roas:           { base: 3.4,    variance: 0.22 },
  mer:            { base: 4.2,    variance: 0.15 },
  cpa:            { base: 27,     variance: 0.28 },
  ctr:            { base: 2.6,    variance: 0.30 },
  impressions:    { base: 195_000,variance: 0.20 },
  clicks:         { base: 5_070,  variance: 0.20 },
  spend:          { base: 13_800, variance: 0.12 },
  sessions:       { base: 24_000, variance: 0.16 },
  conversionRate: { base: 1.9,    variance: 0.22 },
};

const CHANNELS = ["Meta", "Google", "TikTok", "Email", "Organic"];
const WEIGHTS   = [0.34,   0.30,    0.15,     0.12,    0.09];

/** Deterministic pseudo-random (sine-seeded) */
function seeded(seed: number): number {
  const x = Math.sin(seed + 1) * 10_000;
  return x - Math.floor(x);
}

function makePoint(dayOffset: number): DataPoint {
  const d = new Date();
  d.setDate(d.getDate() - dayOffset);
  const date    = d.toISOString().slice(0, 10);
  const baseSeed = dayOffset * 137 + 17;
  // Today gets a small live component so repeated tests show slight variation
  const liveJitter = dayOffset === 0 ? (Math.random() - 0.5) * 0.05 : 0;

  const values    = {} as Record<MetricKey, number>;
  const byChannel = {} as Record<string, Record<MetricKey, number>>;

  for (const [key, { base, variance }] of Object.entries(BASELINES) as [MetricKey, typeof BASELINES[MetricKey]][]) {
    const noise = (seeded(baseSeed + key.length * 7) - 0.5) * 2 * variance + liveJitter;
    values[key] = Math.max(0, base * (1 + noise));
  }

  CHANNELS.forEach((ch, i) => {
    byChannel[ch] = {} as Record<MetricKey, number>;
    for (const key of Object.keys(BASELINES) as MetricKey[]) {
      const chNoise = (seeded(baseSeed + ch.charCodeAt(0) + key.length * 3) - 0.5) * 0.35;
      byChannel[ch][key] = Math.max(0, values[key] * WEIGHTS[i] * (1 + chNoise));
    }
  });

  return { date, values, byChannel };
}

/** Returns `days` data points newest-first (index 0 = today) */
export function getAnalyticsData(days = 60): DataPoint[] {
  return Array.from({ length: days }, (_, i) => makePoint(i));
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

const RATIO_METRICS: MetricKey[] = ["roas", "mer", "cpa", "ctr", "conversionRate"];

function aggregate(points: DataPoint[], metric: MetricKey, channels?: string[]): number {
  if (!points.length) return 0;
  const isRatio = RATIO_METRICS.includes(metric);

  const vals = !channels?.length
    ? points.map((p) => p.values[metric])
    : points.map((p) => channels.reduce((s, ch) => s + (p.byChannel[ch]?.[metric] ?? 0), 0));

  return isRatio
    ? vals.reduce((a, b) => a + b, 0) / vals.length
    : vals.reduce((a, b) => a + b, 0);
}

function pct(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

// ─── Evaluation Result ────────────────────────────────────────────────────────

export interface EvaluationResult {
  didTrigger: boolean;
  currentValue: number;
  comparedValue: number | null;
  percentChange: number | null;
  period: string;
  explanation: string;
  channelBreakdown: { channel: string; value: number }[];
}

// ─── Period Helpers ───────────────────────────────────────────────────────────

function periodDays(g: string): number {
  return g === "week" ? 7 : g === "month" ? 30 : 1;
}

function periodLabel(g: string): string {
  return g === "week" ? "this week" : g === "month" ? "this month" : "today";
}

// ─── Per-Type Evaluators ──────────────────────────────────────────────────────

function evalThreshold(
  alert: PerformanceAlert,
  current: number,
): Pick<EvaluationResult, "didTrigger" | "explanation"> {
  const { operator, threshold, metric } = alert;
  const triggered = operator === "above" ? current > threshold : current < threshold;
  const dir = operator === "above" ? "exceeds" : "drops below";
  return {
    didTrigger: triggered,
    explanation: triggered
      ? `${metric.toUpperCase()} is ${fmtMetric(current, metric)} — ${dir} your threshold of ${fmtMetric(threshold, metric)}.`
      : `${metric.toUpperCase()} is ${fmtMetric(current, metric)}, within bounds (threshold: ${fmtMetric(threshold, metric)}).`,
  };
}

function evalChange(
  alert: PerformanceAlert,
  current: number,
  previous: number | null,
): Pick<EvaluationResult, "didTrigger" | "explanation" | "percentChange"> {
  if (previous === null || previous === 0) {
    return { didTrigger: false, explanation: "Insufficient historical data for comparison.", percentChange: null };
  }
  const change = pct(current, previous);
  const { operator, threshold, metric, timeGranularity } = alert;
  const triggered =
    (operator === "increase_pct" && change > threshold) ||
    (operator === "decrease_pct" && change < -threshold);

  return {
    didTrigger: triggered,
    percentChange: change,
    explanation: triggered
      ? `${metric.toUpperCase()} ${change > 0 ? "increased" : "decreased"} ${Math.abs(change).toFixed(1)}% vs the previous ${timeGranularity} — beyond your ±${threshold}% threshold.`
      : `${metric.toUpperCase()} changed ${change > 0 ? "+" : ""}${change.toFixed(1)}% vs the previous ${timeGranularity} (threshold ±${threshold}%).`,
  };
}

function evalEfficiency(
  alert: PerformanceAlert,
  data: DataPoint[],
  channels: string[] | undefined,
): Pick<EvaluationResult, "didTrigger" | "explanation" | "percentChange"> {
  const pd = periodDays(alert.timeGranularity);
  const spendNow  = aggregate(data.slice(0, pd),      "spend",   channels);
  const spendPrev = aggregate(data.slice(pd, pd * 2), "spend",   channels);
  const revNow    = aggregate(data.slice(0, pd),      "revenue", channels);
  const revPrev   = aggregate(data.slice(pd, pd * 2), "revenue", channels);

  if (!spendPrev || !revPrev) {
    return { didTrigger: false, explanation: "Insufficient data for efficiency check.", percentChange: null };
  }
  const spendChg = pct(spendNow, spendPrev);
  const revChg   = pct(revNow, revPrev);
  const triggered = spendChg > alert.threshold && revChg < -5;

  return {
    didTrigger: triggered,
    percentChange: revChg,
    explanation: triggered
      ? `Ad spend +${spendChg.toFixed(1)}% while revenue ${revChg.toFixed(1)}%. Marketing efficiency is deteriorating.`
      : `Spend ${spendChg >= 0 ? "+" : ""}${spendChg.toFixed(1)}% / Revenue ${revChg >= 0 ? "+" : ""}${revChg.toFixed(1)}% — efficiency within range.`,
  };
}

function evalContributionShift(
  alert: PerformanceAlert,
  data: DataPoint[],
  channels: string[] | undefined,
): Pick<EvaluationResult, "didTrigger" | "explanation" | "percentChange"> {
  const pd  = periodDays(alert.timeGranularity);
  const cur = data.slice(0, pd);
  const prv = data.slice(pd, pd * 2);
  if (!prv.length) {
    return { didTrigger: false, explanation: "Insufficient data for contribution shift check.", percentChange: null };
  }
  const totalCur = aggregate(cur, alert.metric, channels) || 1;
  const totalPrv = aggregate(prv, alert.metric, channels) || 1;

  let maxShift = 0;
  let shiftChannel = "";
  for (const ch of CHANNELS) {
    const shareCur = (aggregate(cur, alert.metric, [ch]) / totalCur) * 100;
    const sharePrv = (aggregate(prv, alert.metric, [ch]) / totalPrv) * 100;
    const shift    = Math.abs(shareCur - sharePrv);
    if (shift > maxShift) { maxShift = shift; shiftChannel = ch; }
  }

  const triggered = maxShift > alert.threshold;
  return {
    didTrigger: triggered,
    percentChange: maxShift,
    explanation: triggered
      ? `${shiftChannel}'s share of ${alert.metric.toUpperCase()} shifted ${maxShift.toFixed(1)}pp — exceeds your ${alert.threshold}pp threshold.`
      : `Channel contributions are stable. Largest shift: ${shiftChannel} at ${maxShift.toFixed(1)}pp (threshold ${alert.threshold}pp).`,
  };
}

function evalAnomaly(
  alert: PerformanceAlert,
  data: DataPoint[],
  channels: string[] | undefined,
): Pick<EvaluationResult, "didTrigger" | "explanation" | "percentChange" | "comparedValue"> {
  const pd       = periodDays(alert.timeGranularity);
  const baseline = alert.baselinePeriods || 14;
  const curPts   = data.slice(0, pd);
  const bPts     = data.slice(pd, pd + baseline);

  if (bPts.length < 3) {
    return { didTrigger: false, explanation: "Not enough baseline data for anomaly detection.", percentChange: null, comparedValue: null };
  }
  const current = aggregate(curPts, alert.metric, channels);
  const bVals   = bPts.map((_, i) =>
    aggregate(data.slice(pd + i, pd + i + 1), alert.metric, channels),
  );
  const avg    = bVals.reduce((a, b) => a + b, 0) / bVals.length;
  const stdDev = Math.sqrt(bVals.reduce((s, v) => s + (v - avg) ** 2, 0) / bVals.length);
  const pctDev = avg > 0 ? Math.abs((current - avg) / avg) * 100 : 0;
  const z      = stdDev > 0 ? Math.abs(current - avg) / stdDev : 0;
  const triggered = pctDev > alert.threshold && z > 1.5;

  return {
    didTrigger: triggered,
    comparedValue: avg,
    percentChange: pctDev,
    explanation: triggered
      ? `${alert.metric.toUpperCase()} (${fmtMetric(current, alert.metric)}) is ${pctDev.toFixed(1)}% from the ${baseline}-day baseline of ${fmtMetric(avg, alert.metric)} — anomaly detected (z=${z.toFixed(2)}).`
      : `${alert.metric.toUpperCase()} within normal range — ${pctDev.toFixed(1)}% from ${baseline}-day baseline (z=${z.toFixed(2)}).`,
  };
}

// ─── Main Evaluator ───────────────────────────────────────────────────────────

export function evaluateAlert(alert: PerformanceAlert, data: DataPoint[]): EvaluationResult {
  const pd       = periodDays(alert.timeGranularity);
  const period   = periodLabel(alert.timeGranularity);
  const combined = [...alert.salesChannels, ...alert.trafficChannels];
  const chFilter = combined.length > 0 ? combined : undefined;

  const curPts = data.slice(0, pd);
  const prvPts = data.slice(pd, pd * 2);

  const current  = aggregate(curPts, alert.metric, chFilter);
  const previous = prvPts.length ? aggregate(prvPts, alert.metric, chFilter) : null;

  // Cooldown guard — skip if triggered too recently
  if (alert.lastTriggeredAt) {
    const elapsed = Date.now() - new Date(alert.lastTriggeredAt).getTime();
    if (elapsed < alert.cooldownMinutes * 60_000) {
      const remaining = Math.ceil((alert.cooldownMinutes * 60_000 - elapsed) / 60_000);
      return base(current, previous, period, `In cooldown — ${remaining}m remaining before re-alert.`, []);
    }
  }

  // Zero-volume guard for count metrics
  if (current === 0 && ["impressions", "clicks", "sessions"].includes(alert.metric)) {
    return base(0, previous, period, "No data for this period — skipping to avoid false positive.", []);
  }

  let partial: Partial<EvaluationResult> = {};
  switch (alert.alertType as AlertType) {
    case "threshold":          partial = evalThreshold(alert, current); break;
    case "change":             partial = { ...evalChange(alert, current, previous), comparedValue: previous }; break;
    case "efficiency":         partial = { ...evalEfficiency(alert, data, chFilter), comparedValue: previous }; break;
    case "contribution_shift": partial = { ...evalContributionShift(alert, data, chFilter), comparedValue: previous }; break;
    case "anomaly":            partial = evalAnomaly(alert, data, chFilter); break;
    default:                   partial = { didTrigger: false, explanation: "Unknown alert type." };
  }

  const channelBreakdown = CHANNELS
    .map((ch) => ({ channel: ch, value: aggregate(curPts, alert.metric, [ch]) }))
    .sort((a, b) => b.value - a.value);

  return { ...base(current, previous, period, "", channelBreakdown), ...partial };
}

function base(
  current: number,
  previous: number | null,
  period: string,
  explanation: string,
  channelBreakdown: { channel: string; value: number }[],
): EvaluationResult {
  return { didTrigger: false, currentValue: current, comparedValue: previous, percentChange: null, period, explanation, channelBreakdown };
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

const SCHEDULE_MS: Record<string, number> = {
  hourly: 3_600_000,
  daily:  86_400_000,
  weekly: 604_800_000,
};

export function shouldRunNow(alert: PerformanceAlert): boolean {
  if (alert.status !== "active") return false;
  if (!alert.lastEvaluatedAt) return true;
  return Date.now() - new Date(alert.lastEvaluatedAt).getTime() >= (SCHEDULE_MS[alert.schedule] ?? SCHEDULE_MS.daily);
}

// ─── Notification Formatter ───────────────────────────────────────────────────

export function formatNotificationEmail(alert: PerformanceAlert, result: EvaluationResult): string {
  const sep = "━".repeat(44);
  const rows = [
    sep,
    `🔔  MONARCH ALERT: ${alert.name}`,
    sep,
    "",
    `METRIC       ${alert.metric.toUpperCase()}`,
    `CURRENT      ${fmtMetric(result.currentValue, alert.metric)}`,
    result.comparedValue !== null ? `BASELINE     ${fmtMetric(result.comparedValue, alert.metric)}` : null,
    result.percentChange !== null ? `CHANGE       ${result.percentChange > 0 ? "+" : ""}${result.percentChange.toFixed(1)}%` : null,
    `PERIOD       ${result.period}`,
    "",
    "WHAT HAPPENED",
    result.explanation,
    "",
    "CHANNEL BREAKDOWN",
    ...result.channelBreakdown.slice(0, 5).map(
      (c) => `  ${c.channel.padEnd(14)} ${fmtMetric(c.value, alert.metric)}`,
    ),
    "",
    `Evaluated: ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`,
    `Alert ID:  ${alert.id}`,
    sep,
    "Manage alerts → Monarch Dashboard → Settings → Notifications",
  ];
  return rows.filter((l) => l !== null).join("\n");
}
