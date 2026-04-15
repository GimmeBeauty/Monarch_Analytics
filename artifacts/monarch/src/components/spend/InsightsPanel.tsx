/**
 * Insights Panel
 * Surfaces priority-ranked, human-readable decisions from the MMM model.
 * Designed to feel like a decision engine, not a report.
 */
import { AlertTriangle, TrendingUp, Eye, FlaskConical, ArrowRight } from "lucide-react";
import type { SpendInsight, InsightType, InsightPriority, Confidence } from "@/lib/spendData";

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<InsightType, {
  icon: React.FC<{ className?: string }>;
  bg: string;
  iconColor: string;
  border: string;
}> = {
  opportunity: { icon: TrendingUp, bg: "bg-emerald-50 dark:bg-emerald-950/30", iconColor: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-900/60" },
  risk:        { icon: AlertTriangle, bg: "bg-red-50 dark:bg-red-950/30", iconColor: "text-red-600 dark:text-red-400", border: "border-red-200 dark:border-red-900/60" },
  observation: { icon: Eye, bg: "bg-blue-50 dark:bg-blue-950/30", iconColor: "text-blue-600 dark:text-blue-400", border: "border-blue-200 dark:border-blue-900/60" },
  model:       { icon: FlaskConical, bg: "bg-[#3A3A3A]/5 dark:bg-[#FFF9F2]/5", iconColor: "text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40", border: "border-[#3A3A3A]/15 dark:border-[#FFF9F2]/10" },
};

const PRIORITY_LABELS: Record<InsightPriority, { label: string; color: string }> = {
  critical: { label: "Critical", color: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" },
  high:     { label: "High",     color: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" },
  medium:   { label: "Medium",   color: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" },
  low:      { label: "Low",      color: "bg-[#3A3A3A]/8 dark:bg-[#FFF9F2]/8 text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40" },
};

const CONFIDENCE_DOTS: Record<Confidence, string> = {
  high:   "bg-emerald-500",
  medium: "bg-amber-400",
  low:    "bg-[#3A3A3A]/30 dark:bg-[#FFF9F2]/20",
};

// ─── Single Insight Card ──────────────────────────────────────────────────────

function InsightCard({ insight }: { insight: SpendInsight }) {
  const typeCfg = TYPE_CONFIG[insight.type];
  const priorityCfg = PRIORITY_LABELS[insight.priority];
  const Icon = typeCfg.icon;

  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-3 ${typeCfg.bg} ${typeCfg.border}`}>
      {/* Top row: icon + priority badge + confidence */}
      <div className="flex items-start justify-between gap-2">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
          insight.type === "opportunity" ? "bg-emerald-100 dark:bg-emerald-900/40" :
          insight.type === "risk"        ? "bg-red-100 dark:bg-red-900/40" :
          insight.type === "observation" ? "bg-blue-100 dark:bg-blue-900/40" :
          "bg-[#3A3A3A]/8 dark:bg-[#FFF9F2]/8"
        }`}>
          <Icon className={`w-4 h-4 ${typeCfg.iconColor}`} />
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${priorityCfg.color}`}>
            {priorityCfg.label}
          </span>
          <div className="flex items-center gap-1" title={`Model confidence: ${insight.confidence}`}>
            {(["high", "medium", "low"] as Confidence[]).map((lvl) => (
              <div
                key={lvl}
                className={`w-1.5 h-1.5 rounded-full transition-opacity ${
                  (insight.confidence === "high" && lvl !== "low") ||
                  (insight.confidence === "medium" && lvl === "high") ||
                  (insight.confidence === "low" && false)
                    ? CONFIDENCE_DOTS[insight.confidence]
                    : lvl === "high" && insight.confidence !== "low"
                    ? CONFIDENCE_DOTS[insight.confidence]
                    : lvl === "medium" && insight.confidence === "medium"
                    ? CONFIDENCE_DOTS[insight.confidence]
                    : "bg-[#3A3A3A]/15 dark:bg-[#FFF9F2]/15"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Title */}
      <h4 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] leading-snug">
        {insight.title}
      </h4>

      {/* Body */}
      <p className="text-xs text-[#3A3A3A]/65 dark:text-[#FFF9F2]/55 leading-relaxed">
        {insight.body}
      </p>

      {/* Impact chip */}
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium self-start ${
        insight.type === "opportunity" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" :
        insight.type === "risk"        ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" :
        "bg-[#FFBC80]/15 text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60"
      }`}>
        {insight.impact}
      </div>

      {/* Channel tag (if any) */}
      {insight.channelLabel && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#3A3A3A]/8 dark:bg-[#FFF9F2]/8 text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45">
            {insight.channelLabel}
          </span>
        </div>
      )}

      {/* Action link */}
      <button className={`mt-auto flex items-center gap-1 text-xs font-semibold transition-opacity opacity-70 hover:opacity-100 ${typeCfg.iconColor}`}>
        {insight.actionLabel}
        <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── Panel Container ──────────────────────────────────────────────────────────

interface InsightsPanelProps {
  insights: SpendInsight[];
}

export default function InsightsPanel({ insights }: InsightsPanelProps) {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">AI-Driven Insights</h3>
          <p className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 mt-0.5">
            Prioritized recommendations from the MMM model
          </p>
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-[#FFBC80]/30 bg-[#FFBC80]/8">
          <div className="w-1.5 h-1.5 rounded-full bg-[#FFBC80] animate-pulse" />
          <span className="text-xs font-medium text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50">Model updated</span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {insights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>
    </div>
  );
}
