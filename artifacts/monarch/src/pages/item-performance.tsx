import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { API_BASE } from "@/lib/apiBase";
import {
  Info,
  ChevronDown,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Download,
} from "lucide-react";
import { Tooltip as UITooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import ErrorState from "@/components/ErrorState";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeekPoint { week: string; revenue: number; }
interface RetailerBreakdown {
  entityId: number;
  name: string;
  revenue: number;
  units: number;
  dpsw: number | null;
  dataSource: string;
  itemNumber: string;
}
interface SkuRow {
  sku: string;
  productName: string;
  upc: string;
  totalRevenue: number;
  totalUnits: number;
  posTotalRevenue?: number;
  posTotalUnits?: number;
  avgDpsw: number;
  targetDpsw: number;
  vsTargetBenchmark: number;
  vsRetailAvg: number;
  retailerCount: number;
  dataSources: string[];
  weeklyTrend: WeekPoint[];
  byRetailer: RetailerBreakdown[];
}
interface RetailerRow {
  entityId: number;
  name: string;
  totalRevenue: number;
  totalUnits: number;
  skuCount: number;
  avgDpsw: number | null;
  dataSource: string;
}
interface Summary {
  topSkuByDpsw:    { sku: string; productName: string; dpsw: number } | null;
  skusAboveAvg:    { count: number; pct: number };
  highestVolumeSku: { sku: string; productName: string; revenue: number } | null;
  biggestOpportunity: { sku: string; productName: string; gap: number } | null;
}
interface ApiResponse {
  summary: Summary;
  skus: SkuRow[];
  retailers: RetailerRow[];
  storeCountsUsed: Record<string, number>;
  periodLabel: string;
  dataSourceNote: string;
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmtCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v).toLocaleString()}`;
}

function fmtDpsw(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "—";
  return `$${v.toFixed(2)}`;
}

function fmtUnits(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { value: "4w",   label: "Last 4 Weeks",   group: "rolling" },
  { value: "13w",  label: "Last 13 Weeks",  group: "rolling" },
  { value: "26w",  label: "Last 26 Weeks",  group: "rolling" },
  { value: "52w",  label: "Last 52 Weeks",  group: "rolling" },
  { value: "lw",   label: "Last Week",      group: "rolling" },
  { value: "2025", label: "Calendar 2025",  group: "annual"  },
  { value: "2026", label: "Building 2026",  group: "annual"  },
];

const RETAILER_OPTIONS = [
  { value: 229,  label: "Target" },
  { value: 231,  label: "Walmart" },
  { value: 230,  label: "Ulta Beauty" },
  { value: 228,  label: "Kroger" },
  { value: 222,  label: "CVS" },
  { value: 633,  label: "Publix" },
  { value: 1068, label: "Walgreens" },
  { value: 227,  label: "Meijer" },
];

const TT_STYLE = {
  background:   "rgba(255,249,242,0.97)",
  border:       "1px solid #FFBC80",
  borderRadius: "10px",
  fontSize:     12,
  boxShadow:    "0 4px 20px rgba(0,0,0,0.08)",
  padding:      "8px 12px",
};

const SKU_TABS = [
  { value: "all",           label: "All SKUs" },
  { value: "above_avg",     label: "Above Retail Avg" },
  { value: "below_avg",     label: "Below Retail Avg" },
  { value: "above_target",  label: "Above Target Benchmark" },
  { value: "below_target",  label: "Below Target Benchmark" },
];

// ─── Delta Badge ──────────────────────────────────────────────────────────────

function DeltaBadge({ value }: { value: number }) {
  if (isNaN(value) || value === 0) {
    return <span className="text-[#3A3A3A]/40 text-xs">—</span>;
  }
  const isPos = value > 0;
  const Icon  = isPos ? TrendingUp : TrendingDown;
  const color = isPos ? "text-emerald-600" : "text-red-500";
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${color}`}>
      <Icon size={11} strokeWidth={2.5} />
      {isPos ? "+" : ""}{fmtDpsw(value)}
    </span>
  );
}

// ─── Data Source Badges ───────────────────────────────────────────────────────

