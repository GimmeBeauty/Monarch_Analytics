/**
 * Spend Summary Bar
 * 6 top-line KPIs for the Spend Optimizer tab.
 *
 * Cards backed by real Snowflake data: Total Spend, Att. Revenue, Overall MER.
 * Cards that include model estimates: Blended iROAS, Realloc. Upside,
 * Model Quality — all labelled "(Est.)" with tooltips explaining assumptions.
 */
import { DollarSign, BarChart2, Zap, TrendingUp, Award, Activity } from "lucide-react";
import type { SpendSummary } from "@/lib/spendData";
import { MetricTooltip } from "@/components/ui/MetricTooltip";

function fmtCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v)}`;
}

interface MetricProps {
  icon: React.FC<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
  tooltip?: string;
}

function Metric({ icon: Icon, label, value, sub, subColor, tooltip }: MetricProps) {
  return (
    <div className="rounded-2xl p-4 monarch-card h-full flex flex-col">
      <div className="flex items-start justify-between mb-2 gap-1">
        <div className="flex items-start gap-1.5 min-w-0 flex-1">
          <span className="text-xs font-medium text-[#3A3A3A]/50 dark:text-[#003349]/40 uppercase tracking-wider leading-tight">
            {label}
          </span>
          {tooltip && <MetricTooltip content={tooltip} />}
        </div>
        <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-[#FFBC80]/15 dark:bg-[#EFBAE1]/15 shrink-0 mt-0.5">
          <Icon className="w-3 h-3 text-[#FFBC80] dark:text-[#BFA1E3]" />
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-end">
        <p className="text-2xl font-black text-[#3A3A3A] dark:text-[#003349] tabular-nums leading-none">{value}</p>
        {sub && (
          <p className={`text-xs mt-1.5 ${subColor ?? "text-[#3A3A3A]/45 dark:text-[#003349]/35"}`}>{sub}</p>
        )}
      </div>
    </div>
  );
}

interface SpendSummaryBarProps {
  summary: SpendSummary;
}

export default function SpendSummaryBar({ summary }: SpendSummaryBarProps) {
  const uptideColor = summary.reallocationUpside > 0 ? "text-emerald-600 dark:text-emerald-700 font-semibold" : undefined;
  const mapeColor = summary.modelMape < 0.1 ? "text-emerald-600 dark:text-emerald-700" :
    summary.modelMape < 0.15 ? "text-amber-600 dark:text-amber-700" : "text-red-500 dark:text-red-700";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-stretch">
      <Metric icon={DollarSign} label="Total Spend"
        value={fmtCurrency(summary.totalSpend)}
        sub={`Rec: ${fmtCurrency(summary.recommendedTotalSpend)}`}
        tooltip="Total media investment across all tracked ad channels in the selected period (real Snowflake data). Recommended total is a model estimate based on saturation analysis." />

      <Metric icon={TrendingUp} label="Att. Revenue"
        value={fmtCurrency(summary.totalAttributedRevenue)}
        sub={`Blended ROAS ${summary.blendedRoas.toFixed(2)}x`}
        tooltip="Platform-reported conversion value attributed to ad spend, sourced directly from Snowflake. Blended ROAS = attributed revenue ÷ total spend (both real numbers)." />

      <Metric icon={Zap} label="Blended iROAS (Est.)"
        value={`${summary.blendedIroas.toFixed(2)}x`}
        sub={`${((summary.totalIncrementalRevenue / summary.totalAttributedRevenue) * 100).toFixed(0)}% incremental`}
        tooltip="Model-estimated Incremental ROAS — causal revenue lift above organic baseline divided by spend. Incrementality factors are industry-benchmark assumptions per channel type, not measured from holdout experiments. Will reflect real lift data once holdout results are ingested." />

      <Metric icon={BarChart2} label="Overall MER"
        value={`${summary.overallMer.toFixed(2)}x`}
        sub="Revenue ÷ Ad Spend"
        tooltip="Marketing Efficiency Ratio — total revenue (attributed + organic) divided by total ad spend. Spend, attributed revenue, and the organic baseline are all real Snowflake data — organic is Shopify revenue from orders with no UTM-tagged landing page, i.e. not attributable to any ad channel." />

      <Metric icon={Award} label="Realloc. Upside (Est.)"
        value={fmtCurrency(summary.reallocationUpside)}
        sub="At equal total spend"
        subColor={uptideColor}
        tooltip="Model-estimated additional revenue achievable by shifting budget toward higher-marginal-return channels at equal total spend. Depends on industry-benchmark saturation curves — treat as directional guidance, not a precise forecast." />

      <Metric icon={Activity} label="Model Quality (Est.)"
        value={`R² ${summary.modelRSquared.toFixed(2)}`}
        sub={`MAPE ${(summary.modelMape * 100).toFixed(1)}%`}
        subColor={mapeColor}
        tooltip="Spend-weighted average model quality across all channels. R² and MAPE are industry-benchmark estimates per channel type, not fitted to Durham Brands' own historical data. These will reflect real regression statistics once holdout experiment data is ingested." />
    </div>
  );
}
