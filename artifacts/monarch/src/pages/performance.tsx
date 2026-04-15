import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
  Legend,
} from "recharts";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useDateRange } from "@/context/DateRangeContext";
import { useStoreFilter } from "@/context/StoreFilterContext";
import { usePricingMode } from "@/context/PricingModeContext";
import { getChannelsForStores, type ChannelMapping } from "@/lib/channelStoreMapping";
import {
  generatePerformanceTrendsData,
  EFFICIENCY_METRICS,
  type EfficiencyMetric,
  type EfficiencyMetricMeta,
  type ChannelMetricSeries,
  type ROASAnomaly,
  type DowDataPoint,
} from "@/lib/performanceTrendsData";
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, TrendingUpIcon,
  ChevronDown, SlidersHorizontal,
} from "lucide-react";

// ─── Formatting Helpers ───────────────────────────────────────────────────────

function fmtMetric(value: unknown, meta: EfficiencyMetricMeta, compact = false): string {
  const v = Number(value);
  if (value == null || isNaN(v)) return "—";
  if (meta.prefix === "$") {
    if (compact && v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
    return `$${v.toFixed(meta.decimals)}`;
  }
  if (meta.suffix === "%") return `${v.toFixed(meta.decimals)}%`;
  if (meta.suffix === "x") return `${v.toFixed(meta.decimals)}x`;
  return v.toFixed(meta.decimals);
}

function fmtCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v).toLocaleString()}`;
}

function fmtCompact(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

// ─── Shared Styles ────────────────────────────────────────────────────────────

const CARD_STYLE = {
  border: "1px solid transparent",
  backgroundImage:
    "linear-gradient(#fff, #fff), linear-gradient(135deg, #FFBC80 0%, #FFE29A 100%)",
  backgroundOrigin: "border-box",
  backgroundClip:   "padding-box, border-box",
};

const TT_STYLE = {
  background:   "rgba(255,249,242,0.97)",
  border:       "1px solid #FFBC80",
  borderRadius: "10px",
  fontSize:     12,
  boxShadow:    "0 4px 20px rgba(0,0,0,0.08)",
  padding:      "8px 12px",
};

const AXIS_TICK   = { fontSize: 11, fill: "rgba(58,58,58,0.45)" };
const GRID_STROKE = "rgba(58,58,58,0.06)";

const FAMILY_LABELS: Record<string, string> = {
  core:         "Core Media",
  rmn:          "Retail Media (RMN)",
  experimental: "Experimental",
};
const FAMILY_ORDER = ["core", "rmn", "experimental"];

// ─── Channel Selector Accordion ───────────────────────────────────────────────

interface ChannelSelectorAccordionProps {
  allChannels: ChannelMapping[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

function ChannelSelectorAccordion({
  allChannels, selected, onToggle, onSelectAll, onClearAll,
}: ChannelSelectorAccordionProps) {
  const [open, setOpen] = useState(false);
  const isAll        = selected.size === 0;
  const activeCount  = isAll ? allChannels.length : selected.size;
  const isActive     = (id: string) => isAll || selected.has(id);

  const activeChannels = isAll ? allChannels : allChannels.filter((c) => selected.has(c.channelId));
  const previewDots    = activeChannels.slice(0, 6);
  const overflow       = activeCount - 6;

  const groups = useMemo(() => {
    const map: Record<string, ChannelMapping[]> = {};
    for (const ch of allChannels) {
      if (!map[ch.channelFamily]) map[ch.channelFamily] = [];
      map[ch.channelFamily].push(ch);
    }
    return FAMILY_ORDER
      .filter((f) => map[f]?.length)
      .map((f) => ({ family: f, channels: map[f] }));
  }, [allChannels]);

  return (
    <div className="rounded-xl bg-white dark:bg-[#231a0e]" style={CARD_STYLE}>
      {/* ── Trigger row ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left select-none"
      >
        <SlidersHorizontal size={13} className="text-[#FFBC80] flex-shrink-0" />

        <span className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">
          Channels
        </span>

        {/* Color dot preview */}
        <div className="flex items-center -space-x-0.5 ml-1">
          {previewDots.map((ch) => (
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
                  {channels.map((ch) => {
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

// ─── Signal Badge ─────────────────────────────────────────────────────────────

function SignalBadge({ signal }: { signal: "improving" | "declining" | "stable" }) {
  const cfg = {
    improving: { Icon: TrendingUp,   label: "Improving", cls: "text-emerald-600 dark:text-emerald-400" },
    declining: { Icon: TrendingDown, label: "Declining", cls: "text-red-500 dark:text-red-400"         },
    stable:    { Icon: Minus,        label: "Stable",    cls: "text-blue-500 dark:text-blue-400"        },
  }[signal];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${cfg.cls}`}>
      <cfg.Icon size={10} />
      {cfg.label}
    </span>
  );
}