function DataSourceBadges({ sources }: { sources: string[] }) {
  const hasSellIn = sources.some(s => s.includes("sellin"));
  const hasPOS    = sources.some(s => s.includes("pos"));
  return (
    <div className="flex gap-1">
      {hasSellIn && (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#3A3A3A]/10 text-[#3A3A3A]/60 uppercase tracking-wide">
          S
        </span>
      )}
      {hasPOS && (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700 uppercase tracking-wide">
          P
        </span>
      )}
    </div>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data }: { data: WeekPoint[] }) {
  if (!data || data.length < 2) {
    return <span className="text-[#3A3A3A]/30 text-xs">—</span>;
  }
  return (
    <ResponsiveContainer width={80} height={28}>
      <LineChart data={data} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="#FFBC80"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── DPSW color class ─────────────────────────────────────────────────────────

function dpswColor(vsAvg: number): string {
  if (isNaN(vsAvg)) return "text-[#3A3A3A]/60";
  if (vsAvg > 0.1)  return "text-emerald-600 font-semibold";
  if (vsAvg < -0.1) return "text-red-500 font-semibold";
  return "text-amber-500 font-semibold";
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-[#FFBC80]/10">
      {Array.from({ length: 10 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 rounded bg-[#FFBC80]/20 animate-pulse" style={{ width: `${40 + (i * 7) % 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  title: string;
  value: string;
  sub?: string;
  note?: string;
  highlight?: boolean;
  onClick?: () => void;
}

function KpiCard({ title, value, sub, note, highlight, onClick }: KpiCardProps) {
  return (
    <div
      className={`rounded-xl p-4 bg-white dark:bg-[#1a1208] shadow-sm border border-[#FFBC80]/20 ${onClick ? "cursor-pointer hover:border-[#FFBC80]/60 hover:shadow-md transition-all" : ""}`}
      style={highlight ? { background: "linear-gradient(135deg, rgba(255,188,128,0.12), rgba(255,226,154,0.12))" } : {}}
      onClick={onClick}
    >
      <div className="text-xs font-medium text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 uppercase tracking-wider mb-1">{title}</div>
      <div className="text-xl font-bold text-[#3A3A3A] dark:text-[#FFF9F2] leading-tight">{value}</div>
      {sub  && <div className="text-xs text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 mt-0.5 truncate">{sub}</div>}
      {note && <div className="text-[10px] text-[#3A3A3A]/40 mt-1">{note}</div>}
      {onClick && <div className="text-[10px] text-[#FFBC80] mt-1.5">View top 10 →</div>}
    </div>
  );
}

// ─── SKU Detail Drawer ────────────────────────────────────────────────────────

function SkuDrawer({ sku, onClose, numWeeks }: { sku: SkuRow; onClose: () => void; numWeeks: number }) {
  const [drawerTab, setDrawerTab] = useState<"retailers" | "trend" | "distribution">("retailers");

  const retailAvgDpsw = useMemo(() => {
    const carrying = sku.byRetailer.filter(r => r.dpsw != null);
    if (!carrying.length) return 0;
    return carrying.reduce((s, r) => s + (r.dpsw ?? 0), 0) / carrying.length;
  }, [sku]);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/20" onClick={onClose} />
      <div className="w-[520px] bg-[#FFF9F2] dark:bg-[#1a1208] shadow-2xl flex flex-col h-full overflow-hidden border-l border-[#FFBC80]/30">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#FFBC80]/20 flex items-start justify-between shrink-0">
          <div>
            <div className="font-bold text-[#3A3A3A] dark:text-[#FFF9F2] text-base">{sku.productName}</div>
            <div className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mt-0.5">
              SKU: {sku.sku}{sku.upc ? ` · UPC: ${sku.upc}` : ""}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#FFBC80]/15 text-[#3A3A3A]/50 hover:text-[#3A3A3A] transition-colors mt-0.5"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 px-6 pt-3 shrink-0">
          {(["retailers", "trend", "distribution"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setDrawerTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                drawerTab === tab
                  ? "text-[#3A3A3A] dark:text-[#1a1208]"
                  : "text-[#3A3A3A]/50 hover:bg-[#FFBC80]/10"
              }`}
              style={drawerTab === tab ? { background: "linear-gradient(135deg, #FFBC80, #FFE29A)" } : {}}
            >
              {tab === "retailers" ? "By Retailer" : tab === "trend" ? "Trend" : "Distribution"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* Tab: By Retailer */}
          {drawerTab === "retailers" && (
            <div>
              {/* Bar chart */}
              <div className="mb-4">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={sku.byRetailer.filter(r => r.dpsw != null)}
                    margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(58,58,58,0.06)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "rgba(58,58,58,0.45)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "rgba(58,58,58,0.45)" }} />
                    <Tooltip contentStyle={TT_STYLE} formatter={(v: number) => [`$${v.toFixed(2)}`, "DPSW"]} />
                    <ReferenceLine y={retailAvgDpsw} stroke="#FFBC80" strokeDasharray="4 2" label={{ value: "Retail Avg", fontSize: 9, fill: "#FFBC80" }} />
                    <Bar dataKey="dpsw" fill="#FFBC80" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-lg border border-[#FFBC80]/15">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#FFBC80]/10">
                      <th className="px-3 py-2 text-left font-semibold text-[#3A3A3A]/60">Retailer</th>
                      <th className="px-3 py-2 text-left font-semibold text-[#3A3A3A]/60">Item #</th>
                      <th className="px-3 py-2 text-right font-semibold text-[#3A3A3A]/60">Revenue</th>
                      <th className="px-3 py-2 text-right font-semibold text-[#3A3A3A]/60">Units</th>
                      <th className="px-3 py-2 text-right font-semibold text-[#3A3A3A]/60">DPSW</th>
                      <th className="px-3 py-2 text-right font-semibold text-[#3A3A3A]/60">vs Avg</th>
                      <th className="px-3 py-2 text-center font-semibold text-[#3A3A3A]/60">Src</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sku.byRetailer.map(r => (
                      <tr key={r.entityId} className="border-t border-[#FFBC80]/10 hover:bg-[#FFBC80]/5">
                        <td className="px-3 py-2 font-medium text-[#3A3A3A] dark:text-[#FFF9F2]">{r.name}</td>
                        <td className="px-3 py-2 text-[#3A3A3A]/50 text-[10px] font-mono">{r.itemNumber || "—"}</td>
                        <td className="px-3 py-2 text-right text-[#3A3A3A]/70">{fmtCurrency(r.revenue)}</td>
                        <td className="px-3 py-2 text-right text-[#3A3A3A]/70">{fmtUnits(r.units)}</td>
                        <td className="px-3 py-2 text-right">{fmtDpsw(r.dpsw)}</td>
                        <td className="px-3 py-2 text-right">
                          {r.dpsw != null ? <DeltaBadge value={r.dpsw - retailAvgDpsw} /> : "—"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <DataSourceBadges sources={[r.dataSource]} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab: Trend */}
          {drawerTab === "trend" && (
            <div>
              <div className="text-xs text-[#3A3A3A]/50 mb-3">Weekly revenue over selected period (sell-in)</div>
              {sku.weeklyTrend.length < 2 ? (
                <div className="text-center py-12 text-[#3A3A3A]/30 text-sm">Not enough data for trend</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={sku.weeklyTrend} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(58,58,58,0.06)" />
                    <XAxis dataKey="week" tick={{ fontSize: 9, fill: "rgba(58,58,58,0.45)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "rgba(58,58,58,0.45)" }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                    <Tooltip contentStyle={TT_STYLE} formatter={(v: number) => [fmtCurrency(v), "Revenue"]} />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#FFBC80"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#FFBC80" }}
                      strokeDasharray="5 3"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
              <div className="mt-3 flex items-center gap-1.5 text-[10px] text-[#3A3A3A]/40">
                <span className="inline-block w-6 border-t-2 border-dashed border-[#FFBC80]" />
                Sell-in (NetSuite) — shipments to retailer
              </div>
            </div>
          )}

          {/* Tab: Distribution */}
          {drawerTab === "distribution" && (
            <div>
              <div className="text-xs text-[#3A3A3A]/50 mb-3">Retailer distribution for this SKU in the selected period</div>
              <div className="overflow-x-auto rounded-lg border border-[#FFBC80]/15">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#FFBC80]/10">
                      <th className="px-3 py-2 text-left font-semibold text-[#3A3A3A]/60">Retailer</th>
                      <th className="px-3 py-2 text-center font-semibold text-[#3A3A3A]/60">Carrying?</th>
                      <th className="px-3 py-2 text-right font-semibold text-[#3A3A3A]/60">DPSW</th>
                      <th className="px-3 py-2 text-right font-semibold text-[#3A3A3A]/60">Est. Stores</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RETAILER_OPTIONS.map(opt => {
                      const r = sku.byRetailer.find(br => br.entityId === opt.value);
                      const carrying = r && r.revenue > 0;
                      return (
                        <tr key={opt.value} className="border-t border-[#FFBC80]/10 hover:bg-[#FFBC80]/5">
                          <td className="px-3 py-2 font-medium text-[#3A3A3A] dark:text-[#FFF9F2]">{opt.label}</td>
                          <td className="px-3 py-2 text-center">
                            {carrying ? (
                              <span className="text-emerald-600 font-semibold">✓</span>
                            ) : (
                              <span className="text-red-400 font-semibold text-[10px] uppercase tracking-wide">Gap</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">{r ? fmtDpsw(r.dpsw) : "—"}</td>
                          <td className="px-3 py-2 text-right text-[#3A3A3A]/60">
                            {RETAILER_OPTIONS.find(o => o.value === opt.value) ? (
                              (({
                                229: "2,000", 231: "4,700", 230: "1,350",
                                228: "2,800", 222: "9,000", 633: "1,400",
                                1068: "8,700", 227: "500",
                              } as Record<number, string>)[opt.value] ?? "—")
                            ) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Summary Modal (Fix 6) ────────────────────────────────────────────────────

type ModalType = "dpsw" | "aboveAvg" | "revenue" | "opportunity";

function SummaryModal({ type, skus, retailAvgDpsw, onClose }: {
  type: ModalType; skus: SkuRow[]; retailAvgDpsw: number; onClose: () => void;
}) {
  const items = useMemo(() => {
    if (type === "dpsw")    return [...skus].sort((a, b) => b.avgDpsw - a.avgDpsw).slice(0, 10);
    if (type === "aboveAvg") return [...skus].filter(s => s.avgDpsw > retailAvgDpsw).sort((a, b) => b.avgDpsw - a.avgDpsw).slice(0, 10);
    if (type === "revenue") return [...skus].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 10);
    return [...skus]
      .filter(s => s.retailerCount > 1 && s.targetDpsw > 0 && s.targetDpsw < s.avgDpsw)
      .sort((a, b) => (b.avgDpsw - b.targetDpsw) - (a.avgDpsw - a.targetDpsw))
      .slice(0, 10);
  }, [type, skus, retailAvgDpsw]);

  const config: Record<ModalType, { title: string; col: string; val: (s: SkuRow) => string }> = {
    dpsw:        { title: "Top 10 SKUs by DPSW",        col: "Avg DPSW",  val: s => fmtDpsw(s.avgDpsw) },
    aboveAvg:    { title: "SKUs Above Retail Average",   col: "Avg DPSW",  val: s => fmtDpsw(s.avgDpsw) },
    revenue:     { title: "Top 10 SKUs by Revenue",      col: "Revenue",   val: s => fmtCurrency(s.totalRevenue) },
    opportunity: { title: "Biggest Opportunities",       col: "DPSW Gap",  val: s => fmtDpsw(s.avgDpsw - s.targetDpsw) },
  };
  const cfg = config[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-[#FFF9F2] dark:bg-[#1a1208] rounded-2xl shadow-2xl border border-[#FFBC80]/30 w-full max-w-lg mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-[#FFBC80]/15 flex items-center justify-between">
          <h3 className="font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">{cfg.title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#FFBC80]/15 text-[#3A3A3A]/50 hover:text-[#3A3A3A]"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto max-h-[420px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#FFF9F2] dark:bg-[#1a1208]">
              <tr className="border-b border-[#FFBC80]/10">
                <th className="px-4 py-2 text-left text-xs font-semibold text-[#3A3A3A]/50">#</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-[#3A3A3A]/50">SKU</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-[#3A3A3A]/50">{cfg.col}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s, i) => (
                <tr key={s.sku} className="border-b border-[#FFBC80]/08 hover:bg-[#FFBC80]/5">
                  <td className="px-4 py-2.5 text-xs text-[#3A3A3A]/40">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-[#3A3A3A] dark:text-[#FFF9F2] text-xs leading-tight">{s.productName}</div>
                    <div className="text-[10px] text-[#3A3A3A]/40">{s.sku}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] tabular-nums">{cfg.val(s)}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-[#3A3A3A]/40 text-sm">No data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Item # helper ────────────────────────────────────────────────────────────

function getPrimaryItemNumber(sku: SkuRow, selectedRetailers: number[]): string {
  if (selectedRetailers.length === 1) {
    return sku.byRetailer.find(r => r.entityId === selectedRetailers[0])?.itemNumber || "—";
  }
  const target  = sku.byRetailer.find(r => r.entityId === 229 && r.itemNumber);
  if (target?.itemNumber)  return target.itemNumber;
  const walmart = sku.byRetailer.find(r => r.entityId === 231 && r.itemNumber);
  if (walmart?.itemNumber) return walmart.itemNumber;
  return sku.byRetailer.find(r => r.itemNumber)?.itemNumber || "—";
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function skuToRow(s: SkuRow): (string | number)[] {
  return [
    s.productName, s.sku, s.upc,
    s.totalRevenue, s.totalUnits,
    +s.avgDpsw.toFixed(4),
    s.targetDpsw > 0 ? +s.targetDpsw.toFixed(4) : "",
    +s.vsRetailAvg.toFixed(4),
    +s.vsTargetBenchmark.toFixed(4),
    s.retailerCount,
    s.dataSources.join("+"),
  ];
}

const EXPORT_HEADERS = [
  "Product Name", "SKU", "UPC",
  "Total Revenue", "Total Units",
  "Avg DPSW", "Target DPSW",
  "vs Retail Avg", "vs Target Benchmark",
  "# Retailers", "Data Sources",
];

function downloadCSV(skus: SkuRow[], filename: string) {
  const csv = [EXPORT_HEADERS, ...skus.map(skuToRow)]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = filename;
  a.click();
}

function downloadExcel(skus: SkuRow[], filename: string) {
  const wb = XLSX.utils.book_new();
  const retailerIds = [...new Set(skus.flatMap(s => s.byRetailer.map(r => r.entityId)))];
  const sheetOrder  = RETAILER_OPTIONS.map(o => o.value).filter(id => retailerIds.includes(id));

  for (const entityId of sheetOrder) {
    const opt   = RETAILER_OPTIONS.find(o => o.value === entityId);
    const label = opt?.label ?? String(entityId);
    const rSkus = skus.filter(s => s.byRetailer.some(r => r.entityId === entityId));
    const headers = [
      "Product Name", "SKU", "UPC",
      `${label} Revenue`, `${label} Units`, `${label} DPSW`, `${label} Item #`,
      "Total Revenue (All)", "Total Units (All)", "Avg DPSW (All)", "Data Sources",
    ];
    const rows = rSkus.map(s => {
      const rb = s.byRetailer.find(r => r.entityId === entityId);
      return [
        s.productName, s.sku, s.upc,
        rb?.revenue ?? 0, rb?.units ?? 0,
        rb?.dpsw != null ? +rb.dpsw.toFixed(4) : "",
        rb?.itemNumber ?? "",
        s.totalRevenue, s.totalUnits,
        +s.avgDpsw.toFixed(4),
        s.dataSources.join("+"),
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, label.substring(0, 31));
  }

  XLSX.writeFile(wb, filename);
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ItemPerformance() {
  const [period,       setPeriod]       = useState<string>("4w");
  const [dateMode,     setDateMode]     = useState<"period" | "custom">("period");
  const [customStart,  setCustomStart]  = useState("");
  const [customEnd,    setCustomEnd]    = useState("");
  const [modalType,    setModalType]    = useState<ModalType | null>(null);
  const [retailers,    setRetailers]    = useState<number[]>([]);
  const [dataSource,   setDataSource]   = useState<string>("all");
  const [skuFilter,    setSkuFilter]    = useState<string>("all");
  const [sortCol,      setSortCol]      = useState<string>("avgDpsw");
  const [sortDir,      setSortDir]      = useState<"asc" | "desc">("desc");
  const [drawerSku,    setDrawerSku]    = useState<SkuRow | null>(null);
  const [retailerOpen, setRetailerOpen] = useState(false);
  const [periodOpen,   setPeriodOpen]   = useState(false);

  const queryParams = useMemo(() => {
    const p = new URLSearchParams({ dataSource });
    if (period === "lw") {
      const today = new Date();
      const dow = today.getDay(); // 0=Sun
      const daysToThisMon = dow === 0 ? 6 : dow - 1;
      const lastMon = new Date(today);
      lastMon.setDate(today.getDate() - daysToThisMon - 7);
      const lastSun = new Date(lastMon);
      lastSun.setDate(lastMon.getDate() + 6);
      const toISO = (d: Date) => d.toISOString().split("T")[0];
      p.set("start", toISO(lastMon));
      p.set("end",   toISO(lastSun));
    } else if (dateMode === "custom" && customStart && customEnd) {
      p.set("start", customStart);
      p.set("end",   customEnd);
    } else {
      p.set("period", period);
    }
    if (retailers.length) p.set("retailers", retailers.join(","));
    return p;
  }, [dateMode, period, customStart, customEnd, dataSource, retailers]);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<ApiResponse>({
    queryKey: ["item-performance", queryParams.toString()],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/item-performance?${queryParams.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to fetch");
      }
      return res.json();
    },
  });

  const numWeeks = useMemo(() => {
    if (period === "lw") return 1;
    if (period === "2025") return 52;
    if (period === "2026") {
      const now = new Date();
      const start2026 = new Date(2026, 0, 1);
      return Math.max(1, Math.ceil((now.getTime() - start2026.getTime()) / (7 * 24 * 60 * 60 * 1000)));
    }
    if (dateMode === "custom" && customStart && customEnd) {
      const diff = new Date(customEnd).getTime() - new Date(customStart).getTime();
      return Math.max(1, Math.round(diff / (7 * 24 * 60 * 60 * 1000)));
    }
    if (period === "ytd") {
      const now = new Date();
      const soy = new Date(now.getFullYear(), 0, 1);
      return Math.max(1, Math.ceil((now.getTime() - soy.getTime()) / (7 * 24 * 60 * 60 * 1000)));
    }
    return parseInt(period) || 4;
  }, [dateMode, period, customStart, customEnd]);

  // Client-side sort
  const sortedSkus = useMemo(() => {
    if (!data?.skus) return [];
    return [...data.skus].sort((a, b) => {
      let va: number, vb: number;
      if (sortCol === "avgDpsw")           { va = a.avgDpsw;           vb = b.avgDpsw; }
      else if (sortCol === "targetDpsw")   { va = a.targetDpsw;        vb = b.targetDpsw; }
      else if (sortCol === "totalRevenue") { va = a.totalRevenue;       vb = b.totalRevenue; }
      else if (sortCol === "totalUnits")   { va = a.totalUnits;         vb = b.totalUnits; }
      else if (sortCol === "vsTargetBench"){ va = a.vsTargetBenchmark;   vb = b.vsTargetBenchmark; }
      else if (sortCol === "retailers")    { va = a.retailerCount;      vb = b.retailerCount; }
      else { va = a.avgDpsw; vb = b.avgDpsw; }
      return sortDir === "desc" ? vb - va : va - vb;
    });
  }, [data?.skus, sortCol, sortDir]);

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortCol(col); setSortDir("desc"); }
  }

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return <Minus size={10} className="text-[#3A3A3A]/20" />;
    return sortDir === "desc"
      ? <TrendingDown size={10} className="text-[#FFBC80]" />
      : <TrendingUp   size={10} className="text-[#FFBC80]" />;
  };

  const retailAvgDpsw = useMemo(() => {
    if (!data?.skus?.length) return 0;
    return data.skus.reduce((s, r) => s + r.avgDpsw, 0) / data.skus.length;
  }, [data?.skus]);

  const includesSellIn = dataSource === "all" || dataSource === "sellin";

  const retailerLabel = retailers.length === 0
    ? "All Retailers"
    : RETAILER_OPTIONS.filter(o => retailers.includes(o.value)).map(o => o.label).join(", ");

  const periodLabelStr = dateMode === "custom" && customStart && customEnd
    ? `${customStart} – ${customEnd}`
    : (PERIOD_OPTIONS.find(o => o.value === period)?.label ?? period);

  return (
    <DashboardLayout
      title="Item Performance"
      description="SKU-level sales velocity across all retail channels"
      hideDatePicker
      hideStoreFilter
    >
      {/* ── Filters Bar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Period dropdown */}
        <div className="relative">
          <button
            onClick={() => { setPeriodOpen(o => !o); setRetailerOpen(false); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#FFBC80]/30 bg-white dark:bg-[#1a1208] text-sm font-medium text-[#3A3A3A] dark:text-[#FFF9F2] hover:border-[#FFBC80]/60 transition-colors"
          >
            <span className="max-w-[160px] truncate">{periodLabelStr}</span>
            <ChevronDown size={14} className={`shrink-0 transition-transform ${periodOpen ? "rotate-180" : ""}`} />
          </button>
          {periodOpen && (
            <div className="absolute top-full mt-1 left-0 z-30 bg-white dark:bg-[#1a1208] border border-[#FFBC80]/30 rounded-xl shadow-xl py-1 min-w-[220px] max-h-[400px] overflow-y-auto">
              <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-[#3A3A3A]/40 uppercase tracking-wider">Rolling Period</div>
              {PERIOD_OPTIONS.filter(o => o.group === "rolling").map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setPeriod(opt.value); setDateMode("period"); setPeriodOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-[#FFBC80]/10 transition-colors ${dateMode === "period" && period === opt.value ? "font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]" : "text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60"}`}
                >
                  {opt.label}
                </button>
              ))}
              <div className="px-3 pt-3 pb-1 text-[10px] font-semibold text-[#3A3A3A]/40 uppercase tracking-wider border-t border-[#FFBC80]/10 mt-1">Annual</div>
              {PERIOD_OPTIONS.filter(o => o.group === "annual").map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setPeriod(opt.value); setDateMode("period"); setPeriodOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-[#FFBC80]/10 transition-colors ${dateMode === "period" && period === opt.value ? "font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]" : "text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60"}`}
                >
                  {opt.label}
                </button>
              ))}
              <div className="px-3 pt-3 pb-1 text-[10px] font-semibold text-[#3A3A3A]/40 uppercase tracking-wider border-t border-[#FFBC80]/10 mt-1">Custom Range</div>
              <div className="px-3 pb-3 flex flex-col gap-1.5">
                <input
                  type="date"
                  value={customStart}
                  onChange={e => { setCustomStart(e.target.value); setDateMode("custom"); }}
                  className="w-full px-2 py-1 text-xs rounded border border-[#FFBC80]/30 bg-white dark:bg-[#1a1208] text-[#3A3A3A] dark:text-[#FFF9F2]"
                />
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => { setCustomEnd(e.target.value); setDateMode("custom"); }}
                  className="w-full px-2 py-1 text-xs rounded border border-[#FFBC80]/30 bg-white dark:bg-[#1a1208] text-[#3A3A3A] dark:text-[#FFF9F2]"
                />
                {customStart && customEnd && (
                  <button
                    onClick={() => { setDateMode("custom"); setPeriodOpen(false); }}
                    className="w-full px-2 py-1 text-xs rounded font-medium text-[#3A3A3A] dark:text-[#1a1208]"
                    style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}
                  >
                    Apply Range
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Retailer multi-select */}
        <div className="relative">
          <button
            onClick={() => { setRetailerOpen(o => !o); setPeriodOpen(false); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#FFBC80]/30 bg-white dark:bg-[#1a1208] text-sm font-medium text-[#3A3A3A] dark:text-[#FFF9F2] hover:border-[#FFBC80]/60 transition-colors max-w-[220px] truncate"
          >
            <span className="truncate">{retailerLabel}</span>
            <ChevronDown size={14} className={`shrink-0 transition-transform ${retailerOpen ? "rotate-180" : ""}`} />
          </button>
          {retailerOpen && (
            <div className="absolute top-full mt-1 left-0 z-30 bg-white dark:bg-[#1a1208] border border-[#FFBC80]/30 rounded-xl shadow-xl py-1 min-w-[180px]">
              <button
                onClick={() => setRetailers([])}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-[#FFBC80]/10 transition-colors ${retailers.length === 0 ? "font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]" : "text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60"}`}
              >
                All Retailers
              </button>
              {RETAILER_OPTIONS.map(opt => {
                const checked = retailers.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => setRetailers(prev =>
                      checked ? prev.filter(v => v !== opt.value) : [...prev, opt.value]
                    )}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-[#FFBC80]/10 transition-colors flex items-center gap-2"
                  >
                    <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${checked ? "border-[#FFBC80] bg-[#FFBC80]" : "border-[#3A3A3A]/30"}`}>
                      {checked && <span className="text-[8px] font-bold text-[#3A3A3A]">✓</span>}
                    </span>
                    <span className={checked ? "font-medium text-[#3A3A3A] dark:text-[#FFF9F2]" : "text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60"}>
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Data Source toggle */}
        <div className="flex rounded-lg border border-[#FFBC80]/30 overflow-hidden bg-white dark:bg-[#1a1208]">
          {[
            { value: "all",    label: "Best Available" },
            { value: "sellin", label: "Sell-In" },
            { value: "pos",    label: "Sell-Through" },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setDataSource(opt.value)}
              className={`px-3 py-2 text-xs font-medium transition-all ${
                dataSource === opt.value
                  ? "text-[#3A3A3A] dark:text-[#1a1208]"
                  : "text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 hover:bg-[#FFBC80]/10"
              }`}
              style={dataSource === opt.value ? { background: "linear-gradient(135deg, #FFBC80, #FFE29A)" } : {}}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {data?.skus && data.skus.length > 0 && (
          <button
            onClick={() => {
              const ts = periodLabelStr.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-");
              if (retailers.length === 1) {
                const opt = RETAILER_OPTIONS.find(o => o.value === retailers[0]);
                downloadCSV(data.skus, `item-performance-${opt?.label ?? "retailer"}-${ts}.csv`);
              } else {
                downloadExcel(data.skus, `item-performance-${ts}.xlsx`);
              }
            }}
            className="ml-auto flex items-center gap-2 px-3 py-2 rounded-lg border border-[#FFBC80]/40 bg-white dark:bg-[#1a1208] text-sm font-medium text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60 hover:border-[#FFBC80]/70 hover:text-[#3A3A3A] transition-colors"
          >
            <Download size={14} />
            Export
          </button>
        )}
      </div>

      {/* ── Sell-In Banner ───────────────────────────────────────────────── */}
      {includesSellIn && (
        <div className="mb-4 flex items-start gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/30 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>
            <strong>Sell-in vs. sell-through:</strong> NetSuite data reflects shipments to retailers, not consumer purchases.
            Circana and Target POS reflect actual consumer sales velocity.
          </span>
        </div>
      )}

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl p-4 bg-white dark:bg-[#1a1208] shadow-sm border border-[#FFBC80]/20 animate-pulse">
              <div className="h-3 w-24 bg-[#FFBC80]/20 rounded mb-2" />
              <div className="h-6 w-32 bg-[#FFBC80]/20 rounded mb-1" />
              <div className="h-3 w-20 bg-[#FFBC80]/15 rounded" />
            </div>
          ))
        ) : isError ? (
          <div className="col-span-4">
            <ErrorState
              message="Unable to load data — check your data connections."
              onRetry={() => refetch()}
              isRetrying={isRefetching}
            />
          </div>
        ) : data?.summary ? (
          <>
            <KpiCard
              title="Top SKU by DPSW"
              value={fmtDpsw(data.summary.topSkuByDpsw?.dpsw ?? null)}
              sub={data.summary.topSkuByDpsw?.productName}
              note={`SKU: ${data.summary.topSkuByDpsw?.sku ?? "—"}`}
              highlight
              onClick={() => setModalType("dpsw")}
            />
            <KpiCard
              title="SKUs Above Retail Avg"
              value={String(data.summary.skusAboveAvg.count)}
              sub={`${data.summary.skusAboveAvg.pct.toFixed(0)}% of all SKUs`}
              onClick={() => setModalType("aboveAvg")}
            />
            <KpiCard
              title="Highest Volume SKU"
              value={fmtCurrency(data.summary.highestVolumeSku?.revenue ?? 0)}
              sub={data.summary.highestVolumeSku?.productName}
              note={`SKU: ${data.summary.highestVolumeSku?.sku ?? "—"}`}
              onClick={() => setModalType("revenue")}
            />
            <KpiCard
              title="Biggest Opportunity"
              value={data.summary.biggestOpportunity ? `${fmtDpsw(data.summary.biggestOpportunity.gap)} gap` : "—"}
              sub={data.summary.biggestOpportunity?.productName}
              note="SKUs with the widest gap between cross-retailer avg DPSW and Target DPSW."
              onClick={() => setModalType("opportunity")}
            />
          </>
        ) : null}
      </div>

      {/* ── SKU Performance Table ─────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1a1208] rounded-xl border border-[#FFBC80]/20 shadow-sm mb-6">
        {/* Table header */}
        <div className="px-5 pt-5 pb-3 border-b border-[#FFBC80]/15">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">SKU Performance</h2>
              <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mt-0.5 flex items-center gap-1">
                Dollars per store per week across all retail channels
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info size={12} className="cursor-help text-[#3A3A3A]/30 hover:text-[#FFBC80] transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[240px]">
                    DPSW = Total Revenue ÷ Store Count ÷ Weeks in period.
                    Store counts are estimates.{" "}
                    {includesSellIn && "Sell-in data reflects shipments to retailer, not consumer purchases."}
                  </TooltipContent>
                </UITooltip>
              </p>
            </div>
            <div className="text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 text-right shrink-0">
              {data?.periodLabel ?? periodLabelStr}
              <br />
              <span className="text-[10px]">{sortedSkus.length} SKU{sortedSkus.length !== 1 ? "s" : ""}</span>
            </div>
          </div>

          {/* Quick-filter tabs */}
          <div className="flex gap-1 mt-3 flex-wrap">
            {SKU_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setSkuFilter(tab.value)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  skuFilter === tab.value
                    ? "text-[#3A3A3A] dark:text-[#1a1208]"
                    : "text-[#3A3A3A]/50 hover:bg-[#FFBC80]/10"
                }`}
                style={skuFilter === tab.value ? { background: "linear-gradient(135deg, #FFBC80, #FFE29A)" } : {}}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Store counts note */}
        <div className="px-5 py-2 text-[10px] text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 border-b border-[#FFBC80]/10 flex items-center gap-1">
          <Info size={10} />
          Store counts are estimates used for DPSW calculations. Store-level data will be used automatically when available.
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#FFBC80]/10 bg-[#FFF9F2]/50 dark:bg-[#120d06]/30">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">Product · SKU</th>
                <th
                  className="px-4 py-3 text-right text-xs font-semibold text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 cursor-pointer hover:text-[#3A3A3A] transition-colors select-none"
                  onClick={() => toggleSort("totalRevenue")}
                >
                  <span className="inline-flex items-center gap-1 justify-end">Revenue <SortIcon col="totalRevenue" /></span>
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-semibold text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 cursor-pointer hover:text-[#3A3A3A] transition-colors select-none"
                  onClick={() => toggleSort("totalUnits")}
                >
                  <span className="inline-flex items-center gap-1 justify-end">Units <SortIcon col="totalUnits" /></span>
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-semibold text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 cursor-pointer hover:text-[#3A3A3A] transition-colors select-none"
                  onClick={() => toggleSort("avgDpsw")}
                >
                  <span className="inline-flex items-center gap-1 justify-end">
                    Avg DPSW
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <Info size={11} className="cursor-help text-[#3A3A3A]/25 hover:text-[#FFBC80]" />
                      </TooltipTrigger>
                      <TooltipContent>Weighted avg dollars per store per week across all retailers carrying this SKU</TooltipContent>
                    </UITooltip>
                    <SortIcon col="avgDpsw" />
                  </span>
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-semibold text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 cursor-pointer hover:text-[#3A3A3A] transition-colors select-none"
                  onClick={() => toggleSort("targetDpsw")}
                >
                  <span className="inline-flex items-center gap-1 justify-end">
                    Target DPSW
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <Info size={11} className="cursor-help text-[#3A3A3A]/25 hover:text-[#FFBC80]" />
                      </TooltipTrigger>
                      <TooltipContent>Dollars per store per week at Target specifically (entity 229). Uses Target store count and sell-in units to retailer.</TooltipContent>
                    </UITooltip>
                    <SortIcon col="targetDpsw" />
                  </span>
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">
                  <span className="inline-flex items-center gap-1 justify-end">
                    vs Benchmark
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <Info size={11} className="cursor-help text-[#3A3A3A]/25 hover:text-[#FFBC80]" />
                      </TooltipTrigger>
                      <TooltipContent>Revenue-weighted velocity benchmark adjusted for retailer format (drug/grocery/mass). Positive = above expected pace.</TooltipContent>
                    </UITooltip>
                  </span>
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-semibold text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 cursor-pointer hover:text-[#3A3A3A] transition-colors select-none"
                  onClick={() => toggleSort("retailers")}
                >
                  <span className="inline-flex items-center gap-1">
                    # Retailers
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <Info size={11} className="cursor-help text-[#3A3A3A]/25 hover:text-[#FFBC80]" />
                      </TooltipTrigger>
                      <TooltipContent>Number of retail chains carrying this SKU in the selected period.</TooltipContent>
                    </UITooltip>
                    <SortIcon col="retailers" />
                  </span>
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">
                  <span className="inline-flex items-center gap-1 justify-center">
                    Data
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <Info size={11} className="cursor-help text-[#3A3A3A]/25 hover:text-[#FFBC80]" />
                      </TooltipTrigger>
                      <TooltipContent>S = Sell-In (NetSuite shipments to retailer). P = Sell-Through (consumer POS scans from Target, Walmart, Circana).</TooltipContent>
                    </UITooltip>
                  </span>
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">Trend</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">Retailer Item #</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              ) : isError ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12">
                    <ErrorState
                      message="Unable to load data — check your data connections."
                      onRetry={() => refetch()}
                      isRetrying={isRefetching}
                    />
                  </td>
                </tr>
              ) : sortedSkus.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-[#3A3A3A]/40 text-sm">
                    No SKUs found for the selected filters.
                  </td>
                </tr>
              ) : (
                sortedSkus.map(sku => (
                  <tr
                    key={sku.sku}
                    className="border-b border-[#FFBC80]/08 hover:bg-[#FFBC80]/5 cursor-pointer transition-colors"
                    onClick={() => setDrawerSku(sku)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#3A3A3A] dark:text-[#FFF9F2] text-sm leading-tight">{sku.productName}</div>
                      <div className="text-[10px] text-[#3A3A3A]/45 mt-0.5">{sku.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-[#3A3A3A]/80 dark:text-[#FFF9F2]/70 tabular-nums">
                      {fmtCurrency(dataSource === "pos" && sku.posTotalRevenue != null ? sku.posTotalRevenue : sku.totalRevenue)}
                      {dataSource !== "pos" && includesSellIn && (
                        <UITooltip>
                          <TooltipTrigger asChild>
                            <Info size={10} className="inline ml-1 text-[#3A3A3A]/25 hover:text-[#FFBC80] cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>Sell-in data — reflects shipments to retailer, not consumer purchases.</TooltipContent>
                        </UITooltip>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60 tabular-nums">
                      {fmtUnits(dataSource === "pos" && sku.posTotalUnits != null ? sku.posTotalUnits : sku.totalUnits)}
                    </td>
                    <td className={`px-4 py-3 text-right text-sm tabular-nums ${dpswColor(sku.vsRetailAvg)}`}>
                      {fmtDpsw(sku.avgDpsw)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60">
                      {sku.targetDpsw > 0 ? fmtDpsw(sku.targetDpsw) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right"><DeltaBadge value={sku.vsTargetBenchmark} /></td>
                    <td className="px-4 py-3 text-center text-sm text-[#3A3A3A]/60">{sku.retailerCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center"><DataSourceBadges sources={sku.dataSources} /></div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center" onClick={e => e.stopPropagation()}>
                        <Sparkline data={sku.weeklyTrend} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-left text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 font-mono">
                      {getPrimaryItemNumber(sku, retailers)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Retailer Velocity Overview ───────────────────────────────────── */}
      {data?.retailers && data.retailers.length > 0 && (
        <div className="bg-white dark:bg-[#1a1208] rounded-xl border border-[#FFBC80]/20 shadow-sm">
          <div className="px-5 pt-5 pb-3 border-b border-[#FFBC80]/15">
            <h2 className="text-base font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">Retailer Velocity Overview</h2>
            <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mt-0.5">Aggregate performance across all SKUs by retailer</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#FFBC80]/10 bg-[#FFF9F2]/50 dark:bg-[#120d06]/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">Retailer</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">Total Revenue</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">Total Units</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40"># SKUs</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">Avg DPSW (all SKUs)</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">Data Source</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const allDpswVals = data.retailers.filter(r => r.avgDpsw != null).map(r => r.avgDpsw as number);
                  const crossAvg = allDpswVals.length ? allDpswVals.reduce((s, v) => s + v, 0) / allDpswVals.length : 0;
                  return data.retailers.map(r => (
                    <tr key={r.entityId} className="border-b border-[#FFBC80]/08 hover:bg-[#FFBC80]/5 transition-colors">
                      <td className="px-4 py-3 font-medium text-[#3A3A3A] dark:text-[#FFF9F2]">{r.name}</td>
                      <td className="px-4 py-3 text-right text-[#3A3A3A]/80 dark:text-[#FFF9F2]/70 tabular-nums">{fmtCurrency(r.totalRevenue)}</td>
                      <td className="px-4 py-3 text-right text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60 tabular-nums">{fmtUnits(r.totalUnits)}</td>
                      <td className="px-4 py-3 text-right text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60">{r.skuCount}</td>
                      <td className={`px-4 py-3 text-right tabular-nums ${r.avgDpsw != null ? dpswColor((r.avgDpsw ?? 0) - crossAvg) : "text-[#3A3A3A]/40"}`}>
                        {fmtDpsw(r.avgDpsw)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#3A3A3A]/10 text-[#3A3A3A]/60 uppercase tracking-wide">
                          {r.dataSource === "sellin" ? "Sell-In" : r.dataSource === "pos" ? "POS" : r.dataSource}
                        </span>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SKU Drawer ──────────────────────────────────────────────────── */}
      {drawerSku && (
        <SkuDrawer
          sku={drawerSku}
          onClose={() => setDrawerSku(null)}
          numWeeks={numWeeks}
        />
      )}

      {/* ── Summary Modal ───────────────────────────────────────────────── */}
      {modalType && data?.skus && (
        <SummaryModal
          type={modalType}
          skus={data.skus}
          retailAvgDpsw={retailAvgDpsw}
          onClose={() => setModalType(null)}
        />
      )}

      {/* Close dropdowns on outside click */}
      {(periodOpen || retailerOpen) && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => { setPeriodOpen(false); setRetailerOpen(false); }}
        />
      )}
    </DashboardLayout>
  );
}
