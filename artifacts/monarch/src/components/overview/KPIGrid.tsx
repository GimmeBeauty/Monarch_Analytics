import { TrendingUp, TrendingDown, Minus, DollarSign, BarChart2, ShoppingCart, Package, Users, Percent, Zap } from "lucide-react";
import type { KPIMetric } from "@/lib/overviewData";

const KPI_ICONS: Record<string, React.FC<{ className?: string }>> = {
  revenue:  DollarSign,
  spend:    Zap,
  mer:      BarChart2,
  roas:     BarChart2,
  units:    Package,
  aov:      ShoppingCart,
  sessions: Users,
  cvr:      Percent,
};

export function ChangeBadge({ change, positive }: { change: number; positive: boolean }) {
  const isUp = change > 0;
  const isDown = change < 0;
  const isGood = (isUp && positive) || (isDown && !positive);
  const isBad = (isDown && positive) || (isUp && !positive);

  const colorClass = isGood
    ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30"
    : isBad
    ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30"
    : "text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 bg-[#3A3A3A]/5 dark:bg-[#FFF9F2]/5";

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-xs font-semibold tabular-nums ${colorClass}`}
    >
      {isUp ? (
        <TrendingUp className="w-3 h-3" />
      ) : isDown ? (
        <TrendingDown className="w-3 h-3" />
      ) : (
        <Minus className="w-3 h-3" />
      )}
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}

function KPICard({ kpi }: { kpi: KPIMetric }) {
  const Icon = KPI_ICONS[kpi.id] ?? BarChart2;

  return (
    <div
      title={kpi.description}
      className="relative rounded-2xl p-4 sm:p-5 monarch-card overflow-hidden group hover:shadow-md transition-shadow duration-200 cursor-default"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 uppercase tracking-wider leading-none">
          {kpi.label}
        </span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#FFBC80]/15 dark:bg-[#FFBC80]/10 shrink-0">
          <Icon className="w-3.5 h-3.5 text-[#FFBC80] dark:text-[#FFE29A]" />
        </div>
      </div>

      {/* Value */}
      <div className="text-2xl font-black text-[#3A3A3A] dark:text-[#FFF9F2] tabular-nums leading-none mb-2.5">
        {kpi.formatted}
      </div>

      {/* Change badge */}
      <div className="flex items-center gap-2">
        <ChangeBadge change={kpi.change} positive={kpi.positive} />
        <span className="text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">vs prior</span>
      </div>

      {/* Hover accent line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ background: "linear-gradient(90deg, #FFBC80, #FFE29A)" }}
      />
    </div>
  );
}

interface KPIGridProps {
  kpis: KPIMetric[];
}

export default function KPIGrid({ kpis }: KPIGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      {kpis.map((kpi) => (
        <KPICard key={kpi.id} kpi={kpi} />
      ))}
    </div>
  );
}
