/**
 * Scenario Simulator
 * Interactive spend allocation tool with Hill-function projections.
 * All projections use the same response curves as the MMM model.
 */
import { useState, useMemo, useCallback } from "react";
import { RotateCcw, Lock, Unlock, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { ChannelMMM, SpendSummary, ScenarioResult } from "@/lib/spendData";

// Inline Hill response — same formula as the MMM engine
function hillResponse(spend: number, alpha: number, gamma: number, kappa: number): number {
  if (spend <= 0) return 0;
  const eff = Math.max(0, spend);
  const kg = Math.pow(kappa, gamma);
  return alpha * Math.pow(eff, gamma) / (kg + Math.pow(eff, gamma));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v)}`;
}

function fmtRoas(v: number): string { return `${v.toFixed(2)}x`; }

function DeltaLabel({ current, projected, prefix = "", suffix = "", inverse = false }: {
  current: number; projected: number; prefix?: string; suffix?: string; inverse?: boolean;
}) {
  const delta = projected - current;
  const pct = current > 0 ? (delta / current) * 100 : 0;
  const isUp = delta > 0;
  const good = inverse ? !isUp : isUp;

  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums ${
      good ? "text-emerald-600 dark:text-emerald-400" :
      Math.abs(pct) < 0.5 ? "text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30" :
      "text-red-500 dark:text-red-400"
    }`}>
      {isUp ? <TrendingUp className="w-3 h-3" /> : delta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
      {isUp ? "+" : ""}{prefix}{Math.abs(delta) >= 1_000_000 ? `${(Math.abs(delta) / 1_000_000).toFixed(2)}M` : Math.abs(delta) >= 1_000 ? `${(Math.abs(delta) / 1_000).toFixed(1)}K` : Math.round(Math.abs(delta)).toLocaleString()}{suffix}
      <span className="opacity-60 text-[10px]">({pct > 0 ? "+" : ""}{pct.toFixed(1)}%)</span>
    </span>
  );
}

// Slider with percentage display
function SpendSlider({ channel, multiplier, onChange, locked }: {
  channel: ChannelMMM;
  multiplier: number;
  onChange: (v: number) => void;
  locked: boolean;
}) {
  const newSpend = channel.spend * multiplier;
  const delta = newSpend - channel.spend;

  const trackBg = multiplier > 1
    ? "accent-emerald-500"
    : multiplier < 1
    ? "accent-red-400"
    : "accent-[#FFBC80]";

  return (
    <div className="flex items-center gap-3">
      {/* Color dot + label */}
      <div className="flex items-center gap-1.5 w-28 shrink-0">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: channel.color }} />
        <span className="text-xs text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60 truncate">
          {channel.channelLabel}
        </span>
      </div>

      {/* Slider */}
      <input
        type="range"
        min={50}
        max={200}
        step={5}
        value={Math.round(multiplier * 100)}
        disabled={locked}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className={`flex-1 h-1.5 rounded-full appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${trackBg}`}
        style={{
          background: `linear-gradient(to right, ${
            multiplier > 1 ? "#10B981" : multiplier < 1 ? "#F87171" : "#FFBC80"
          } 0%, ${
            multiplier > 1 ? "#10B981" : multiplier < 1 ? "#F87171" : "#FFBC80"
          } ${(multiplier - 0.5) / 1.5 * 100}%, #E5E7EB ${(multiplier - 0.5) / 1.5 * 100}%, #E5E7EB 100%)`,
        }}
      />

      {/* Current multiplier */}
      <span className={`text-xs font-bold tabular-nums w-10 text-right shrink-0 ${
        multiplier > 1 ? "text-emerald-600 dark:text-emerald-400" :
        multiplier < 1 ? "text-red-500 dark:text-red-400" :
        "text-[#3A3A3A] dark:text-[#FFF9F2]"
      }`}>
        {Math.round(multiplier * 100)}%
      </span>

      {/* New spend amount */}
      <span className="text-xs tabular-nums text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 w-20 text-right shrink-0">
        {fmtCurrency(newSpend)}
      </span>

      {/* Delta */}
      <span className={`text-xs font-medium tabular-nums w-16 text-right shrink-0 ${
        delta > 0 ? "text-emerald-600 dark:text-emerald-400" :
        delta < 0 ? "text-red-500 dark:text-red-400" :
        "text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25"
      }`}>
        {delta > 0 ? "+" : ""}{fmtCurrency(delta)}
      </span>
    </div>
  );
}

// ─── Projected Metric Card ────────────────────────────────────────────────────

