import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, type TooltipProps } from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { StoreBreakdown, ChannelBreakdown, ContributionSlice } from "@/lib/overviewData";

// ─── Shared Helpers ───────────────────────────────────────────────────────────

function DeltaBadge({ change }: { change: number }) {
  const isUp = change > 0;
  const isDown = change < 0;
  const color = isUp
    ? "text-emerald-600 dark:text-emerald-400"
    : isDown
    ? "text-red-500 dark:text-red-400"
    : "text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30";

  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums ${color}`}>
      {isUp ? <TrendingUp className="w-3 h-3" /> : isDown ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}

function ContribBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-16 h-1.5 rounded-full bg-[#3A3A3A]/8 dark:bg-[#FFF9F2]/8 overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(value, 100)}%`, background: color }}
      />
    </div>
  );
}

const CARD_STYLE = {
  border: "1px solid transparent",
  backgroundImage:
    "linear-gradient(#fff, #fff), linear-gradient(135deg, #FFBC80 0%, #FFE29A 100%)",
  backgroundOrigin: "border-box",
  backgroundClip: "padding-box, border-box",
} as const;

// ─── Top Stores ───────────────────────────────────────────────────────────────

function TopStores({ stores }: { stores: StoreBreakdown[] }) {
  return (
    <div className="rounded-2xl p-5 bg-white dark:bg-[#1a1208]" style={CARD_STYLE}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">Top Stores</h3>
        <p className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 mt-0.5">Revenue by store</p>
      </div>

      <div className="space-y-3">
        {stores.slice(0, 7).map((store) => (
          <div key={store.storeId} className="flex items-center gap-3">
            {/* Color dot */}
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: store.color }}
            />

            {/* Store name */}
            <span className="text-xs text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60 w-24 truncate shrink-0">
              {store.label}
            </span>

            {/* Contribution bar */}
            <div className="flex-1 min-w-0">
              <ContribBar value={store.contribution} color={store.color} />
            </div>

            {/* Revenue */}
            <span className="text-xs font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] tabular-nums w-16 text-right shrink-0">
              {store.formattedRevenue}
            </span>

            {/* Contribution % */}
            <span className="text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 tabular-nums w-10 text-right shrink-0">
              {store.contribution.toFixed(1)}%
            </span>

            {/* Delta */}
            <div className="w-12 text-right shrink-0">
              <DeltaBadge change={store.change} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Top Channels ─────────────────────────────────────────────────────────────

type ChannelView = "spend" | "revenue" | "roas";

function TopChannels({ channels }: { channels: ChannelBreakdown[] }) {
  const [view, setView] = useState<ChannelView>("spend");

  const sorted = [...channels].sort((a, b) => {
    if (view === "spend") return b.spend - a.spend;
    if (view === "revenue") return b.attributedRevenue - a.attributedRevenue;
    return b.roas - a.roas;
  });

  const getDisplayValue = (ch: ChannelBreakdown): string => {
    if (view === "spend") return ch.formattedSpend;
    if (view === "revenue") return ch.formattedRevenue;
    return `${ch.roas.toFixed(2)}x`;
  };

  const getBarValue = (ch: ChannelBreakdown): number => {
    if (view === "roas") {
      const maxRoas = Math.max(...channels.map((c) => c.roas), 1);
      return (ch.roas / maxRoas) * 100;
    }
    return view === "spend" ? ch.contribution : (ch.attributedRevenue / Math.max(...channels.map(c => c.attributedRevenue), 1)) * 100;
  };

  return (
    <div className="rounded-2xl p-5 bg-white dark:bg-[#1a1208]" style={CARD_STYLE}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">Top Channels</h3>
          <p className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 mt-0.5">Across mapped channels</p>
        </div>
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#3A3A3A]/5 dark:bg-[#FFF9F2]/5">
          {(["spend", "revenue", "roas"] as ChannelView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                view === v
                  ? "bg-white dark:bg-[#2a1f0f] text-[#3A3A3A] dark:text-[#FFF9F2] shadow-sm"
                  : "text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 hover:text-[#3A3A3A]/80"
              }`}
            >
              {v === "roas" ? "ROAS" : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {sorted.slice(0, 7).map((ch) => (
          <div key={ch.channelId} className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: ch.color }} />
            <span className="text-xs text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60 w-28 truncate shrink-0">
              {ch.label}
            </span>
            <div className="flex-1 min-w-0">
              <ContribBar value={getBarValue(ch)} color={ch.color} />
            </div>
            <span className="text-xs font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] tabular-nums w-16 text-right shrink-0">
              {getDisplayValue(ch)}
            </span>
            {view !== "roas" && (
              <div className="w-12 text-right shrink-0">
                <DeltaBadge change={ch.change} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Contribution Breakdown (Donut) ───────────────────────────────────────────

type ContribView = "store" | "channel";

function PieTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-xl border border-[#FFBC80]/30 bg-white/95 dark:bg-[#1a1208]/95 shadow-lg px-3 py-2">
      <p className="text-xs font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">{item.name}</p>
      <p className="text-xs text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 tabular-nums">{(item.value as number).toFixed(1)}%</p>
    </div>
  );
}

function ContributionBreakdown({
  byStore,
  byChannel,
}: {
  byStore: ContributionSlice[];
  byChannel: ContributionSlice[];
}) {
  const [view, setView] = useState<ContribView>("store");
  const slices = view === "store" ? byStore : byChannel;

  return (
    <div className="rounded-2xl p-5 bg-white dark:bg-[#1a1208]" style={CARD_STYLE}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">Contribution</h3>
          <p className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 mt-0.5">
            % of {view === "store" ? "revenue" : "spend"} breakdown
          </p>
        </div>
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#3A3A3A]/5 dark:bg-[#FFF9F2]/5">
          {(["store", "channel"] as ContribView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                view === v
                  ? "bg-white dark:bg-[#2a1f0f] text-[#3A3A3A] dark:text-[#FFF9F2] shadow-sm"
                  : "text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 hover:text-[#3A3A3A]/80"
              }`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-4 items-center">
        {/* Donut chart */}
        <div className="shrink-0 w-36 h-36">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="85%"
                paddingAngle={2}
                dataKey="value"
                isAnimationActive
                animationDuration={400}
              >
                {slices.map((slice, i) => (
                  <Cell key={i} fill={slice.color} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex-1 min-w-0 space-y-2">
          {slices.slice(0, 6).map((slice, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: slice.color }} />
              <span className="text-xs text-[#3A3A3A]/65 dark:text-[#FFF9F2]/55 truncate flex-1 min-w-0">
                {slice.name}
              </span>
              <span className="text-xs font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] tabular-nums shrink-0">
                {slice.value.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Composed Section ─────────────────────────────────────────────────────────

interface BreakdownSectionProps {
  stores: StoreBreakdown[];
  channels: ChannelBreakdown[];
  contributionByStore: ContributionSlice[];
  contributionByChannel: ContributionSlice[];
}

export default function BreakdownSection({
  stores,
  channels,
  contributionByStore,
  contributionByChannel,
}: BreakdownSectionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <TopStores stores={stores} />
      <TopChannels channels={channels} />
      <ContributionBreakdown byStore={contributionByStore} byChannel={contributionByChannel} />
    </div>
  );
}
