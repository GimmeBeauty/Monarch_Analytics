import DashboardLayout from "@/components/layout/DashboardLayout";
import { useGetForecastData } from "@workspace/api-client-react";
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

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Forecast() {
  const { data, isLoading } = useGetForecastData();

  const cardStyle = {
    border: "1px solid transparent",
    backgroundImage: "linear-gradient(#fff, #fff), linear-gradient(135deg, #FFBC80 0%, #FFE29A 100%)",
    backgroundOrigin: "border-box",
    backgroundClip: "padding-box, border-box",
  };

  return (
    <DashboardLayout
      title="Forecast"
      description="Projected performance based on historical trends, seasonality, and spend modeling."
    >
      {isLoading ? (
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-[#FFBC80]/10" />)}</div>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* KPI summary */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Projected Revenue", value: `$${(data.projectedRevenue / 1000).toFixed(0)}k` },
              { label: "Projected Spend", value: `$${(data.projectedSpend / 1000).toFixed(0)}k` },
              { label: "Projected ROAS", value: `${data.projectedROAS}x` },
              { label: "Confidence", value: `${data.confidence}%` },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl p-5 bg-white dark:bg-[#231a0e] relative overflow-hidden" style={cardStyle}>
                <div className="absolute top-0 right-0 w-20 h-20 opacity-10 rounded-bl-full" style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }} />
                <p className="text-xs font-medium text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 uppercase tracking-wider mb-2">{kpi.label}</p>
                <p className="text-2xl font-bold text-[#3A3A3A] dark:text-[#FFF9F2] tabular-nums">{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Forecast chart */}
          <div className="rounded-xl p-6 bg-white dark:bg-[#231a0e]" style={cardStyle}>
            <h2 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] mb-2">Revenue Forecast with Confidence Interval</h2>
            <p className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 mb-4">Shaded area represents the upper and lower confidence bounds</p>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={data.forecastTimeSeries} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradBand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FFE29A" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#FFE29A" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(58,58,58,0.06)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: "rgba(58,58,58,0.45)" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "rgba(58,58,58,0.45)" }} axisLine={false} tickLine={false} width={52} />
                <Tooltip
                  contentStyle={{ background: "rgba(255,249,242,0.96)", border: "1px solid #FFBC80", borderRadius: "10px", fontSize: 12 }}
                  labelFormatter={formatDate}
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = { projected: "Projected", upper: "Upper Bound", lower: "Lower Bound", actual: "Actual" };
                    return [`$${value.toLocaleString()}`, labels[name] ?? name];
                  }}
                />
                <Area type="monotone" dataKey="upper" stroke="none" fill="url(#gradBand)" />
                <Area type="monotone" dataKey="lower" stroke="none" fill="#FFF9F2" />
                <Line type="monotone" dataKey="actual" stroke="#FFBC80" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="projected" stroke="#F5A56A" strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Scenario comparison */}
          <div className="rounded-xl p-6 bg-white dark:bg-[#231a0e]" style={cardStyle}>
            <h2 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] mb-4">Scenario Comparison</h2>
            <div className="grid grid-cols-3 gap-4">
              {data.scenarioComparison.map((s, i) => (
                <div
                  key={s.scenario}
                  className="rounded-lg p-4"
                  style={
                    i === 1
                      ? { background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }
                      : { background: "rgba(255,188,128,0.08)", border: "1px solid rgba(255,188,128,0.3)" }
                  }
                >
                  <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${i === 1 ? "text-[#3A3A3A]" : "text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40"}`}>
                    {s.scenario}
                  </p>
                  <p className={`text-xl font-bold tabular-nums mb-1 ${i === 1 ? "text-[#3A3A3A]" : "text-[#3A3A3A] dark:text-[#FFF9F2]"}`}>
                    ${(s.revenue / 1000).toFixed(0)}k
                  </p>
                  <p className={`text-xs ${i === 1 ? "text-[#3A3A3A]/70" : "text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40"}`}>Revenue</p>
                  <div className={`mt-3 pt-3 border-t ${i === 1 ? "border-[#3A3A3A]/20" : "border-[#FFBC80]/20"} flex justify-between`}>
                    <div>
                      <p className={`text-xs ${i === 1 ? "text-[#3A3A3A]/60" : "text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35"}`}>Spend</p>
                      <p className={`text-sm font-semibold tabular-nums ${i === 1 ? "text-[#3A3A3A]" : "text-[#3A3A3A] dark:text-[#FFF9F2]"}`}>${(s.spend / 1000).toFixed(0)}k</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs ${i === 1 ? "text-[#3A3A3A]/60" : "text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35"}`}>ROAS</p>
                      <p className={`text-sm font-semibold tabular-nums ${i === 1 ? "text-[#3A3A3A]" : "text-[#3A3A3A] dark:text-[#FFF9F2]"}`}>{s.roas}x</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
