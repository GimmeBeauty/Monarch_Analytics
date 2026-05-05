import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import KPIGrid from "@/components/overview/KPIGrid";
import PerformanceTrendChart from "@/components/overview/PerformanceTrendChart";
import EfficiencyTrendChart from "@/components/overview/EfficiencyTrendChart";
import BreakdownSection from "@/components/overview/BreakdownSection";
import ActivityFeed from "@/components/overview/ActivityFeed";
import { useDateRange } from "@/context/DateRangeContext";
import { useStoreFilter } from "@/context/StoreFilterContext";
import { usePricingMode } from "@/context/PricingModeContext";
import { API_BASE } from "@/lib/apiBase";
import type { KPIMetric, TrendPoint, StoreBreakdown, ChannelBreakdown, ContributionSlice, ActivityEvent } from "@/lib/overviewData";
import { storeById } from "@/lib/storeData";
import type { NetSuiteSalesResponse } from "@/lib/wholesaleData";

const NS_STORE_ID: Record<string, string> = {
  "Target":            "target",
  "Walmart":           "walmart",
  "CVS":               "cvs",
  "Ulta Beauty":       "ulta",
  "Kroger":            "kroger",
  "Publix":            "publix",
  "Walgreens":         "walgreens",
  "Shopify":           "shopify",
  "Amazon (Pattern)":  "amazon",
};

// ─── API Response Type ─────────────────────────────────────────────────────────

