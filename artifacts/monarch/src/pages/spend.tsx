import { useMemo, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import SpendSummaryBar from "@/components/spend/SpendSummaryBar";
import BudgetAllocation from "@/components/spend/BudgetAllocation";
import InsightsPanel from "@/components/spend/InsightsPanel";
import ChannelDeepDive from "@/components/spend/ChannelDeepDive";
import ScenarioSimulator from "@/components/spend/ScenarioSimulator";
import ChannelFamilyFilter, {
  defaultFilterState,
  type FamilyFilterState,
} from "@/components/spend/ChannelFamilyFilter";
import { generateSpendData, aggregateChannels } from "@/lib/spendData";
import type { ChannelFamily } from "@/lib/channelStoreMapping";
import { useDateRange } from "@/context/DateRangeContext";
import { useStoreFilter } from "@/context/StoreFilterContext";
import { usePricingMode } from "@/context/PricingModeContext";

export default function Spend() {
  const { dateRange } = useDateRange();
  const { selectedIds } = useStoreFilter();
  const { mode: pricingMode } = usePricingMode();

  const [filterState, setFilterState] = useState<FamilyFilterState>(defaultFilterState);

  const data = useMemo(
    () =>
      generateSpendData({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        selectedStoreIds: selectedIds,
        pricingMode,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateRange.startDate, dateRange.endDate, selectedIds.join(","), pricingMode]
  );

  // Channel counts per family (for the filter chip badges)
  const channelCounts = useMemo((): Record<ChannelFamily, number> => {
    const counts: Record<ChannelFamily, number> = { core: 0, rmn: 0, experimental: 0 };
    for (const ch of data.channels) counts[ch.channelFamily] += 1;
    return counts;
  }, [data.channels]);

  // Filtered channel set — only recomputes aggregation, not model estimates
  const filteredChannels = useMemo(
    () => data.channels.filter((c) => filterState.enabledFamilies.has(c.channelFamily)),
    [data.channels, filterState.enabledFamilies]
  );

  // Summary recomputed from filtered slice (aggregation layer only)
  const filteredSummary = useMemo(
    () => aggregateChannels(filteredChannels, data.totalBaseRevenue),
    [filteredChannels, data.totalBaseRevenue]
  );

  // Insights scoped to visible channels
  const filteredInsights = useMemo(() => {
    const visibleIds = new Set(filteredChannels.map((c) => c.channelId));
    return data.insights.filter((i) => !i.channelId || visibleIds.has(i.channelId));
  }, [data.insights, filteredChannels]);

  return (
    <DashboardLayout
      title="Spend Optimizer"
      description="MMM-powered budget analysis — decomposition, incrementality, saturation curves, and scenario modeling."
    >
      <div className="space-y-5">
        {/* Channel family scope filter */}
        <ChannelFamilyFilter
          state={filterState}
          channelCounts={channelCounts}
          onChange={setFilterState}
        />

        {/* Summary KPIs — scoped to active families */}
        <SpendSummaryBar summary={filteredSummary} />

        {/* Budget allocation + decomposition */}
        <BudgetAllocation channels={filteredChannels} summary={filteredSummary} />

        {/* Deep dive table */}
        <ChannelDeepDive channels={filteredChannels} />

        {/* Scenario simulator — operates on filtered channel set */}
        <ScenarioSimulator
          channels={filteredChannels}
          summary={filteredSummary}
          totalBaseRevenue={data.totalBaseRevenue}
        />

        {/* AI insights */}
        <InsightsPanel insights={filteredInsights} />
      </div>
    </DashboardLayout>
  );
}
