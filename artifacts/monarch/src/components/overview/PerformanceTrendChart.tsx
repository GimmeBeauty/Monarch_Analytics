import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import type { TrendPoint } from "@/lib/overviewData";

type Metric = "revenue" | "spend" | "both";

const REVENUE_CFG = {
  label: "Revenue",
  color: "#FFBC80",
  gradientId: "performanceRevenue",
  formatter: (v: number) =>
    `$${v >= 1_000_000 ? (v / 1_000_000).toFixed(2) + "M" : v >= 1_000 ? (v / 1_000).toFixed(1) + "K" : v.toFixed(0)}`,
};

const SPEND_CFG = {
  label: "Ad Spend",
  color: "#60A5FA",
  gradientId: "performanceSpend",
  formatter: (v: number) =>
    `$${v >= 1_000 ? (v / 1_000).toFixed(1) + "K" : v.toFixed(0)}`,
};

const METRIC_CONFIG: Record<Metric, { label: string; color: string; gradientId: string; formatter: (v: number) => string }> = {
  revenue: REVENUE_CFG,
  spend: SPEND_CFG,
  both: { label: "Both", color: "#FFBC80", gradientId: "performanceRevenue", formatter: REVENUE_CFG.formatter },
};

function CustomTooltip({ active, payload, label, metric }: TooltipProps<number, string> & { metric: Metric }) {
  if (!active || !payload?.length) return null;

  if (metric === "both") {
    const rev   = payload.find(p => p.dataKey === "revenue")?.value ?? 0;
    const spend = payload.find(p => p.dataKey === "spend")?.value ?? 0;
    return (
      <div className="rounded-xl border border-[#FFBC80]/30 bg-white/95 dark:bg-[#1a1208]/95 backdrop-blur-sm shadow-lg px-3 py-2.5">
        <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mb-1">{label}</p>
        <p className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">
          Rev: {REVENUE_CFG.formatter(rev as number)}
        </p>
        <p className="text-sm font-semibold text-[#60A5FA]">
          Spend: {SPEND_CFG.formatter(spend as number)}
        </p>
      </div>
    );
  }

  const cfg = METRIC_CONFIG[metric];
  const val = payload[0]?.value ?? 0;
  return (
    <div className="rounded-xl border border-[#FFBC80]/30 bg-white/95 dark:bg-[#1a1208]/95 backdrop-blur-sm shadow-lg px-3 py-2.5">
      <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mb-1">{label}</p>
      <p className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">
        {cfg.formatter(val as number)}
      </p>
    </div>
  );
}

interface PerformanceTrendChartProps {
  data: TrendPoint[];
}

export default function PerformanceTrendChart({ data }: PerformanceTrendChartProps) {
  const [active, setActive] = useState<Metric>("revenue");
  const cfg = METRIC_CONFIG[active];

  const tickInterval = data.length > 60 ? 13 : data.length > 30 ? 6 : data.length > 14 ? 3 : 1;

  const subtitle =
    active === "both" ? "revenue & ad spend" : cfg.label.toLowerCase();

  return (
    <div className="rounded-2xl p-5 monarch-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">
            Performance Over Time
          </h3>
          <p className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 mt-0.5">
            Daily {subtitle} trend
          </p>
        </div>

        {/* Toggle */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#3A3A3A]/5 dark:bg-[#FFF9F2]/5">
          {(["revenue", "spend", "both"] as Metric[]).map((m) => (
            <button
              key={m}
              onClick={() => setActive(m)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                active === m
                  ? "bg-white dark:bg-[#2a1f0f] text-[#3A3A3A] dark:text-[#FFF9F2] shadow-sm"
                  : "text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 hover:text-[#3A3A3A]/80 dark:hover:text-[#FFF9F2]/60"
              }`}
            >
              {METRIC_CONFIG[m].label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="performanceRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#FFBC80" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#FFBC80" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="performanceSpend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#60A5FA" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            className="text-[#3A3A3A]/8 dark:text-[#FFF9F2]/8"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "currentColor", className: "text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30" }}
            tickLine={false}
            axisLine={false}
            interval={tickInterval}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "currentColor", className: "text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30" }}
            tickLine={false}
            axisLine={false}
            width={50}
            tickFormatter={(v: number) => REVENUE_CFG.formatter(v)}
          />
          <Tooltip content={<CustomTooltip metric={active} />} />
          {active === "both" ? [
            <Area
              key="revenue"
              type="monotone"
              dataKey="revenue"
              stroke="#FFBC80"
              strokeWidth={2}
              fill="url(#performanceRevenue)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: "#FFBC80" }}
              isAnimationActive={true}
              animationDuration={400}
            />,
            <Area
              key="spend"
              type="monotone"
              dataKey="spend"
              stroke="#60A5FA"
              strokeWidth={2}
              fill="url(#performanceSpend)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: "#60A5FA" }}
              isAnimationActive={true}
              animationDuration={400}
            />,
          ] : (
            <Area
              key={active}
              type="monotone"
              dataKey={active}
              stroke={cfg.color}
              strokeWidth={2}
              fill={`url(#${cfg.gradientId})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: cfg.color }}
              isAnimationActive={true}
              animationDuration={400}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
