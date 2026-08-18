import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useStoreFilter } from "@/context/StoreFilterContext";
import { usePricingMode } from "@/context/PricingModeContext";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import ErrorState from "@/components/ErrorState";
import { useTheme } from "@/context/ThemeContext";
import { brandGradient } from "@/lib/brandGradient";

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmt$(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toLocaleString()}`;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonthBucket  { month: number; revenue: number }
interface GoalBucket   { month: number; goal: number }

interface ForecastSummary {
  year: number;
  ytdRevenue: number;
  projectedRevenue: number;
  adSpendAvailable: boolean;
  projectedSpend: number;
  projectedUnits: number;
  asp: number;
  mtdRevenue: number;
  currentMonth: number;
  currentMonthLabel: string;
  currentMonthGoal: number;
  annualGoal: number;
  monthlyActuals: MonthBucket[];
  monthlyGoals: GoalBucket[];
  totalMonthlyGoal: number;
}

interface ChartPoint {
  period: string;
  actual?: number;
  projected: number;
  lower: number;
  upper: number;
  priorYear?: number;
}

interface ForecastChartResp {
  year: number;
  granularity: string;
  series: ChartPoint[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Forecast() {
  const { theme } = useTheme();
  const accent = theme === "dark" ? "#BFA1E3" : "#FFBC80";
  const [selectedYear, setSelectedYear]   = useState(2026);
  const [granularity,  setGranularity]    = useState<"week" | "month">("month");
  const [showPriorYear, setShowPriorYear] = useState(false);

  const { isWholesale } = usePricingMode();
  const { selectedIds } = useStoreFilter();
  const storeIdsParam = selectedIds.length > 0 ? selectedIds.join(",") : "";

  const { data: summary, isLoading: summaryLoading, isFetching: summaryFetching, error: summaryError, refetch: refetchSummary } = useQuery<ForecastSummary>({
    queryKey: ["forecast-summary", selectedYear, isWholesale, storeIdsParam],
    queryFn: async () => {
      const p = new URLSearchParams({ year: String(selectedYear), isWholesale: String(isWholesale) });
      if (storeIdsParam) p.set("storeIds", storeIdsParam);
      const r = await fetch(`/api/data/forecast/summary?${p}`);
      if (!r.ok) {
        const body = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      return r.json() as Promise<ForecastSummary>;
    },
  });

  const { data: chartResp, isLoading: chartLoading, isFetching: chartFetching, error: chartError, refetch: refetchChart } = useQuery<ForecastChartResp>({
    queryKey: ["forecast-chart", selectedYear, granularity, showPriorYear, isWholesale, storeIdsParam],
    queryFn: async () => {
      const p = new URLSearchParams({
        year: String(selectedYear),
        granularity,
        priorYear: String(showPriorYear),
        isWholesale: String(isWholesale),
      });
      if (storeIdsParam) p.set("storeIds", storeIdsParam);
      const r = await fetch(`/api/data/forecast/chart?${p}`);
      if (!r.ok) {
        const body = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      return r.json() as Promise<ForecastChartResp>;
    },
  });

  const isLoading = summaryLoading || chartLoading;
  const error = summaryError || chartError;
  const isRefetching = summaryFetching || chartFetching;
  const refetchAll = () => { refetchSummary(); refetchChart(); };

  // All KPIs are now server-scoped by store — no frontend scaling needed.
  const s = summary ?? null;

  // Chart actuals are server-scoped; no frontend scaling needed.
  const chartSeries = useMemo((): ChartPoint[] => {
    return chartResp?.series ?? [];
  }, [chartResp]);

  // Derived KPI values
  const pctMonthly = s && s.currentMonthGoal > 0
    ? Math.round((s.mtdRevenue / s.currentMonthGoal) * 100)
    : null;
  const pctAnnual = s && s.annualGoal > 0
    ? Math.round((s.ytdRevenue / s.annualGoal) * 100)
    : null;

  // Accent color helper
  const pctColor = (pct: number | null) =>
    pct == null ? "" :
    pct >= 100  ? "text-emerald-600 dark:text-emerald-700" :
    pct >= 75   ? "text-amber-600 dark:text-amber-700"   :
                  "text-red-500 dark:text-red-700";

  // Scenario calculations
  const scenarios = useMemo(() => {
    if (!s) return null;
    const base       = s.annualGoal > 0 ? s.annualGoal : (s.totalMonthlyGoal > 0 ? s.totalMonthlyGoal : s.projectedRevenue);
    const goalBase   = s.totalMonthlyGoal > 0 ? s.totalMonthlyGoal : base;
    const spendRatio = s.projectedRevenue > 0 ? s.projectedSpend / s.projectedRevenue : 0.25;
    const build = (rev: number) => ({
      revenue: Math.round(rev),
      spend:   Math.round(rev * spendRatio),
      roas:    spendRatio > 0 ? Math.round((1 / spendRatio) * 100) / 100 : 0,
    });
    return [
      { label: "Conservative", ...build(base * 0.90) },
      { label: "Actual Goals", ...build(goalBase) },
      { label: "BHAG",         ...build(base * 1.15) },
    ];
  }, [s]);

  // KPI card data
  const kpiCards = s ? [
    {
      label: "Projected Revenue",
      value: fmt$(s.projectedRevenue),
      sub:   `Full year ${selectedYear}`,
      color: "",
    },
    {
      label: "Projected Spend",
      value: s.adSpendAvailable ? fmt$(s.projectedSpend) : "—",
      sub:   s.adSpendAvailable ? "Ad spend forecast" : "No ad channels for this store",
      color: "",
    },
    {
      label: "Projected Units",
      value: fmtNum(s.projectedUnits),
      sub:   `$${s.asp.toFixed(2)} ASP`,
      color: "",
    },
    {
      label: `% to ${s.currentMonthLabel} Goal`,
      value: pctMonthly != null ? `${pctMonthly}%` : "—",
      sub:   pctMonthly != null ? "MTD vs monthly target" : "Set goals in settings",
      color: pctColor(pctMonthly),
    },
    {
      label: "% to Annual Goal",
      value: pctAnnual != null ? `${pctAnnual}%` : s.annualGoal === 0 ? "Set goal ↗" : "—",
      sub:   s.ytdRevenue > 0 ? `${fmt$(s.ytdRevenue)} YTD` : "No annual goal set",
      color: pctColor(pctAnnual),
    },
  ] : [];

  return (
    <DashboardLayout
      title="Forecast"
      description="Projected full-year performance based on actuals YTD and historical trends."
      hideDatePicker
    >
      {/* Year selector */}
      <div className="flex items-center gap-2 mb-6">
        {([2025, 2026] as const).map((y) => (
          <button
            key={y}
            onClick={() => setSelectedYear(y)}
            className={`px-5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              selectedYear === y
                ? "text-[#3A3A3A]"
                : "text-[#3A3A3A]/55 dark:text-[#003349]/45 border border-[#FFBC80]/30 dark:border-[#9BDBF3]/30 hover:border-[#FFBC80]/60 dark:hover:border-[#9BDBF3]/60 hover:bg-[#FFBC80]/8 dark:hover:bg-[#EFBAE1]/8"
            }`}
            style={selectedYear === y ? { background: brandGradient(theme) } : {}}
          >
            {y}
          </button>
        ))}
        <span className="text-xs text-[#3A3A3A]/40 dark:text-[#003349]/30 ml-1">
          Jan 1 – Dec 31, {selectedYear}
        </span>
      </div>

      {error ? (
        <ErrorState
          message="Unable to load data — check your data connections."
          onRetry={refetchAll}
          isRetrying={isRefetching}
        />
      ) : isLoading ? (
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-[#FFBC80]/10 dark:bg-[#EFBAE1]/10" />)}
          </div>
          <div className="h-80 rounded-xl bg-[#FFBC80]/10 dark:bg-[#EFBAE1]/10" />
          <div className="h-52 rounded-xl bg-[#FFBC80]/10 dark:bg-[#EFBAE1]/10" />
        </div>
      ) : (
        <div className="space-y-6">

          {/* ── 5 KPI Cards ── */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#3A3A3A]/40 dark:text-[#003349]/30">
              Key Metrics
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${
              isWholesale
                ? "bg-blue-100 dark:bg-blue-100 text-blue-700 dark:text-blue-700"
                : "bg-[#FFBC80]/20 dark:bg-[#EFBAE1]/20 text-[#3A3A3A]/60 dark:text-[#003349]/50"
            }`}>
              {isWholesale ? "Wholesale" : "MSRP"}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-4">
            {kpiCards.map((kpi) => (
              <div key={kpi.label} className="rounded-xl p-5 monarch-card-settings relative overflow-hidden">
                <div
                  className="absolute top-0 right-0 w-20 h-20 opacity-10 rounded-bl-full"
                  style={{ background: brandGradient(theme) }}
                />
                <p className="text-xs font-medium text-[#3A3A3A]/50 dark:text-[#003349]/40 uppercase tracking-wider mb-2 leading-tight">
                  {kpi.label}
                </p>
                <p className={`text-2xl font-bold tabular-nums mb-1 ${kpi.color || "text-[#3A3A3A] dark:text-[#003349]"}`}>
                  {kpi.value}
                </p>
                <p className="text-xs text-[#3A3A3A]/40 dark:text-[#003349]/30">{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Revenue Forecast Chart ── */}
          <div className="rounded-xl p-6 monarch-card-settings">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#003349]">Revenue Forecast</h2>
                <p className="text-xs text-[#3A3A3A]/45 dark:text-[#003349]/35 mt-0.5">
                  Solid = actuals · Dashed = projected · Shaded = confidence interval
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                {/* Prior year toggle */}
                <button
                  onClick={() => setShowPriorYear(!showPriorYear)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    showPriorYear
                      ? "bg-[#3A3A3A]/10 dark:bg-[#003349]/10 text-[#3A3A3A] dark:text-[#003349] border border-[#3A3A3A]/20"
                      : "text-[#3A3A3A]/50 dark:text-[#003349]/40 border border-[#FFBC80]/30 dark:border-[#9BDBF3]/30 hover:border-[#FFBC80]/60 dark:hover:border-[#9BDBF3]/60"
                  }`}
                >
                  {selectedYear - 1} Actual
                </button>
                {/* Granularity toggle */}
                <div className="flex rounded-lg border border-[#FFBC80]/30 dark:border-[#9BDBF3]/30 overflow-hidden">
                  {(["month", "week"] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGranularity(g)}
                      className={`px-3 py-1.5 text-xs font-medium transition-all ${
                        granularity === g
                          ? "text-[#3A3A3A]"
                          : "text-[#3A3A3A]/50 dark:text-[#003349]/40 hover:bg-[#FFBC80]/8 dark:hover:bg-[#EFBAE1]/8"
                      }`}
                      style={granularity === g ? { background: brandGradient(theme) } : {}}
                    >
                      {g === "month" ? "Month" : "Week"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartSeries} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradBand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={theme === "dark" ? "#9BDBF3" : "#FFE29A"} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={theme === "dark" ? "#9BDBF3" : "#FFE29A"} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(58,58,58,0.06)" vertical={false} />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 11, fill: "rgba(58,58,58,0.45)" }}
                  axisLine={false}
                  tickLine={false}
                  interval={granularity === "week" ? 3 : 0}
                />
                <YAxis
                  tickFormatter={fmt$}
                  tick={{ fontSize: 11, fill: "rgba(58,58,58,0.45)" }}
                  axisLine={false}
                  tickLine={false}
                  width={58}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(255,249,242,0.96)",
                    border: `1px solid ${accent}`,
                    borderRadius: "10px",
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = {
                      projected: "Projected",
                      upper:     "Upper Bound",
                      lower:     "Lower Bound",
                      actual:    "Actual",
                      priorYear: `${selectedYear - 1} Actual`,
                    };
                    return [`$${Number(value).toLocaleString()}`, labels[name] ?? name];
                  }}
                />
                {/* Confidence band */}
                <Area type="monotone" dataKey="upper" stroke="none" fill="url(#gradBand)" />
                <Area type="monotone" dataKey="lower" stroke="none" fill="rgba(255,249,242,0.95)" />
                {/* Prior year comparison line */}
                {showPriorYear && (
                  <Line
                    type="monotone"
                    dataKey="priorYear"
                    stroke="#aaaaaa"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    dot={false}
                    name="priorYear"
                  />
                )}
                {/* Projected (dashed) */}
                <Line
                  type="monotone"
                  dataKey="projected"
                  stroke="#F5A56A"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                {/* Actual (solid) */}
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke={accent}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>

            {showPriorYear && (
              <div className="mt-3 flex items-center gap-4 text-xs text-[#3A3A3A]/45 dark:text-[#003349]/35">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-6 border-t-2 border-[#FFBC80] dark:border-[#BFA1E3]" />
                  {selectedYear} Actual
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-6 border-t-2 border-dashed border-[#F5A56A]" />
                  {selectedYear} Projected
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-6 border-t-2 border-dashed border-[#aaa]" />
                  {selectedYear - 1} Actual
                </span>
              </div>
            )}
          </div>

          {/* ── Scenario Comparison ── */}
          {scenarios && (
            <div className="rounded-xl p-6 monarch-card-settings">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#003349]">Scenario Comparison</h2>
                  <p className="text-xs text-[#3A3A3A]/45 dark:text-[#003349]/35 mt-0.5">
                    Updates daily as actuals come in · Remaining months use forecast model
                  </p>
                </div>
                {!s?.annualGoal && (
                  <p className="text-xs text-[#3A3A3A]/40 dark:text-[#003349]/30 text-right max-w-[200px] leading-relaxed">
                    Set an Annual Revenue Goal in Forecast Settings to calibrate scenarios.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4">
                {scenarios.map((sc, i) => (
                  <div
                    key={sc.label}
                    className="rounded-lg p-4"
                    style={
                      i === 1
                        ? { background: brandGradient(theme) }
                        : {
                            background: theme === "dark" ? "rgba(191,161,227,0.08)" : "rgba(255,188,128,0.08)",
                            border: theme === "dark" ? "1px solid rgba(191,161,227,0.3)" : "1px solid rgba(255,188,128,0.3)",
                          }
                    }
                  >
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${
                      i === 1 ? "text-[#3A3A3A]" : "text-[#3A3A3A]/50 dark:text-[#003349]/40"
                    }`}>
                      {sc.label}
                    </p>
                    <p className={`text-xl font-bold tabular-nums mb-1 ${
                      i === 1 ? "text-[#3A3A3A]" : "text-[#3A3A3A] dark:text-[#003349]"
                    }`}>
                      {fmt$(sc.revenue)}
                    </p>
                    <p className={`text-xs ${i === 1 ? "text-[#3A3A3A]/70" : "text-[#3A3A3A]/50 dark:text-[#003349]/40"}`}>
                      Revenue
                    </p>
                    <div className={`mt-3 pt-3 border-t ${
                      i === 1 ? "border-[#3A3A3A]/20" : "border-[#FFBC80]/20 dark:border-[#9BDBF3]/20"
                    } flex justify-between`}>
                      <div>
                        <p className={`text-xs ${i === 1 ? "text-[#3A3A3A]/60" : "text-[#3A3A3A]/45 dark:text-[#003349]/35"}`}>Spend</p>
                        <p className={`text-sm font-semibold tabular-nums ${
                          i === 1 ? "text-[#3A3A3A]" : "text-[#3A3A3A] dark:text-[#003349]"
                        }`}>{fmt$(sc.spend)}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs ${i === 1 ? "text-[#3A3A3A]/60" : "text-[#3A3A3A]/45 dark:text-[#003349]/35"}`}>ROAS</p>
                        <p className={`text-sm font-semibold tabular-nums ${
                          i === 1 ? "text-[#3A3A3A]" : "text-[#3A3A3A] dark:text-[#003349]"
                        }`}>{sc.roas}x</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </DashboardLayout>
  );
}
