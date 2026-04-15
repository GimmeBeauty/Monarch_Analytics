import { useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useDateRange } from "@/context/DateRangeContext";
import { useStoreFilter } from "@/context/StoreFilterContext";
import { usePricingMode } from "@/context/PricingModeContext";
import { generateTrafficData } from "@/lib/trafficData";
import TrafficKPISection from "@/components/traffic/TrafficKPISection";
import ProductPerformanceTable from "@/components/traffic/ProductPerformanceTable";
import USMap from "@/components/traffic/USMap";

export default function Traffic() {
  const { dateRange } = useDateRange();
  const { selectedIds } = useStoreFilter();
  const { mode: pricingMode } = usePricingMode();

  const data = useMemo(
    () =>
      generateTrafficData({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        selectedStoreIds: selectedIds,
        compareStart: dateRange.compareEnabled ? dateRange.compareStart : undefined,
        compareEnd: dateRange.compareEnabled ? dateRange.compareEnd : undefined,
        pricingMode,
      }),
    [
      dateRange.startDate,
      dateRange.endDate,
      dateRange.compareEnabled,
      dateRange.compareStart,
      dateRange.compareEnd,
      selectedIds,
      pricingMode,
    ]
  );

  return (
    <DashboardLayout
      title="Traffic"
      description="Performance by store, product, and geography."
    >
      <div className="space-y-6">
        {/* ── KPIs ── */}
        <TrafficKPISection kpis={data.kpis} />

        {/* ── Products ── */}
        <ProductPerformanceTable
          products={data.products}
          selectedStoreIds={selectedIds}
        />

        {/* ── Geo Map ── */}
        <USMap
          stateRevenue={data.stateRevenue}
          storeLocations={data.storeLocations}
        />
      </div>
    </DashboardLayout>
  );
}
