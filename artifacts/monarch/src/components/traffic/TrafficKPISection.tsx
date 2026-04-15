import { TrendingUp, TrendingDown, Minus, DollarSign, Package, Store, Megaphone, TrendingUp as AdRev, BarChart2 } from "lucide-react";
import type { TrafficKPI } from "@/lib/trafficData";

const KPI_ICONS: Record<string, React.FC<{ className?: string }>> = {
  revenue:   DollarSign,
  units:     Package,
  pspw:      Store,
  adSales:   Megaphone,
  adRevenue: AdRev,
  mer:       BarChart2,
};

const cardStyle = {
  border: "1px solid transparent",
  backgroundImage: "linear-gradient(#fff, #fff), linear-gradient(135deg, #FFBC80 0%, #FFE29A 100%)",
  backgroundOrigin: "border-box",
  backgroundClip: "padding-box, border-box",
};
const cardStyleDark = {
  border: "1px solid transparent",
  backgroundImage: "linear-gradient(#1a1208, #1a1208), linear-gradient(135deg, #FFBC80 0%, #FFE29A 100%)",
  backgroundOrigin: "border-box",
  backgroundClip: "padding-box, border-box",
};

function ChangeBadge({ change, positive }: { change: number; positive: boolean }) {
  const isUp   = change > 0;
  const isDown = change < 0;
  const isGood = (isUp && positive) || (isDown && !positive);
  const isBad  = (isDown && positive) || (isUp && !positive);

  const cls = isGood
    ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30"
    : isBad
    ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30"
    : "text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 bg-[#3A3A3A]/5 dark:bg-[#FFF9F2]/5";

  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-xs font-semibold tabular-nums ${cls}`}>
      {isUp ? <TrendingUp className="w-3 h-3" /> : isDown ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}

function KPICard({ kpi }: { kpi: TrafficKPI }) {
  const Icon = KPI_ICONS[kpi.id] ?? BarChart2;

  return (
    <div
      title={kpi.description}
      className="relative rounded-2xl p-4 sm:p-5 bg-white dark:bg-[#1a1208] overflow-hidden group hover:shadow-md transition-shadow duration-200 cursor-default"
      style={cardStyle}
    >
      <style>{`.dark .traffic-kpi-card { background-image: linear-gradient(#1a1208, #1a1208), linear-gradient(135deg, #FFBC80 0%, #FFE29A 100%) !important; }`}</style>

      {/* Corner accent */}
      <div className="absolute top-0 right-0 w-24 h-24 opacity-10 rounded-bl-full"
           style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }} />

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 uppercase tracking-wider">
            {kpi.label}
          </span>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#FFBC80]/15 dark:bg-[#FFBC80]/10 shrink-0">
            <Icon className="w-3.5 h-3.5 text-[#FFBC80] dark:text-[#FFE29A]" />
          </div>
        </div>

        <div className="text-2xl font-black text-[#3A3A3A] dark:text-[#FFF9F2] tabular-nums leading-none mb-2.5">
          {kpi.formatted}
        </div>

        <div className="flex items-center gap-2">
          <ChangeBadge change={kpi.change} positive={kpi.positive} />
          <span className="text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">vs prior period</span>
        </div>
      </div>

      {/* Hover accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
           style={{ background: "linear-gradient(90deg, #FFBC80, #FFE29A)" }} />
    </div>
  );
}

interface Props {
  kpis: TrafficKPI[];
}

export default function TrafficKPISection({ kpis }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
      {kpis.map(kpi => <KPICard key={kpi.id} kpi={kpi} />)}
    </div>
  );
}
