/**
 * Channel Family Filter
 *
 * Controls WHICH channel families are included in displayed totals.
 * View mode shortcuts:
 *   Core View  — Core Media only (default)
 *   Total View — All active channel families
 *
 * IMPORTANT: toggling families changes aggregation scope ONLY.
 * The underlying MMM model and per-channel metrics are unaffected.
 */
import { Layers, Radio, ShoppingBag, FlaskConical, Info } from "lucide-react";
import type { ChannelFamily } from "@/lib/spendData";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ViewMode = "core" | "total" | "custom";

export interface FamilyFilterState {
  enabledFamilies: Set<ChannelFamily>;
  viewMode: ViewMode;
}

export function defaultFilterState(): FamilyFilterState {
  return { enabledFamilies: new Set<ChannelFamily>(["core"]), viewMode: "core" };
}

export function toggleFamily(state: FamilyFilterState, family: ChannelFamily): FamilyFilterState {
  const next = new Set(state.enabledFamilies);
  if (next.has(family)) {
    if (next.size === 1) return state; // keep at least one family active
    next.delete(family);
  } else {
    next.add(family);
  }
  const viewMode: ViewMode =
    next.size === 1 && next.has("core") ? "core" :
    next.has("core") && next.has("rmn") ? "total" : "custom";
  return { enabledFamilies: next, viewMode };
}

export function setViewMode(state: FamilyFilterState, mode: "core" | "total"): FamilyFilterState {
  if (mode === "core") return { enabledFamilies: new Set<ChannelFamily>(["core"]), viewMode: "core" };
  return { enabledFamilies: new Set<ChannelFamily>(["core", "rmn", "experimental"]), viewMode: "total" };
}

// ─── Family Config ────────────────────────────────────────────────────────────

const FAMILY_CONFIG: Record<ChannelFamily, {
  label: string;
  sublabel: string;
  icon: React.FC<{ className?: string }>;
  activeClasses: string;
  inactiveClasses: string;
}> = {
  core: {
    label: "Core Media",
    sublabel: "Meta, Google, TikTok, Pinterest…",
    icon: Radio,
    activeClasses: "border-[#1877F2]/40 bg-[#1877F2]/8 text-[#1877F2] dark:text-[#93C5FD]",
    inactiveClasses: "border-[#3A3A3A]/15 dark:border-[#FFF9F2]/10 text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 hover:border-[#3A3A3A]/30",
  },
  rmn: {
    label: "Retail Media",
    sublabel: "Amazon, Walmart Connect, Target Roundel…",
    icon: ShoppingBag,
    activeClasses: "border-[#FF9900]/50 bg-[#FF9900]/8 text-[#B45309] dark:text-[#FCD34D]",
    inactiveClasses: "border-[#3A3A3A]/15 dark:border-[#FFF9F2]/10 text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 hover:border-[#3A3A3A]/30",
  },
  experimental: {
    label: "Experimental",
    sublabel: "Affiliates, influencers, sponsorships…",
    icon: FlaskConical,
    activeClasses: "border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300",
    inactiveClasses: "border-[#3A3A3A]/15 dark:border-[#FFF9F2]/10 text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 hover:border-[#3A3A3A]/30 opacity-60",
  },
};

// ─── View Mode Badge ──────────────────────────────────────────────────────────

function ViewBadge({ mode, channelCount, totalCount }: { mode: ViewMode; channelCount: number; totalCount: number }) {
  const isTotal   = mode === "total";
  const isCustom  = mode === "custom";

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
      isTotal  ? "bg-[#FFBC80]/20 text-[#3A3A3A] dark:text-[#FFE29A] border border-[#FFBC80]/40" :
      isCustom ? "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800" :
                 "bg-[#3A3A3A]/6 dark:bg-[#FFF9F2]/6 text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 border border-[#3A3A3A]/12 dark:border-[#FFF9F2]/10"
    }`}>
      <div className={`w-1.5 h-1.5 rounded-full ${
        isTotal ? "bg-[#FFBC80]" : isCustom ? "bg-purple-500" : "bg-[#3A3A3A]/40 dark:bg-[#FFF9F2]/40"
      }`} />
      {isTotal ? "TOTAL VIEW" : isCustom ? "CUSTOM VIEW" : "CORE VIEW"}
      <span className="opacity-60 font-normal">· {channelCount}/{totalCount} ch</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ChannelFamilyFilterProps {
  state: FamilyFilterState;
  channelCounts: Record<ChannelFamily, number>;
  onChange: (next: FamilyFilterState) => void;
}

export default function ChannelFamilyFilter({ state, channelCounts, onChange }: ChannelFamilyFilterProps) {
  const { enabledFamilies, viewMode } = state;
  const totalChannels = Object.values(channelCounts).reduce((s, n) => s + n, 0);
  const activeChannels = (Object.entries(channelCounts) as [ChannelFamily, number][])
    .filter(([f]) => enabledFamilies.has(f))
    .reduce((s, [, n]) => s + n, 0);

  return (
    <div className="rounded-2xl border border-[#FFBC80]/25 bg-white dark:bg-[#1a1208] px-5 py-3.5 flex flex-wrap items-center gap-4">
      {/* Left: icon + scope label */}
      <div className="flex items-center gap-2 shrink-0">
        <Layers className="w-4 h-4 text-[#FFBC80]" />
        <span className="text-xs font-semibold text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 uppercase tracking-wider">
          Scope
        </span>
      </div>

      {/* View mode shortcuts */}
      <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#3A3A3A]/5 dark:bg-[#FFF9F2]/5 shrink-0">
        {(["core", "total"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => onChange(setViewMode(state, mode))}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              (viewMode === mode || (mode === "total" && viewMode === "custom" && enabledFamilies.size > 1))
                ? "bg-white dark:bg-[#2a1f0f] text-[#3A3A3A] dark:text-[#FFF9F2] shadow-sm"
                : "text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 hover:text-[#3A3A3A]/70"
            }`}
          >
            {mode === "core" ? "Core" : "Total"}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-[#FFBC80]/25 shrink-0 hidden sm:block" />

      {/* Family toggles */}
      <div className="flex items-center gap-2 flex-wrap">
        {(Object.entries(FAMILY_CONFIG) as [ChannelFamily, typeof FAMILY_CONFIG[ChannelFamily]][]).map(([family, cfg]) => {
          const Icon = cfg.icon;
          const active = enabledFamilies.has(family);
          const count = channelCounts[family] ?? 0;
          if (count === 0) return null; // hide families with no channels in current store filter
          return (
            <button
              key={family}
              onClick={() => onChange(toggleFamily(state, family))}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                active ? cfg.activeClasses : cfg.inactiveClasses
              }`}
            >
              <Icon className="w-3 h-3 shrink-0" />
              {cfg.label}
              <span className={`text-[10px] px-1 rounded ${
                active ? "bg-white/40 dark:bg-black/20" : "bg-[#3A3A3A]/6 dark:bg-[#FFF9F2]/6"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Right: active view badge + tooltip */}
      <div className="ml-auto flex items-center gap-2 shrink-0">
        <ViewBadge mode={viewMode} channelCount={activeChannels} totalCount={totalChannels} />
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-[#3A3A3A]/30 dark:text-[#FFF9F2]/20 hover:text-[#3A3A3A]/60 cursor-help transition-colors"
          title="Scope controls which channel families are included in portfolio totals (ROAS, MER, Incremental Revenue). Individual channel metrics are always calculated using the same MMM model regardless of scope."
        >
          <Info className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
}
