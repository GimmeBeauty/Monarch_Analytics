import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import type { TrendPoint } from "@/lib/overviewData";

type View = "both" | "mer" | "roas";

function CustomTooltip({ active, payload, label, view }: TooltipProps<number, string> & { view: View }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[#FFBC80]/30 bg-white/95 dark:bg-[#1a1208]/95 backdrop-blur-sm shadow-lg px-3 py-2.5 space-y-1">
      <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mb-1.5">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.color }} />
          <span className="text-xs text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 w-10">
            {entry.dataKey === "mer" ? "MER" : "ROAS"}
          </span>
          <span className="text-xs font-bold text-[#3A3A3A] dark:text-[#FFF9F2] tabular-nums">
            {(entry.value as number).toFixed(2)}x
          </span>
        </div>
      ))}
    </div>
  );
}

interface EfficiencyTrendChartProps {
  data: TrendPoint[];
}

export default function EfficiencyTrendChart({ data }: EfficiencyTrendChartProps) {
  const [view, setView] = useState<View>("both");

  const tickInterval = data.length > 60 ? 13 : data.length > 30 ? 6 : data.length > 14 ? 3 : 1;
  const showMer = view === "both" || view === "mer";
  const showRoas = view === "both" || view === "roas";

  return (
    <div
      className="rounded-2xl p-5 bg-white dark:bg-[#1a1208]"
      style={{
        border: "1px solid transparent",
        backgroundImage:
          "linear-gradient(#fff, #fff), linear-gradient(135deg, #FFBC80 0%, #FFE29A 100%)",
        backgroundOrigin: "border-box",
        backgroundClip: "padding-box, border-box",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">
            Efficiency Trend
          </h3>
          <p className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 mt-0.5">
            MER and ROAS over time
          </p>
        </div>

        {/* Toggle */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#3A3A3A]/5 dark:bg-[#FFF9F2]/5">
          {(["both", "mer", "roas"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                view === v
                  ? "bg-white dark:bg-[#2a1f0f] text-[#3A3A3A] dark:text-[#FFF9F2] shadow-sm"
                  : "text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 hover:text-[#3A3A3A]/80 dark:hover:text-[#FFF9F2]/60"
              }`}
            >
              {v === "both" ? "Both" : v.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Legend chips */}
      {view === "both" && (
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded-full bg-[#34D399]" />
            <span className="text-xs text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45">MER</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded-full bg-[#A78BFA]" />
            <span className="text-xs text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45">Blended ROAS</span>
          </div>
        </div>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
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
            width={36}
            tickFormatter={(v: number) => `${v.toFixed(1)}x`}
          />
          <Tooltip content={<CustomTooltip view={view} />} />
          {showMer && (
            <Line
              key="mer"
              type="monotone"
              dataKey="mer"
              stroke="#34D399"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: "#34D399" }}
              isAnimationActive
              animationDuration={400}
            />
          )}
          {showRoas && (
            <Line
              key="roas"
              type="monotone"
              dataKey="roas"
              stroke="#A78BFA"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: "#A78BFA" }}
              isAnimationActive
              animationDuration={400}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
