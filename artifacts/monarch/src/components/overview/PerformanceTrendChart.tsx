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

type Metric = "revenue" | "spend" | "mer";

const METRIC_CONFIG: Record<Metric, {
  label: string;
  color: string;
  gradientId: string;
  formatter: (v: number) => string;
  prefix?: string;
  suffix?: string;
}> = {
  revenue: {
    label: "Revenue",
    color: "#FFBC80",
    gradientId: "performanceRevenue",
    formatter: (v) => `$${v >= 1_000_000 ? (v / 1_000_000).toFixed(2) + "M" : v >= 1_000 ? (v / 1_000).toFixed(1) + "K" : v.toFixed(0)}`,
  },
  spend: {
    label: "Ad Spend",
    color: "#60A5FA",
    gradientId: "performanceSpend",
    formatter: (v) => `$${v >= 1_000 ? (v / 1_000).toFixed(1) + "K" : v.toFixed(0)}`,
  },
  mer: {
    label: "MER",
    color: "#34D399",
    gradientId: "performanceMer",
    formatter: (v) => `${v.toFixed(2)}x`,
  },
};

function CustomTooltip({ active, payload, label, metric }: TooltipProps<number, string> & { metric: Metric }) {
  if (!active || !payload?.length) return null;
  const cfg = METRIC_CONFIG[metric];
  const val = payload[0]?.value ?? 0;

  return (
    <div className="rounded-xl border border-[#FFBC80]/30 bg-white/95 dark:bg-[#1a1208]/95 backdrop-blur-sm shadow-lg px-3 py-2.5">
      <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mb-1">{label}</p>
      <p className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">
        {cfg.formatter(val)}
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

  // Thin out x-axis labels for readability
  const tickInterval = data.length > 60 ? 13 : data.length > 30 ? 6 : data.length > 14 ? 3 : 1;

  return (
    <div className="rounded-2xl p-5 monarch-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">
            Performance Over Time
          </h3>
          <p className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 mt-0.5">
            Daily {cfg.label.toLowerCase()} trend
          </p>
        </div>

        {/* Toggle */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#3A3A3A]/5 dark:bg-[#FFF9F2]/5">
          {(["revenue", "spend", "mer"] as Metric[]).map((m) => (
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
            <linearGradient id={cfg.gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={cfg.color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={cfg.color} stopOpacity={0.02} />
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
            tickFormatter={(v: number) => cfg.formatter(v)}
          />
          <Tooltip content={<CustomTooltip metric={active} />} />
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
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
