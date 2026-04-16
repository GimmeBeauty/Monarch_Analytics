/**
 * Spend Summary Bar
 * 6 top-line KPIs for the Spend Optimizer tab, including model metadata.
 */
import { DollarSign, BarChart2, Zap, TrendingUp, Award, Activity } from "lucide-react";
import type { SpendSummary } from "@/lib/spendData";

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
}

function Metric({ icon: Icon, label, value, sub, subColor }: MetricProps) {
  return (
    <div className="rounded-2xl p-4 monarch-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 uppercase tracking-wider">
          {label}
        </span>
        <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-[#FFBC80]/15">
          <Icon className="w-3 h-3 text-[#FFBC80]" />
        </div>
      </div>
      <p className="text-2xl font-black text-[#3A3A3A] dark:text-[#FFF9F2] tabular-nums leading-none">{value}</p>
      {sub && (
        <p className={`text-xs mt-1.5 ${subColor ?? "text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35"}`}>{sub}</p>
      )}
    </div>
  );
}

interface SpendSummaryBarProps {
  summary: SpendSummary;
}

export default function SpendSummaryBar({ summary }: SpendSummaryBarProps) {
  const uptideColor = summary.reallocationUpside > 0 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : undefined;
  const mapeColor = summary.modelMape < 0.1 ? "text-emerald-600 dark:text-emerald-400" :
    summary.modelMape < 0.15 ? "text-amber-600 dark:text-amber-400" : "text-red-500 dark:text-red-400";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <Metric icon={DollarSign} label="Total Spend"
        value={fmtCurrency(summary.totalSpend)}
        sub={`Rec: ${fmtCurrency(summary.recommendedTotalSpend)}`} />

      <Metric icon={TrendingUp} label="Attributed Revenue"
        value={fmtCurrency(summary.totalAttributedRevenue)}
        sub={`Blended ROAS ${summary.blendedRoas.toFixed(2)}x`} />

      <Metric icon={Zap} label="Blended iROAS"
        value={`${summary.blendedIroas.toFixed(2)}x`}
        sub={`${((summary.totalIncrementalRevenue / summary.totalAttributedRevenue) * 100).toFixed(0)}% incremental`} />

      <Metric icon={BarChart2} label="Overall MER"
        value={`${summary.overallMer.toFixed(2)}x`}
        sub="Revenue ÷ Ad Spend" />

      <Metric icon={Award} label="Reallocation Upside"
        value={fmtCurrency(summary.reallocationUpside)}
        sub="At equal total spend"
        subColor={uptideColor} />

      <Metric icon={Activity} label="Model Quality"
        value={`R² ${summary.modelRSquared.toFixed(2)}`}
        sub={`MAPE ${(summary.modelMape * 100).toFixed(1)}%`}
        subColor={mapeColor} />
    </div>
  );
}
