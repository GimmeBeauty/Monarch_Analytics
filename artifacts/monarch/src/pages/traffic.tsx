import DashboardLayout from "@/components/layout/DashboardLayout";
import MetricCard from "@/components/charts/MetricCard";
import MonarchChart from "@/components/charts/MonarchChart";
import { useGetTrafficData } from "@workspace/api-client-react";
import { useDateRange } from "@/context/DateRangeContext";

export default function Traffic() {
  const { dateRange } = useDateRange();
  const { data, isLoading } = useGetTrafficData({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    compareStart: dateRange.compareEnabled ? dateRange.compareStart : undefined,
    compareEnd: dateRange.compareEnabled ? dateRange.compareEnd : undefined,
  });

  const cardStyle = {
    border: "1px solid transparent",
    backgroundImage: "linear-gradient(#fff, #fff), linear-gradient(135deg, #FFBC80 0%, #FFE29A 100%)",
    backgroundOrigin: "border-box",
    backgroundClip: "padding-box, border-box",
  };

  return (
    <DashboardLayout
      title="Traffic"
      description="Understand where your visitors come from and how they engage with your site."
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

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl p-6 bg-white dark:bg-[#231a0e]" style={cardStyle}>
              <h2 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] mb-4">Sessions Over Time</h2>
              <MonarchChart type="area" data={data.sessionTimeSeries} compareEnabled={dateRange.compareEnabled} label="Sessions" />
            </div>
            <div className="rounded-xl p-6 bg-white dark:bg-[#231a0e]" style={cardStyle}>
              <h2 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] mb-4">Pageviews Over Time</h2>
              <MonarchChart type="area" data={data.pageviewTimeSeries} compareEnabled={dateRange.compareEnabled} label="Pageviews" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Source breakdown */}
            <div className="rounded-xl p-6 bg-white dark:bg-[#231a0e]" style={cardStyle}>
              <h2 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] mb-4">Traffic Sources</h2>
              <div className="space-y-3">
                {data.sourceBreakdown.map((s) => (
                  <div key={s.source} className="flex items-center gap-3">
                    <span className="text-sm text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60 w-32 truncate">{s.source}</span>
                    <div className="flex-1 bg-[#FFBC80]/15 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${s.share}%`, background: "linear-gradient(90deg, #FFBC80, #FFE29A)" }} />
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-[#3A3A3A] dark:text-[#FFF9F2] w-20 text-right">{s.sessions.toLocaleString()}</span>
                    <span className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 w-10 text-right">{s.share}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top pages */}
            <div className="rounded-xl p-6 bg-white dark:bg-[#231a0e]" style={cardStyle}>
              <h2 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] mb-4">Top Pages</h2>
              <div className="space-y-2">
                <div className="grid grid-cols-3 text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 font-medium uppercase tracking-wider pb-2 border-b border-[#FFBC80]/20">
                  <span>Page</span><span className="text-right">Views</span><span className="text-right">Avg. Time</span>
                </div>
                {data.topPages.map((p) => (
                  <div key={p.page} className="grid grid-cols-3 text-sm py-1.5">
                    <span className="text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60 truncate font-mono text-xs">{p.page}</span>
                    <span className="text-right font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] tabular-nums">{p.views.toLocaleString()}</span>
                    <span className="text-right text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">{p.avgTime}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
