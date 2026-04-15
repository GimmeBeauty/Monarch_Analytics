/**
 * Wholesale Pricing Data Layer
 *
 * Defines wholesale rates per store, store/product mapping for NetSuite
 * ingestion, and utility functions for the global pricing mode.
 *
 * SHOPIFY EXCEPTION: Shopify always uses actual DTC transaction revenue (rate = 1.0).
 * All other stores can be in MSRP or Wholesale mode.
 */

import { STORES, storeById } from "./storeData";

// ─── Pricing Mode ─────────────────────────────────────────────────────────────

export type PricingMode = "msrp" | "wholesale";

/** Stores that participate in wholesale pricing (NetSuite-sourced). */
export const WHOLESALE_ELIGIBLE_STORE_IDS = new Set([
  "amazon", "walmart", "target", "kroger", "cvs", "publix", "ulta", "walgreens",
]);

/**
 * Per-store wholesale rate as a fraction of MSRP revenue.
 * Shopify is always 1.0 — DTC transactions never change.
 */
export const WHOLESALE_RATES: Record<string, number> = {
  shopify:   1.00,   // DTC — always actual transaction revenue
  amazon:    0.55,   // Wholesale price shipped to Amazon FBA / Pattern
  walmart:   0.48,   // Retail placement vendor cost
  target:    0.50,   // Target vendor wholesale rate
  kroger:    0.52,   // Kroger buyer price
  cvs:       0.50,   // CVS pharmacy wholesale
  publix:    0.52,   // Publix wholesale
  ulta:      0.55,   // Ulta prestige beauty premium
  walgreens: 0.50,   // Walgreens wholesale
};

/** Returns the wholesale rate for a single store (falls back to 1.0 if unknown). */
export function getWholesaleRate(storeId: string, mode: PricingMode): number {
  if (mode === "msrp") return 1.0;
  return WHOLESALE_RATES[storeId] ?? 1.0;
}

/**
 * Returns a weight-blended wholesale multiplier across the selected stores.
 * Used for metrics that span multiple stores (e.g. blended ROAS, MER).
 */
export function getBlendedWholesaleMultiplier(
  selectedStoreIds: string[],
  mode: PricingMode
): number {
  if (mode === "msrp") return 1.0;
  const effective = selectedStoreIds.length ? selectedStoreIds : STORES.map((s) => s.id);
  let totalWeight = 0;
  let weightedRate = 0;
  for (const id of effective) {
    const store = storeById(id);
    if (!store) continue;
    const rate = WHOLESALE_RATES[id] ?? 1.0;
    totalWeight += store.weight;
    weightedRate += store.weight * rate;
  }
  return totalWeight > 0 ? weightedRate / totalWeight : 1.0;
}

// ─── Store Mapping (NetSuite → Platform) ─────────────────────────────────────

export interface StoreMapping {
  id: string;
  netSuiteEntity: string;    // Raw name as it appears in NetSuite exports
  platformStoreId: string;   // Our internal store ID
  confirmed: boolean;
}

/** Default store mappings — handles naming inconsistencies from NetSuite. */
export const DEFAULT_STORE_MAPPINGS: StoreMapping[] = [
  { id: "sm-1", netSuiteEntity: "WALMART INC",          platformStoreId: "walmart",   confirmed: true  },
  { id: "sm-2", netSuiteEntity: "WALMART STORES, INC.", platformStoreId: "walmart",   confirmed: true  },
  { id: "sm-3", netSuiteEntity: "TARGET CORP",          platformStoreId: "target",    confirmed: true  },
  { id: "sm-4", netSuiteEntity: "TARGET CORPORATION",   platformStoreId: "target",    confirmed: true  },
  { id: "sm-5", netSuiteEntity: "KROGER CO.",           platformStoreId: "kroger",    confirmed: true  },
  { id: "sm-6", netSuiteEntity: "THE KROGER CO.",       platformStoreId: "kroger",    confirmed: true  },
  { id: "sm-7", netSuiteEntity: "CVS HEALTH",           platformStoreId: "cvs",       confirmed: true  },
  { id: "sm-8", netSuiteEntity: "CVS PHARMACY",         platformStoreId: "cvs",       confirmed: true  },
  { id: "sm-9", netSuiteEntity: "PUBLIX SUPER MARKETS", platformStoreId: "publix",    confirmed: true  },
  { id: "sm-10",netSuiteEntity: "PUBLIX",               platformStoreId: "publix",    confirmed: true  },
  { id: "sm-11",netSuiteEntity: "ULTA BEAUTY",          platformStoreId: "ulta",      confirmed: true  },
  { id: "sm-12",netSuiteEntity: "ULTA SALON",           platformStoreId: "ulta",      confirmed: false },
  { id: "sm-13",netSuiteEntity: "WALGREENS BOOTS",      platformStoreId: "walgreens", confirmed: true  },
  { id: "sm-14",netSuiteEntity: "WALGREEN CO.",         platformStoreId: "walgreens", confirmed: true  },
  { id: "sm-15",netSuiteEntity: "AMAZON.COM SERVICES",  platformStoreId: "amazon",    confirmed: true  },
  { id: "sm-16",netSuiteEntity: "PATTERN INC.",         platformStoreId: "amazon",    confirmed: true  },
];

// ─── Product Mapping (NetSuite SKU → Platform SKU) ────────────────────────────

export interface ProductMapping {
  id: string;
  netSuiteSku: string;
  platformSku: string;
  productName: string;
  wholesalePrice: number;
  msrpPrice: number;
  storeIds: string[];       // which stores carry this mapping
  confirmed: boolean;
}