interface OverviewApiResponse {
  revenue: number;
  orders: number;
  units: number;
  asp: number;
  spend: number;
  adRevenue: number;
  mer: number;
  roas: number;
  sessions: number;
  cvr: number;
  revenueChange: number;
  ordersChange: number;
  aspChange: number;
  sessionsChange: number;
  cvrChange: number;
  storeBreakdown: Array<{ storeId: string; revenue: number }>;
  channelBreakdown: Array<{ channelId: string; channelLabel: string; color: string; channelFamily: string; storeIds: string[]; spend: number; revenue: number }>;
  dailySeries: Array<{ date: string; revenue: number; spend: number; adRevenue: number; adSpend: number }>;
  isEmpty: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v).toLocaleString()}`;
}

function fmtRatio(v: number): string { return `${v.toFixed(2)}x`; }

function fmtAxisDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function Overview() {
  const { dateRange } = useDateRange();
  const { selectedIds } = useStoreFilter();
  const { isWholesale } = usePricingMode();

  const isTargetOnly   = selectedIds.length === 1 && selectedIds[0] === "target";
  const includesTarget = selectedIds.length === 0 || selectedIds.includes("target");

  const { data: apiData, isLoading, error } = useQuery<OverviewApiResponse>({
    queryKey: ["overview-data", dateRange.startDate, dateRange.endDate, selectedIds.join(","), dateRange.compareStart, dateRange.compareEnd],
    queryFn: async () => {
      const storeParam = selectedIds.length ? `&storeIds=${selectedIds.join(",")}` : "";
      const res = await fetch(
        `${API_BASE}/api/data/overview?start=${dateRange.startDate}&end=${dateRange.endDate}${storeParam}&priorStart=${dateRange.compareStart}&priorEnd=${dateRange.compareEnd}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<OverviewApiResponse>;
    },
    staleTime: 1000 * 60 * 15,
    retry: false,
  });

  const { data: wholesaleData } = useQuery<NetSuiteSalesResponse>({
    queryKey: ["netsuite-sales", dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/api/data/netsuite/sales?start=${dateRange.startDate}&end=${dateRange.endDate}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<NetSuiteSalesResponse>;
    },
    staleTime: 1000 * 60 * 15,
    retry: false,
    enabled: isWholesale,
  });

  const data = useMemo(() => {
    if (!apiData || apiData.isEmpty) return null;

    // ── KPIs ─────────────────────────────────────────────────────────────────
    const wsActive = isWholesale && !!wholesaleData && !wholesaleData.isEmpty;
    console.log("[Overview ws] isWholesale:", isWholesale, "| wholesaleData:", wholesaleData ? `isEmpty=${wholesaleData.isEmpty} byStore=${wholesaleData.byStore.length}` : "undefined");
    const wsStores = wsActive
      ? (selectedIds.length > 0
          ? wholesaleData!.byStore.filter(s => {
              const sid = NS_STORE_ID[s.storeName] ?? s.storeName.toLowerCase().replace(/\s+/g, "-");
              return selectedIds.includes(sid);
            })
          : wholesaleData!.byStore)
      : [];
    const wsRevenue = wsActive && wsStores.length > 0 ? wsStores.reduce((sum, s) => sum + s.revenue, 0) : null;
    const wsUnits   = wsActive && wsStores.length > 0 ? wsStores.reduce((sum, s) => sum + s.units,   0) : null;
    console.log("[Overview ws] wsActive:", wsActive, "| wsStores:", wsStores.length, "| wsRevenue:", wsRevenue, "| wsUnits:", wsUnits);
    const displayRevenue = wsRevenue  ?? apiData.revenue;
    const displayUnits   = wsUnits    ?? apiData.units ?? 0;
    const revenueLabel   = isWholesale ? "Wholesale Revenue" : "Total Revenue";

    const wsMer  = wsRevenue != null && apiData.spend > 0 ? wsRevenue / apiData.spend : apiData.mer;
    const wsAsp  = wsRevenue != null && displayUnits > 0  ? wsRevenue / displayUnits  : (apiData.asp ?? 0);

    const kpis: KPIMetric[] = [
      { id: "revenue", label: revenueLabel,        value: displayRevenue,   formatted: fmtCurrency(displayRevenue),   change: wsRevenue != null ? 0 : (apiData.revenueChange ?? 0), positive: true,  format: "currency", description: isWholesale ? "Wholesale (sell-in) revenue from NetSuite" : "Aggregate revenue across all selected stores" },
      { id: "spend",   label: "Ad Spend",          value: apiData.spend,    formatted: fmtCurrency(apiData.spend),    change: 0, positive: false, format: "currency", description: "Total spend across all mapped ad channels" },
      { id: "mer",     label: "MER",               value: wsMer,            formatted: fmtRatio(wsMer),               change: 0, positive: true,  format: "ratio",    description: isWholesale ? "Wholesale Revenue ÷ Ad Spend" : "Marketing Efficiency Ratio — Total Revenue ÷ Total Ad Spend" },
      { id: "roas",    label: "Blended ROAS",       value: apiData.roas,     formatted: fmtRatio(apiData.roas),        change: 0, positive: true,  format: "ratio",    description: "Return on Ad Spend — Attributed Revenue ÷ Total Spend" },
      { id: "units",   label: "Units",              value: displayUnits,     formatted: displayUnits.toLocaleString(), change: 0, positive: true,  format: "number",   description: "Total units sold across all selected stores" },
      { id: "asp",     label: "ASP",                value: wsAsp,            formatted: fmtCurrency(wsAsp),            change: wsRevenue != null ? 0 : (apiData.aspChange ?? 0), positive: true, format: "currency", description: isWholesale ? "Wholesale Revenue ÷ Units" : "Average Selling Price — Total Revenue ÷ Total Units" },
      { id: "sessions", label: "Sessions / Views", value: apiData.sessions ?? 0, formatted: (apiData.sessions ?? 0).toLocaleString(),         change: apiData.sessionsChange ?? 0, positive: true, format: "number",  description: "Total GA4 sessions in period" },
      { id: "cvr",      label: "Conversion Rate",  value: apiData.cvr     ?? 0, formatted: `${((apiData.cvr ?? 0) * 100).toFixed(2)}%`,        change: apiData.cvrChange     ?? 0, positive: true, format: "percent", description: "Web orders ÷ GA4 sessions" },
    ];

    // ── Trend Series ─────────────────────────────────────────────────────────
    // In wholesale mode, map wholesale revenue onto the full date range from apiData
    // so the chart always has a point for every day (days with no NetSuite transactions = 0).
    const trendSeries: TrendPoint[] = wsActive
      ? (() => {
          const wsRevByDate = new Map((wholesaleData!.dailySeries ?? []).map(d => [d.date, d.revenue]));
          return apiData.dailySeries.map(d => ({
            date:    d.date,
            label:   fmtAxisDate(d.date),
            revenue: wsRevByDate.get(d.date) ?? 0,
            spend:   0,
            mer:     0,
            roas:    0,
          }));
        })()
      : apiData.dailySeries.map(d => ({
          date:    d.date,
          label:   fmtAxisDate(d.date),
          revenue: d.revenue,
          spend:   d.spend,
          mer:     d.adSpend > 0 ? d.revenue / d.adSpend : 0,
          roas:    d.spend > 0 && d.adRevenue > 0 ? d.adRevenue / d.spend : 0,
        }));

    // ── Store Breakdown ───────────────────────────────────────────────────────
    const rawStoreBreakdown = wsActive
      ? wsStores.map(s => ({
          storeId: NS_STORE_ID[s.storeName] ?? s.storeName.toLowerCase().replace(/\s+/g, "-"),
          revenue: s.revenue,
        }))
      : apiData.storeBreakdown;
    const totalRevenue = rawStoreBreakdown.reduce((s, x) => s + x.revenue, 0);
    const storeBreakdown: StoreBreakdown[] = rawStoreBreakdown
      .map(s => {
        const store = storeById(s.storeId);
        return {
          storeId:          s.storeId,
          label:            store?.label ?? s.storeId,
          revenue:          s.revenue,
          formattedRevenue: fmtCurrency(s.revenue),
          contribution:     totalRevenue > 0 ? Math.round((s.revenue / totalRevenue) * 1000) / 10 : 0,
          change:           0,
          color:            store?.color ?? "#9CA3AF",
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    // ── Channel Breakdown ─────────────────────────────────────────────────────
    const totalSpend = apiData.channelBreakdown.reduce((s, c) => s + c.spend, 0);
    const channelBreakdown: ChannelBreakdown[] = apiData.channelBreakdown
      .map(c => ({
        channelId:        c.channelId,
        label:            c.channelLabel,
        spend:            c.spend,
        attributedRevenue: c.revenue,
        roas:             c.spend > 0 ? c.revenue / c.spend : 0,
        contribution:     totalSpend > 0 ? Math.round((c.spend / totalSpend) * 1000) / 10 : 0,
        change:           0,
        formattedSpend:   fmtCurrency(c.spend),
        formattedRevenue: fmtCurrency(c.revenue),
        color:            c.color,
      }))
      .sort((a, b) => b.spend - a.spend);

    // ── Contribution Slices ───────────────────────────────────────────────────
    const contributionByStore: ContributionSlice[] = storeBreakdown.slice(0, 10).map(s => ({
      name: s.label, value: s.contribution, color: s.color,
    }));

    const contributionByChannel: ContributionSlice[] = channelBreakdown.slice(0, 6).map(c => ({
      name: c.label, value: c.contribution, color: c.color,
    }));

    const activityFeed: ActivityEvent[] = [];

    return { kpis, trendSeries, storeBreakdown, channelBreakdown, contributionByStore, contributionByChannel, activityFeed };
  }, [apiData, isWholesale, wholesaleData, selectedIds]);

  const isEmpty = !isLoading && (!apiData || apiData.isEmpty || !data);

  return (
    <DashboardLayout
      title="Overview"
      description="Unified view of revenue, spend, and performance drivers across all stores and channels."
    >
      <div className="space-y-5">
        {error && (
          <div className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/40 text-xs text-amber-700 dark:text-amber-400">
            Unable to load data — {(error as Error).message}. Check your Snowflake connection.
          </div>
        )}

        {isEmpty && !error && (
          <div className="px-4 py-8 rounded-xl border border-dashed border-[#FFBC80]/30 bg-[#FFBC80]/4 text-center">
            <p className="text-sm font-medium text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50">
              No data available — check your Snowflake connection and date range.
            </p>
          </div>
        )}

        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-[#FFBC80]/8 animate-pulse" />
            ))}
          </div>
        )}

        {data && (
          <>
            <KPIGrid kpis={data.kpis} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <PerformanceTrendChart data={data.trendSeries} />
              <EfficiencyTrendChart data={data.trendSeries} />
            </div>
            <BreakdownSection
              stores={data.storeBreakdown}
              channels={data.channelBreakdown}
              contributionByStore={data.contributionByStore}
              contributionByChannel={data.contributionByChannel}
            />
            <ActivityFeed events={data.activityFeed} />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
