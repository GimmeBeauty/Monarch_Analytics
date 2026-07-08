import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight,
  SlidersHorizontal, AlertTriangle, Loader2,
  Zap, MousePointerClick, DollarSign, BarChart2,
  ArrowRight, ArrowDown, Info,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useDateRange } from "@/context/DateRangeContext";
import { useStoreFilter } from "@/context/StoreFilterContext";
import { getChannelsForStores, type ChannelMapping } from "@/lib/channelStoreMapping";
import { type BlendedMetric, type AdSignal, type ChannelFunnel, type AdvancedRow, type SignalType } from "@/lib/adAttributionData";
import { API_BASE } from "@/lib/apiBase";
import { MetricTooltip } from "@/components/ui/MetricTooltip";

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

// ─── Constants ────────────────────────────────────────────────────────────────

const CARD_CLASS = "monarch-card-settings rounded-xl";

// ─── ROAS Color Helpers ───────────────────────────────────────────────────────

function roasTextColor(roas: number): string {
  if (roas >= 3) return "text-emerald-600 dark:text-emerald-400";
  if (roas >= 1.5) return "text-amber-600 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
}

function roasBadgeClass(roas: number): string {
  if (roas >= 3) return "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400";
  if (roas >= 1.5) return "bg-amber-400/12 text-amber-600 dark:text-amber-400";
  return "bg-red-500/12 text-red-500 dark:text-red-400";
}

// ─── Channel Selector ─────────────────────────────────────────────────────────

const FAMILY_LABELS: Record<string, string> = {
  core: "Core Media",
  rmn:  "Retail Media (RMN)",
  experimental: "Experimental",
};

const FAMILY_ORDER = ["core", "rmn", "experimental"];