export const DEFAULT_PRODUCT_MAPPINGS: ProductMapping[] = [
  { id: "pm-01", netSuiteSku: "NS-SKU-001", platformSku: "p01", productName: "Daily Defense SPF 30 Moisturizer",  wholesalePrice: 13.50, msrpPrice: 28.99, storeIds: ["amazon","walmart","target","kroger","cvs","publix","ulta","walgreens"], confirmed: true  },
  { id: "pm-02", netSuiteSku: "NS-SKU-002", platformSku: "p02", productName: "Vitamin C Brightening Serum 30ml",  wholesalePrice: 22.00, msrpPrice: 46.00, storeIds: ["amazon","target","cvs","ulta"],                                           confirmed: true  },
  { id: "pm-03", netSuiteSku: "NS-SKU-003", platformSku: "p03", productName: "Hyaluronic Acid Plumping Cream",    wholesalePrice: 16.00, msrpPrice: 34.50, storeIds: ["amazon","walmart","target","kroger","publix"],                              confirmed: true  },
  { id: "pm-04", netSuiteSku: "NS-SKU-004", platformSku: "p04", productName: "Retinol Night Renewal Treatment",   wholesalePrice: 25.00, msrpPrice: 52.00, storeIds: ["amazon","ulta"],                                                            confirmed: true  },
  { id: "pm-05", netSuiteSku: "NS-SKU-005", platformSku: "p05", productName: "Peptide Eye Repair Gel",            wholesalePrice: 18.00, msrpPrice: 38.00, storeIds: ["amazon","target","cvs","ulta"],                                             confirmed: true  },
  { id: "pm-06", netSuiteSku: "NS-SKU-006", platformSku: "p06", productName: "Gentle Micellar Cleansing Balm",    wholesalePrice: 10.00, msrpPrice: 22.00, storeIds: ["amazon","walmart","target","cvs","ulta","walgreens"],                        confirmed: true  },
  { id: "pm-07", netSuiteSku: "NS-SKU-007", platformSku: "p07", productName: "Calming Rose Toning Mist 100ml",    wholesalePrice:  8.50, msrpPrice: 18.50, storeIds: ["amazon","walmart","target","ulta"],                                         confirmed: true  },
  { id: "pm-08", netSuiteSku: "NS-SKU-008", platformSku: "p08", productName: "Niacinamide 10% Pore Minimizer",    wholesalePrice: 11.00, msrpPrice: 24.00, storeIds: ["amazon","walmart","target","cvs","ulta"],                                    confirmed: false },
  { id: "pm-09", netSuiteSku: "NS-SKU-009", platformSku: "p09", productName: "Mineral Sunscreen SPF 50+",         wholesalePrice:  9.50, msrpPrice: 19.99, storeIds: ["amazon","walmart","target","kroger","cvs","publix","ulta","walgreens"],      confirmed: true  },
  { id: "pm-10", netSuiteSku: "NS-SKU-010", platformSku: "p10", productName: "Vitamin D3 + K2 Softgels 5000 IU", wholesalePrice: 11.00, msrpPrice: 22.99, storeIds: ["amazon","walmart","kroger","cvs","publix","walgreens"],                      confirmed: true  },
];

// ─── NetSuite Simulated Ingestion Records ─────────────────────────────────────

export type NetSuiteGranularity = "weekly" | "monthly";

export interface NetSuiteRecord {
  id: string;
  storeId: string;           // Resolved platform store ID
  granularity: NetSuiteGranularity;
  periodStart: string;       // YYYY-MM-DD
  periodEnd: string;         // YYYY-MM-DD
  wholesaleRevenue: number;
  units: number;
  status: "synced" | "pending" | "delayed";
}

/** Simulated latest NetSuite sync records per store. */
export const NETSUITE_SAMPLE_RECORDS: NetSuiteRecord[] = [
  { id: "ns-1",  storeId: "amazon",    granularity: "weekly",  periodStart: "2026-04-07", periodEnd: "2026-04-13", wholesaleRevenue: 312_400, units: 5_680, status: "synced"  },
  { id: "ns-2",  storeId: "walmart",   granularity: "weekly",  periodStart: "2026-04-07", periodEnd: "2026-04-13", wholesaleRevenue: 168_200, units: 3_504, status: "synced"  },
  { id: "ns-3",  storeId: "target",    granularity: "monthly", periodStart: "2026-03-01", periodEnd: "2026-03-31", wholesaleRevenue: 218_900, units: 4_378, status: "delayed" },
  { id: "ns-4",  storeId: "kroger",    granularity: "monthly", periodStart: "2026-03-01", periodEnd: "2026-03-31", wholesaleRevenue: 130_500, units: 2_510, status: "synced"  },
  { id: "ns-5",  storeId: "cvs",       granularity: "weekly",  periodStart: "2026-04-07", periodEnd: "2026-04-13", wholesaleRevenue:  95_800, units: 1_916, status: "synced"  },
  { id: "ns-6",  storeId: "publix",    granularity: "monthly", periodStart: "2026-03-01", periodEnd: "2026-03-31", wholesaleRevenue:  84_200, units: 1_619, status: "pending" },
  { id: "ns-7",  storeId: "ulta",      granularity: "weekly",  periodStart: "2026-04-07", periodEnd: "2026-04-13", wholesaleRevenue:  71_500, units: 1_300, status: "synced"  },
  { id: "ns-8",  storeId: "walgreens", granularity: "weekly",  periodStart: "2026-04-07", periodEnd: "2026-04-13", wholesaleRevenue:  44_100, units:   882, status: "synced"  },
];

/** Last full sync timestamp (simulated). */
export const NETSUITE_LAST_SYNC = "2026-04-14T18:30:00Z";
