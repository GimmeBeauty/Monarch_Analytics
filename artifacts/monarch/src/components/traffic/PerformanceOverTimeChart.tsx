import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  type TooltipProps,
} from "recharts";
import { API_BASE } from "@/lib/apiBase";

type Metric = "revenue" | "units" | "both";

interface TrendPoint {
  date: string;
  revenue: number;
  units: number;
}

interface StoreTrend {
  storeId: string;
  storeName: string;
  color: string;
  data: TrendPoint[];
}

interface Props {
  selectedStoreIds: string[];
  startDate: string;
  endDate: string;
}

function formatCurrency(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v).toLocaleString()}`;
}

function formatUnits(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(Math.round(v));
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function CustomTooltip({
  active, payload, label, metric, trends,
}: TooltipProps<number, string> & { metric: Metric; trends: StoreTrend[] | undefined }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card/95 backdrop-blur-sm shadow-lg px-3 py-2.5">
      <p className="text-xs text-muted-foreground mb-1.5">{formatDate(String(label))}</p>
      {payload.map((entry) => {
        const key = String(entry.dataKey ?? "");
        const isRev = key.endsWith("_revenue");
        const store = trends?.find(s => key === `${s.storeId}_revenue` || key === `${s.storeId}_units`);
        const name = store
          ? store.storeName + (metric === "both" ? (isRev ? " Rev" : " Units") : "")
          : key;
        const val = Number(entry.value ?? 0);
        return (
          <p key={key} className="text-sm font-semibold" style={{ color: entry.color }}>
            {name}: {isRev ? formatCurrency(val) : formatUnits(val)}
          </p>
        );
      })}
    </div>
  );
}

export default function PerformanceOverTimeChart({ selectedStoreIds, startDate, endDate }: Props) {
  const [metric, setMetric] = useState<Metric>("revenue");

  const storeParam = selectedStoreIds.length ? `&storeIds=${selectedStoreIds.join(",")}` : "";

  const { data: trends, isLoading } = useQuery<StoreTrend[]>({
    queryKey: ["traffic-trends", startDate, endDate, selectedStoreIds.join(",")],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/api/data/traffic/trends?start=${startDate}&end=${endDate}${storeParam}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<StoreTrend[]>;
    },
    staleTime: 1000 * 60 * 15,
    retry: false,
  });

  // Pivot per-store arrays into flat [{date, storeId_revenue, storeId_units, ...}]
  const chartData = useMemo(() => {
    if (!trends?.length) return [];
    const dateMap = new Map<string, Record<string, number>>();
    for (const store of trends) {
      for (const point of store.data) {
        if (!dateMap.has(point.date)) dateMap.set(point.date, {});
        const entry = dateMap.get(point.date)!;
        entry[`${store.storeId}_revenue`] = point.revenue;
        entry[`${store.storeId}_units`]   = point.units;
      }
    }
    return Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date, ...vals }));
  }, [trends]);

  const isSingleStore = (trends?.length ?? 0) === 1;
  const hasData = chartData.length > 0;

  return (
    <div className="rounded-2xl p-6 monarch-card">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-base font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">
          Performance Over Time
        </h2>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#3A3A3A]/5 dark:bg-[#FFF9F2]/5">
          {(["revenue", "units", "both"] as Metric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all capitalize ${
                metric === m
                  ? "bg-white dark:bg-[#2a1f0f] text-[#3A3A3A] dark:text-[#FFF9F2] shadow-sm"
                  : "text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 hover:text-[#3A3A3A]/80 dark:hover:text-[#FFF9F2]/60"
              }`}
            >
              {m === "both" ? "Both" : m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      ) : !hasData ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
          No trend data available for the selected period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={chartData}
            margin={{ top: 5, right: metric === "both" ? 64 : 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="currentColor"
              className="text-[#3A3A3A]/8 dark:text-[#FFF9F2]/8"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 11, fill: "currentColor", className: "text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30" }}
              axisLine={false}
              tickLine={false}
              minTickGap={48}
            />
            <YAxis
              yAxisId="left"
              tickFormatter={metric === "units" ? formatUnits : formatCurrency}
              tick={{ fontSize: 11, fill: "currentColor", className: "text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30" }}
              axisLine={false}
              tickLine={false}
              width={64}
            />
            {metric === "both" && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={formatUnits}
                tick={{ fontSize: 11, fill: "currentColor", className: "text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30" }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
            )}
            <Tooltip content={<CustomTooltip metric={metric} trends={trends} />} />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
              formatter={(value) => {
                const key = String(value);
                const store = trends?.find(s => key === `${s.storeId}_revenue` || key === `${s.storeId}_units`);
                if (!store) return key;
                if (metric !== "both") return store.storeName;
                return store.storeName + (key.endsWith("_revenue") ? " (Rev)" : " (Units)");
              }}
            />

            {trends?.flatMap((store) => {
              const lines = [];
              if (metric === "revenue" || metric === "both") {
                lines.push(
                  <Line
                    key={`${store.storeId}_revenue`}
                    yAxisId="left"
                    type="monotone"
                    dataKey={`${store.storeId}_revenue`}
                    stroke={store.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0, fill: store.color }}
                    connectNulls
                  />,
                );
              }
              if (metric === "units" || metric === "both") {
                lines.push(
                  <Line
                    key={`${store.storeId}_units`}
                    yAxisId={metric === "both" ? "right" : "left"}
                    type="monotone"
                    dataKey={`${store.storeId}_units`}
                    stroke={store.color}
                    strokeWidth={metric === "both" ? 1.5 : 2}
                    strokeDasharray={metric === "both" ? "5 3" : undefined}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0, fill: store.color }}
                    connectNulls
                  />,
                );
              }
              return lines;
            })}
          </LineChart>
        </ResponsiveContainer>
      )}

      {metric === "both" && hasData && (
        <p className="mt-3 text-xs text-muted-foreground text-center">
          {isSingleStore
            ? "Solid line = Revenue (left axis) · Dashed line = Units (right axis)"
            : "Solid lines = Revenue (left axis) · Dashed lines = Units (right axis)"}
        </p>
      )}
    </div>
  );
}
