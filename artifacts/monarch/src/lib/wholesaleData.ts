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

// ─── NetSuite API Types ───────────────────────────────────────────────────────

export interface NetSuiteStoreSummary {
  storeName:  string;
  storeType:  string;
  revenue:    number;
  units:      number;
  lastDate:   string;
  status:     "synced" | "pending" | "delayed";
}

export interface NetSuiteProductRow {
  sku:         string;
  productName: string;
  upc:         string;
  storeName:   string;
  revenue:     number;
  units:       number;
}

export interface NetSuiteSalesResponse {
  totals:      { revenue: number; units: number };
  byStore:     NetSuiteStoreSummary[];
  products:    NetSuiteProductRow[];
  dailySeries: Array<{ date: string; revenue: number; units: number }>;
  lastSync:    string;
  isEmpty:     boolean;
  source:      string;
}

export interface NetSuiteSalesParams {
  start:    string;
  end:      string;
  store?:   string;
  storeIds?: string[];
}

/** Fetch NetSuite sales data from the API for a given date range. */
export async function fetchNetSuiteSales(
  params: NetSuiteSalesParams,
  apiBase: string,
): Promise<NetSuiteSalesResponse> {
  const url = new URL(`${apiBase}/api/data/netsuite/sales`);
  url.searchParams.set("start", params.start);
  url.searchParams.set("end",   params.end);
  if (params.store) url.searchParams.set("store", params.store);
  const res = await fetch(url.toString(), { credentials: "include" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `NetSuite API error: HTTP ${res.status}`);
  }
  return res.json() as Promise<NetSuiteSalesResponse>;
}
