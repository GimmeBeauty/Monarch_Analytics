import { useMemo } from "react";
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

export default function Overview() {
  const { dateRange } = useDateRange();
  const { selectedIds } = useStoreFilter();
  const { mode: pricingMode } = usePricingMode();

  const data = useMemo(
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
      // join to get a stable primitive — avoids re-runs when array ref changes but contents don't
      selectedIds.join(","),
      dateRange.compareEnabled,
      dateRange.compareStart,
      dateRange.compareEnd,
      pricingMode,
    ]
  );

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
