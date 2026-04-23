import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { buildSpendData, aggregateChannels } from "@/lib/spendData";
import type { ChannelFamily } from "@/lib/channelStoreMapping";
import { useDateRange } from "@/context/DateRangeContext";
import { useStoreFilter } from "@/context/StoreFilterContext";
import { usePricingMode } from "@/context/PricingModeContext";
import { API_BASE } from "@/lib/apiBase";

interface SpendApiResponse {
  channels: Array<{ channelId: string; totalSpend: number; totalConversionValue: number; dailySpend: Array<{ date: string; spend: number }> }>;
  isEmpty: boolean;
}

export default function Spend() {
  const { dateRange } = useDateRange();
  const { selectedIds } = useStoreFilter();
  const { mode: pricingMode } = usePricingMode();

  const [filterState, setFilterState] = useState<FamilyFilterState>(defaultFilterState);

  const { data: spendApiData, isLoading } = useQuery<SpendApiResponse>({
    queryKey: ["spend-data", dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/api/data/spend?start=${dateRange.startDate}&end=${dateRange.endDate}`,
        { credentials: "include" },
      );
      if (!res.ok) return { channels: [], isEmpty: true };
      return res.json() as Promise<SpendApiResponse>;
    },
    staleTime: 1000 * 60 * 15,
    retry: false,
  });

  // Build real spend and conversion value maps from API data
  const { realSpendByChannel, conversionValueByChannel } = useMemo(() => {
    if (!spendApiData || spendApiData.isEmpty) return { realSpendByChannel: undefined, conversionValueByChannel: undefined };
    const spendMap: Record<string, number> = {};
    const cvMap: Record<string, number> = {};
    for (const ch of spendApiData.channels) {
      spendMap[ch.channelId] = ch.totalSpend;
      cvMap[ch.channelId] = ch.totalConversionValue;
    }
    const hasSpend = Object.keys(spendMap).length > 0;
    return {
      realSpendByChannel: hasSpend ? spendMap : undefined,
      conversionValueByChannel: hasSpend ? cvMap : undefined,
    };
  }, [spendApiData]);

  const data = useMemo(
    () => {
      if (!realSpendByChannel) return null;
      return buildSpendData({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        selectedStoreIds: selectedIds,
        pricingMode,
        realSpendByChannel,
        conversionValueByChannel,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateRange.startDate, dateRange.endDate, selectedIds.join(","), pricingMode, realSpendByChannel]
  );

  const channelCounts = useMemo((): Record<ChannelFamily, number> => {
    const counts: Record<ChannelFamily, number> = { core: 0, rmn: 0, experimental: 0 };
    for (const ch of (data?.channels ?? [])) counts[ch.channelFamily] += 1;
    return counts;
  }, [data]);

  const filteredChannels = useMemo(
    () => (data?.channels ?? []).filter((c) => filterState.enabledFamilies.has(c.channelFamily)),
    [data, filterState.enabledFamilies]
  );

  const filteredSummary = useMemo(
    () => aggregateChannels(filteredChannels, data?.totalBaseRevenue ?? 0),
    [filteredChannels, data]
  );

  const filteredInsights = useMemo(() => {
    if (!data) return [];
    const visibleIds = new Set(filteredChannels.map((c) => c.channelId));
    return data.insights.filter((i) => !i.channelId || visibleIds.has(i.channelId));
  }, [data, filteredChannels]);

  const isEmpty = !isLoading && (!realSpendByChannel || data === null || spendApiData?.isEmpty);

  return (
    <DashboardLayout
      title="Spend Optimizer"
      description="MMM-powered budget analysis — decomposition, incrementality, saturation curves, and scenario modeling."
    >
      <div className="space-y-5">
        {isEmpty && (
          <div className="px-4 py-8 rounded-xl border border-dashed border-[#FFBC80]/30 bg-[#FFBC80]/4 text-center">
            <p className="text-sm font-medium text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50">
              No data available — check your Snowflake connection and date range.
            </p>
          </div>
        )}

        {data && (
          <>
            <div className="px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-700/40 text-xs text-emerald-700 dark:text-emerald-400">
              Using real spend data from Snowflake — MMM model calibrated to actual channel spend.
            </div>

            <ChannelFamilyFilter
              state={filterState}
              channelCounts={channelCounts}
              onChange={setFilterState}
            />

            <SpendSummaryBar summary={filteredSummary} />
            <BudgetAllocation channels={filteredChannels} summary={filteredSummary} />
            <ChannelDeepDive channels={filteredChannels} />
            <ScenarioSimulator
              channels={filteredChannels}
              summary={filteredSummary}
              totalBaseRevenue={data.totalBaseRevenue}
            />
            <InsightsPanel insights={filteredInsights} />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
