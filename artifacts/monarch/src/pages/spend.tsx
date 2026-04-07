import DashboardLayout from "@/components/layout/DashboardLayout";
import MetricCard from "@/components/charts/MetricCard";
import MonarchChart from "@/components/charts/MonarchChart";
import { useGetSpendData } from "@workspace/api-client-react";
import { useDateRange } from "@/context/DateRangeContext";

export default function Spend() {
  const { dateRange } = useDateRange();
  const { data, isLoading } = useGetSpendData({
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
      title="Spend Optimizer"
      description="Analyze channel performance and optimize your ad budget allocation for maximum return."
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

          {/* Spend over time */}
          <div className="rounded-xl p-6 bg-white dark:bg-[#231a0e]" style={cardStyle}>
            <h2 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] mb-4">Daily Ad Spend</h2>
            <MonarchChart type="area" data={data.spendTimeSeries} compareEnabled={dateRange.compareEnabled} valuePrefix="$" label="Spend" />
          </div>

          {/* Channel breakdown table */}
          <div className="rounded-xl p-6 bg-white dark:bg-[#231a0e]" style={cardStyle}>
            <h2 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] mb-4">Channel Performance & Recommendations</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 font-medium uppercase tracking-wider border-b border-[#FFBC80]/20">
                    <th className="pb-3 text-left">Channel</th>
                    <th className="pb-3 text-right">Current Spend</th>
                    <th className="pb-3 text-right">ROAS</th>
                    <th className="pb-3 text-right">CPA</th>
                    <th className="pb-3 text-right">Recommended</th>
                    <th className="pb-3 text-right">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {data.spendByChannel.map((ch) => {
                    const diff = ch.recommended - ch.spend;
                    const pct = ((diff / ch.spend) * 100).toFixed(0);
                    const positive = diff >= 0;
                    return (
                      <tr key={ch.channel} className="border-b border-[#FFBC80]/10 last:border-0">
                        <td className="py-3 font-medium text-[#3A3A3A] dark:text-[#FFF9F2]">{ch.channel}</td>
                        <td className="py-3 text-right tabular-nums text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60">${ch.spend.toLocaleString()}</td>
                        <td className="py-3 text-right tabular-nums font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">{ch.roas}x</td>
                        <td className="py-3 text-right tabular-nums text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60">${ch.cpa}</td>
                        <td className="py-3 text-right tabular-nums font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">${ch.recommended.toLocaleString()}</td>
                        <td className={`py-3 text-right tabular-nums text-xs font-semibold ${positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                          {positive ? "+" : ""}{pct}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bar chart comparison */}
          <div className="rounded-xl p-6 bg-white dark:bg-[#231a0e]" style={cardStyle}>
            <h2 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] mb-4">Current vs. Recommended Spend</h2>
            <MonarchChart
              type="bar"
              data={data.spendByChannel.map((ch) => ({
                label: ch.channel.replace("Google ", "G. ").replace("Meta ", "M. "),
                value: ch.spend,
                value2: ch.recommended,
              }))}
              height={200}
            />
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