// ─── Custom Tooltips ──────────────────────────────────────────────────────────

interface TooltipBaseProps {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: unknown; color?: string; stroke?: string; name?: string }>;
  label?: string;
}

function EfficiencyTooltip({
  active, payload, label, meta, channelSeries,
}: TooltipBaseProps & { meta: EfficiencyMetricMeta; channelSeries: ChannelMetricSeries[] }) {
  if (!active || !payload?.length) return null;
  const main = payload.filter(
    (p) => !String(p.dataKey).endsWith("_ma7") && !String(p.dataKey).endsWith("_ma30"),
  );
  if (!main.length) return null;
  return (
    <div style={TT_STYLE}>
      <p className="text-xs font-semibold text-[#3A3A3A] mb-2 pb-1.5 border-b border-[#FFBC80]/20">{label}</p>
      {main.map((entry) => {
        const s = channelSeries.find((c) => c.channelId === entry.dataKey);
        if (!s) return null;
        return (
          <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
            <span className="text-xs text-[#3A3A3A]/70 flex-1">{s.channelLabel}</span>
            <span className="text-xs font-semibold text-[#3A3A3A] ml-3">
              {fmtMetric(entry.value, meta)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DowTooltip({ active, payload, label }: TooltipBaseProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TT_STYLE}>
      <p className="text-xs font-semibold text-[#3A3A3A] mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex justify-between gap-6 py-0.5">
          <span className="text-xs" style={{ color: entry.color }}>{entry.name}</span>
          <span className="text-xs font-semibold text-[#3A3A3A]">{fmtCurrency(Number(entry.value))}</span>
        </div>
      ))}
    </div>
  );
}

function RevSpendTooltip({ active, payload, label }: TooltipBaseProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TT_STYLE}>
      <p className="text-xs font-semibold text-[#3A3A3A] mb-2 pb-1.5 border-b border-[#FFBC80]/20">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex justify-between gap-6 py-0.5">
          <span className="text-xs" style={{ color: entry.color ?? entry.stroke }}>{entry.name}</span>
          <span className="text-xs font-semibold text-[#3A3A3A]">{fmtCurrency(Number(entry.value))}</span>
        </div>
      ))}
    </div>
  );
}

// ─── DOW Insight Card ─────────────────────────────────────────────────────────

