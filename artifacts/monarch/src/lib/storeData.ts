// ─── Store Definitions ────────────────────────────────────────────────────────

export type StoreGroup = "dtc" | "marketplace" | "retail";

export interface StoreDefinition {
  id: string;
  label: string;
  group: StoreGroup;
  /** Fraction of total business volume. All weights sum to 1.0. */
  weight: number;
  color: string;
  /** Integration platform IDs that feed data for this store. */
  integrationIds: string[];
}

export const STORES: StoreDefinition[] = [
  {
    id: "shopify",
    label: "Shopify",
    group: "dtc",
    weight: 0.20,
    color: "#95BF47",
    integrationIds: ["shopify"],
  },
  {
    id: "amazon",
    label: "Amazon (Pattern)",
    group: "marketplace",
    weight: 0.25,
    color: "#FF9900",
    integrationIds: ["amazon_seller", "amazon_ads", "pattern_predict"],
  },
  {
    id: "walmart",
    label: "Walmart",
    group: "retail",
    weight: 0.14,
    color: "#0071CE",
    integrationIds: ["walmart_marketplace", "walmart_connect", "alloy_ai"],
  },
  {
    id: "target",
    label: "Target",
    group: "retail",
    weight: 0.12,
    color: "#CC0000",
    integrationIds: ["target_roundel", "alloy_ai"],
  },
  {
    id: "kroger",
    label: "Kroger",
    group: "retail",
    weight: 0.08,
    color: "#005DAA",
    integrationIds: [],
  },
  {
    id: "cvs",
    label: "CVS",
    group: "retail",
    weight: 0.07,
    color: "#CC0000",
    integrationIds: [],
  },
  {
    id: "publix",
    label: "Publix",
    group: "retail",
    weight: 0.06,
    color: "#007A3D",
    integrationIds: [],
  },
  {
    id: "ulta",
    label: "Ulta Beauty",
    group: "retail",
    weight: 0.05,
    color: "#B5298F",
    integrationIds: [],
  },
  {
    id: "walgreens",
    label: "Walgreens",
    group: "retail",
    weight: 0.03,
    color: "#E31837",
    integrationIds: [],
  },
];

export const STORE_GROUPS: { id: StoreGroup; label: string }[] = [
  { id: "dtc",         label: "DTC"         },
  { id: "marketplace", label: "Marketplace" },
  { id: "retail",      label: "Retail"      },
];

export function storeById(id: string): StoreDefinition | undefined {
  return STORES.find((s) => s.id === id);
}

/**
 * Returns the combined weight of the selected stores (0–1).
 * An empty selection is treated as "all stores" and returns 1.0.
 */
export function combinedWeight(selectedIds: string[]): number {
  if (selectedIds.length === 0) return 1;
  return STORES.filter((s) => selectedIds.includes(s.id))
    .reduce((sum, s) => sum + s.weight, 0);
}

// ─── Metric Value Scaling ─────────────────────────────────────────────────────

/**
 * Parse a pre-formatted metric string and scale it by `weight`.
 * Ratio/percentage strings (ending in "x" or "%") are returned unchanged.
 * Handles: "$1.2M", "$45k", "$1,234", "1.2M", "45k", "1,234", "1234"
 */
export function scaleMetricValue(value: string, weight: number): string {
  if (weight === 1) return value;
  // Don't scale ratios or percentages
  if (value.endsWith("x") || value.endsWith("%")) return value;

  const hasDollar = value.startsWith("$") || value.startsWith("-$");
  const isNeg     = value.startsWith("-");
  const clean     = value.replace(/[$,\-\s]/g, "");

  let raw: number;
  const upper = clean.toUpperCase();
  if (upper.endsWith("M"))      raw = parseFloat(clean) * 1_000_000;
  else if (upper.endsWith("K")) raw = parseFloat(clean) * 1_000;
  else                          raw = parseFloat(clean);

  if (isNaN(raw)) return value;

  const scaled = Math.abs(raw) * weight;
  const sign   = isNeg ? "-" : "";
  const prefix = hasDollar ? "$" : "";

  let formatted: string;
  if (scaled >= 1_000_000)      formatted = `${sign}${prefix}${(scaled / 1_000_000).toFixed(1)}M`;
  else if (scaled >= 100_000)   formatted = `${sign}${prefix}${Math.round(scaled / 1_000)}k`;
  else if (scaled >= 10_000)    formatted = `${sign}${prefix}${(scaled / 1_000).toFixed(1)}k`;
  else if (scaled >= 1_000)     formatted = `${sign}${prefix}${Math.round(scaled).toLocaleString()}`;
  else if (scaled >= 10)        formatted = `${sign}${prefix}${Math.round(scaled)}`;
  else                          formatted = `${sign}${prefix}${scaled.toFixed(1)}`;

  return formatted;
}