function MetricPanel({
  label, current, projected, format, inverse = false,
}: {
  label: string;
  current: number;
  projected: number;
  format: "currency" | "ratio" | "number";
  inverse?: boolean;
}) {
  const fmt = (v: number) =>
    format === "currency" ? fmtCurrency(v) :
    format === "ratio" ? fmtRoas(v) :
    v.toFixed(2);

  const CARD_INNER = {
    border: "1px solid transparent",
    backgroundImage: "linear-gradient(#fff, #fff), linear-gradient(135deg, #FFBC80 0%, #FFE29A 100%)",
    backgroundOrigin: "border-box",
    backgroundClip: "padding-box, border-box",
  } as const;

  return (
    <div className="rounded-xl p-3.5 bg-white dark:bg-[#1a1208]" style={CARD_INNER}>
      <p className="text-xs font-medium text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 uppercase tracking-wider mb-1.5">{label}</p>
      <p className="text-xl font-black text-[#3A3A3A] dark:text-[#FFF9F2] tabular-nums leading-none mb-1">
        {fmt(projected)}
      </p>
      <DeltaLabel current={current} projected={projected}
        prefix={format === "currency" ? "$" : ""}
        suffix={format === "ratio" ? "x" : ""}
        inverse={inverse} />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ScenarioSimulatorProps {
  channels: ChannelMMM[];
  summary: SpendSummary;
  totalBaseRevenue: number;
}

export default function ScenarioSimulator({ channels, summary, totalBaseRevenue }: ScenarioSimulatorProps) {
  // multipliers: 1.0 = current spend, 0.5 = 50%, 2.0 = 200%
  const defaultMults = useMemo(
    () => Object.fromEntries(channels.map((c) => [c.channelId, 1.0])),
    // Reset sliders when the filtered channel set changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [channels.map((c) => c.channelId).join(",")]
  );
  const [multipliers, setMultipliers] = useState<Record<string, number>>(defaultMults);
  const [budgetLocked, setBudgetLocked] = useState(false);

  const hasChanges = channels.some((c) => multipliers[c.channelId] !== 1.0);

  // Inline simulate — reuses Hill params stored on each ChannelMMM
  const simulate = useCallback(
    (mults: Record<string, number>): ScenarioResult => {
      const currentTotalRevenue = summary.totalAttributedRevenue + totalBaseRevenue;
      const currentMer = summary.totalSpend > 0 ? currentTotalRevenue / summary.totalSpend : 0;
      let totalSpend = 0;
      let totalRevenue = totalBaseRevenue;
      let totalIncremental = 0;
      const channelRevenues: Record<string, number> = {};

      for (const ch of channels) {
        const mult = mults[ch.channelId] ?? 1.0;
        const newNominalSpend = ch.spend * mult;
        const newEffectiveSpend = newNominalSpend / (1 - ch.adstockDecay);
        const newRevenue = hillResponse(newEffectiveSpend, ch.hillAlpha, ch.hillGamma, ch.hillKappa);
        const incrFactor = ch.attributedRevenue > 0 ? ch.incrementalRevenue / ch.attributedRevenue : 0;
        totalSpend += newNominalSpend;
        totalRevenue += newRevenue;
        totalIncremental += newRevenue * incrFactor;
        channelRevenues[ch.channelId] = newRevenue;
      }

      const mer = totalSpend > 0 ? totalRevenue / totalSpend : 0;
      const iroas = totalSpend > 0 ? totalIncremental / totalSpend : 0;
      return {
        totalSpend, totalRevenue,
        incrementalRevenue: totalIncremental,
        baseRevenue: totalBaseRevenue,
        mer, roas: mer, iroas,
        revenueDelta: totalRevenue - currentTotalRevenue,
        merDelta: mer - currentMer,
        channelRevenues,
      };
    },
    [channels, summary, totalBaseRevenue]
  );

  function setMult(channelId: string, value: number) {
    if (!budgetLocked) {
      setMultipliers((prev) => ({ ...prev, [channelId]: value }));
      return;
    }
    // Budget-locked mode: offset change with proportional reduction elsewhere
    setMultipliers((prev) => {
      const oldVal = prev[channelId];
      const delta = value - oldVal;
      const deltaSpend = channels.find((c) => c.channelId === channelId)!.spend * delta;
      const others = channels.filter((c) => c.channelId !== channelId);
      const othersSpend = others.reduce((s, c) => s + c.spend * (prev[c.channelId] ?? 1), 0);
      const newPrev = { ...prev, [channelId]: value };
      for (const other of others) {
        const share = (other.spend * (prev[other.channelId] ?? 1)) / othersSpend;
        const adj = prev[other.channelId] - (deltaSpend * share) / other.spend;
        newPrev[other.channelId] = Math.max(0.1, Math.min(3, adj));
      }
      return newPrev;
    });
  }

  function applyRecommendations() {
    const newMults = Object.fromEntries(
      channels.map((c) => [c.channelId, c.recommendedSpend / c.spend])
    );
    setMultipliers(newMults);
  }

  const scenario = useMemo(() => simulate(multipliers), [multipliers, simulate]);

  const CARD = {
    border: "1px solid transparent",
    backgroundImage: "linear-gradient(#fff, #fff), linear-gradient(135deg, #FFBC80 0%, #FFE29A 100%)",
    backgroundOrigin: "border-box",
    backgroundClip: "padding-box, border-box",
  } as const;

  const currentRevenue = summary.totalAttributedRevenue + totalBaseRevenue;
  const currentMer = summary.totalSpend > 0 ? currentRevenue / summary.totalSpend : 0;

  return (
    <div className="rounded-2xl p-5 bg-white dark:bg-[#1a1208]" style={CARD}>
      {/* Header */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">Scenario Simulator</h3>
          <p className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 mt-0.5">
            Adjust channel spend to project revenue, MER, and iROAS outcomes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBudgetLocked((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              budgetLocked
                ? "border-[#FFBC80] bg-[#FFBC80]/15 text-[#3A3A3A] dark:text-[#FFF9F2]"
                : "border-[#3A3A3A]/15 dark:border-[#FFF9F2]/15 text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 hover:border-[#FFBC80]/50"
            }`}
          >
            {budgetLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            {budgetLocked ? "Budget locked" : "Lock budget"}
          </button>
          <button
            onClick={applyRecommendations}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
          >
            Apply recommendations
          </button>
          {hasChanges && (
            <button
              onClick={() => setMultipliers(defaultMults)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#3A3A3A]/15 dark:border-[#FFF9F2]/15 text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 hover:bg-[#3A3A3A]/5 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Sliders — 3/5 */}
        <div className="xl:col-span-3 space-y-3">
          <div className="flex items-center gap-3 pb-1.5 border-b border-[#FFBC80]/15 text-[10px] font-medium uppercase tracking-wider text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25">
            <span className="w-28 shrink-0">Channel</span>
            <span className="flex-1">Allocation</span>
            <span className="w-10 text-right shrink-0">%</span>
            <span className="w-20 text-right shrink-0">New Spend</span>
            <span className="w-16 text-right shrink-0">Delta</span>
          </div>
          {channels.map((ch) => (
            <SpendSlider
              key={ch.channelId}
              channel={ch}
              multiplier={multipliers[ch.channelId] ?? 1}
              onChange={(v) => setMult(ch.channelId, v)}
              locked={false}
            />
          ))}
        </div>

        {/* Projected metrics — 2/5 */}
        <div className="xl:col-span-2 flex flex-col gap-3">
          <p className="text-xs font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 uppercase tracking-wider">
            Projected Outcomes
          </p>

          <div className="grid grid-cols-2 gap-2">
            <MetricPanel
              label="Total Spend"
              current={summary.totalSpend}
              projected={scenario.totalSpend}
              format="currency"
              inverse
            />
            <MetricPanel
              label="Total Revenue"
              current={currentRevenue}
              projected={scenario.totalRevenue}
              format="currency"
            />
            <MetricPanel
              label="MER"
              current={currentMer}
              projected={scenario.mer}
              format="ratio"
            />
            <MetricPanel
              label="Blended iROAS"
              current={summary.blendedIroas}
              projected={scenario.iroas}
              format="ratio"
            />
          </div>

          {/* Incremental revenue highlight */}
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 p-3">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-0.5">
              Incremental Revenue
            </p>
            <p className="text-xl font-black text-emerald-700 dark:text-emerald-300 tabular-nums">
              {fmtCurrency(scenario.incrementalRevenue)}
            </p>
            <DeltaLabel
              current={summary.totalIncrementalRevenue}
              projected={scenario.incrementalRevenue}
              prefix="$"
            />
          </div>

          {/* Budget delta summary */}
          <div className="rounded-xl bg-[#3A3A3A]/4 dark:bg-[#FFF9F2]/5 p-3 text-xs">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45">Spend delta</span>
              <span className={`font-bold tabular-nums ${
                scenario.totalSpend > summary.totalSpend ? "text-amber-600" : "text-emerald-600"
              }`}>
                {scenario.totalSpend > summary.totalSpend ? "+" : ""}{fmtCurrency(scenario.totalSpend - summary.totalSpend)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45">Revenue delta</span>
              <span className={`font-bold tabular-nums ${scenario.revenueDelta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {scenario.revenueDelta >= 0 ? "+" : ""}{fmtCurrency(scenario.revenueDelta)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
