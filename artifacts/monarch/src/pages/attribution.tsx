import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import {
  TrendingUp, TrendingDown, Minus, ChevronUp, ChevronDown, ChevronsUpDown,
  Zap, MousePointerClick, DollarSign, BarChart2, Search, SlidersHorizontal,
  ArrowRight, ArrowDown, Info, AlertTriangle,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useDateRange } from "@/context/DateRangeContext";
import { useStoreFilter } from "@/context/StoreFilterContext";
import { usePricingMode } from "@/context/PricingModeContext";
import { getChannelsForStores, type ChannelMapping } from "@/lib/channelStoreMapping";
import {
  generateAdAttributionData,
  type AdChannelRow, type AdSignal, type BlendedMetric,
  type ChannelFunnel, type AdvancedRow, type SignalType,
} from "@/lib/adAttributionData";

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmtCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v).toLocaleString()}`;
}

function fmtNumber(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return Math.round(v).toLocaleString();
}

// ─── Card Style Helpers ───────────────────────────────────────────────────────

const CARD_CLASS = "monarch-card-settings rounded-xl";

// ─── Channel Selector ─────────────────────────────────────────────────────────

const FAMILY_LABELS: Record<string, string> = {
  core: "Core Media",
  rmn:  "Retail Media (RMN)",
  experimental: "Experimental",
};

const FAMILY_ORDER = ["core", "rmn", "experimental"];

interface ChannelSelectorProps {
  allChannels: ChannelMapping[];
  selected: Set<string>;   // empty = all selected
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

function ChannelSelector({ allChannels, selected, onToggle, onSelectAll, onClearAll }: ChannelSelectorProps) {
  const [open, setOpen] = useState(false);
  const isAll        = selected.size === 0;
  const activeCount  = isAll ? allChannels.length : selected.size;
  const isActive     = (id: string) => isAll || selected.has(id);

  const activeChannels = isAll ? allChannels : allChannels.filter(c => selected.has(c.channelId));
  const previewDots    = activeChannels.slice(0, 6);
  const overflow       = activeCount - 6;

  // Group by family in defined order
  const groups = useMemo(() => {
    const map: Record<string, ChannelMapping[]> = {};
    for (const ch of allChannels) {
      if (!map[ch.channelFamily]) map[ch.channelFamily] = [];
      map[ch.channelFamily].push(ch);
    }
    return FAMILY_ORDER.filter(f => map[f]?.length).map(f => ({ family: f, channels: map[f] }));
  }, [allChannels]);

  return (
    <div className={`${CARD_CLASS}`}>
      {/* ── Trigger row ── */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left select-none"
      >
        <SlidersHorizontal size={13} className="text-[#FFBC80] flex-shrink-0" />

        <span className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">
          Channels
        </span>

        {/* Color dot preview */}
        <div className="flex items-center -space-x-0.5 ml-1">
          {previewDots.map(ch => (
            <span
              key={ch.channelId}
              className="w-2 h-2 rounded-full ring-1 ring-white dark:ring-[#231a0e]"
              style={{ background: ch.color }}
            />
          ))}
          {overflow > 0 && (
            <span className="text-[10px] text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25 pl-1.5">
              +{overflow}
            </span>
          )}
        </div>

        <span className="ml-auto text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 flex-shrink-0">
          {activeCount} of {allChannels.length} active
        </span>

        <ChevronDown
          size={14}
          className={`text-[#3A3A3A]/30 dark:text-[#FFF9F2]/25 flex-shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* ── Expanded content ── */}
      <div
        className={`overflow-hidden transition-all duration-200 ${
          open ? "max-h-[440px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-4 pb-4 border-t border-[#FFBC80]/10">
          {/* All / None controls */}
          <div className="flex items-center justify-between pt-3 mb-3">
            <p className="text-[10px] font-semibold text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 uppercase tracking-widest">
              Filter channels
            </p>
            <div className="flex items-center gap-0.5">
              <button
                onClick={onSelectAll}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  isAll
                    ? "bg-[#FFBC80]/20 text-[#3A3A3A] dark:text-[#FFF9F2]"
                    : "text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2]"
                }`}
              >
                All
              </button>
              <span className="text-[#3A3A3A]/15 dark:text-[#FFF9F2]/15 select-none">·</span>
              <button
                onClick={onClearAll}
                className="px-2.5 py-1 rounded-lg text-xs font-medium text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] transition-colors"
              >
                None
              </button>
            </div>
          </div>

          <div className="space-y-3.5">
            {groups.map(({ family, channels }) => (
              <div key={family}>
                <p className="text-[9px] font-bold text-[#3A3A3A]/30 dark:text-[#FFF9F2]/25 uppercase tracking-widest mb-1.5">
                  {FAMILY_LABELS[family] ?? family}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {channels.map(ch => {
                    const active = isActive(ch.channelId);
                    return (
                      <button
                        key={ch.channelId}
                        onClick={() => onToggle(ch.channelId)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-all select-none"
                        style={{
                          background: active ? `${ch.color}18` : "transparent",
                          color:      active ? ch.color : "rgba(58,58,58,0.30)",
                          border:     `1px solid ${active ? `${ch.color}45` : "rgba(58,58,58,0.12)"}`,
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors"
                          style={{ background: active ? ch.color : "rgba(58,58,58,0.20)" }}
                        />
                        {ch.channelLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section 1: Blended Metrics ───────────────────────────────────────────────

function BlendedMetricCard({ m }: { m: BlendedMetric }) {
  const isGood = m.positiveIsUp ? m.change > 0 : m.change < 0;
  const isNeutral = m.change === 0;
  const colorCls = isNeutral
    ? "text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30"
    : isGood
    ? "text-emerald-500 dark:text-emerald-400"
    : "text-red-500 dark:text-red-400";

  return (
    <div className={`${CARD_CLASS} p-4 relative overflow-hidden`} title={m.description}>
      <div className="absolute top-0 right-0 w-16 h-16 opacity-8 rounded-bl-full"
        style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }} />
      <p className="text-[10px] font-semibold text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 uppercase tracking-wider mb-1.5">
        {m.label}
      </p>
      <p className="text-xl font-black tabular-nums text-[#3A3A3A] dark:text-[#FFF9F2] mb-2 leading-none">
        {m.formatted}
      </p>
      <div className={`flex items-center gap-1 text-[11px] font-medium ${colorCls}`}>
        {isNeutral ? <Minus size={10} /> : isGood ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
        <span>{Math.abs(m.change)}% vs prior</span>
      </div>
    </div>
  );
}

// ─── Section 2: Core Efficiency Table ────────────────────────────────────────

type SortKey = keyof AdChannelRow;

interface ColDef { id: string; label: string; key: SortKey; fmt: (v: number) => string; align?: "right" }

const DEFAULT_COLS: ColDef[] = [
  { id: "spend",       label: "Spend",       key: "spend",       fmt: fmtCurrency,               align: "right" },
  { id: "revenue",     label: "Revenue",     key: "revenue",     fmt: fmtCurrency,               align: "right" },
  { id: "conversions", label: "Conv.",        key: "conversions", fmt: fmtNumber,                 align: "right" },
  { id: "ctr",         label: "CTR",         key: "ctr",         fmt: v => `${v.toFixed(2)}%`,   align: "right" },
  { id: "cvr",         label: "CVR",         key: "cvr",         fmt: v => `${v.toFixed(2)}%`,   align: "right" },
  { id: "roas",        label: "ROAS",        key: "roas",        fmt: v => `${v.toFixed(1)}x`,   align: "right" },
  { id: "cpa",         label: "CPA",         key: "cpa",         fmt: fmtCurrency,               align: "right" },
];

const OPTIONAL_COLS: ColDef[] = [
  { id: "clicks",      label: "Clicks",      key: "clicks",      fmt: fmtNumber,                 align: "right" },
  { id: "cpc",         label: "CPC",         key: "cpc",         fmt: v => `$${v.toFixed(2)}`,   align: "right" },
  { id: "cpm",         label: "CPM",         key: "cpm",         fmt: v => `$${v.toFixed(2)}`,   align: "right" },
  { id: "frequency",   label: "Frequency",   key: "frequency",   fmt: v => v.toFixed(1),         align: "right" },
  { id: "impressions", label: "Impressions", key: "impressions", fmt: fmtNumber,                 align: "right" },
];

function SortIcon({ col, sortKey, dir }: { col: string; sortKey: string; dir: "asc" | "desc" }) {
  if (col !== sortKey) return <ChevronsUpDown size={11} className="opacity-25" />;
  return dir === "asc" ? <ChevronUp size={11} className="text-[#FFBC80]" /> : <ChevronDown size={11} className="text-[#FFBC80]" />;
}

function EfficiencyTable({ rows }: { rows: AdChannelRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const [visibleOptional, setVisibleOptional] = useState<Set<string>>(new Set());
  const [showPicker, setShowPicker] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const toggleCol = (id: string) => setVisibleOptional(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const displayedOptional = OPTIONAL_COLS.filter(c => visibleOptional.has(c.id));

  const filtered = useMemo(() => {
    let r = [...rows];
    if (search) r = r.filter(row => row.channelLabel.toLowerCase().includes(search.toLowerCase()));
    r.sort((a, b) => {
      const av = a[sortKey] as number, bv = b[sortKey] as number;
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return r;
  }, [rows, search, sortKey, sortDir]);

  const thCls = "px-3 py-2.5 text-left text-[10px] font-semibold text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:text-[#3A3A3A]/70 dark:hover:text-[#FFF9F2]/60 transition-colors";
  const thRCls = thCls + " text-right";

  return (
    <div className={`${CARD_CLASS} overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#FFBC80]/15">
        <div>
          <h2 className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">Core Efficiency</h2>
          <p className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 mt-0.5">Channel-level paid ad performance</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#3A3A3A]/35 dark:text-[#FFF9F2]/30" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter channels…"
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[#FFBC80]/8 dark:bg-[#FFF9F2]/5 border border-[#FFBC80]/20 text-[#3A3A3A] dark:text-[#FFF9F2] placeholder:text-[#3A3A3A]/30 dark:placeholder:text-[#FFF9F2]/25 focus:outline-none focus:border-[#FFBC80]/50 w-36"
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setShowPicker(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#FFBC80]/10 text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60 border border-[#FFBC80]/20 hover:bg-[#FFBC80]/20 transition-colors"
            >
              <SlidersHorizontal size={11} />
              Show / Hide
              {visibleOptional.size > 0 && (
                <span className="bg-[#FFBC80] text-[#3A3A3A] rounded-full w-4 h-4 text-[10px] font-bold flex items-center justify-center">
                  {visibleOptional.size}
                </span>
              )}
            </button>
            {showPicker && (
              <div className="absolute right-0 top-full mt-1.5 z-30 w-44 rounded-xl shadow-xl border border-[#FFBC80]/20 bg-white dark:bg-[#231a0e] p-2">
                <p className="text-[10px] font-semibold text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 uppercase tracking-wider px-2 pb-2">
                  Optional Columns
                </p>
                {OPTIONAL_COLS.map(col => (
                  <label key={col.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[#FFBC80]/8 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleOptional.has(col.id)}
                      onChange={() => toggleCol(col.id)}
                      className="accent-[#FFBC80] w-3.5 h-3.5"
                    />
                    <span className="text-xs text-[#3A3A3A] dark:text-[#FFF9F2]">{col.label}</span>
                  </label>
                ))}
                <div className="border-t border-[#FFBC80]/15 mt-1.5 pt-1.5">
                  <button onClick={() => setShowPicker(false)} className="w-full text-center text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 hover:text-[#3A3A3A]/70 py-1">
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        {showPicker && <div className="fixed inset-0 z-20" onClick={() => setShowPicker(false)} />}
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#FFBC80]/10">
              <th className={thCls + " min-w-[140px] sticky left-0 bg-white dark:bg-[#231a0e]"}>Channel</th>
              {DEFAULT_COLS.map(col => (
                <th key={col.id} className={thRCls} onClick={() => handleSort(col.key)}>
                  <div className="flex items-center justify-end gap-1">
                    {col.label}
                    <SortIcon col={col.id} sortKey={sortKey} dir={sortDir} />
                  </div>
                </th>
              ))}
              {displayedOptional.map(col => (
                <th key={col.id} className={thRCls} onClick={() => handleSort(col.key)}>
                  <div className="flex items-center justify-end gap-1">
                    {col.label}
                    <SortIcon col={col.id} sortKey={sortKey} dir={sortDir} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={1 + DEFAULT_COLS.length + displayedOptional.length} className="text-center py-8 text-xs text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25">
                  No channels match your filter.
                </td>
              </tr>
            ) : (
              filtered.map(row => (
                <tr key={row.channelId} className="border-b border-[#FFBC80]/8 hover:bg-[#FFBC80]/4 transition-colors">
                  <td className="px-3 py-2.5 sticky left-0 bg-white dark:bg-[#231a0e]">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: row.color }} />
                      <span className="font-medium text-[#3A3A3A] dark:text-[#FFF9F2] whitespace-nowrap">{row.channelLabel}</span>
                      <span className="hidden sm:inline text-[9px] px-1.5 py-0.5 rounded bg-[#FFBC80]/12 text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 uppercase tracking-wide">
                        {row.channelFamily}
                      </span>
                    </div>
                  </td>
                  {DEFAULT_COLS.map(col => (
                    <td key={col.id} className={`px-3 py-2.5 text-right tabular-nums whitespace-nowrap ${
                      col.id === "revenue"
                        ? "font-semibold text-emerald-600 dark:text-emerald-400"
                        : "text-[#3A3A3A]/75 dark:text-[#FFF9F2]/65"
                    }`}>
                      {col.fmt(row[col.key] as number)}
                    </td>
                  ))}
                  {displayedOptional.map(col => (
                    <td key={col.id} className="px-3 py-2.5 text-right tabular-nums text-[#3A3A3A]/65 dark:text-[#FFF9F2]/55 whitespace-nowrap">
                      {col.fmt(row[col.key] as number)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Section 3: Signal Detector ───────────────────────────────────────────────

const SIGNAL_META: Record<SignalType, { icon: React.ElementType; label: string }> = {
  "ad-fatigue":      { icon: Zap,               label: "Ad Fatigue" },
  "declining-ctr":   { icon: MousePointerClick, label: "CTR Decline" },
  "rising-cpa":      { icon: DollarSign,        label: "Rising CPA" },
  "declining-roas":  { icon: BarChart2,          label: "ROAS Decline" },
};

const SEV_STYLES = {
  critical: {
    wrap: "border-red-500/25 bg-red-500/5 dark:bg-red-500/8",
    icon: "text-red-500",
    badge: "bg-red-500/12 text-red-600 dark:text-red-400",
  },
  warning: {
    wrap: "border-amber-400/30 bg-amber-400/5 dark:bg-amber-400/8",
    icon: "text-amber-500",
    badge: "bg-amber-400/12 text-amber-600 dark:text-amber-400",
  },
};

function SignalCard({ signal }: { signal: AdSignal }) {
  const meta = SIGNAL_META[signal.type];
  const sev = SEV_STYLES[signal.severity];
  const Icon = meta.icon;

  return (
    <div className={`rounded-xl p-4 border ${sev.wrap}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex-shrink-0 ${sev.icon}`}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <h3 className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">{signal.issue}</h3>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${sev.badge}`}>
              {signal.severity}
            </span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: signal.color }} />
            <span className="text-xs font-medium text-[#3A3A3A]/65 dark:text-[#FFF9F2]/55">{signal.channelLabel}</span>
            <span className="text-xs text-[#3A3A3A]/30 dark:text-[#FFF9F2]/25">·</span>
            <span className="text-[11px] tabular-nums text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 font-mono">
              {signal.priorValue} → <strong className={sev.icon}>{signal.currentValue}</strong>
            </span>
            <span className={`text-[10px] font-medium ${sev.icon}`}>({signal.changeText})</span>
          </div>
          <p className="text-xs text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 leading-relaxed mb-2.5">
            {signal.explanation}
          </p>
          <div className="flex items-start gap-1.5 p-2 rounded-lg bg-white/60 dark:bg-white/5">
            <ArrowRight size={11} className="mt-0.5 text-[#FFBC80] flex-shrink-0" />
            <p className="text-xs text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60 italic leading-relaxed">
              {signal.recommendation}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section 4: Funnel Analysis ───────────────────────────────────────────────

function FunnelView({ funnel }: { funnel: ChannelFunnel }) {
  const [impressions, clicks, conversions] = funnel.stages;

  return (
    <div className="space-y-1">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60">Impressions</span>
          <span className="text-sm font-bold tabular-nums text-[#3A3A3A] dark:text-[#FFF9F2]">{impressions.formatted}</span>
        </div>
        <div className="h-7 rounded-md overflow-hidden bg-[#FFBC80]/10">
          <div className="h-full rounded-md" style={{ width: "100%", background: funnel.color, opacity: 0.85 }} />
        </div>
      </div>

      <div className={`flex items-center gap-2 py-1.5 px-2 rounded-lg text-xs ${
        clicks.isLargestDropOff ? "bg-red-500/8 text-red-500" : "bg-amber-400/8 text-amber-600 dark:text-amber-400"
      }`}>
        <ArrowDown size={12} className="flex-shrink-0" />
        <span className="font-medium">
          {clicks.dropOff.toFixed(1)}% drop-off &nbsp;·&nbsp; CTR: {(clicks.rate ?? 0).toFixed(2)}%
        </span>
        {clicks.isLargestDropOff && (
          <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/15 text-red-600">Largest</span>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60">Clicks</span>
          <span className="text-sm font-bold tabular-nums text-[#3A3A3A] dark:text-[#FFF9F2]">{clicks.formatted}</span>
        </div>
        <div className="h-7 rounded-md overflow-hidden bg-[#FFBC80]/10">
          <div className="h-full rounded-md transition-all" style={{ width: `${Math.max(clicks.relativeWidth, 1)}%`, background: funnel.color, opacity: 0.65 }} />
        </div>
      </div>

      <div className={`flex items-center gap-2 py-1.5 px-2 rounded-lg text-xs ${
        conversions.isLargestDropOff ? "bg-red-500/8 text-red-500" : "bg-amber-400/8 text-amber-600 dark:text-amber-400"
      }`}>
        <ArrowDown size={12} className="flex-shrink-0" />
        <span className="font-medium">
          {conversions.dropOff.toFixed(1)}% drop-off &nbsp;·&nbsp; CVR: {(conversions.rate ?? 0).toFixed(2)}%
        </span>
        {conversions.isLargestDropOff && (
          <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/15 text-red-600">Largest</span>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60">Conversions</span>
          <span className="text-sm font-bold tabular-nums text-[#3A3A3A] dark:text-[#FFF9F2]">{conversions.formatted}</span>
        </div>
        <div className="h-7 rounded-md overflow-hidden bg-[#FFBC80]/10">
          <div className="h-full rounded-md transition-all" style={{ width: `${Math.max(conversions.relativeWidth, 0.3)}%`, background: funnel.color, opacity: 0.45 }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-[#FFBC80]/15">
        <div className="rounded-lg p-2.5 bg-[#FFBC80]/8 border border-[#FFBC80]/20">
          <p className="text-[10px] font-semibold text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 uppercase tracking-wide mb-1">ROAS</p>
          <p className="text-base font-black tabular-nums text-[#3A3A3A] dark:text-[#FFF9F2]">{funnel.roas.toFixed(1)}x</p>
        </div>
        <div className="rounded-lg p-2.5 bg-emerald-500/8 border border-emerald-500/20">
          <p className="text-[10px] font-semibold text-emerald-600/70 dark:text-emerald-400/60 uppercase tracking-wide mb-1">Revenue</p>
          <p className="text-base font-black tabular-nums text-emerald-600 dark:text-emerald-400">{fmtCurrency(funnel.revenue)}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Section 6: Advanced Intelligence Table ───────────────────────────────────

function advancedColor(value: number, type: "elasticity" | "lift" | "ipc" | "decay"): string {
  const green = "text-emerald-600 dark:text-emerald-400";
  const amber = "text-amber-600 dark:text-amber-400";
  const red = "text-red-500 dark:text-red-400";
  if (type === "elasticity") return value >= 0.7 ? green : value >= 0.5 ? amber : red;
  if (type === "lift")       return value >= 75   ? green : value >= 50   ? amber : red;
  if (type === "ipc")        return value <= 25   ? green : value <= 50   ? amber : red;
  if (type === "decay")      return value <= 12   ? green : value <= 22   ? amber : red;
  return "";
}

function AdvancedTable({ rows }: { rows: AdvancedRow[] }) {
  const thCls = "px-3 py-2.5 text-left text-[10px] font-semibold text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 uppercase tracking-wider whitespace-nowrap";
  const TOOLTIPS: Record<string, string> = {
    elasticity:          "Sensitivity of revenue to changes in spend (0–1). Higher = more scalable.",
    incrementalLift:     "% of revenue directly attributable to the advertising (not organic).",
    impressionsPerClick: "Avg impressions required to generate one click. Lower = more engagement-efficient.",
    efficiencyDecay:     "Rate at which ROAS degrades as spend scales up. Lower = more headroom.",
  };

  return (
    <div className={`${CARD_CLASS} overflow-hidden`}>
      <div className="px-5 py-4 border-b border-[#FFBC80]/15">
        <h2 className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">Advanced Intelligence</h2>
        <p className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 mt-0.5">
          Scalability, attribution, and saturation signals per channel
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#FFBC80]/10">
              <th className={thCls + " min-w-[150px]"}>Channel</th>
              {(["elasticity", "incrementalLift", "impressionsPerClick", "efficiencyDecay"] as const).map((key, i) => (
                <th key={key} className={thCls + " text-right"}>
                  <span title={TOOLTIPS[key]} className="flex items-center justify-end gap-1 cursor-help">
                    {["Elasticity", "Incr. Lift %", "Impr. / Click", "Eff. Decay %"][i]}
                    <Info size={10} className="opacity-40" />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.channelId} className="border-b border-[#FFBC80]/8 hover:bg-[#FFBC80]/4 transition-colors">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: row.color }} />
                    <span className="font-medium text-[#3A3A3A] dark:text-[#FFF9F2] whitespace-nowrap">{row.channelLabel}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <div className="w-14 h-1.5 rounded-full bg-[#3A3A3A]/8 dark:bg-[#FFF9F2]/8 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${row.elasticity * 100}%`, background: row.elasticity >= 0.7 ? "#10b981" : row.elasticity >= 0.5 ? "#f59e0b" : "#ef4444" }} />
                    </div>
                    <span className={`tabular-nums font-semibold ${advancedColor(row.elasticity, "elasticity")}`}>{row.elasticity.toFixed(2)}</span>
                  </div>
                </td>
                <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${advancedColor(row.incrementalLift, "lift")}`}>
                  {row.incrementalLift.toFixed(1)}%
                </td>
                <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${advancedColor(row.impressionsPerClick, "ipc")}`}>
                  {row.impressionsPerClick.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <span className={`tabular-nums font-semibold ${advancedColor(row.efficiencyDecay, "decay")}`}>{row.efficiencyDecay.toFixed(1)}%</span>
                    <div className="w-10 h-1.5 rounded-full bg-[#3A3A3A]/8 dark:bg-[#FFF9F2]/8 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(row.efficiencyDecay / 35 * 100, 100)}%`, background: row.efficiencyDecay <= 12 ? "#10b981" : row.efficiencyDecay <= 22 ? "#f59e0b" : "#ef4444" }} />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3 border-t border-[#FFBC80]/10 flex flex-wrap gap-3">
        {[{ color: "bg-emerald-500", label: "Strong / scalable" }, { color: "bg-amber-400", label: "Moderate / watch" }, { color: "bg-red-500", label: "Weak / saturated" }].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-[10px] text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35">
            <span className={`w-2 h-2 rounded-full ${color}`} /> {label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Attribution() {
  const { dateRange } = useDateRange();
  const { selectedIds: storeIds } = useStoreFilter();
  const { mode: pricingMode } = usePricingMode();

  // All channels available for the selected stores (drives the channel selector)
  const allChannels = useMemo(() => getChannelsForStores(storeIds), [storeIds]);

  // selectedChannelIds: empty set = all channels active (same pattern as StoreFilterContext)
  const [selectedChannelIds, setSelectedChannelIds] = useState<Set<string>>(new Set());

  // When available channels change (store filter changed), drop channels that no longer exist
  useEffect(() => {
    if (selectedChannelIds.size === 0) return; // "all" — nothing to prune
    const available = new Set(allChannels.map(c => c.channelId));
    const pruned = new Set([...selectedChannelIds].filter(id => available.has(id)));
    if (pruned.size !== selectedChannelIds.size) {
      setSelectedChannelIds(pruned.size > 0 ? pruned : new Set()); // fallback to "all"
    }
  }, [allChannels]); // eslint-disable-line react-hooks/exhaustive-deps

  const isChannelActive = (id: string) => selectedChannelIds.size === 0 || selectedChannelIds.has(id);

  const handleToggleChannel = (id: string) => {
    setSelectedChannelIds(prev => {
      if (prev.size === 0) {
        // "All" mode → deselect this one (add all others)
        const next = new Set(allChannels.map(c => c.channelId));
        next.delete(id);
        return next.size > 0 ? next : prev;
      }
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (next.size === 0) return prev; // can't deselect last
        if (next.size === allChannels.length) return new Set(); // all = normalize to empty
      } else {
        next.add(id);
        if (next.size === allChannels.length) return new Set(); // all = normalize to empty
      }
      return next;
    });
  };

  const handleSelectAll = () => setSelectedChannelIds(new Set());
  const handleClearAll = () => {
    if (allChannels.length > 0) setSelectedChannelIds(new Set([allChannels[0].channelId]));
  };

  // Derive filterChannelIds for the data engine (undefined = no filter = all)
  const filterChannelIds = useMemo(
    () => selectedChannelIds.size > 0 ? [...selectedChannelIds] : undefined,
    [selectedChannelIds],
  );

  const data = useMemo(() => generateAdAttributionData({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    selectedStoreIds: storeIds,
    filterChannelIds,
    pricingMode,
  }), [dateRange.startDate, dateRange.endDate, storeIds, filterChannelIds, pricingMode]);

  // Funnel channel selector
  const [funnelChannelId, setFunnelChannelId] = useState<string>("");
  const effectiveFunnelId = funnelChannelId || data.channels[0]?.channelId || "";
  const selectedFunnel: ChannelFunnel | undefined =
    data.funnels.find(f => f.channelId === effectiveFunnelId) ?? data.funnels[0];

  const hasData = data.channels.length > 0;

  return (
    <DashboardLayout
      title="Ad Attribution"
      description="Paid media performance command center — efficiency, signals, and channel intelligence."
    >
      

      {allChannels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <AlertTriangle size={36} className="text-[#FFBC80]/50" />
          <p className="text-sm text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 text-center max-w-xs">
            No ad channels found for the selected stores. Adjust your store filter to see channel data.
          </p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* ── Channel Selector ──────────────────────────────────────────── */}
          <section>
            <ChannelSelector
              allChannels={allChannels}
              selected={selectedChannelIds}
              onToggle={handleToggleChannel}
              onSelectAll={handleSelectAll}
              onClearAll={handleClearAll}
            />
          </section>

          {!hasData ? (
            <div className={`${CARD_CLASS} p-10 text-center`}>
              <p className="text-sm text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35">
                No data for the selected channels. Select at least one channel above.
              </p>
            </div>
          ) : (
            <>

              {/* ── 1. Blended Ad Metrics ─────────────────────────────────── */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">Blended Ad Metrics</h2>
                  <span className="text-[10px] text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">vs prior period</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {data.blendedMetrics.map(m => <BlendedMetricCard key={m.id} m={m} />)}
                </div>
              </section>

              {/* ── 2. Core Efficiency Table ──────────────────────────────── */}
              <section>
                <EfficiencyTable rows={data.channels} />
              </section>

              {/* ── 3. Signal Detector ────────────────────────────────────── */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">Signal Detector</h2>
                  {data.signals.length > 0 ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/12 text-red-600 dark:text-red-400">
                      {data.signals.filter(s => s.severity === "critical").length} critical
                      {data.signals.filter(s => s.severity === "warning").length > 0 &&
                        `, ${data.signals.filter(s => s.severity === "warning").length} warning`}
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
                      All clear
                    </span>
                  )}
                </div>
                {data.signals.length === 0 ? (
                  <div className={`${CARD_CLASS} p-8 text-center`}>
                    <p className="text-sm text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">
                      No performance issues detected for this period.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {data.signals.map(signal => <SignalCard key={signal.id} signal={signal} />)}
                  </div>
                )}
              </section>

              {/* ── 4. Funnel Analysis ────────────────────────────────────── */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">Funnel Analysis</h2>
                  <span className="text-[10px] text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">Impressions → Clicks → Conversions</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
                  <div className={`${CARD_CLASS} p-4`}>
                    <p className="text-[10px] font-semibold text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 uppercase tracking-wider mb-2">
                      Select Channel
                    </p>
                    <div className="space-y-1">
                      {data.funnels.map(f => (
                        <button
                          key={f.channelId}
                          onClick={() => setFunnelChannelId(f.channelId)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs transition-all ${
                            effectiveFunnelId === f.channelId
                              ? "bg-[#FFBC80]/15 font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]"
                              : "text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 hover:bg-[#FFBC80]/8"
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: f.color }} />
                          <span className="truncate">{f.channelLabel}</span>
                          {effectiveFunnelId === f.channelId && (
                            <span className="ml-auto text-[9px] font-bold text-[#FFBC80]">▶</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={`${CARD_CLASS} p-5`}>
                    {selectedFunnel ? (
                      <>
                        <div className="flex items-center gap-2 mb-4">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: selectedFunnel.color }} />
                          <h3 className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">{selectedFunnel.channelLabel}</h3>
                          <span className="text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">conversion funnel</span>
                        </div>
                        <FunnelView funnel={selectedFunnel} />
                      </>
                    ) : (
                      <p className="text-xs text-[#3A3A3A]/40 text-center py-8">Select a channel to view funnel data.</p>
                    )}
                  </div>
                </div>
              </section>

              {/* ── 5. Daily ROAS Trend (Line Chart) ─────────────────────── */}
              <section>
                <div className={`${CARD_CLASS} p-5`}>
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
                    <div>
                      <h2 className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">Daily ROAS Trend</h2>
                      <p className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 mt-0.5">
                        Return on ad spend over time — channels reflect selection above
                      </p>
                    </div>
                    {/* Inline channel colour legend */}
                    <div className="flex flex-wrap gap-2">
                      {data.trendChannelIds.map(id => {
                        const ch = data.channels.find(c => c.channelId === id);
                        if (!ch) return null;
                        return (
                          <div
                            key={id}
                            className="flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full"
                            style={{ background: `${ch.color}12`, color: ch.color, border: `1px solid ${ch.color}30` }}
                          >
                            <span className="w-3 border-b-2 flex-shrink-0" style={{ borderColor: ch.color }} />
                            {ch.channelLabel}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart
                      data={data.roasTrend}
                      margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(58,58,58,0.06)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: "rgba(58,58,58,0.40)" }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tickFormatter={v => `${v}x`}
                        tick={{ fontSize: 10, fill: "rgba(58,58,58,0.40)" }}
                        axisLine={false}
                        tickLine={false}
                        width={36}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(255,249,242,0.97)",
                          border: "1px solid #FFBC80",
                          borderRadius: "10px",
                          fontSize: 11,
                          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                        }}
                        formatter={(value: number, name: string) => [
                          `${Number(value).toFixed(2)}x`,
                          data.channels.find(c => c.channelId === name)?.channelLabel ?? name,
                        ]}
                        labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                        itemStyle={{ padding: "1px 0" }}
                      />
                      {data.trendChannelIds.map(id => {
                        const ch = data.channels.find(c => c.channelId === id);
                        return (
                          <Line
                            key={id}
                            type="monotone"
                            dataKey={id}
                            name={id}
                            stroke={ch?.color ?? "#FFBC80"}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 0, fill: ch?.color ?? "#FFBC80" }}
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {/* ── 6. Advanced Intelligence ──────────────────────────────── */}
              <section>
                <div className="mb-3">
                  <h2 className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">Advanced Intelligence</h2>
                </div>
                <AdvancedTable rows={data.advanced} />
              </section>

            </>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
