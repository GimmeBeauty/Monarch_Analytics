import DashboardLayout from "@/components/layout/DashboardLayout";
import MetricCard from "@/components/charts/MetricCard";
import MonarchChart from "@/components/charts/MonarchChart";
import { useGetAttributionData } from "@workspace/api-client-react";
import { useDateRange } from "@/context/DateRangeContext";

export default function Attribution() {
  const { dateRange } = useDateRange();
  const { data, isLoading } = useGetAttributionData({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  const cardStyle = {
    border: "1px solid transparent",
    backgroundImage: "linear-gradient(#fff, #fff), linear-gradient(135deg, #FFBC80 0%, #FFE29A 100%)",
    backgroundOrigin: "border-box",
    backgroundClip: "padding-box, border-box",
  };

  return (
    <DashboardLayout
      title="Ad Attribution"
      description="Track which touchpoints and channels are driving conversions and revenue."
    >
      {isLoading ? (
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-[#FFBC80]/10" />)}</div>
        </div>
      ) : data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {data.metrics.map((m) => <MetricCard key={m.label} {...m} />)}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Touchpoint pie */}
            <div className="rounded-xl p-6 bg-white dark:bg-[#231a0e]" style={cardStyle}>
              <h2 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] mb-4">Conversions by Touchpoint</h2>
              <MonarchChart
                type="pie"
                data={data.touchpointBreakdown.map((t) => ({ name: t.touchpoint, value: t.conversions }))}
                height={200}
              />
            </div>

            {/* Touchpoint table */}
            <div className="rounded-xl p-6 bg-white dark:bg-[#231a0e]" style={cardStyle}>
              <h2 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] mb-4">Touchpoint Breakdown</h2>
              <div className="space-y-2">
                <div className="grid grid-cols-3 text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 font-medium uppercase tracking-wider pb-2 border-b border-[#FFBC80]/20">
                  <span>Touchpoint</span><span className="text-right">Conversions</span><span className="text-right">Revenue</span>
                </div>
                {data.touchpointBreakdown.map((t) => (
                  <div key={t.touchpoint} className="grid grid-cols-3 text-sm py-1.5 border-b border-[#FFBC80]/10 last:border-0">
                    <span className="text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60 truncate">{t.touchpoint}</span>
                    <span className="text-right font-semibold tabular-nums text-[#3A3A3A] dark:text-[#FFF9F2]">{t.conversions.toLocaleString()}</span>
                    <span className="text-right tabular-nums text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60">${t.revenue.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Conversion paths */}
          <div className="rounded-xl p-6 bg-white dark:bg-[#231a0e]" style={cardStyle}>
            <h2 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] mb-4">Top Conversion Paths</h2>
            <div className="space-y-2">
              <div className="grid grid-cols-3 text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 font-medium uppercase tracking-wider pb-2 border-b border-[#FFBC80]/20">
                <span className="col-span-2">Path</span><span className="text-right">Conv. Rate</span>
              </div>
              {data.conversionPaths.map((p) => (
                <div key={p.path} className="grid grid-cols-3 text-sm py-2 border-b border-[#FFBC80]/10 last:border-0 items-center">
                  <span className="col-span-2 text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60 text-xs font-mono">{p.path}</span>
                  <div className="text-right">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)", color: "#3A3A3A" }}>
                      {p.conversionRate}%
                    </span>
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
