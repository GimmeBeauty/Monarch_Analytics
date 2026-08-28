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
import ErrorState from "@/components/ErrorState";

interface SpendApiResponse {
  channels: Array<{ channelId: string; totalSpend: number; totalConversionValue: number; dailySpend: Array<{ date: string; spend: number }> }>;
  organicRevenue: number;
  channelStatus?: Record<string, string>;
  isEmpty: boolean;
}

const CHANNEL_STATUS_LABELS: Record<string, string> = {
  tiktok_shop: "TikTok Shop",
  "tiktok-shop": "TikTok Shop",
};

export default function Spend() {
  const { dateRange } = useDateRange();
  const { selectedIds } = useStoreFilter();
  const { mode: pricingMode } = usePricingMode();

  const [filterState, setFilterState] = useState<FamilyFilterState>(defaultFilterState);

  const { data: spendApiData, isLoading, error, refetch, isRefetching } = useQuery<SpendApiResponse>({
    queryKey: ["spend-data", dateRange.startDate, dateRange.endDate, selectedIds.join(",")],
    queryFn: async () => {
      const storeParam = selectedIds.length > 0 ? `&storeIds=${selectedIds.join(",")}` : "";
      const res = await fetch(
        `${API_BASE}/api/data/spend?start=${dateRange.startDate}&end=${dateRange.endDate}${storeParam}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
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
        organicRevenue: spendApiData?.organicRevenue ?? 0,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateRange.startDate, dateRange.endDate, selectedIds.join(","), pricingMode, realSpendByChannel, spendApiData?.organicRevenue]
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

  const channelWarnings = useMemo(() => {
    const statuses = spendApiData?.channelStatus ?? {};
    const visibleIds = new Set(filteredChannels.map((c) => c.channelId));
    return Object.entries(statuses)
      .filter(([channelId, status]) => (status === "stale" || status === "needs_reconnect") && visibleIds.has(channelId))
      .map(([channelId, status]) => ({
        channelId,
        status,
        label: CHANNEL_STATUS_LABELS[channelId] ?? filteredChannels.find((c) => c.channelId === channelId)?.channelLabel ?? channelId,
      }));
  }, [spendApiData, filteredChannels]);

  return (
    <DashboardLayout
      title="Spend Optimizer"
      description="MMM-powered budget analysis — decomposition, incrementality, saturation curves, and scenario modeling."
    >
      <div className="space-y-5">
        {error && (
          <ErrorState
            message="Unable to load data — check your data connections."
            onRetry={() => refetch()}
            isRetrying={isRefetching}
          />
        )}

        {!error && isEmpty && (
          <div className="px-4 py-8 rounded-xl border border-dashed border-[#FFBC80]/30 dark:border-[#9BDBF3]/30 bg-[#FFBC80]/4 dark:bg-[#EFBAE1]/4 text-center">
            <p className="text-sm font-medium text-[#3A3A3A]/60 dark:text-[#003349]/50">
              No data available — check your Snowflake connection and date range.
            </p>
          </div>
        )}

        {!error && data && (
          <>
            <div className="px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-100 border border-emerald-200/60 dark:border-emerald-300/40 text-xs text-emerald-700 dark:text-emerald-700">
              Spend and attributed revenue sourced from Snowflake — ROAS and MER reflect real data.
            </div>

            <div className="px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-100 border border-amber-200/70 dark:border-amber-300/40 text-xs text-amber-800 dark:text-amber-700 flex items-start gap-2">
              <span className="shrink-0 mt-0.5">⚠</span>
              <span>
                <strong>Model estimates:</strong> iROAS, incrementality, saturation, mROAS, confidence, R², MAPE, adstock, halo, and reallocation upside are calculated using industry-benchmark parameters per channel type — not fitted to Durham Brands&apos; own data. They are directional guidance. Hover any <strong className="underline decoration-dotted">(?)</strong> tooltip for details. These will automatically upgrade to real statistics once holdout experiment data is ingested.
              </span>
            </div>

            {channelWarnings.length > 0 && (
              <div className="px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-100 border border-red-200/70 dark:border-red-300/40 text-xs text-red-800 dark:text-red-700 flex items-start gap-2">
                <span className="shrink-0 mt-0.5">⚠</span>
                <span>
                  {channelWarnings.map((w, i) => (
                    <span key={w.channelId}>
                      {i > 0 && " · "}
                      <strong>{w.label}</strong> {w.status === "needs_reconnect"
                        ? "needs to be reconnected — its numbers may be missing or out of date until you reconnect it in Settings → Integrations."
                        : "hasn't synced recently — its numbers may be stale."}
                    </span>
                  ))}
                </span>
              </div>
            )}

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
