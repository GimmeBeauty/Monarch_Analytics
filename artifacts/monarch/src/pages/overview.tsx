import DashboardLayout from "@/components/layout/DashboardLayout";
import MetricCard from "@/components/charts/MetricCard";
import MonarchChart from "@/components/charts/MonarchChart";
import { useGetOverviewSummary } from "@workspace/api-client-react";
import { useDateRange } from "@/context/DateRangeContext";

export default function Overview() {
  const { data, isLoading } = useGetOverviewSummary();
  const { dateRange } = useDateRange();

  return (
    <DashboardLayout
      title="Overview"
      description="A high-level view of your platform's performance across all channels."
    >
      {isLoading ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-[#FFBC80]/10" />
            ))}
          </div>
          <div className="h-64 rounded-xl bg-[#FFBC80]/10" />
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Metric cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {data.metrics.map((m) => (
              <MetricCard key={m.label} {...m} />
            ))}
          </div>

          {/* Revenue chart */}
          <div
            className="rounded-xl p-6 bg-white dark:bg-[#231a0e]"
            style={{
              border: "1px solid transparent",
              backgroundImage: "linear-gradient(#fff, #fff), linear-gradient(135deg, #FFBC80 0%, #FFE29A 100%)",
              backgroundOrigin: "border-box",
              backgroundClip: "padding-box, border-box",
            }}
          >
            <h2 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] mb-4">Revenue Over Time</h2>
            <MonarchChart
              type="area"
              data={data.revenueTimeSeries}
              compareEnabled={dateRange.compareEnabled}
              valuePrefix="$"
              label="Revenue"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Conversion chart */}
            <div
              className="rounded-xl p-6 bg-white dark:bg-[#231a0e]"
              style={{
                border: "1px solid transparent",
                backgroundImage: "linear-gradient(#fff, #fff), linear-gradient(135deg, #FFBC80 0%, #FFE29A 100%)",
                backgroundOrigin: "border-box",
                backgroundClip: "padding-box, border-box",
              }}
            >
              <h2 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] mb-4">Conversion Rate</h2>
              <MonarchChart
                type="line"
                data={data.conversionTimeSeries}
                compareEnabled={dateRange.compareEnabled}
                valueSuffix="%"
                height={200}
              />
            </div>

            {/* Top channels table */}
            <div
              className="rounded-xl p-6 bg-white dark:bg-[#231a0e]"
              style={{
                border: "1px solid transparent",
                backgroundImage: "linear-gradient(#fff, #fff), linear-gradient(135deg, #FFBC80 0%, #FFE29A 100%)",
                backgroundOrigin: "border-box",
                backgroundClip: "padding-box, border-box",
              }}
            >
              <h2 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] mb-4">Top Channels by Revenue</h2>
              <div className="space-y-3">
                {data.topChannels.map((ch) => (
                  <div key={ch.channel} className="flex items-center gap-3">
                    <span className="text-sm text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60 w-28 truncate">{ch.channel}</span>
                    <div className="flex-1 bg-[#FFBC80]/15 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${ch.share}%`,
                          background: "linear-gradient(90deg, #FFBC80, #FFE29A)",
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] tabular-nums w-20 text-right">
                      ${ch.revenue.toLocaleString()}
                    </span>
                    <span className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 w-10 text-right">{ch.share}%</span>
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
