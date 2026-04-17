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

  const { data: shopifyData } = useQuery<ShopifyData | null>({
    queryKey: ["shopify-data", dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/api/data/shopify?start=${dateRange.startDate}&end=${dateRange.endDate}`,
        { credentials: "include" },
      );
      if (!res.ok) return null;
      return res.json() as Promise<ShopifyData>;
    },
    staleTime: 1000 * 60 * 15,
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
    if (!shopifyData) return mockData;

    // Replace Shopify store row with real revenue
    const storeBreakdown = mockData.storeBreakdown.map((s) => {
      if (s.storeId !== "shopify") return s;
      return {
        ...s,
        revenue: shopifyData.revenue,
        formattedRevenue:
          shopifyData.revenue >= 1_000_000
            ? `$${(shopifyData.revenue / 1_000_000).toFixed(2)}M`
            : shopifyData.revenue >= 1_000
              ? `$${(shopifyData.revenue / 1_000).toFixed(1)}K`
              : `$${Math.round(shopifyData.revenue).toLocaleString()}`,
      };
    });

    // Adjust total revenue KPI by the delta between real and mock Shopify revenue
    const mockShopify = mockData.storeBreakdown.find((s) => s.storeId === "shopify");
    const revenueDelta = shopifyData.revenue - (mockShopify?.revenue ?? 0);

    const kpis = mockData.kpis.map((k) => {
      if (k.id !== "revenue") return k;
      const newValue = k.value + revenueDelta;
      return {
        ...k,
        value: newValue,
        formatted:
          newValue >= 1_000_000
            ? `$${(newValue / 1_000_000).toFixed(2)}M`
            : newValue >= 1_000
              ? `$${(newValue / 1_000).toFixed(1)}K`
              : `$${Math.round(newValue).toLocaleString()}`,
      };
    });

    return { ...mockData, kpis, storeBreakdown };
  }, [mockData, shopifyData]);

  return (
    <DashboardLayout
      title="Overview"
      description="Unified view of revenue, spend, and performance drivers across all stores and channels."
    >
      <div className="space-y-5">
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