function DowInsightCard({ day, value, type }: { day: DowDataPoint; value: number; type: "best" | "slowest" }) {
  const isBest = type === "best";
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
        isBest
          ? "bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200/60 dark:border-emerald-700/30"
          : "bg-red-50 dark:bg-red-900/10 border border-red-200/60 dark:border-red-700/30"
      }`}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isBest ? "bg-emerald-100 dark:bg-emerald-800/30" : "bg-red-100 dark:bg-red-800/30"
        }`}
      >
        {isBest ? (
          <TrendingUpIcon size={15} className="text-emerald-600 dark:text-emerald-400" />
        ) : (
          <TrendingDown size={15} className="text-red-500 dark:text-red-400" />
        )}
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">
          {isBest ? "Best Day" : "Slowest Day"}
        </p>
        <p className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">{day.dayFull}</p>
        <p className={`text-xs font-medium ${isBest ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
          {fmtCurrency(value)} avg revenue
        </p>
      </div>
    </div>
  );
}

// ─── Anomaly Row ──────────────────────────────────────────────────────────────

function AnomalyRow({ anomaly }: { anomaly: ROASAnomaly }) {
  const isAbove = anomaly.type === "above";
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-[#FFF9F2]/60 dark:bg-[#120d06]/50 border border-[#FFBC80]/10">
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: anomaly.channelColor }} />
      <span className="text-xs font-medium text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60 w-28 truncate">
        {anomaly.channelLabel}
      </span>
      <span className="text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 w-14 flex-shrink-0">
        {anomaly.label}
      </span>
      <span className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2] w-12 flex-shrink-0">
        {anomaly.roasValue.toFixed(2)}x
      </span>
      <span className="text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 flex-1 hidden sm:block">
        avg {anomaly.avgRoas.toFixed(2)}x
      </span>
      <span
        className={`ml-auto text-xs font-bold flex-shrink-0 ${
          isAbove ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
        }`}
      >
        {isAbove ? "+" : ""}{anomaly.deviationPct.toFixed(1)}%
      </span>
      <span
        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
          isAbove
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
            : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
        }`}
      >
        {isAbove ? "Above" : "Below"}
      </span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Performance() {
  const { dateRange }   = useDateRange();
  const { selectedIds } = useStoreFilter();
  const { mode: pricingMode } = usePricingMode();

  const [metric, setMetric]     = useState<EfficiencyMetric>("roas");
  const [showMA7, setShowMA7]   = useState(false);
  const [showMA30, setShowMA30] = useState(false);

  // Channel selection state (empty Set = all channels)
  const [selectedChannelIds, setSelectedChannelIds] = useState<Set<string>>(new Set());

  // All channels available for the current store selection (for the picker)
  const allChannels = useMemo(
    () => getChannelsForStores(selectedIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedIds.join(",")],
  );

  const handleToggleChannel = (id: string) => {
    setSelectedChannelIds((prev) => {
      const isAll = prev.size === 0;
      const next  = isAll
        ? new Set(allChannels.map((c) => c.channelId))
        : new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (!next.size) return new Set();         // back to "all"
      } else {
        next.add(id);
        if (next.size === allChannels.length) return new Set(); // back to "all"
      }
      return next;
    });
  };

  const handleSelectAll = () => setSelectedChannelIds(new Set());
  const handleClearAll  = () =>
    setSelectedChannelIds(new Set([allChannels[0]?.channelId ?? ""]));

  // Generate chart data — respects date range, store filter, and channel filter
  const data = useMemo(
    () =>
      generatePerformanceTrendsData({
        startDate:        dateRange.startDate,
        endDate:          dateRange.endDate,
        selectedStoreIds: selectedIds,
        metric,
        channelIds:       selectedChannelIds.size > 0 ? [...selectedChannelIds] : undefined,
        pricingMode,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      dateRange.startDate,
      dateRange.endDate,
      selectedIds.join(","),
      metric,
      // stable primitive for the channel set
      [...selectedChannelIds].sort().join(","),
      pricingMode,
    ],
  );

  const metricMeta = EFFICIENCY_METRICS.find((m) => m.id === metric)!;

  const xInterval        = Math.max(0, Math.floor(data.chartRows.length / 7) - 1);
  const xIntervalRevSpend = Math.max(0, Math.floor(data.revSpendSeries.length / 7) - 1);
  const yFmt = (v: number) => fmtMetric(v, metricMeta, true);

  return (
    <DashboardLayout
      title="Performance Trends"
      description="Efficiency trends, seasonality patterns, and anomaly detection across channels."
    >
      <div className="space-y-6">

        {/* ── Channel Selector Accordion ────────────────────────────────── */}
        <ChannelSelectorAccordion
          allChannels={allChannels}
          selected={selectedChannelIds}
          onToggle={handleToggleChannel}
          onSelectAll={handleSelectAll}
          onClearAll={handleClearAll}
        />

        {/* ── Section 1: Daily Revenue vs Spend Composition ─────────────── */}
        <div className="rounded-xl p-6 bg-white dark:bg-[#231a0e]" style={CARD_STYLE}>
          <h2 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] mb-1">
            Daily Revenue vs. Spend Composition
          </h2>
          <p className="text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 mb-5">
            Alignment between total revenue and advertising spend over time
          </p>

          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart
              data={data.revSpendSeries as object[]}
              margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#FFBC80" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#FFBC80" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#60A5FA" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#60A5FA" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
              <XAxis
                dataKey="label"
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                interval={xIntervalRevSpend}
              />
              <YAxis
                tickFormatter={fmtCompact}
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip
                content={(props) => (
                  <RevSpendTooltip
                    active={props.active}
                    payload={props.payload as TooltipBaseProps["payload"]}
                    label={props.label as string}
                  />
                )}
              />
              <Legend
                iconType="square"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, color: "rgba(58,58,58,0.5)", paddingTop: 12 }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Total Revenue"
                stroke="#FFBC80"
                strokeWidth={2}
                fill="url(#revGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "#FFBC80", strokeWidth: 0 }}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="spend"
                name="Ad Spend"
                stroke="#60A5FA"
                strokeWidth={2}
                fill="url(#spendGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "#60A5FA", strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* ── Section 2: Efficiency Trends ──────────────────────────────── */}
        <div className="rounded-xl p-6 bg-white dark:bg-[#231a0e]" style={CARD_STYLE}>
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">
                Efficiency Trends
              </h2>
              <p className="text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 mt-0.5">
                {metricMeta.label} — {metricMeta.description} · one line per active channel
              </p>
            </div>

            {/* MA toggle */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showMA7}
                  onChange={(e) => setShowMA7(e.target.checked)}
                  className="rounded border-[#FFBC80]/40 accent-[#FFBC80]"
                />
                <span className="flex items-center gap-1.5 text-xs text-[#3A3A3A]/55 dark:text-[#FFF9F2]/40">
                  <span style={{ display: "inline-block", width: 18, height: 0, borderTop: "2px dashed #FFBC80" }} />
                  7-day MA
                </span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showMA30}
                  onChange={(e) => setShowMA30(e.target.checked)}
                  className="rounded border-[#FFBC80]/40 accent-[#FFBC80]"
                />
                <span className="flex items-center gap-1.5 text-xs text-[#3A3A3A]/55 dark:text-[#FFF9F2]/40">
                  <span style={{ display: "inline-block", width: 18, height: 0, borderTop: "2px dotted #FFBC80" }} />
                  30-day MA
                </span>
              </label>
            </div>
          </div>

          {/* Metric Selector */}
          <div className="flex flex-wrap gap-2 mb-5">
            {EFFICIENCY_METRICS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMetric(m.id)}
                title={m.description}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  metric === m.id
                    ? "bg-[#FFBC80] text-[#3A3A3A] shadow-sm"
                    : "bg-[#FFF9F2] dark:bg-[#120d06] text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 border border-[#FFBC80]/25 hover:border-[#FFBC80]/60 hover:text-[#3A3A3A]/80 dark:hover:text-[#FFF9F2]/70"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {data.channels.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[280px] text-center">
              <SlidersHorizontal size={24} className="text-[#FFBC80]/30 mb-3" />
              <p className="text-sm text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">
                No channels selected
              </p>
              <p className="text-xs text-[#3A3A3A]/25 dark:text-[#FFF9F2]/20 mt-1">
                Use the channel filter above to select at least one channel.
              </p>
            </div>
          ) : (
            <>
              {/* Chart */}
              <ResponsiveContainer width="100%" height={280}>
                <LineChart
                  data={data.chartRows as object[]}
                  margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                    interval={xInterval}
                  />
                  <YAxis
                    tickFormatter={yFmt}
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                    width={52}
                  />
                  <Tooltip
                    content={(props) => (
                      <EfficiencyTooltip
                        active={props.active}
                        payload={props.payload as TooltipBaseProps["payload"]}
                        label={props.label as string}
                        meta={metricMeta}
                        channelSeries={data.channelSeries}
                      />
                    )}
                  />

                  {/* Main channel lines */}
                  {data.channels.map((ch) => (
                    <Line
                      key={ch.channelId}
                      type="monotone"
                      dataKey={ch.channelId}
                      stroke={ch.color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  ))}

                  {/* 7-day MA lines (dashed) */}
                  {showMA7 &&
                    data.channels.map((ch) => (
                      <Line
                        key={`${ch.channelId}_ma7`}
                        type="monotone"
                        dataKey={`${ch.channelId}_ma7`}
                        stroke={ch.color}
                        strokeWidth={1.5}
                        strokeDasharray="6 3"
                        dot={false}
                        activeDot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                        legendType="none"
                      />
                    ))}

                  {/* 30-day MA lines (dotted) */}
                  {showMA30 &&
                    data.channels.map((ch) => (
                      <Line
                        key={`${ch.channelId}_ma30`}
                        type="monotone"
                        dataKey={`${ch.channelId}_ma30`}
                        stroke={ch.color}
                        strokeWidth={1.5}
                        strokeDasharray="2 2"
                        dot={false}
                        activeDot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                        legendType="none"
                      />
                    ))}

                  {/* ROAS anomaly markers */}
                  {metric === "roas" &&
                    data.anomalies.map((a) => (
                      <ReferenceDot
                        key={`${a.channelId}-${a.date}`}
                        x={a.label}
                        y={a.roasValue}
                        r={6}
                        fill={a.channelColor}
                        stroke="white"
                        strokeWidth={2}
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>

              {/* Channel signal badges */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 mt-4 pt-4 border-t border-[#FFBC80]/10">
                {data.channelSeries.map((s) => (
                  <div
                    key={s.channelId}
                    className="flex flex-col gap-1 px-3 py-2 rounded-lg bg-[#FFF9F2]/60 dark:bg-[#120d06]/50"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: s.color }}
                      />
                      <span className="text-[10px] font-medium text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60 truncate">
                        {s.channelLabel}
                      </span>
                    </div>
                    <SignalBadge signal={s.signal} />
                    <span className="text-[10px] text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25">
                      {fmtMetric(s.latestValue, metricMeta)} latest
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Section 3: Day-of-Week Seasonality ───────────────────────── */}
        <div className="rounded-xl p-6 bg-white dark:bg-[#231a0e]" style={CARD_STYLE}>
          <h2 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] mb-1">
            Day-of-Week Seasonality
          </h2>
          <p className="text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 mb-5">
            Average daily revenue and ad spend by weekday across the selected period
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            <DowInsightCard day={data.bestDay}    value={data.bestDay.avgRevenue}    type="best"    />
            <DowInsightCard day={data.slowestDay} value={data.slowestDay.avgRevenue} type="slowest" />
          </div>

          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={data.dowData as object[]}
              margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
              barCategoryGap="22%"
              barGap={3}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
              <XAxis
                dataKey="day"
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={fmtCompact}
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip
                content={(props) => (
                  <DowTooltip
                    active={props.active}
                    payload={props.payload as TooltipBaseProps["payload"]}
                    label={props.label as string}
                  />
                )}
              />
              <Legend
                iconType="square"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, color: "rgba(58,58,58,0.5)", paddingTop: 12 }}
              />
              <Bar dataKey="avgRevenue" name="Avg Revenue" fill="#FFBC80" radius={[4, 4, 0, 0]} />
              <Bar dataKey="avgSpend"   name="Avg Spend"   fill="#60A5FA" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── Section 4: Signal Intelligence ───────────────────────────── */}
        <div className="rounded-xl p-6 bg-white dark:bg-[#231a0e]" style={CARD_STYLE}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-[#FFBC80]" />
            <h2 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">
              Signal Intelligence
            </h2>
          </div>
          <p className="text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 mb-5">
            ROAS anomalies where daily performance deviates ≥40% from the period average — top 6 by magnitude
          </p>

          {data.anomalies.length > 0 && (
            <div className="flex items-center gap-3 px-3 pb-2 mb-1 border-b border-[#FFBC80]/10">
              <span className="w-2.5" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#3A3A3A]/30 dark:text-[#FFF9F2]/20 w-28">Channel</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#3A3A3A]/30 dark:text-[#FFF9F2]/20 w-14">Date</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#3A3A3A]/30 dark:text-[#FFF9F2]/20 w-12">ROAS</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#3A3A3A]/30 dark:text-[#FFF9F2]/20 flex-1 hidden sm:block">Period Avg</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#3A3A3A]/30 dark:text-[#FFF9F2]/20 ml-auto">Deviation</span>
              <span className="w-14" />
            </div>
          )}

          {data.anomalies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/10 flex items-center justify-center mb-3">
                <TrendingUp size={18} className="text-emerald-500" />
              </div>
              <p className="text-sm font-medium text-[#3A3A3A]/50 dark:text-[#FFF9F2]/30">
                No anomalies detected
              </p>
              <p className="text-xs text-[#3A3A3A]/30 dark:text-[#FFF9F2]/20 mt-1">
                ROAS is within ±40% of average across all active channels
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.anomalies.map((a) => (
                <AnomalyRow key={`${a.channelId}-${a.date}`} anomaly={a} />
              ))}
            </div>
          )}

          {data.anomalies.length > 0 && (
            <p className="text-[10px] text-[#3A3A3A]/30 dark:text-[#FFF9F2]/20 mt-4">
              Anomaly markers (●) appear on the ROAS trend chart when ROAS is selected.
            </p>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
