/**
 * Channel Deep Dive Table
 * Full MMM metrics per channel with expandable rows showing saturation curves.
 */
import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, ReferenceLine, Tooltip,
  ResponsiveContainer, type TooltipProps,
} from "recharts";
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { ChannelMMM, SaturationStatus, Recommendation, Confidence } from "@/lib/spendData";
import { MetricTooltip } from "@/components/ui/MetricTooltip";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v)}`;
}

function fmtRoas(v: number): string { return `${v.toFixed(2)}x`; }
function fmtPct(v: number): string { return `${v.toFixed(1)}%`; }

const SAT_CONFIG: Record<SaturationStatus, { label: string; bg: string; text: string }> = {
  "under-invested": { label: "Under-invested", bg: "bg-blue-100 dark:bg-blue-900/30",   text: "text-blue-700 dark:text-blue-300" },
  "efficient":      { label: "Efficient",       bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300" },
  "saturated":      { label: "Saturated",       bg: "bg-amber-100 dark:bg-amber-900/30",  text: "text-amber-700 dark:text-amber-300" },
  "over-invested":  { label: "Over-invested",   bg: "bg-red-100 dark:bg-red-900/30",     text: "text-red-700 dark:text-red-300" },
};

const REC_CONFIG: Record<Recommendation, { icon: React.FC<{className?: string}>; text: string; color: string }> = {
  increase: { icon: TrendingUp,   text: "Increase",  color: "text-emerald-600 dark:text-emerald-400" },
  decrease: { icon: TrendingDown, text: "Decrease",  color: "text-red-500 dark:text-red-400" },
  maintain: { icon: Minus,        text: "Maintain",  color: "text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40" },
};

const CONF_CONFIG: Record<Confidence, { dots: number; color: string; label: string }> = {
  high:   { dots: 3, color: "bg-emerald-500", label: "High" },
  medium: { dots: 2, color: "bg-amber-400",   label: "Medium" },
  low:    { dots: 1, color: "bg-red-400",      label: "Low" },
};

// ─── Chip label with optional tooltip ─────────────────────────────────────────

function ChipLabel({ label, tooltip }: { label: string; tooltip?: string }) {
  return (
    <p className="text-[10px] text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 uppercase tracking-wide flex items-center gap-0.5">
      {label}
      {tooltip && <MetricTooltip content={tooltip} />}
    </p>
  );
}

// ─── Saturation Curve Mini Chart ──────────────────────────────────────────────

function SatCurveTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="rounded-lg border border-[#FFBC80]/30 bg-white/97 dark:bg-[#1a1208]/97 shadow-md px-2.5 py-2 text-[11px]">
      <div className="text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mb-1">{fmtCurrency(d.spend)} spend</div>
      <div className="font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">{fmtCurrency(d.revenue)} revenue</div>
      <div className="text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">{fmtRoas(d.marginalRoas)} mROAS</div>
    </div>
  );
}

function SaturationCurveChart({ channel }: { channel: ChannelMMM }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
      {/* Chart */}
      <div>
        <p className="text-xs font-medium text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 mb-2">
          Response Curve — Revenue vs Spend
        </p>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={channel.saturationCurve} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="spend" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={(v: number) => fmtCurrency(v)} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={50}
              tickFormatter={(v: number) => fmtCurrency(v)} />
            <Tooltip content={<SatCurveTooltip />} />
            <ReferenceLine x={channel.spend} stroke="#FFBC80" strokeDasharray="4 2" strokeWidth={1.5}
              label={{ value: "Current", position: "top", fontSize: 10, fill: "#FFBC80" }} />
            <ReferenceLine x={channel.recommendedSpend} stroke="#10B981" strokeDasharray="4 2" strokeWidth={1.5}
              label={{ value: "Rec.", position: "insideTopRight", fontSize: 10, fill: "#10B981" }} />
            <Line type="monotone" dataKey="revenue" stroke="#FFBC80" strokeWidth={2}
              dot={false} activeDot={{ r: 3, fill: "#FFBC80", strokeWidth: 0 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Model details */}
      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 mb-2">Model Quality</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "R²",         value: channel.rSquared.toFixed(3),                                             tooltip: "Coefficient of determination — proportion of revenue variance explained by the model. Closer to 1.0 = better fit." },
              { label: "MAPE",       value: fmtPct(channel.mape * 100),                                              tooltip: "Mean Absolute Percentage Error — average forecast accuracy across the holdout period. Under 10% is excellent; above 15% warrants review." },
              { label: "P-Value",    value: channel.pValue < 0.001 ? "<0.001" : channel.pValue.toFixed(3),           tooltip: "Statistical significance of this channel's revenue contribution. Values below 0.05 indicate a reliable, non-random signal." },
              { label: "Confidence", value: CONF_CONFIG[channel.confidence].label,                                   tooltip: "Overall model confidence for this channel, derived from p-value, coefficient stability, and cross-validation performance." },
            ].map(({ label, value, tooltip }) => (
              <div key={label} className="rounded-lg bg-[#3A3A3A]/4 dark:bg-[#FFF9F2]/5 px-2.5 py-2">
                <ChipLabel label={label} tooltip={tooltip} />
                <p className="text-xs font-bold text-[#3A3A3A] dark:text-[#FFF9F2] tabular-nums">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 mb-2">Adstock & Lag</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Decay",      value: fmtPct(channel.adstockDecay * 100) + "/wk",  tooltip: "Weekly adstock decay rate — how quickly advertising effects fade after a campaign ends. 80%/wk means 20% of effect carries into the next week." },
              { label: "Peak Lag",   value: `${channel.peakLagDays}d`,                    tooltip: "Days from ad exposure to peak revenue response. Accounts for consideration and purchase delay." },
              { label: "Eff. Spend", value: fmtCurrency(channel.effectiveSpend),          tooltip: "Adstock-adjusted effective spend — actual spend plus carryover effects from prior periods, reflecting the true advertising pressure on consumers." },
              { label: "mROAS",      value: fmtRoas(channel.marginalRoas),                tooltip: "Marginal ROAS at the current spend level — the return on the last dollar invested in this channel." },
            ].map(({ label, value, tooltip }) => (
              <div key={label} className="rounded-lg bg-[#3A3A3A]/4 dark:bg-[#FFF9F2]/5 px-2.5 py-2">
                <ChipLabel label={label} tooltip={tooltip} />
                <p className="text-xs font-bold text-[#3A3A3A] dark:text-[#FFF9F2] tabular-nums">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {channel.haloRevenue > 0 && (
          <div className="rounded-lg border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/20 px-3 py-2">
            <div className="flex items-center gap-1 mb-0.5">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                Halo effect: {fmtCurrency(channel.haloRevenue)}
              </p>
              <MetricTooltip content="Indirect revenue lift on adjacent channels (e.g. branded search) that can be attributed to this channel's advertising driving awareness." />
            </div>
            <p className="text-[11px] text-blue-600/70 dark:text-blue-400/60">
              Indirect revenue on {channel.haloChannels.join(", ")}
            </p>
          </div>
        )}
      </div>

      {/* Recommendation reasoning */}
      <div className="lg:col-span-2">
        <p className="text-xs font-medium text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 mb-1.5">Recommendation rationale</p>
        <p className="text-xs text-[#3A3A3A]/65 dark:text-[#FFF9F2]/55 leading-relaxed bg-[#3A3A3A]/3 dark:bg-[#FFF9F2]/3 rounded-lg p-3">
          {channel.recommendationReason}
        </p>
      </div>
    </div>
  );
}

// ─── Table Row ────────────────────────────────────────────────────────────────

function TableRow({ channel }: { channel: ChannelMMM }) {
  const [expanded, setExpanded] = useState(false);
  const satCfg  = SAT_CONFIG[channel.saturationStatus];
  const recCfg  = REC_CONFIG[channel.recommendation];
  const confCfg = CONF_CONFIG[channel.confidence];
  const RecIcon = recCfg.icon;

  const spendDelta = channel.recommendedSpend - channel.spend;
  const spendDeltaPct = (spendDelta / channel.spend) * 100;

  return (
    <>
      <tr
        className="border-b border-[#FFBC80]/10 hover:bg-[#FFBC80]/4 dark:hover:bg-[#FFBC80]/5 cursor-pointer transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Channel */}
        <td className="py-3 px-4 font-medium text-[#3A3A3A] dark:text-[#FFF9F2]">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: channel.color }} />
            <span className="text-sm">{channel.channelLabel}</span>
          </div>
        </td>

        {/* Channel Type */}
        <td className="py-3 px-3">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
            channel.channelFamily === "rmn"
              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
              : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
          }`}>
            {channel.channelFamily === "rmn" ? "Retail Media" : "Core Digital"}
          </span>
        </td>

        {/* Spend */}
        <td className="py-3 px-3 text-right tabular-nums text-sm text-[#3A3A3A]/75 dark:text-[#FFF9F2]/65">
          {fmtCurrency(channel.spend)}
        </td>

        {/* Revenue */}
        <td className="py-3 px-3 text-right tabular-nums text-sm text-[#3A3A3A]/75 dark:text-[#FFF9F2]/65">
          {fmtCurrency(channel.attributedRevenue)}
        </td>

        {/* Incremental Revenue */}
        <td className="py-3 px-3 text-right tabular-nums text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">
          {fmtCurrency(channel.incrementalRevenue)}
        </td>

        {/* ROAS */}
        <td className="py-3 px-3 text-right tabular-nums text-sm text-[#3A3A3A]/75 dark:text-[#FFF9F2]/65">
          {fmtRoas(channel.roas)}
        </td>

        {/* iROAS */}
        <td className="py-3 px-3 text-right">
          <div className="flex flex-col items-end">
            <span className="text-sm font-semibold tabular-nums text-[#3A3A3A] dark:text-[#FFF9F2]">
              {fmtRoas(channel.iroas)}
            </span>
            <span className="text-[10px] tabular-nums text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25">
              [{fmtRoas(channel.iroasLow)}–{fmtRoas(channel.iroasHigh)}]
            </span>
          </div>
        </td>

        {/* Marginal ROAS */}
        <td className="py-3 px-3 text-right tabular-nums text-sm">
          <span className={
            channel.marginalRoas > channel.roas * 0.8
              ? "text-emerald-600 dark:text-emerald-400 font-semibold"
              : channel.marginalRoas < channel.roas * 0.4
              ? "text-red-500 dark:text-red-400 font-semibold"
              : "text-amber-600 dark:text-amber-400"
          }>
            {fmtRoas(channel.marginalRoas)}
          </span>
        </td>

        {/* Saturation */}
        <td className="py-3 px-3">
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${satCfg.bg} ${satCfg.text}`}>
            {satCfg.label}
          </span>
        </td>

        {/* Recommendation */}
        <td className="py-3 px-3">
          <div className="flex items-center gap-1.5">
            <RecIcon className={`w-3.5 h-3.5 ${recCfg.color}`} />
            <span className={`text-xs font-semibold ${recCfg.color}`}>{recCfg.text}</span>
            {spendDelta !== 0 && (
              <span className={`text-[10px] tabular-nums ${spendDelta > 0 ? "text-emerald-500" : "text-red-400"}`}>
                {spendDelta > 0 ? "+" : ""}{spendDeltaPct.toFixed(0)}%
              </span>
            )}
          </div>
        </td>

        {/* Confidence */}
        <td className="py-3 px-3">
          <div className="flex items-center gap-1">
            {[1, 2, 3].map((dot) => (
              <div key={dot} className={`w-1.5 h-1.5 rounded-full ${dot <= confCfg.dots ? confCfg.color : "bg-[#3A3A3A]/15 dark:bg-[#FFF9F2]/15"}`} />
            ))}
            <span className="text-[11px] text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 ml-1">{confCfg.label}</span>
          </div>
        </td>

        {/* Expand toggle */}
        <td className="py-3 px-3 text-right">
          {expanded
            ? <ChevronUp className="w-4 h-4 text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 ml-auto" />
            : <ChevronDown className="w-4 h-4 text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 ml-auto" />
          }
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="border-b border-[#FFBC80]/10 bg-[#FFBC80]/3 dark:bg-[#FFBC80]/4">
          <td colSpan={12} className="px-4 py-4">
            <SaturationCurveChart channel={channel} />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Table Container ──────────────────────────────────────────────────────────

interface ChannelDeepDiveProps {
  channels: ChannelMMM[];
}

type SortKey = "spend" | "iroas" | "marginalRoas" | "saturationLevelPct" | "incrementalRevenue";

// Column header with optional tooltip (non-sortable columns)
function HeaderLabel({ label, tooltip }: { label: string; tooltip?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">
      {label}
      {tooltip && <MetricTooltip content={tooltip} />}
    </span>
  );
}

export default function ChannelDeepDive({ channels }: ChannelDeepDiveProps) {
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...channels].sort((a, b) => {
    const diff = a[sortKey] - b[sortKey];
    return sortDir === "desc" ? -diff : diff;
  });

  function SortBtn({ label, k, tooltip }: { label: string; k: SortKey; tooltip?: string }) {
    const active = sortKey === k;
    return (
      <button
        onClick={() => handleSort(k)}
        className={`flex items-center gap-0.5 hover:text-[#3A3A3A]/80 dark:hover:text-[#FFF9F2]/70 transition-colors ${
          active ? "text-[#FFBC80]" : "text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30"
        }`}
      >
        {label}
        {active && (sortDir === "desc" ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />)}
        {tooltip && <MetricTooltip content={tooltip} />}
      </button>
    );
  }

  return (
    <div className="rounded-2xl monarch-card">
      <div className="px-5 pt-5 pb-3">
        <h3 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">Channel Deep Dive</h3>
        <p className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 mt-0.5">
          Full MMM metrics — click any row to expand saturation curve and model details
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#FFBC80]/20">
              {[
                { label: "Channel",        th: "px-4 pb-2 text-left" },
                { label: "Type",           th: "px-3 pb-2 text-left" },
                { label: "Spend",          th: "px-3 pb-2 text-right",  k: "spend" as SortKey },
                { label: "Revenue",        th: "px-3 pb-2 text-right" },
                { label: "Incremental Rev",th: "px-3 pb-2 text-right",  k: "incrementalRevenue" as SortKey, tooltip: "Revenue causally attributed to this channel's spend above what would occur organically — the true incremental lift." },
                { label: "ROAS",           th: "px-3 pb-2 text-right",  tooltip: "Return on Ad Spend — total attributed revenue divided by channel spend. Includes organic halo effects." },
                { label: "iROAS [95% CI]", th: "px-3 pb-2 text-right",  k: "iroas" as SortKey,             tooltip: "Incremental ROAS — causal revenue lift divided by spend. 95% confidence interval shown in brackets; tighter intervals = more reliable estimate." },
                { label: "mROAS",          th: "px-3 pb-2 text-right",  k: "marginalRoas" as SortKey,      tooltip: "Marginal ROAS — revenue generated by the next dollar spent at the current investment level. Declining mROAS signals saturation." },
                { label: "Saturation",     th: "px-3 pb-2 text-left",   k: "saturationLevelPct" as SortKey,tooltip: "Where the channel sits on its diminishing-returns curve. Over-invested = mROAS falling sharply; Under-invested = significant headroom remains." },
                { label: "Action",         th: "px-3 pb-2 text-left",   tooltip: "Model-recommended budget direction based on comparing this channel's marginal ROAS to the blended portfolio target." },
                { label: "Confidence",     th: "px-3 pb-2 text-left",   tooltip: "Statistical confidence in this channel's model coefficient, based on p-value and coefficient stability across model runs." },
                { label: "",               th: "px-3 pb-2" },
              ].map(({ label, th, k, tooltip }) => (
                <th key={label || "_expand"} className={`text-xs font-medium uppercase tracking-wider ${th}`}>
                  {k ? (
                    <SortBtn label={label} k={k} tooltip={tooltip} />
                  ) : label ? (
                    <HeaderLabel label={label} tooltip={tooltip} />
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((ch) => <TableRow key={ch.channelId} channel={ch} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
