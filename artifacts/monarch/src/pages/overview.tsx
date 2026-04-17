import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import KPIGrid from "@/components/overview/KPIGrid";
import PerformanceTrendChart from "@/components/overview/PerformanceTrendChart";
import EfficiencyTrendChart from "@/components/overview/EfficiencyTrendChart";
import BreakdownSection from "@/components/overview/BreakdownSection";
import ActivityFeed from "@/components/overview/ActivityFeed";
import { generateOverviewData } from "@/lib/overviewData";
import { useDateRange } from "@/context/DateRangeContext";
import { useStoreFilter } from "@/context/StoreFilterContext";
import { usePricingMode } from "@/context/PricingModeContext";
import { API_BASE } from "@/lib/apiBase";

interface ShopifyData {
  revenue: number;
  orders: number;
  aov: number;
  dailySeries: Array<{ date: string; revenue: number; orders: number }>;
}

export default function Overview() {
  const { dateRange } = useDateRange();
  const { selectedIds } = useStoreFilter();
  const { mode: pricingMode } = usePricingMode();

  const { data: shopifyData, error: shopifyError } = useQuery<ShopifyData | null>({
    queryKey: ["shopify-data", dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/api/data/shopify?start=${dateRange.startDate}&end=${dateRange.endDate}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string; detail?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<ShopifyData>;
    },
    staleTime: 1000 * 60 * 15,
    retry: false,
  });

  const mockData = useMemo(
    () =>
      generateOverviewData({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        selectedStoreIds: selectedIds,
        compareStart: dateRange.compareEnabled ? dateRange.compareStart : undefined,
        compareEnd: dateRange.compareEnabled ? dateRange.compareEnd : undefined,
        pricingMode,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      dateRange.startDate,
      dateRange.endDate,
      selectedIds.join(","),
      dateRange.compareEnabled,
      dateRange.compareStart,
      dateRange.compareEnd,
      pricingMode,
    ]
  );

  const data = useMemo(() => {
    if (!shopifyData || shopifyError) return mockData;

    const fmt = (v: number) =>
      v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M`
      : v >= 1_000   ? `$${(v / 1_000).toFixed(1)}K`
      : `$${Math.round(v).toLocaleString()}`;

    // Replace Shopify row revenue
    const withRealShopify = mockData.storeBreakdown.map((s) =>
      s.storeId !== "shopify"
        ? s
        : { ...s, revenue: shopifyData.revenue, formattedRevenue: fmt(shopifyData.revenue) }
    );

    // Recompute total and recalculate every store's contribution % from scratch
    const newTotal = withRealShopify.reduce((sum, s) => sum + s.revenue, 0);
    const storeBreakdown = withRealShopify
      .map((s) => ({
        ...s,
        contribution: newTotal > 0 ? Math.round((s.revenue / newTotal) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // Rebuild the pie-chart slices from the updated breakdown
    const topN = 6;
    const contributionByStore = [
      ...storeBreakdown.slice(0, topN).map((s) => ({ name: s.label, value: s.contribution, color: s.color })),
    ];
    const otherContrib = storeBreakdown.slice(topN).reduce((sum, s) => sum + s.contribution, 0);
    if (otherContrib > 0) contributionByStore.push({ name: "Other", value: otherContrib, color: "#9CA3AF" });

    // Update revenue and AOV KPIs
    const mockShopify = mockData.storeBreakdown.find((s) => s.storeId === "shopify");
    const revenueDelta = shopifyData.revenue - (mockShopify?.revenue ?? 0);

    const kpis = mockData.kpis.map((k) => {
      if (k.id === "revenue") {
        const v = k.value + revenueDelta;
        return { ...k, value: v, formatted: fmt(v) };
      }
      if (k.id === "aov" && shopifyData.orders > 0) {
        // AOV: we only have real Shopify orders — use that directly for the Shopify store
        const v = shopifyData.revenue / shopifyData.orders;
        return { ...k, value: v, formatted: fmt(v) };
      }
      return k;
    });

    return { ...mockData, kpis, storeBreakdown, contributionByStore };
  }, [mockData, shopifyData]);

  return (
    <DashboardLayout
      title="Overview"
      description="Unified view of revenue, spend, and performance drivers across all stores and channels."
    >
      <div className="space-y-5">
        {shopifyError && (
          <div className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/40 text-xs text-amber-700 dark:text-amber-400">
            Shopify data unavailable — {(shopifyError as Error).message}. Showing estimated data.
          </div>
        )}

        {/* 8 KPIs */}
        <KPIGrid kpis={data.kpis} />

        {/* Trend charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PerformanceTrendChart data={data.trendSeries} />
          <EfficiencyTrendChart data={data.trendSeries} />
        </div>

        {/* Store / Channel / Contribution breakdown */}
        <BreakdownSection
          stores={data.storeBreakdown}
          channels={data.channelBreakdown}
          contributionByStore={data.contributionByStore}
          contributionByChannel={data.contributionByChannel}
        />

        {/* Activity feed */}
        <ActivityFeed events={data.activityFeed} />
      </div>
    </DashboardLayout>
  );
}
