import DashboardLayout from "@/components/layout/DashboardLayout";
import MetricCard from "@/components/charts/MetricCard";
import MonarchChart from "@/components/charts/MonarchChart";
import { useGetPerformanceTrends } from "@workspace/api-client-react";
import { useDateRange } from "@/context/DateRangeContext";

export default function Performance() {
  const { dateRange } = useDateRange();
  const { data, isLoading } = useGetPerformanceTrends({
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
      title="Performance Trends"
      description="Deep-dive into KPIs across channels — impressions, clicks, CTR, CPC, and more."
    >
      {isLoading ? (
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-[#FFBC80]/10" />)}</div>
        </div>
      ) : data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {data.metrics.map((m) => <MetricCard key={m.label} {...m} />)}
          </div>

          <div className="rounded-xl p-6 bg-white dark:bg-[#231a0e]" style={cardStyle}>
            <h2 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] mb-4">CTR Trend</h2>
            <MonarchChart type="area" data={data.kpiTimeSeries} compareEnabled={dateRange.compareEnabled} valueSuffix="%" label="CTR" />
          </div>

          <div className="rounded-xl p-6 bg-white dark:bg-[#231a0e]" style={cardStyle}>
            <h2 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] mb-4">Channel Performance</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 font-medium uppercase tracking-wider border-b border-[#FFBC80]/20">
                    <th className="pb-3 text-left">Channel</th>
                    <th className="pb-3 text-right">Impressions</th>
                    <th className="pb-3 text-right">Clicks</th>
                    <th className="pb-3 text-right">CTR</th>
                    <th className="pb-3 text-right">CPC</th>
                    <th className="pb-3 text-right">Conversions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.channelPerformance.map((ch) => (
                    <tr key={ch.channel} className="border-b border-[#FFBC80]/10 last:border-0">
                      <td className="py-3 font-medium text-[#3A3A3A] dark:text-[#FFF9F2]">{ch.channel}</td>
                      <td className="py-3 text-right tabular-nums text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60">
                        {ch.impressions >= 1000000 ? `${(ch.impressions / 1000000).toFixed(1)}M` : `${(ch.impressions / 1000).toFixed(0)}k`}
                      </td>
                      <td className="py-3 text-right tabular-nums text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60">{ch.clicks.toLocaleString()}</td>
                      <td className="py-3 text-right tabular-nums font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">{ch.ctr}%</td>
                      <td className="py-3 text-right tabular-nums text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60">${ch.cpc}</td>
                      <td className="py-3 text-right tabular-nums font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">{ch.conversions.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
