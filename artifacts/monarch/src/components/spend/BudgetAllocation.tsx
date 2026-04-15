/**
 * Budget Allocation
 * Shows current vs recommended spend per channel (grouped bar) and
 * a revenue decomposition breakdown (base + incremental stacked bar).
 */
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, type TooltipProps,
} from "recharts";
import type { ChannelMMM, SpendSummary } from "@/lib/spendData";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtK(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

const CARD = {
  border: "1px solid transparent",
  backgroundImage: "linear-gradient(#fff, #fff), linear-gradient(135deg, #FFBC80 0%, #FFE29A 100%)",
  backgroundOrigin: "border-box",
  backgroundClip: "padding-box, border-box",
} as const;

// ─── Current vs Recommended Bar Chart ────────────────────────────────────────

interface AllocationTooltipProps extends TooltipProps<number, string> {}

function AllocationTooltip({ active, payload, label }: AllocationTooltipProps) {
  if (!active || !payload?.length) return null;
  const current = payload.find((p) => p.dataKey === "spend");
  const rec     = payload.find((p) => p.dataKey === "recommendedSpend");
  return (
    <div className="rounded-xl border border-[#FFBC80]/30 bg-white/97 dark:bg-[#1a1208]/97 shadow-lg px-3 py-2.5 text-xs">
      <p className="font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] mb-1.5">{label}</p>
      {current && (
        <div className="flex gap-3 items-center">
          <span className="w-2 h-2 rounded-full bg-[#FFBC80] inline-block" />
          <span className="text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 w-16">Current</span>
          <span className="font-bold text-[#3A3A3A] dark:text-[#FFF9F2] tabular-nums">{fmtK(current.value as number)}</span>
        </div>
      )}
      {rec && (
        <div className="flex gap-3 items-center mt-0.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          <span className="text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 w-16">Recommended</span>
          <span className="font-bold text-[#3A3A3A] dark:text-[#FFF9F2] tabular-nums">{fmtK(rec.value as number)}</span>
        </div>
      )}
    </div>
  );
}

// ─── Revenue Decomposition ────────────────────────────────────────────────────

function RevenueDecomposition({ channels, totalBase }: { channels: ChannelMMM[]; totalBase: number }) {
  const totalAll = totalBase + channels.reduce((s, c) => s + c.incrementalRevenue, 0);
  const basePct = totalAll > 0 ? (totalBase / totalAll) * 100 : 0;

  const top5 = [...channels].sort((a, b) => b.incrementalRevenue - a.incrementalRevenue).slice(0, 5);
  const otherIncr = channels
    .sort((a, b) => b.incrementalRevenue - a.incrementalRevenue)
    .slice(5)
    .reduce((s, c) => s + c.incrementalRevenue, 0);

  const segments = [
    { label: "Organic Base", revenue: totalBase, pct: basePct, color: "#9CA3AF" },
    ...top5.map((c) => ({
      label: c.channelLabel,
      revenue: c.incrementalRevenue,
      pct: totalAll > 0 ? (c.incrementalRevenue / totalAll) * 100 : 0,
      color: c.color,
    })),
    ...(otherIncr > 0
      ? [{ label: "Other Channels", revenue: otherIncr, pct: (otherIncr / totalAll) * 100, color: "#D1D5DB" }]
      : []),
  ];

  return (
    <div>
      <h4 className="text-xs font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 uppercase tracking-wider mb-3">
        Revenue Decomposition
      </h4>

      {/* Stacked bar */}
      <div className="flex h-6 rounded-lg overflow-hidden gap-px mb-4">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className="h-full transition-all duration-300"
            style={{ width: `${seg.pct}%`, background: seg.color, minWidth: seg.pct > 1 ? "2px" : "0" }}
            title={`${seg.label}: ${fmtK(seg.revenue)} (${seg.pct.toFixed(1)}%)`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-y-1.5 gap-x-3">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: seg.color }} />
            <span className="text-xs text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 truncate">{seg.label}</span>
            <span className="text-xs font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] tabular-nums ml-auto shrink-0">
              {seg.pct.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface BudgetAllocationProps {
  channels: ChannelMMM[];
  summary: SpendSummary;
}

export default function BudgetAllocation({ channels, summary }: BudgetAllocationProps) {
  const sorted = [...channels].sort((a, b) => b.spend - a.spend);

  const barData = sorted.map((ch) => ({
    label: ch.channelLabel.replace(" Programmatic", "").replace("AppLovin Axon", "AppLovin").replace("Pattern Predict", "Pattern"),
    spend: ch.spend,
    recommendedSpend: ch.recommendedSpend,
    color: ch.color,
    recommendation: ch.recommendation,
  }));

  const totalDelta = summary.recommendedTotalSpend - summary.totalSpend;
  const isDeltaPositive = totalDelta >= 0;

  return (
    <div className="rounded-2xl p-5 bg-white dark:bg-[#1a1208]" style={CARD}>
      {/* Header */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">Budget Allocation</h3>
          <p className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 mt-0.5">Current vs MMM-recommended spend</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-[#FFBC80]" />
            <span className="text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45">Current</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-500" />
            <span className="text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45">Recommended</span>
          </div>
          <div className={`px-2 py-0.5 rounded-md font-semibold ${isDeltaPositive ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" : "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"}`}>
            {isDeltaPositive ? "+" : ""}{fmtK(totalDelta)} total
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Bar chart — 3/5 width */}
        <div className="xl:col-span-3">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} barGap={2} barCategoryGap="25%"
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false}
                stroke="currentColor" className="text-[#3A3A3A]/8 dark:text-[#FFF9F2]/8" />
              <XAxis dataKey="label"
                tick={{ fontSize: 10, fill: "currentColor", className: "text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30" }}
                tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 10, fill: "currentColor", className: "text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30" }}
                tickLine={false} axisLine={false} width={44}
                tickFormatter={(v: number) => fmtK(v)} />
              <Tooltip content={<AllocationTooltip />} cursor={{ fill: "currentColor", className: "text-[#3A3A3A]/4 dark:text-[#FFF9F2]/4" }} />
              <Bar dataKey="spend" name="Current Spend" radius={[3, 3, 0, 0]}>
                {barData.map((d, i) => <Cell key={i} fill="#FFBC80" fillOpacity={0.85} />)}
              </Bar>
              <Bar dataKey="recommendedSpend" name="Recommended" radius={[3, 3, 0, 0]}>
                {barData.map((d, i) => (
                  <Cell key={i} fill={d.recommendation === "increase" ? "#10B981" : d.recommendation === "decrease" ? "#F87171" : "#60A5FA"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Decomposition — 2/5 width */}
        <div className="xl:col-span-2 flex flex-col justify-center">
          <RevenueDecomposition channels={channels} totalBase={summary.totalBaseRevenue} />
        </div>
      </div>
    </div>
  );
}
