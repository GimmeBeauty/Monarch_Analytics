import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useDateRange } from "@/context/DateRangeContext";
import { useStoreFilter } from "@/context/StoreFilterContext";
import { usePricingMode } from "@/context/PricingModeContext";
import TrafficKPISection from "@/components/traffic/TrafficKPISection";
import ProductPerformanceTable from "@/components/traffic/ProductPerformanceTable";
import USMap from "@/components/traffic/USMap";
import { API_BASE } from "@/lib/apiBase";
import type { TrafficKPI, ProductRow, StateRevenue, StoreLocation } from "@/lib/trafficData";
import type { NetSuiteSalesResponse } from "@/lib/wholesaleData";
import { storeById } from "@/lib/storeData";

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
  units: number;
  asp: number;
  sessions: number;
  cvr: number;
  revenueChange: number;
  ordersChange: number;
  aspChange: number;
  sessionsChange: number;
  cvrChange: number;
  products: Array<{ id: string; productName: string; sku?: string; revenue: number; orders: number; units: number }>;
  stateRevenue: Array<{ stateCode: string; revenue: number; orders: number }>;
  isEmpty: boolean;
}

interface TargetProductsApiResponse {
  products: Array<{ itemDescription: string; sku?: string; revenue: number; unitsSold: number; storeCount: number }>;
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

interface WalmartProductsApiResponse {
  products: Array<{ productDescription: string; sku?: string; revenue: number; unitsSold: number; storeCount: number }>;
  isEmpty: boolean;
}

interface WalmartGeographicApiResponse {
  locations: Array<{ stateCode: string; revenue: number; unitsSold: number; storeCount: number }>;
  isEmpty: boolean;
}

interface WalmartStoresApiResponse {
  stores: Array<{ storeNumber: string; storeName: string; streetAddress: string; city: string; stateCode: string; zipCode: string; revenue: number; unitsSold: number }>;
  isEmpty: boolean;
}

interface CircanaSummaryItem {
  retailer: string;
  storeId: string;
  revenue: number;
  units: number;
  avgPrice: number;
  storeCount: number;
}

interface CircanaProductsApiResponse {
  products: Array<{
    product: string;
    upc: string;
    category: string;
    subcategory: string;
    brand: string;
    retailer: string;
    storeId: string;
    revenue: number;
    units: number;
    avgPrice: number;
    storeCount: number;
  }>;
  isEmpty: boolean;
}

function fmtCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v).toLocaleString()}`;
}

function fmtCurrencyFull(v: number): string {
  return v.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// Maps NetSuite STORE_NAME values to platform store IDs
const NS_STORE_ID: Record<string, string> = {
  "Target":            "target",
  "Walmart":           "walmart",
  "CVS":               "cvs",
  "Ulta Beauty":       "ulta",
  "Kroger":            "kroger",
  "Publix":            "publix",
  "Walgreens":         "walgreens",
  "Meijer":            "meijer",
  "Shopify":           "shopify",
  "Amazon (Pattern)":  "amazon",
};

const NS_STORE_COLOR: Record<string, string> = {
  target:    "#CC0000",
  walmart:   "#0071CE",
  cvs:       "#CC0000",
  ulta:      "#000000",
  kroger:    "#004B8D",
  publix:    "#007749",
  walgreens: "#F5A623",
  shopify:   "#96BF48",
  amazon:    "#FF9900",
};

export default function Traffic() {
  const { dateRange } = useDateRange();
  const { selectedIds } = useStoreFilter();
  const { isWholesale } = usePricingMode();
  const isTargetOnly = selectedIds.length === 1 && selectedIds[0] === "target";
  const includesTarget = selectedIds.length === 0 || selectedIds.includes("target");
  const isWalmartSelected = selectedIds.length === 0 || selectedIds.includes("walmart");
  const CIRCANA_STORE_IDS = ["meijer", "cvs", "walgreens", "publix"];
  const includesCircana = selectedIds.length === 0 || selectedIds.some(id => CIRCANA_STORE_IDS.includes(id));
  console.log("[Traffic] selectedIds:", JSON.stringify(selectedIds), "| isTargetOnly:", isTargetOnly, "| isWalmartSelected:", isWalmartSelected);

  const { data: apiData, isLoading, error } = useQuery<TrafficApiResponse>({
    queryKey: ["traffic-data", dateRange.startDate, dateRange.endDate, selectedIds.join(","), dateRange.compareStart, dateRange.compareEnd],
    queryFn: async () => {
      const storeParam = selectedIds.length ? `&storeIds=${selectedIds.join(",")}` : "";
      const res = await fetch(
        `${API_BASE}/api/data/traffic?start=${dateRange.startDate}&end=${dateRange.endDate}${storeParam}&priorStart=${dateRange.compareStart}&priorEnd=${dateRange.compareEnd}`,
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

  const { data: walmartStoresData } = useQuery<WalmartStoresApiResponse>({
    queryKey: ["walmart-stores", selectedMapState, dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/api/data/walmart/stores?state=${selectedMapState}&start=${dateRange.startDate}&end=${dateRange.endDate}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<WalmartStoresApiResponse>;
    },
    staleTime: 1000 * 60 * 60,
    retry: false,
    enabled: isWalmartSelected && !!selectedMapState,
  });

  const { data: walmartProductData, isLoading: isWalmartLoading } = useQuery<WalmartProductsApiResponse>({
    queryKey: ["walmart-products", dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/api/data/walmart/products?start=${dateRange.startDate}&end=${dateRange.endDate}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<WalmartProductsApiResponse>;
    },
    staleTime: 1000 * 60 * 15,
    retry: false,
    enabled: isWalmartSelected,
  });

  const { data: walmartGeoData, isLoading: isWalmartGeoLoading } = useQuery<WalmartGeographicApiResponse>({
    queryKey: ["walmart-geographic", dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/api/data/walmart/geographic?start=${dateRange.startDate}&end=${dateRange.endDate}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<WalmartGeographicApiResponse>;
    },
    staleTime: 1000 * 60 * 15,
    retry: false,
    enabled: isWalmartSelected,
  });

  const { data: circanaSummaryData, isLoading: isCircanaSummaryLoading } = useQuery<CircanaSummaryItem[]>({
    queryKey: ["circana-summary", dateRange.startDate, dateRange.endDate, selectedIds.join(",")],
    queryFn: async () => {
      const storeParam = selectedIds.length ? `&storeIds=${selectedIds.join(",")}` : "";
      const res = await fetch(
        `${API_BASE}/api/data/circana/summary?start=${dateRange.startDate}&end=${dateRange.endDate}${storeParam}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<CircanaSummaryItem[]>;
    },
    staleTime: 1000 * 60 * 15,
    retry: false,
    enabled: includesCircana,
  });

  const { data: circanaProductData, isLoading: isCircanaProductLoading } = useQuery<CircanaProductsApiResponse>({
    queryKey: ["circana-products", dateRange.startDate, dateRange.endDate, selectedIds.join(",")],
    queryFn: async () => {
      const storeParam = selectedIds.length ? `&storeIds=${selectedIds.join(",")}` : "";
      const res = await fetch(
        `${API_BASE}/api/data/circana/products?start=${dateRange.startDate}&end=${dateRange.endDate}${storeParam}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<CircanaProductsApiResponse>;
    },
    staleTime: 1000 * 60 * 15,
    retry: false,
    enabled: includesCircana,
  });

  const { data: wholesaleData, isLoading: isWholesaleLoading } = useQuery<NetSuiteSalesResponse>({
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

  const effectiveIsLoading = isLoading || (includesTarget && (isTargetLoading || isTargetGeoLoading)) || (isWalmartSelected && (isWalmartLoading || isWalmartGeoLoading)) || (isWholesale && isWholesaleLoading) || (includesCircana && (isCircanaSummaryLoading || isCircanaProductLoading));

  const data = useMemo(() => {
    if (!apiData || apiData.isEmpty) return null;
    console.log("[Traffic memo] isTargetOnly:", isTargetOnly, "| targetProductData:", targetProductData ? `${targetProductData.products.length} products` : "undefined");

    const wsActive = isWholesale && !!wholesaleData && !wholesaleData.isEmpty;
    console.log("[Traffic ws] isWholesale:", isWholesale, "| wholesaleData:", wholesaleData ? `isEmpty=${wholesaleData.isEmpty} byStore=${wholesaleData.byStore.length}` : "undefined");
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
    console.log("[Traffic ws] wsActive:", wsActive, "| wsStores:", wsStores.length, "| wsRevenue:", wsRevenue, "| wsUnits:", wsUnits);

    // ── KPIs ──────────────────────────────────────────────────────────────────
    const circanaRevenue = !wsActive ? (circanaSummaryData ?? []).reduce((sum, s) => sum + s.revenue, 0) : 0;
    const circanaUnits   = !wsActive ? (circanaSummaryData ?? []).reduce((sum, s) => sum + s.units,   0) : 0;
    const displayRevenue = (wsRevenue ?? apiData.revenue ?? 0) + circanaRevenue;
    const displayUnits   = (wsUnits   ?? apiData.units   ?? 0) + circanaUnits;

    const wsAsp = wsRevenue != null && displayUnits > 0
      ? wsRevenue / displayUnits
      : displayUnits > 0 ? displayRevenue / displayUnits : (apiData.asp ?? 0);

    const kpis: TrafficKPI[] = [
      { id: "revenue",  label: isWholesale ? "Wholesale Revenue" : "Revenue",  value: displayRevenue, formatted: fmtCurrency(displayRevenue), change: wsRevenue != null ? 0 : (apiData.revenueChange ?? 0), positive: true, description: isWholesale ? "Wholesale (sell-in) revenue from NetSuite" : "Total revenue in period" },
      { id: "units",    label: "Units",    value: displayUnits, formatted: Math.round(displayUnits).toLocaleString(), change: 0, positive: true, description: "Total units sold across all selected stores" },
      { id: "asp",      label: "ASP",      value: wsAsp,        formatted: fmtCurrencyFull(wsAsp),       change: wsRevenue != null ? 0 : (apiData.aspChange ?? 0), positive: true, description: isWholesale ? "Wholesale Revenue ÷ Units" : "Average Selling Price — Total Revenue ÷ Total Units" },
      { id: "sessions", label: "Sessions", value: apiData.sessions ?? 0, formatted: (apiData.sessions ?? 0).toLocaleString(), change: apiData.sessionsChange ?? 0, positive: true, description: "Total GA4 sessions in period" },
      { id: "cvr",      label: "CVR",      value: apiData.cvr      ?? 0, formatted: `${((apiData.cvr ?? 0) * 100).toFixed(2)}%`, change: apiData.cvrChange     ?? 0, positive: true, description: "Orders ÷ Sessions" },
    ];

    // ── Products ──────────────────────────────────────────────────────────────
    let products: ProductRow[];

    if (wsActive) {
      const storeIdSet = selectedIds.length > 0 ? new Set(selectedIds) : null;
      const filteredWsProducts = storeIdSet
        ? wholesaleData!.products.filter(p => {
            const sid = NS_STORE_ID[p.storeName] ?? p.storeName.toLowerCase().replace(/\s+/g, "-");
            return storeIdSet.has(sid);
          })
        : wholesaleData!.products;

      products = filteredWsProducts.map((p, i) => {
        const storeId = NS_STORE_ID[p.storeName] ?? p.storeName.toLowerCase().replace(/\s+/g, "-");
        const color   = NS_STORE_COLOR[storeId] ?? "#9CA3AF";
        return {
          id:             `${p.sku}-${p.storeName}`,
          productName:    p.productName || p.sku,
          sku:            p.sku,
          upc:            p.upc,
          storeId,
          storeName:      p.storeName,
          storeColor:     color,
          sales:          p.revenue,
          formattedSales: fmtCurrency(p.revenue),
          salesPrior:     0,
          units:          p.units,
          unitsPrior:     0,
          avgSellPrice:   p.units > 0 ? p.revenue / p.units : 0,
          changeInSales:  0,
          conversionRate: 0,
          pctSalesOnline: 0,
          pageViews:      0,
          isTop10:        i < 10,
        };
      });
    } else {
      const shopifyRows = (selectedIds.length === 0 || selectedIds.includes("shopify"))
        ? apiData.products.map((p, i) => ({
            id:              `shopify-${p.id || p.sku || i}`,
            productName:     p.productName,
            sku:             p.sku ?? "",
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
        ? (targetProductData?.products ?? []).map((p, i) => ({
            id:             `target-${p.sku || i}-${p.itemDescription}`,
            productName:    p.itemDescription,
            sku:            p.sku ?? "",
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

      const walmartRows = isWalmartSelected
        ? (walmartProductData?.products ?? []).map((p, i) => ({
            id:             `walmart-${p.sku || i}-${p.productDescription}`,
            productName:    p.productDescription,
            sku:            p.sku ?? "",
            storeId:        "walmart",
            storeName:      "Walmart",
            storeColor:     "#0071CE",
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

      const circanaRows = includesCircana
        ? (circanaProductData?.products ?? [])
            .filter(p => selectedIds.length === 0 || selectedIds.includes(p.storeId))
            .map((p, i) => {
              const store = storeById(p.storeId);
              return {
                id:             `circana-${p.storeId}-${p.upc || i}-${p.product}`,
                productName:    p.product,
                sku:            p.upc ?? "",
                storeId:        p.storeId,
                storeName:      store?.label ?? p.retailer,
                storeColor:     store?.color ?? "#9CA3AF",
                sales:          p.revenue,
                formattedSales: fmtCurrency(p.revenue),
                salesPrior:     0,
                units:          p.units,
                unitsPrior:     0,
                avgSellPrice:   p.units > 0 ? p.revenue / p.units : 0,
                changeInSales:  0,
                conversionRate: 0,
                pctSalesOnline: 0,
                pageViews:      0,
                storeCount:     p.storeCount,
                isTop10:        false,
              };
            })
        : [];

      products = [...shopifyRows, ...targetRows, ...walmartRows, ...circanaRows]
        .sort((a, b) => b.sales - a.sales)
        .map((p, i) => ({ ...p, isTop10: i < 10 }));
    }
    console.log("[Traffic memo] products resolved:", products.length, "rows | first storeId:", products[0]?.storeId ?? "empty");

    // ── State Revenue ─────────────────────────────────────────────────────────
    const geoMap: Record<string, { revenue: number; orders: number; storeCount: number }> = {};
    if (!isTargetOnly) {
      for (const s of apiData.stateRevenue) {
        if (!geoMap[s.stateCode]) geoMap[s.stateCode] = { revenue: 0, orders: 0, storeCount: 0 };
        geoMap[s.stateCode].revenue += s.revenue;
        geoMap[s.stateCode].orders  += s.orders;
      }
    }
    if (includesTarget && targetGeoData?.locations) {
      for (const loc of targetGeoData.locations) {
        if (!geoMap[loc.stateCode]) geoMap[loc.stateCode] = { revenue: 0, orders: 0, storeCount: 0 };
        geoMap[loc.stateCode].revenue    += loc.revenue;
        geoMap[loc.stateCode].orders     += loc.unitsSold;
        geoMap[loc.stateCode].storeCount += loc.storeCount ?? 0;
      }
    }
    if (isWalmartSelected && walmartGeoData?.locations) {
      for (const loc of walmartGeoData.locations) {
        if (!geoMap[loc.stateCode]) geoMap[loc.stateCode] = { revenue: 0, orders: 0, storeCount: 0 };
        geoMap[loc.stateCode].revenue    += loc.revenue;
        geoMap[loc.stateCode].orders     += loc.unitsSold;
        geoMap[loc.stateCode].storeCount += loc.storeCount ?? 0;
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
        storeCount:   d.storeCount,
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

    const targetLocs: StoreLocation[] = (includesTarget && !!selectedMapState)
      ? (targetLocationsData?.locations ?? [])
          .filter(loc => loc.stateCode === selectedMapState)
          .map(loc => ({
            id:             loc.locationId,
            storeId:        "target",
            storeName:      "Target",
            storeColor:     "#CC0000",
            sales:          loc.revenue,
            formattedSales: fmtCurrencyFull(loc.revenue),
            units:          loc.unitsSold,
            address:        loc.locationName,
            city:           loc.city,
            stateCode:      loc.stateCode,
            zipCode:        loc.zipCode,
            lat:            0,
            lon:            0,
          }))
      : [];

    console.log("[Traffic] walmartLocs debug | isWalmartSelected:", isWalmartSelected, "| selectedMapState:", selectedMapState, "| walmartStoresData stores:", walmartStoresData?.stores?.length ?? "undefined (query not resolved)");
    const walmartLocs: StoreLocation[] = (isWalmartSelected && !!selectedMapState)
      ? (walmartStoresData?.stores ?? [])
          .map(s => ({
            id:             s.storeNumber,
            storeId:        "walmart",
            storeName:      s.storeName,
            storeColor:     "#0071CE",
            sales:          s.revenue,
            formattedSales: fmtCurrencyFull(s.revenue),
            units:          s.unitsSold,
            address:        s.streetAddress,
            city:           s.city,
            stateCode:      s.stateCode,
            zipCode:        s.zipCode,
            lat:            0,
            lon:            0,
          }))
      : [];

    const storeLocations: StoreLocation[] = [...targetLocs, ...walmartLocs];
    console.log("[Traffic] storeLocations assembled:", storeLocations.length, "total |", targetLocs.length, "Target |", walmartLocs.length, "Walmart");

    return { kpis, products, stateRevenue, storeLocations };
  }, [apiData, selectedIds, targetProductData, targetGeoData, targetLocationsData, selectedMapState, walmartProductData, walmartGeoData, walmartStoresData, isWalmartSelected, isWholesale, wholesaleData, circanaSummaryData, circanaProductData, includesCircana]);

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
                isWholesale={isWholesale}
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
