import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useDateRange } from "@/context/DateRangeContext";
import { useStoreFilter } from "@/context/StoreFilterContext";
import TrafficKPISection from "@/components/traffic/TrafficKPISection";
import ProductPerformanceTable from "@/components/traffic/ProductPerformanceTable";
import USMap from "@/components/traffic/USMap";
import { API_BASE } from "@/lib/apiBase";
import type { TrafficKPI, ProductRow, StateRevenue, StoreLocation } from "@/lib/trafficData";

// ─── State Name Lookup ────────────────────────────────────────────────────────

const STATE_NAMES: Record<string, string> = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",
  DE:"Delaware",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",
  KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",
  MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",
  NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",
  OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",
  TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",
  WI:"Wisconsin",WY:"Wyoming",DC:"Washington D.C.",
};

// ─── API Response Types ────────────────────────────────────────────────────────

interface TrafficApiResponse {
  revenue: number;
  orders: number;
  aov: number;
  sessions: number;
  cvr: number;
  products: Array<{ id: string; productName: string; revenue: number; orders: number; units: number }>;
  stateRevenue: Array<{ stateCode: string; revenue: number; orders: number }>;
  isEmpty: boolean;
}

interface TargetProductsApiResponse {
  products: Array<{ itemDescription: string; revenue: number; unitsSold: number; storeCount: number }>;
  isEmpty: boolean;
}

interface TargetGeographicApiResponse {
  locations: Array<{ stateCode: string; revenue: number; unitsSold: number; storeCount: number }>;
  isEmpty: boolean;
}

interface TargetLocationsApiResponse {
  locations: Array<{ locationId: string; locationName: string; city: string; stateCode: string; zipCode: string; revenue: number; unitsSold: number }>;
  isEmpty: boolean;
}

function fmtCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v).toLocaleString()}`;
}

export default function Traffic() {
  const { dateRange } = useDateRange();
  const { selectedIds } = useStoreFilter();
  const isTargetOnly = selectedIds.length === 1 && selectedIds[0] === "target";
  const includesTarget = selectedIds.length === 0 || selectedIds.includes("target");
  console.log("[Traffic] selectedIds:", JSON.stringify(selectedIds), "| isTargetOnly:", isTargetOnly);

  const { data: apiData, isLoading, error } = useQuery<TrafficApiResponse>({
    queryKey: ["traffic-data", dateRange.startDate, dateRange.endDate, selectedIds.join(",")],
    queryFn: async () => {
      const storeParam = selectedIds.length ? `&storeIds=${selectedIds.join(",")}` : "";
      const res = await fetch(
        `${API_BASE}/api/data/traffic?start=${dateRange.startDate}&end=${dateRange.endDate}${storeParam}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<TrafficApiResponse>;
    },
    staleTime: 1000 * 60 * 15,
    retry: false,
  });

  const { data: targetProductData, isLoading: isTargetLoading } = useQuery<TargetProductsApiResponse>({
    queryKey: ["target-products", dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      console.log("[Traffic] target/products queryFn fired");
      const res = await fetch(
        `${API_BASE}/api/data/target/products?start=${dateRange.startDate}&end=${dateRange.endDate}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<TargetProductsApiResponse>;
    },
    staleTime: 1000 * 60 * 15,
    retry: false,
    enabled: includesTarget,
  });

  const { data: targetGeoData, isLoading: isTargetGeoLoading } = useQuery<TargetGeographicApiResponse>({
    queryKey: ["target-geographic", dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/api/data/target/geographic?start=${dateRange.startDate}&end=${dateRange.endDate}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<TargetGeographicApiResponse>;
    },
    staleTime: 1000 * 60 * 15,
    retry: false,
    enabled: includesTarget,
  });

  const [selectedMapState, setSelectedMapState] = useState<string | null>(null);

  const { data: targetLocationsData } = useQuery<TargetLocationsApiResponse>({
    queryKey: ["target-locations", selectedMapState, dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/api/data/target/locations?state=${selectedMapState}&start=${dateRange.startDate}&end=${dateRange.endDate}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<TargetLocationsApiResponse>;
    },
    staleTime: 1000 * 60 * 60,
    retry: false,
    enabled: includesTarget && !!selectedMapState,
  });

  const effectiveIsLoading = isLoading || (includesTarget && (isTargetLoading || isTargetGeoLoading));

  const data = useMemo(() => {
    if (!apiData || apiData.isEmpty) return null;
    console.log("[Traffic memo] isTargetOnly:", isTargetOnly, "| targetProductData:", targetProductData ? `${targetProductData.products.length} products` : "undefined");

    // ── KPIs ──────────────────────────────────────────────────────────────────
    const kpis: TrafficKPI[] = [
      { id: "revenue",  label: "Revenue",  value: apiData.revenue  ?? 0, formatted: fmtCurrency(apiData.revenue  ?? 0), change: 0, positive: true, description: "Total Shopify revenue in period" },
      { id: "orders",   label: "Orders",   value: apiData.orders   ?? 0, formatted: (apiData.orders   ?? 0).toLocaleString(), change: 0, positive: true, description: "Total orders placed" },
      { id: "aov",      label: "AOV",      value: apiData.aov      ?? 0, formatted: fmtCurrency(apiData.aov      ?? 0), change: 0, positive: true, description: "Average Order Value" },
      { id: "sessions", label: "Sessions", value: apiData.sessions ?? 0, formatted: (apiData.sessions ?? 0).toLocaleString(), change: 0, positive: true, description: "Total GA4 sessions in period" },
      { id: "cvr",      label: "CVR",      value: apiData.cvr      ?? 0, formatted: `${((apiData.cvr ?? 0) * 100).toFixed(2)}%`, change: 0, positive: true, description: "Orders ÷ Sessions" },
    ];

    // ── Products ──────────────────────────────────────────────────────────────
    const shopifyRows = (selectedIds.length === 0 || selectedIds.includes("shopify"))
      ? apiData.products.map(p => ({
          id:              p.id,
          productName:     p.productName,
          storeId:         "shopify",
          storeName:       "Shopify",
          storeColor:      "#96BF48",
          sales:           p.revenue,
          formattedSales:  fmtCurrency(p.revenue),
          salesPrior:      0,
          units:           p.units,
          unitsPrior:      0,
          avgSellPrice:    p.units > 0 ? p.revenue / p.units : 0,
          changeInSales:   0,
          conversionRate:  0,
          pctSalesOnline:  100,
          pageViews:       0,
          isTop10:         false,
        }))
      : [];

    const targetRows = includesTarget
      ? (targetProductData?.products ?? []).map(p => ({
          id:             p.itemDescription,
          productName:    p.itemDescription,
          storeId:        "target",
          storeName:      "Target",
          storeColor:     "#CC0000",
          sales:          p.revenue,
          formattedSales: fmtCurrency(p.revenue),
          salesPrior:     0,
          units:          p.unitsSold,
          unitsPrior:     0,
          avgSellPrice:   p.unitsSold > 0 ? p.revenue / p.unitsSold : 0,
          changeInSales:  0,
          conversionRate: 0,
          pctSalesOnline: 0,
          pageViews:      0,
          storeCount:     p.storeCount,
          isTop10:        false,
        }))
      : [];

    const products: ProductRow[] = [...shopifyRows, ...targetRows]
      .sort((a, b) => b.sales - a.sales)
      .map((p, i) => ({ ...p, isTop10: i < 10 }));
    console.log("[Traffic memo] products resolved:", products.length, "rows | first storeId:", products[0]?.storeId ?? "empty");

    // ── State Revenue ─────────────────────────────────────────────────────────
    const geoMap: Record<string, { revenue: number; orders: number }> = {};
    if (!isTargetOnly) {
      for (const s of apiData.stateRevenue) {
        if (!geoMap[s.stateCode]) geoMap[s.stateCode] = { revenue: 0, orders: 0 };
        geoMap[s.stateCode].revenue += s.revenue;
        geoMap[s.stateCode].orders  += s.orders;
      }
    }
    if (includesTarget && targetGeoData?.locations) {
      for (const loc of targetGeoData.locations) {
        if (!geoMap[loc.stateCode]) geoMap[loc.stateCode] = { revenue: 0, orders: 0 };
        geoMap[loc.stateCode].revenue += loc.revenue;
        geoMap[loc.stateCode].orders  += loc.unitsSold;
      }
    }
    const totalStateRevenue = Object.values(geoMap).reduce((s, x) => s + x.revenue, 0);
    const stateEntries = Object.entries(geoMap).map(([code, d]) => {
      const contrib = totalStateRevenue > 0 ? (d.revenue / totalStateRevenue) * 100 : 0;
      return {
        code,
        name:         STATE_NAMES[code] ?? code,
        revenue:      d.revenue,
        units:        d.orders,
        contribution: Math.round(contrib * 10) / 10,
        band:         5 as 0|1|2|3|4|5,
      };
    });
    const n = stateEntries.length;
    [...stateEntries]
      .sort((a, b) => b.revenue - a.revenue)
      .forEach((entry, i) => {
        const pct = i / n;
        entry.band = (pct < 1/6 ? 0 : pct < 2/6 ? 1 : pct < 3/6 ? 2 : pct < 4/6 ? 3 : pct < 5/6 ? 4 : 5) as 0|1|2|3|4|5;
      });
    const stateRevenue: StateRevenue[] = stateEntries;

    const storeLocations: StoreLocation[] = (includesTarget && !!selectedMapState)
      ? (targetLocationsData?.locations ?? [])
          .filter(loc => loc.stateCode === selectedMapState)
          .map(loc => ({
            id:             loc.locationId,
            storeId:        "target",
            storeName:      "Target",
            storeColor:     "#CC0000",
            sales:          loc.revenue,
            formattedSales: fmtCurrency(loc.revenue),
            units:          loc.unitsSold,
            address:        loc.locationName,
            city:           loc.city,
            stateCode:      loc.stateCode,
            zipCode:        loc.zipCode,
            lat:            0,
            lon:            0,
          }))
      : [];

    return { kpis, products, stateRevenue, storeLocations };
  }, [apiData, selectedIds, targetProductData, targetGeoData, targetLocationsData, selectedMapState]);

  const isEmpty = !effectiveIsLoading && (!apiData || apiData.isEmpty || !data);

  return (
    <DashboardLayout
      title="Traffic"
      description="Performance by store, product, and geography."
    >
      <div className="space-y-6">
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

        {effectiveIsLoading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-[#FFBC80]/8 animate-pulse" />
              ))}
            </div>
            <div className="h-64 rounded-xl bg-[#FFBC80]/8 animate-pulse" />
          </div>
        )}

        {data && (
          <>
            <TrafficKPISection kpis={data.kpis} />
            {!effectiveIsLoading && (
              <ProductPerformanceTable
                products={data.products}
                selectedStoreIds={selectedIds}
              />
            )}
            <USMap
              stateRevenue={data.stateRevenue}
              storeLocations={data.storeLocations}
              onStateChange={setSelectedMapState}
            />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
