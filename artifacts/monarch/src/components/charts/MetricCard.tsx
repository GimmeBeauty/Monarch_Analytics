import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string;
  change: number;
  changeLabel: string;
  trend: "up" | "down" | "neutral";
}

export default function MetricCard({ label, value, change, changeLabel, trend }: MetricCardProps) {
  const isPositive = trend === "up";
  const isNeutral = trend === "neutral";

  return (
    <div
      data-testid={`metric-card-${label.toLowerCase().replace(/\s+/g, "-")}`}
      className="relative rounded-xl p-5 monarch-card overflow-hidden"
    >

      {/* Subtle gradient accent in corner */}
      <div
        className="absolute top-0 right-0 w-24 h-24 opacity-10 rounded-bl-full"
        style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}
      />

      <div className="relative">
        <p className="text-xs font-medium text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 uppercase tracking-wider mb-2">
          {label}
        </p>
        <p className="text-2xl font-bold text-[#3A3A3A] dark:text-[#FFF9F2] mb-3 tabular-nums">
          {value}
        </p>
        <div className={`flex items-center gap-1.5 text-xs font-medium ${
          isNeutral
            ? "text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40"
            : isPositive
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-500 dark:text-red-400"
        }`}>
          {isNeutral ? (
            <Minus size={12} />
          ) : isPositive ? (
            <TrendingUp size={12} />
          ) : (
            <TrendingDown size={12} />
          )}
          <span>{Math.abs(change)}% {changeLabel}</span>
        </div>
      </div>
    </div>
  );
}
