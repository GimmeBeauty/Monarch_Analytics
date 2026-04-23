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
import { API_BASE } from "@/lib/apiBase";
import type { KPIMetric, TrendPoint, StoreBreakdown, ChannelBreakdown, ContributionSlice, ActivityEvent } from "@/lib/overviewData";
import { storeById } from "@/lib/storeData";

// ─── API Response Type ─────────────────────────────────────────────────────────

interface OverviewApiResponse {
  revenue: number;
  orders: number;
  aov: number;
  spend: number;
  adRevenue: number;
  mer: number;
  roas: number;
  storeBreakdown: Array<{ storeId: string; revenue: number }>;
  channelBreakdown: Array<{ channelId: string; channelLabel: string; color: string; channelFamily: string; storeIds: string[]; spend: number; revenue: number }>;
  dailySeries: Array<{ date: string; revenue: number; spend: number; adRevenue: number }>;
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

  const { data: apiData, isLoading, error } = useQuery<OverviewApiResponse>({
    queryKey: ["overview-data", dateRange.startDate, dateRange.endDate, selectedIds.join(",")],
    queryFn: async () => {
      const storeParam = selectedIds.length ? `&storeIds=${selectedIds.join(",")}` : "";
      const res = await fetch(
        `${API_BASE}/api/data/overview?start=${dateRange.startDate}&end=${dateRange.endDate}${storeParam}`,
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

  const data = useMemo(() => {
    if (!apiData || apiData.isEmpty) return null;

    // ── KPIs ─────────────────────────────────────────────────────────────────
    const kpis: KPIMetric[] = [
      { id: "revenue", label: "Total Revenue",     value: apiData.revenue,  formatted: fmtCurrency(apiData.revenue),  change: 0, positive: true,  format: "currency", description: "Aggregate revenue across all selected stores" },
      { id: "spend",   label: "Ad Spend",          value: apiData.spend,    formatted: fmtCurrency(apiData.spend),    change: 0, positive: false, format: "currency", description: "Total spend across all mapped ad channels" },
      { id: "mer",     label: "MER",               value: apiData.mer,      formatted: fmtRatio(apiData.mer),         change: 0, positive: true,  format: "ratio",    description: "Marketing Efficiency Ratio — Total Revenue ÷ Total Ad Spend" },
      { id: "roas",    label: "Blended ROAS",       value: apiData.roas,     formatted: fmtRatio(apiData.roas),        change: 0, positive: true,  format: "ratio",    description: "Return on Ad Spend — Attributed Revenue ÷ Total Spend" },
      { id: "orders",  label: "Orders",             value: apiData.orders ?? 0,   formatted: (apiData.orders ?? 0).toLocaleString(), change: 0, positive: true, format: "number",  description: "Total orders from all selected stores" },
      { id: "aov",     label: "AOV",               value: apiData.aov,      formatted: fmtCurrency(apiData.aov),      change: 0, positive: true,  format: "currency", description: "Average Order Value — Total Revenue ÷ Total Orders" },
      { id: "sessions", label: "Sessions / Views", value: 0,                formatted: "—",                           change: 0, positive: true,  format: "number",   description: "Sessions data not yet available from Snowflake" },
      { id: "cvr",     label: "Conversion Rate",   value: 0,                formatted: "—",                           change: 0, positive: true,  format: "percent",  description: "Conversion rate data not yet available" },
    ];

    // ── Trend Series ─────────────────────────────────────────────────────────
    const trendSeries: TrendPoint[] = apiData.dailySeries.map(d => ({
      date:    d.date,
      label:   fmtAxisDate(d.date),
      revenue: d.revenue,
      spend:   d.spend,
      mer:     d.spend > 0 ? d.revenue / d.spend : 0,
      roas:    d.spend > 0 && d.adRevenue > 0 ? d.adRevenue / d.spend : 0,
    }));

    // ── Store Breakdown ───────────────────────────────────────────────────────
    const totalRevenue = apiData.storeBreakdown.reduce((s, x) => s + x.revenue, 0);
    const storeBreakdown: StoreBreakdown[] = apiData.storeBreakdown
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
    const contributionByStore: ContributionSlice[] = storeBreakdown.slice(0, 6).map(s => ({
      name: s.label, value: s.contribution, color: s.color,
    }));

    const contributionByChannel: ContributionSlice[] = channelBreakdown.slice(0, 6).map(c => ({
      name: c.label, value: c.contribution, color: c.color,
    }));

    const activityFeed: ActivityEvent[] = [];

    return { kpis, trendSeries, storeBreakdown, channelBreakdown, contributionByStore, contributionByChannel, activityFeed };
  }, [apiData]);

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