interface ChannelSelectorProps {
  allChannels: ChannelMapping[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

function ChannelSelector({ allChannels, selected, onToggle, onSelectAll, onClearAll }: ChannelSelectorProps) {
  const [open, setOpen] = useState(false);
  const isAll       = selected.size === 0;
  const activeCount = isAll ? allChannels.length : selected.size;
  const isActive    = (id: string) => isAll || selected.has(id);

  const activeChannels = isAll ? allChannels : allChannels.filter(c => selected.has(c.channelId));
  const previewDots    = activeChannels.slice(0, 6);
  const overflow       = activeCount - 6;

  const groups = useMemo(() => {
    const map: Record<string, ChannelMapping[]> = {};
    for (const ch of allChannels) {
      if (!map[ch.channelFamily]) map[ch.channelFamily] = [];
      map[ch.channelFamily].push(ch);
    }
    return FAMILY_ORDER.filter(f => map[f]?.length).map(f => ({ family: f, channels: map[f] }));
  }, [allChannels]);

  return (
    <div className={CARD_CLASS}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left select-none"
      >
        <SlidersHorizontal size={13} className="text-[#FFBC80] flex-shrink-0" />
        <span className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">Channels</span>
        <div className="flex items-center -space-x-0.5 ml-1">
          {previewDots.map(ch => (
            <span
              key={ch.channelId}
              className="w-2 h-2 rounded-full ring-1 ring-white dark:ring-[#231a0e]"
              style={{ background: ch.color }}
            />
          ))}
          {overflow > 0 && (
            <span className="text-[10px] text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25 pl-1.5">+{overflow}</span>
          )}
        </div>
        <span className="ml-auto text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 flex-shrink-0">
          {activeCount} of {allChannels.length} active
        </span>
        <ChevronDown
          size={14}
          className={`text-[#3A3A3A]/30 dark:text-[#FFF9F2]/25 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div className={`overflow-hidden transition-all duration-200 ${open ? "max-h-[440px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="px-4 pb-4 border-t border-[#FFBC80]/10">
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
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
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

// ─── Blended Metric Card ──────────────────────────────────────────────────────

function BlendedMetricCard({ m }: { m: BlendedMetric }) {
  const isGood    = m.positiveIsUp ? m.change > 0 : m.change < 0;
  const isNeutral = m.change === 0;
  const colorCls  = isNeutral
    ? "text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30"
    : isGood
    ? "text-emerald-500 dark:text-emerald-400"
    : "text-red-500 dark:text-red-400";

  return (
    <div className={`${CARD_CLASS} p-4 relative overflow-hidden`}>
      <div className="absolute top-0 right-0 w-16 h-16 opacity-8 rounded-bl-full"
        style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }} />
      <p className="flex items-center gap-1 text-[10px] font-semibold text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 uppercase tracking-wider mb-1.5">
        {m.label}
        <MetricTooltip content={m.description} />
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

// ─── Small KPI Card ───────────────────────────────────────────────────────────

function SmallKpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl p-3.5 bg-[#FFBC80]/6 border border-[#FFBC80]/15">
      <p className="text-[10px] font-semibold text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 uppercase tracking-wider mb-1.5">
        {label}
      </p>
      <p className="text-base font-black tabular-nums text-[#3A3A3A] dark:text-[#FFF9F2] leading-none">
        {value}
      </p>
      {sub && <p className="text-[10px] text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Channel Detail Types ─────────────────────────────────────────────────────

interface MetaCampaign {
  campaignId: string; campaignName: string;
  spend: number; impressions: number; clicks: number; reach: number;
  frequency: number; cpm: number; cpc: number; ctr: number; cpp: number;
  initiateCheckout: number;
}
interface MetaDetailData {
  channel: "meta";
  kpis: { frequency: number; cpm: number; cpp: number; initiateCheckout: number; reach: number };
  campaigns: MetaCampaign[];
  isEmpty: boolean;
}

interface GoogleCampaign {
  campaignId: string; campaignName: string;
  spend: number; impressions: number; clicks: number;
  conversions: number; revenue: number; ctr: number; cpc: number; cpm: number; roas: number;
}
interface GoogleDetailData {
  channel: "google";
  kpis: { conversions: number; cpc: number; cpm: number; revenue: number };
  campaigns: GoogleCampaign[];
  isEmpty: boolean;
}

interface PinterestDetailData {
  channel: "pinterest";
  kpis: { spend: number; impressions: number; clicks: number; engagements: number; ctr: number };
  isEmpty: boolean;
}

interface CriteoCampaign {
  campaignId: string; campaignName: string; campaignType: string;
  spend: number; impressions: number; clicks: number;
  revenue: number; orders: number; ctr: number; cpc: number; cpm: number; roas: number;
}
interface CriteoDetailData {
  channel: "criteo";
  kpis: { cpm: number; cpc: number; revenue: number; roas: number };
  campaigns: CriteoCampaign[];
  isEmpty: boolean;
}

interface RoundelWeek {
  week: string; spend: number; revenue: number; roas: number;
  orders: number; clicks: number; impressions: number; ctr: number; cpc: number;
}
interface RoundelDetailData {
  channel: "roundel";
  kpis: { revenue: number; roas: number };
  weeks: RoundelWeek[];
  isEmpty: boolean;
}

interface AgilityRow {
  campaign: string; channel: string;
  spend: number; impressions: number; clicks: number;
  trafficConversions: number; highIntentTraffic: number;
  realizedSales: number; realizedRevenue: number;
}
interface AgilityDetailData {
  channel: "agility";
  kpis: { impressions: number; spend: number; realizedRevenue: number; roas: number; highIntentTraffic: number; trafficConversions: number };
  rows: AgilityRow[];
  isEmpty: boolean;
}

type ChannelDetailData =
  | MetaDetailData
  | GoogleDetailData
  | PinterestDetailData
  | CriteoDetailData
  | RoundelDetailData
  | AgilityDetailData;

const CHANNEL_ID_TO_PARAM: Record<string, string> = {
  "meta-ads":       "meta",
  "google-ads":     "google",
  "pinterest-ads":  "pinterest",
  "criteo-ads":     "criteo",
  "roundel-target": "roundel",
  "agility-ads":    "agility",
};

// ─── Channel Detail Hook ──────────────────────────────────────────────────────

function useChannelDetail(channelParam: string | null, start: string, end: string) {
  return useQuery<ChannelDetailData>({
    queryKey: ["channel-detail", channelParam, start, end],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/api/data/ads/channel-detail?channel=${channelParam}&start=${start}&end=${end}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch channel detail");
      return res.json() as Promise<ChannelDetailData>;
    },
    enabled: !!channelParam,
    staleTime: 1000 * 60 * 15,
    retry: false,
  });
}

// ─── Table Class Helpers ──────────────────────────────────────────────────────

const TH  = "px-3 py-2 text-left text-[10px] font-semibold text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 uppercase tracking-wider whitespace-nowrap";
const THR = TH + " text-right";
const TD  = "px-3 py-2.5 text-right tabular-nums text-xs text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60 whitespace-nowrap";
const TDL = "px-3 py-2.5 text-xs font-medium text-[#3A3A3A] dark:text-[#FFF9F2]";

// ─── Loading / Empty States ───────────────────────────────────────────────────

function DetailLoader() {
  return (
    <div className="flex items-center justify-center py-8 gap-2 text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">
      <Loader2 size={14} className="animate-spin" />
      <span className="text-xs">Loading detail…</span>
    </div>
  );
}

function DetailEmpty() {
  return (
    <p className="text-center text-xs text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25 py-6">
      No data available for this channel in the selected date range.
    </p>
  );
}

// ─── Meta Detail Panel ────────────────────────────────────────────────────────

function MetaDetailPanel({ data }: { data: MetaDetailData }) {
  const k = data.kpis;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <SmallKpiCard label="Frequency"        value={`${k.frequency.toFixed(1)}x`} />
        <SmallKpiCard label="CPM"              value={`$${k.cpm.toFixed(2)}`} />
        <SmallKpiCard label="CPA"              value={`$${k.cpp.toFixed(2)}`} />
        <SmallKpiCard label="Init. Checkout"   value={fmtNumber(k.initiateCheckout)} />
        <SmallKpiCard label="Reach"            value={fmtNumber(k.reach)} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-[#FFBC80]/15">
        <table className="w-full text-xs min-w-[720px]">
          <thead className="border-b border-[#FFBC80]/10 bg-[#FFBC80]/4">
            <tr>
              <th className={`${TH} min-w-[200px]`}>Campaign</th>
              <th className={THR}>Spend</th>
              <th className={THR}>Impr.</th>
              <th className={THR}>Clicks</th>
              <th className={THR}>CTR</th>
              <th className={THR}>CPC</th>
              <th className={THR}>CPM</th>
              <th className={THR}>Freq.</th>
              <th className={THR}>Reach</th>
              <th className={THR}>Init. Checkout</th>
            </tr>
          </thead>
          <tbody>
            {data.campaigns.map(c => (
              <tr key={c.campaignId} className="border-b border-[#FFBC80]/8 hover:bg-[#FFBC80]/4 transition-colors">
                <td className={TDL}>
                  <span className="line-clamp-1 max-w-[240px] block">{c.campaignName}</span>
                </td>
                <td className={TD}>{fmtCurrency(c.spend)}</td>
                <td className={TD}>{fmtNumber(c.impressions)}</td>
                <td className={TD}>{fmtNumber(c.clicks)}</td>
                <td className={TD}>{c.ctr.toFixed(2)}%</td>
                <td className={TD}>${c.cpc.toFixed(2)}</td>
                <td className={TD}>${c.cpm.toFixed(2)}</td>
                <td className={TD}>{c.frequency.toFixed(1)}x</td>
                <td className={TD}>{fmtNumber(c.reach)}</td>
                <td className={TD}>{fmtNumber(c.initiateCheckout)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25 italic px-0.5">
        Per-campaign revenue not available in raw data — channel total shown above.
      </p>
    </div>
  );
}

// ─── Google Detail Panel ──────────────────────────────────────────────────────

function GoogleDetailPanel({ data }: { data: GoogleDetailData }) {
  const k = data.kpis;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <SmallKpiCard label="Revenue"     value={fmtCurrency(k.revenue)} />
        <SmallKpiCard label="Conversions" value={fmtNumber(k.conversions)} />
        <SmallKpiCard label="CPC"         value={`$${k.cpc.toFixed(2)}`} />
        <SmallKpiCard label="CPM"         value={`$${k.cpm.toFixed(2)}`} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-[#FFBC80]/15">
        <table className="w-full text-xs min-w-[740px]">
          <thead className="border-b border-[#FFBC80]/10 bg-[#FFBC80]/4">
            <tr>
              <th className={`${TH} min-w-[200px]`}>Campaign</th>
              <th className={THR}>Spend</th>
              <th className={THR}>Impr.</th>
              <th className={THR}>Clicks</th>
              <th className={THR}>CTR</th>
              <th className={THR}>CPC</th>
              <th className={THR}>CPM</th>
              <th className={THR}>Conv.</th>
              <th className={THR}>Revenue</th>
              <th className={THR}>ROAS</th>
            </tr>
          </thead>
          <tbody>
            {data.campaigns.map(c => (
              <tr key={c.campaignId} className="border-b border-[#FFBC80]/8 hover:bg-[#FFBC80]/4 transition-colors">
                <td className={TDL}>
                  <span className="line-clamp-1 max-w-[240px] block">{c.campaignName}</span>
                </td>
                <td className={TD}>{fmtCurrency(c.spend)}</td>
                <td className={TD}>{fmtNumber(c.impressions)}</td>
                <td className={TD}>{fmtNumber(c.clicks)}</td>
                <td className={TD}>{c.ctr.toFixed(2)}%</td>
                <td className={TD}>${c.cpc.toFixed(2)}</td>
                <td className={TD}>${c.cpm.toFixed(2)}</td>
                <td className={TD}>{fmtNumber(c.conversions)}</td>
                <td className={`${TD} text-emerald-600 dark:text-emerald-400 font-semibold`}>
                  {fmtCurrency(c.revenue)}
                </td>
                <td className={`${TD} font-semibold ${roasTextColor(c.roas)}`}>
                  {c.roas.toFixed(2)}x
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Pinterest Detail Panel ───────────────────────────────────────────────────

function PinterestDetailPanel({ data }: { data: PinterestDetailData }) {
  const k = data.kpis;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
      <SmallKpiCard label="Spend"       value={fmtCurrency(k.spend)} />
      <SmallKpiCard label="Impressions" value={fmtNumber(k.impressions)} />
      <SmallKpiCard label="Clicks"      value={fmtNumber(k.clicks)} />
      <SmallKpiCard label="Engagements" value={fmtNumber(k.engagements)} />
      <SmallKpiCard label="CTR"         value={`${k.ctr.toFixed(2)}%`} />
    </div>
  );
}

// ─── Criteo Detail Panel ──────────────────────────────────────────────────────

function CriteoDetailPanel({ data }: { data: CriteoDetailData }) {
  const k = data.kpis;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <SmallKpiCard label="CPM"     value={`$${k.cpm.toFixed(2)}`} />
        <SmallKpiCard label="CPC"     value={`$${k.cpc.toFixed(2)}`} />
        <SmallKpiCard label="Revenue" value={fmtCurrency(k.revenue)} />
        <SmallKpiCard
          label="ROAS"
          value={`${k.roas.toFixed(2)}x`}
          sub={k.roas >= 3 ? "Strong" : k.roas >= 1.5 ? "Moderate" : "Below target"}
        />
      </div>
      <div className="overflow-x-auto rounded-xl border border-[#FFBC80]/15">
        <table className="w-full text-xs min-w-[740px]">
          <thead className="border-b border-[#FFBC80]/10 bg-[#FFBC80]/4">
            <tr>
              <th className={`${TH} min-w-[180px]`}>Campaign</th>
              <th className={TH}>Type</th>
              <th className={THR}>Spend</th>
              <th className={THR}>Impr.</th>
              <th className={THR}>Clicks</th>
              <th className={THR}>CTR</th>
              <th className={THR}>CPC</th>
              <th className={THR}>Revenue</th>
              <th className={THR}>Orders</th>
              <th className={THR}>ROAS</th>
            </tr>
          </thead>
          <tbody>
            {data.campaigns.map(c => (
              <tr key={c.campaignId} className="border-b border-[#FFBC80]/8 hover:bg-[#FFBC80]/4 transition-colors">
                <td className={TDL}>
                  <span className="line-clamp-1 max-w-[200px] block">{c.campaignName}</span>
                </td>
                <td className="px-3 py-2.5 text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 whitespace-nowrap">
                  {c.campaignType}
                </td>
                <td className={TD}>{fmtCurrency(c.spend)}</td>
                <td className={TD}>{fmtNumber(c.impressions)}</td>
                <td className={TD}>{fmtNumber(c.clicks)}</td>
                <td className={TD}>{c.ctr.toFixed(2)}%</td>
                <td className={TD}>${c.cpc.toFixed(2)}</td>
                <td className={`${TD} text-emerald-600 dark:text-emerald-400 font-semibold`}>
                  {fmtCurrency(c.revenue)}
                </td>
                <td className={TD}>{c.orders}</td>
                <td className={`${TD} font-semibold ${roasTextColor(c.roas)}`}>
                  {c.roas.toFixed(2)}x
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Roundel Detail Panel ─────────────────────────────────────────────────────

function RoundelDetailPanel({ data }: { data: RoundelDetailData }) {
  const k = data.kpis;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5">
        <SmallKpiCard label="Revenue" value={fmtCurrency(k.revenue)} />
        <SmallKpiCard
          label="ROAS"
          value={`${k.roas.toFixed(2)}x`}
          sub={k.roas >= 3 ? "Strong" : k.roas >= 1.5 ? "Moderate" : "Below target"}
        />
      </div>
      <div className="overflow-x-auto rounded-xl border border-[#FFBC80]/15">
        <table className="w-full text-xs min-w-[660px]">
          <thead className="border-b border-[#FFBC80]/10 bg-[#FFBC80]/4">
            <tr>
              <th className={`${TH} min-w-[110px]`}>Week</th>
              <th className={THR}>Spend</th>
              <th className={THR}>Revenue</th>
              <th className={THR}>ROAS</th>
              <th className={THR}>Orders</th>
              <th className={THR}>Clicks</th>
              <th className={THR}>Impr.</th>
              <th className={THR}>CTR</th>
              <th className={THR}>CPC</th>
            </tr>
          </thead>
          <tbody>
            {data.weeks.map((w, i) => (
              <tr key={i} className="border-b border-[#FFBC80]/8 hover:bg-[#FFBC80]/4 transition-colors">
                <td className={TDL}>{w.week}</td>
                <td className={TD}>{fmtCurrency(w.spend)}</td>
                <td className={`${TD} text-emerald-600 dark:text-emerald-400 font-semibold`}>
                  {fmtCurrency(w.revenue)}
                </td>
                <td className={`${TD} font-semibold ${roasTextColor(w.roas)}`}>
                  {w.roas.toFixed(2)}x
                </td>
                <td className={TD}>{w.orders}</td>
                <td className={TD}>{fmtNumber(w.clicks)}</td>
                <td className={TD}>{fmtNumber(w.impressions)}</td>
                <td className={TD}>{w.ctr.toFixed(2)}%</td>
                <td className={TD}>${w.cpc.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Agility Detail Panel ─────────────────────────────────────────────────────

function AgilityDetailPanel({ data }: { data: AgilityDetailData }) {
  const k = data.kpis;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <SmallKpiCard label="Impressions"       value={fmtNumber(k.impressions)} />
        <SmallKpiCard label="Spend"             value={fmtCurrency(k.spend)} />
        <SmallKpiCard label="Realized Revenue"  value={fmtCurrency(k.realizedRevenue)} />
        <SmallKpiCard
          label="ROAS"
          value={`${k.roas.toFixed(2)}x`}
          sub="Upper-funnel — see note"
        />
        <SmallKpiCard label="High-Intent Traffic"   value={fmtNumber(k.highIntentTraffic)} />
        <SmallKpiCard label="Traffic Conversions"   value={fmtNumber(k.trafficConversions)} />
      </div>
      <div className="flex items-start gap-1.5 px-1 py-2 rounded-lg bg-[#6B46C1]/8 border border-[#6B46C1]/20">
        <Info size={12} className="text-[#6B46C1] flex-shrink-0 mt-0.5" />
        <p className="text-[10px] text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 leading-relaxed">
          Agility drives upper-funnel awareness and in-store lift that is not fully captured in last-touch attribution.
          ROAS reflects only directly attributed realized revenue and will appear low relative to direct-response channels.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[#FFBC80]/15">
        <table className="w-full text-xs min-w-[740px]">
          <thead className="border-b border-[#FFBC80]/10 bg-[#FFBC80]/4">
            <tr>
              <th className={`${TH} min-w-[200px]`}>Campaign</th>
              <th className={TH}>Channel</th>
              <th className={THR}>Spend</th>
              <th className={THR}>Impr.</th>
              <th className={THR}>Clicks</th>
              <th className={THR}>Traffic Conv.</th>
              <th className={THR}>Realized Sales</th>
              <th className={THR}>Realized Revenue</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, i) => (
              <tr key={i} className="border-b border-[#FFBC80]/8 hover:bg-[#FFBC80]/4 transition-colors">
                <td className={TDL}>
                  <span className="line-clamp-1 max-w-[240px] block">{r.campaign}</span>
                </td>
                <td className="px-3 py-2.5 text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 whitespace-nowrap">
                  {r.channel}
                </td>
                <td className={TD}>{fmtCurrency(r.spend)}</td>
                <td className={TD}>{fmtNumber(r.impressions)}</td>
                <td className={TD}>{fmtNumber(r.clicks)}</td>
                <td className={TD}>{fmtNumber(r.trafficConversions)}</td>
                <td className={TD}>{r.realizedSales.toFixed(1)}</td>
                <td className={`${TD} text-emerald-600 dark:text-emerald-400 font-semibold`}>
                  {fmtCurrency(r.realizedRevenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Channel Detail Panel (discriminated router) ──────────────────────────────

function ChannelDetailPanel({ channelId, start, end }: { channelId: string; start: string; end: string }) {
  const channelParam = CHANNEL_ID_TO_PARAM[channelId] ?? null;
  const { data, isLoading } = useChannelDetail(channelParam, start, end);

  if (!channelParam) return <DetailEmpty />;
  if (isLoading)     return <DetailLoader />;
  if (!data)         return <DetailEmpty />;
  if (data.isEmpty)  return <DetailEmpty />;

  if (data.channel === "meta")      return <MetaDetailPanel      data={data} />;
  if (data.channel === "google")    return <GoogleDetailPanel    data={data} />;
  if (data.channel === "pinterest") return <PinterestDetailPanel data={data} />;
  if (data.channel === "criteo")    return <CriteoDetailPanel    data={data} />;
  if (data.channel === "roundel")   return <RoundelDetailPanel   data={data} />;
  if (data.channel === "agility")   return <AgilityDetailPanel   data={data} />;

  return <DetailEmpty />;
}

// ─── Channel Row Type ─────────────────────────────────────────────────────────

interface ChannelRow {
  channelId: string;
  channelLabel: string;
  color: string;
  channelFamily: string;
  spend: number;
  revenue: number;
  roas: number;
  conversions: number;
  impressions: number;
  ctr: number;
  cpc: number;
}

// ─── Expandable Channel Table ─────────────────────────────────────────────────

function ChannelTable({ rows, start, end }: { rows: ChannelRow[]; start: string; end: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggle = (id: string) => setExpandedId(prev => prev === id ? null : id);

  const thCls  = "px-4 py-3 text-left text-[10px] font-semibold text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 uppercase tracking-wider whitespace-nowrap";
  const thRCls = thCls + " text-right";

  return (
    <div className={`${CARD_CLASS} overflow-hidden`}>
      <div className="px-5 py-4 border-b border-[#FFBC80]/15">
        <h2 className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">Channel Performance</h2>
        <p className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 mt-0.5">
          Expand a row to view campaign-level detail
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[680px]">
          <thead>
            <tr className="border-b border-[#FFBC80]/10">
              <th className={`${thCls} min-w-[160px] sticky left-0 bg-white dark:bg-[#231a0e]`}>
                Channel
              </th>
              <th className={thRCls}><span className="flex items-center justify-end gap-1">Spend <MetricTooltip content="Total ad spend across all campaigns for this channel in the selected period." /></span></th>
              <th className={thRCls}><span className="flex items-center justify-end gap-1">Revenue <MetricTooltip content="Total attributed revenue driven by this channel's advertising." /></span></th>
              <th className={thRCls}><span className="flex items-center justify-end gap-1">ROAS <MetricTooltip content="Return On Ad Spend — Revenue ÷ Spend. Higher is better; ≥3x is generally strong." /></span></th>
              <th className={thRCls}><span className="flex items-center justify-end gap-1">Purchases <MetricTooltip content="Total purchase conversions attributed to this channel." /></span></th>
              <th className={thRCls}><span className="flex items-center justify-end gap-1">Impressions <MetricTooltip content="Total number of times ads from this channel were shown to users." /></span></th>
              <th className={thRCls}><span className="flex items-center justify-end gap-1">CTR <MetricTooltip content="Click-Through Rate — Clicks ÷ Impressions. Measures how compelling the ad creative is." /></span></th>
              <th className={thRCls}><span className="flex items-center justify-end gap-1">CPC <MetricTooltip content="Cost Per Click — Spend ÷ Clicks. Lower means you're paying less for each visit." /></span></th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const isExpanded = expandedId === row.channelId;
              const stickyBg   = isExpanded
                ? "bg-[#FFBC80]/8"
                : "bg-white dark:bg-[#231a0e]";

              return (
                <Fragment key={row.channelId}>
                  <tr
                    onClick={() => toggle(row.channelId)}
                    className={`border-b border-[#FFBC80]/8 cursor-pointer select-none transition-colors ${
                      isExpanded ? "bg-[#FFBC80]/8" : "hover:bg-[#FFBC80]/4"
                    }`}
                  >
                    {/* Channel name — sticky */}
                    <td className={`px-4 py-3 sticky left-0 transition-colors ${stickyBg}`}>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: row.color }} />
                        <span className="font-medium text-[#3A3A3A] dark:text-[#FFF9F2] whitespace-nowrap">
                          {row.channelLabel}
                        </span>
                        <span className="hidden sm:inline text-[9px] px-1.5 py-0.5 rounded bg-[#FFBC80]/12 text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 uppercase tracking-wide">
                          {row.channelFamily}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right tabular-nums text-[#3A3A3A]/75 dark:text-[#FFF9F2]/65 whitespace-nowrap">
                      {fmtCurrency(row.spend)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {fmtCurrency(row.revenue)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${roasBadgeClass(row.roas)}`}>
                        {row.roas.toFixed(2)}x
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#3A3A3A]/65 dark:text-[#FFF9F2]/55 whitespace-nowrap">
                      {fmtNumber(row.conversions)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#3A3A3A]/65 dark:text-[#FFF9F2]/55 whitespace-nowrap">
                      {fmtNumber(row.impressions)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#3A3A3A]/65 dark:text-[#FFF9F2]/55 whitespace-nowrap">
                      {row.ctr.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#3A3A3A]/65 dark:text-[#FFF9F2]/55 whitespace-nowrap">
                      ${row.cpc.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isExpanded
                        ? <ChevronDown  size={14} className="text-[#FFBC80] mx-auto" />
                        : <ChevronRight size={14} className="text-[#3A3A3A]/30 dark:text-[#FFF9F2]/25 mx-auto" />
                      }
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="border-b border-[#FFBC80]/15">
                      <td colSpan={9} className="px-5 py-4 bg-[#FFBC80]/3 dark:bg-[#FFF9F2]/2">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: row.color }} />
                          <span className="text-xs font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">
                            {row.channelLabel} Detail
                          </span>
                        </div>
                        <ChannelDetailPanel channelId={row.channelId} start={start} end={end} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Signal Detector ─────────────────────────────────────────────────────────

const SIGNAL_META: Record<SignalType, { icon: React.ElementType; label: string }> = {
  "ad-fatigue":     { icon: Zap,               label: "Ad Fatigue" },
  "declining-ctr":  { icon: MousePointerClick, label: "CTR Decline" },
  "rising-cpa":     { icon: DollarSign,        label: "Rising CPA" },
  "declining-roas": { icon: BarChart2,         label: "ROAS Decline" },
};

const SEV_STYLES = {
  critical: {
    wrap:  "border-red-500/25 bg-red-500/5 dark:bg-red-500/8",
    icon:  "text-red-500",
    badge: "bg-red-500/12 text-red-600 dark:text-red-400",
  },
  warning: {
    wrap:  "border-amber-400/30 bg-amber-400/5 dark:bg-amber-400/8",
    icon:  "text-amber-500",
    badge: "bg-amber-400/12 text-amber-600 dark:text-amber-400",
  },
};

function SignalCard({ signal }: { signal: AdSignal }) {
  const meta = SIGNAL_META[signal.type];
  const sev  = SEV_STYLES[signal.severity];
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

// ─── Funnel Analysis ──────────────────────────────────────────────────────────

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

// ─── Advanced Intelligence Table ──────────────────────────────────────────────

function advancedColor(value: number, type: "elasticity" | "lift" | "ipc" | "decay"): string {
  const green = "text-emerald-600 dark:text-emerald-400";
  const amber = "text-amber-600 dark:text-amber-400";
  const red   = "text-red-500 dark:text-red-400";
  if (type === "elasticity") return value >= 0.7 ? green : value >= 0.5 ? amber : red;
  if (type === "lift")       return value >= 75  ? green : value >= 50  ? amber : red;
  if (type === "ipc")        return value <= 25  ? green : value <= 50  ? amber : red;
  if (type === "decay")      return value <= 12  ? green : value <= 22  ? amber : red;
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
                  <span className="flex items-center justify-end gap-1">
                    {["Elasticity", "Incr. Lift %", "Impr. / Click", "Eff. Decay %"][i]}
                    <MetricTooltip content={TOOLTIPS[key]} />
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

  const allChannels = useMemo(() => getChannelsForStores(storeIds), [storeIds]);

  const [selectedChannelIds, setSelectedChannelIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (selectedChannelIds.size === 0) return;
    const available = new Set(allChannels.map(c => c.channelId));
    const pruned = new Set([...selectedChannelIds].filter(id => available.has(id)));
    if (pruned.size !== selectedChannelIds.size) {
      setSelectedChannelIds(pruned.size > 0 ? pruned : new Set());
    }
  }, [allChannels]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleChannel = (id: string) => {
    setSelectedChannelIds(prev => {
      if (prev.size === 0) {
        const next = new Set(allChannels.map(c => c.channelId));
        next.delete(id);
        return next.size > 0 ? next : prev;
      }
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (next.size === 0) return prev;
        if (next.size === allChannels.length) return new Set();
      } else {
        next.add(id);
        if (next.size === allChannels.length) return new Set();
      }
      return next;
    });
  };

  const handleSelectAll = () => setSelectedChannelIds(new Set());
  const handleClearAll = () => {
    if (allChannels.length > 0) setSelectedChannelIds(new Set([allChannels[0].channelId]));
  };

  const filterChannelIds = useMemo(
    () => selectedChannelIds.size > 0 ? [...selectedChannelIds] : undefined,
    [selectedChannelIds],
  );

  // ─── Fetch attribution summary (channel totals) ───────────────────────────

  interface AttrApiChannel {
    channelId: string; channelLabel: string; color: string; channelFamily: string; storeIds: string[];
    spend: number; impressions: number; clicks: number; conversions: number; revenue: number;
    dailySeries: Array<{ date: string; spend: number; impressions: number; clicks: number; conversions: number; revenue: number }>;
  }
  interface AttrApiResponse { channels: AttrApiChannel[]; isEmpty: boolean; }

  const { data: attrApiData, isLoading: attrLoading } = useQuery<AttrApiResponse>({
    queryKey: ["attribution-data", dateRange.startDate, dateRange.endDate, storeIds.join(",")],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/api/data/attribution?start=${dateRange.startDate}&end=${dateRange.endDate}`,
        { credentials: "include" },
      );
      if (!res.ok) return { channels: [], isEmpty: true };
      return res.json() as Promise<AttrApiResponse>;
    },
    staleTime: 1000 * 60 * 15,
    retry: false,
  });

  // ─── Derive channel rows + blended metrics ────────────────────────────────

  function fmtC(v: number): string {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
    return `$${v.toFixed(2)}`;
  }

  const { blendedMetrics, channelRows, signals, funnels, advanced } = useMemo(() => {
    const raw = (attrApiData?.channels ?? [])
      .filter(c => filterChannelIds == null || filterChannelIds.includes(c.channelId));

    const channelRows: ChannelRow[] = raw.map(c => {
      const ctr  = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
      const cpc  = c.clicks      > 0 ? c.spend / c.clicks : 0;
      const roas = c.spend       > 0 ? c.revenue / c.spend : 0;
      return {
        channelId:     c.channelId,
        channelLabel:  c.channelLabel,
        color:         c.color,
        channelFamily: c.channelFamily,
        spend:         c.spend,
        revenue:       c.revenue,
        roas,
        conversions:   c.conversions,
        impressions:   c.impressions,
        ctr,
        cpc,
      };
    }).sort((a, b) => b.revenue - a.revenue);

    const tSpend  = channelRows.reduce((s, c) => s + c.spend,  0);
    const tRev    = channelRows.reduce((s, c) => s + c.revenue, 0);
    const tImpr   = channelRows.reduce((s, c) => s + c.impressions, 0);
    const tClicks = channelRows.reduce((s, c) => s + c.impressions > 0 ? c.ctr / 100 * c.impressions : 0, 0);
    const blRoas  = tSpend  > 0 ? tRev    / tSpend  : 0;
    const blCtr   = tImpr   > 0 ? (tClicks / tImpr)  * 100 : 0;
    const blCpm   = tImpr   > 0 ? (tSpend  / tImpr)  * 1000 : 0;
    const blCpc   = tClicks > 0 ? tSpend  / tClicks : 0;

    const blendedMetrics: BlendedMetric[] = [
      { id: "spend",       label: "Total Spend",   value: tSpend,  formatted: fmtC(tSpend),            change: 0, positiveIsUp: false, description: "Aggregate ad spend across all channels" },
      { id: "revenue",     label: "Total Revenue", value: tRev,    formatted: fmtC(tRev),              change: 0, positiveIsUp: true,  description: "Attributed revenue across all channels" },
      { id: "roas",        label: "Blended ROAS",  value: blRoas,  formatted: `${blRoas.toFixed(2)}x`, change: 0, positiveIsUp: true,  description: "Total attributed revenue ÷ total spend" },
      { id: "ctr",         label: "Blended CTR",   value: blCtr,   formatted: `${blCtr.toFixed(2)}%`,  change: 0, positiveIsUp: true,  description: "Clicks ÷ Impressions" },
      { id: "impressions", label: "Impressions",   value: tImpr,   formatted: tImpr >= 1e6 ? `${(tImpr/1e6).toFixed(1)}M` : tImpr >= 1e3 ? `${(tImpr/1e3).toFixed(1)}K` : tImpr.toLocaleString(), change: 0, positiveIsUp: true, description: "Total impressions" },
      { id: "cpm",         label: "Blended CPM",   value: blCpm,   formatted: fmtC(blCpm),             change: 0, positiveIsUp: false, description: "Cost per 1K impressions" },
      { id: "cpc",         label: "Blended CPC",   value: blCpc,   formatted: `$${blCpc.toFixed(2)}`,  change: 0, positiveIsUp: false, description: "Cost per click" },
    ];

    // ── Signals ───────────────────────────────────────────────────────────────
    const signals: AdSignal[] = [];
    let sigIdx = 0;
    for (const ch of channelRows) {
      if (ch.roas < 1 && ch.spend > 0) {
        signals.push({ id: `sig-${sigIdx++}`, channelId: ch.channelId, channelLabel: ch.channelLabel, color: ch.color,
          type: "declining-roas" as SignalType, severity: "critical",
          issue: "ROAS below break-even",
          explanation: `${ch.channelLabel} is returning ${ch.roas.toFixed(2)}x — spending more than it earns.`,
          recommendation: "Pause low-ROAS ad sets and reallocate budget to higher-performing audiences.",
          currentValue: `${ch.roas.toFixed(2)}x`, priorValue: "—", changeText: "Below 1.0x threshold" });
      } else if (ch.roas < 2 && ch.spend > 0) {
        signals.push({ id: `sig-${sigIdx++}`, channelId: ch.channelId, channelLabel: ch.channelLabel, color: ch.color,
          type: "declining-roas" as SignalType, severity: "warning",
          issue: "ROAS below target (2.0x)",
          explanation: `${ch.channelLabel} ROAS is ${ch.roas.toFixed(2)}x — below the recommended 2.0x target.`,
          recommendation: "Review creative performance and audience targeting.",
          currentValue: `${ch.roas.toFixed(2)}x`, priorValue: "—", changeText: "Below 2.0x target" });
      }
      if (ch.ctr < 0.5 && ch.impressions > 1000) {
        signals.push({ id: `sig-${sigIdx++}`, channelId: ch.channelId, channelLabel: ch.channelLabel, color: ch.color,
          type: "declining-ctr" as SignalType, severity: "warning",
          issue: "Low click-through rate",
          explanation: `${ch.channelLabel} CTR is ${ch.ctr.toFixed(2)}% — indicates poor ad relevance or creative fatigue.`,
          recommendation: "Refresh creative assets and test new audience segments.",
          currentValue: `${ch.ctr.toFixed(2)}%`, priorValue: "—", changeText: "Below 0.5% benchmark" });
      }
    }

    // ── Funnels ───────────────────────────────────────────────────────────────
    const funnels: ChannelFunnel[] = channelRows.map(ch => {
      const impr   = ch.impressions;
      const clicks = ch.ctr / 100 * ch.impressions;
      const convs  = ch.conversions;
      const maxVal = impr;
      const stages = [
        { name: "Impressions", value: impr,   formatted: impr   >= 1e6 ? `${(impr/1e6).toFixed(1)}M`     : `${Math.round(impr/1e3)}K`,                         rate: null,                             dropOff: 0,                                           relativeWidth: 100,                          isLargestDropOff: false },
        { name: "Clicks",      value: clicks, formatted: clicks >= 1e3 ? `${(clicks/1e3).toFixed(1)}K`   : String(Math.round(clicks)),                          rate: impr   > 0 ? (clicks/impr)*100   : 0, dropOff: impr   > 0 ? ((impr-clicks)/impr)*100   : 0, relativeWidth: maxVal > 0 ? (clicks/maxVal)*100 : 0, isLargestDropOff: false },
        { name: "Conversions", value: convs,  formatted: String(Math.round(convs)),                                                                             rate: clicks > 0 ? (convs/clicks)*100  : 0, dropOff: clicks > 0 ? ((clicks-convs)/clicks)*100 : 0, relativeWidth: maxVal > 0 ? (convs/maxVal)*100  : 0, isLargestDropOff: false },
      ];
      const maxDrop = Math.max(...stages.slice(1).map(s => s.dropOff));
      stages.forEach(s => { if (s.dropOff === maxDrop && maxDrop > 0) s.isLargestDropOff = true; });
      return { channelId: ch.channelId, channelLabel: ch.channelLabel, color: ch.color, roas: ch.roas, revenue: ch.revenue, stages };
    });

    // ── Advanced rows ─────────────────────────────────────────────────────────
    const advanced: AdvancedRow[] = channelRows.map(ch => {
      const apiCh      = raw.find(r => r.channelId === ch.channelId);
      const series     = apiCh?.dailySeries ?? [];
      const midpoint   = Math.floor(series.length / 2);
      const firstHalf  = series.slice(0, midpoint);
      const secondHalf = series.slice(midpoint);
      const roasFirst  = firstHalf.reduce( (s, d) => s + (d.spend > 0 ? d.revenue / d.spend : 0), 0) / (firstHalf.length  || 1);
      const roasSecond = secondHalf.reduce((s, d) => s + (d.spend > 0 ? d.revenue / d.spend : 0), 0) / (secondHalf.length || 1);
      const efficiencyDecay   = roasFirst > 0 ? Math.max(0, ((roasFirst - roasSecond) / roasFirst) * 100) : 0;
      const actualClicks      = ch.ctr / 100 * ch.impressions;
      return {
        channelId:           ch.channelId,
        channelLabel:        ch.channelLabel,
        color:               ch.color,
        elasticity:          0.7,
        incrementalLift:     Math.min(ch.roas * 20, 100),
        impressionsPerClick: actualClicks > 0 ? ch.impressions / actualClicks : 0,
        efficiencyDecay,
      };
    });

    return { blendedMetrics, channelRows, signals, funnels, advanced };
  }, [attrApiData, filterChannelIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const [funnelChannelId, setFunnelChannelId] = useState<string>("");
  const effectiveFunnelId = funnelChannelId || channelRows[0]?.channelId || "";
  const selectedFunnel: ChannelFunnel | undefined =
    funnels.find(f => f.channelId === effectiveFunnelId) ?? funnels[0];

  const hasData  = channelRows.length > 0;
  const isLoading = attrLoading;

  return (
    <DashboardLayout
      title="Ad Attribution"
      description="Paid media performance — expand any channel to view campaign-level detail."
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

          {/* Channel selector */}
          <section>
            <ChannelSelector
              allChannels={allChannels}
              selected={selectedChannelIds}
              onToggle={handleToggleChannel}
              onSelectAll={handleSelectAll}
              onClearAll={handleClearAll}
            />
          </section>

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-[#FFBC80]/8 animate-pulse" />
              ))}
            </div>
          ) : !hasData ? (
            <div className={`${CARD_CLASS} p-10 text-center`}>
              <p className="text-sm text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35">
                No data available — check your Snowflake connection and date range.
              </p>
            </div>
          ) : (
            <>
              {/* Blended KPI cards */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">Blended Ad Metrics</h2>
                  <span className="text-[10px] text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">vs prior period</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {blendedMetrics.map(m => <BlendedMetricCard key={m.id} m={m} />)}
                </div>
              </section>

              {/* Expandable channel table */}
              <section>
                <ChannelTable
                  rows={channelRows}
                  start={dateRange.startDate}
                  end={dateRange.endDate}
                />
              </section>

              {/* ── Signal Detector ─────────────────────────────────────── */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">Signal Detector</h2>
                  {signals.length > 0 ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/12 text-red-600 dark:text-red-400">
                      {signals.filter(s => s.severity === "critical").length} critical
                      {signals.filter(s => s.severity === "warning").length > 0 &&
                        `, ${signals.filter(s => s.severity === "warning").length} warning`}
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
                      All clear
                    </span>
                  )}
                </div>
                {signals.length === 0 ? (
                  <div className={`${CARD_CLASS} p-8 text-center`}>
                    <p className="text-sm text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">
                      No performance issues detected for this period.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {signals.map(signal => <SignalCard key={signal.id} signal={signal} />)}
                  </div>
                )}
              </section>

              {/* ── Funnel Analysis ─────────────────────────────────────── */}
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
                      {funnels.map(f => (
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

              {/* ── Advanced Intelligence ────────────────────────────────── */}
              <section>
                <AdvancedTable rows={advanced} />
              </section>
            </>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
