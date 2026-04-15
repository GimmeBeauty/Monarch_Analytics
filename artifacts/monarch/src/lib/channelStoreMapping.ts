/**
 * Channel-to-Store Mapping Configuration
 *
 * Maps advertising / analytics channels to the stores they drive revenue for.
 * This is the single source of truth for connecting spend → revenue attribution.
 *
 * CONFIGURABLE: Edit CHANNEL_STORE_MAPPINGS to add, remove, or update entries.
 * Never hard-code these relationships in component logic.
 */

/**
 * Channel family — controls reporting segmentation only.
 * All families feed into the same MMM model; this field affects
 * aggregation scope (Core View vs Total View), not the calculations.
 *
 * core         — Paid media bought off-platform (Meta, Google, TikTok, etc.)
 * rmn          — Retail Media Networks: closed-loop, retailer-owned inventory
 * experimental — Emerging or hard-to-measure channels (affiliates, influencers)
 */
export type ChannelFamily = "core" | "rmn" | "experimental";

export interface ChannelMapping {
  /** Integration ID — matches INTEGRATION_REGISTRY keys */
  channelId: string;
  /** Display label used in charts / tables */
  channelLabel: string;
  /** Store IDs this channel is mapped to */
  storeIds: string[];
  /** Baseline daily spend (USD) — drives deterministic mock data */
  dailySpendBaseline: number;
  /** Baseline ROAS for this channel — used for attributed revenue estimates */
  baseRoas: number;
  /** Brand color for chart series */
  color: string;
  /**
   * Reporting family — segmentation layer only.
   * Does NOT affect model calculations; only controls aggregation scope.
   */
  channelFamily: ChannelFamily;
}

export const CHANNEL_STORE_MAPPINGS: ChannelMapping[] = [
  // ── Core Media ──────────────────────────────────────────────────────────────
  // Off-platform paid media bought through open / walled-garden exchanges.
  {
    channelId: "meta-ads",
    channelLabel: "Meta Ads",
    storeIds: ["shopify"],
    dailySpendBaseline: 8500,
    baseRoas: 3.5,
    color: "#1877F2",
    channelFamily: "core",
  },
  {
    channelId: "google-ads",
    channelLabel: "Google Ads",
    storeIds: ["shopify"],
    dailySpendBaseline: 6200,
    baseRoas: 4.8,
    color: "#4285F4",
    channelFamily: "core",
  },
  {
    channelId: "tiktok-ads",
    channelLabel: "TikTok Ads",
    storeIds: ["shopify"],
    dailySpendBaseline: 3100,
    baseRoas: 2.9,
    color: "#69C9D0",
    channelFamily: "core",
  },
  {
    channelId: "pinterest-ads",
    channelLabel: "Pinterest Ads",
    storeIds: ["shopify"],
    dailySpendBaseline: 1800,
    baseRoas: 3.8,
    color: "#E60023",
    channelFamily: "core",
  },
  {
    channelId: "applovin-axon",
    channelLabel: "AppLovin Axon",
    storeIds: ["shopify"],
    dailySpendBaseline: 2200,
    baseRoas: 2.4,
    color: "#3B5BDB",
    channelFamily: "core",
  },
  {
    channelId: "ctv-programmatic",
    channelLabel: "CTV / Programmatic",
    storeIds: ["shopify", "amazon", "walmart", "target"],
    dailySpendBaseline: 4500,
    baseRoas: 2.8,
    color: "#0EA5E9",
    channelFamily: "core",
  },

  // ── Retail Media Networks (RMN) ──────────────────────────────────────────────
  // Closed-loop retailer-owned ad platforms with direct sales attribution.
  // Use the SAME model as Core Media — segmented for reporting only.
  {
    channelId: "amazon-ads",
    channelLabel: "Amazon Ads",
    storeIds: ["amazon"],
    dailySpendBaseline: 12000,
    baseRoas: 7.2,
    color: "#FF9900",
    channelFamily: "rmn",
  },
  {
    channelId: "pattern-predict",
    channelLabel: "Pattern Predict",
    storeIds: ["amazon"],
    dailySpendBaseline: 3500,
    baseRoas: 5.5,
    color: "#7C3AED",
    channelFamily: "rmn",
  },
  {
    channelId: "walmart-connect",
    channelLabel: "Walmart Connect",
    storeIds: ["walmart"],
    dailySpendBaseline: 5200,
    baseRoas: 4.3,
    color: "#0071CE",
    channelFamily: "rmn",
  },
  {
    channelId: "target-roundel",
    channelLabel: "Target Roundel",
    storeIds: ["target"],
    dailySpendBaseline: 4100,
    baseRoas: 5.1,
    color: "#CC0000",
    channelFamily: "rmn",
  },
  {
    channelId: "criteo",
    channelLabel: "Criteo",
    storeIds: ["walmart", "target", "kroger", "cvs", "ulta"],
    dailySpendBaseline: 3200,
    baseRoas: 4.2,
    color: "#F57C00",
    channelFamily: "rmn",
  },
];

/** O(1) lookup map from channelId → mapping */
export const CHANNEL_MAP = new Map<string, ChannelMapping>(
  CHANNEL_STORE_MAPPINGS.map((m) => [m.channelId, m])
);

/**
 * Returns ChannelMapping entries relevant to the given store selection.
 * An empty storeIds array means "all stores" → returns all channels.
 */
export function getChannelsForStores(storeIds: string[]): ChannelMapping[] {
  if (!storeIds.length) return CHANNEL_STORE_MAPPINGS;
  const set = new Set(storeIds);
  return CHANNEL_STORE_MAPPINGS.filter((m) => m.storeIds.some((s) => set.has(s)));
}

/**
 * Returns the store IDs that a given channel maps to.
 */
export function getStoreIdsForChannel(channelId: string): string[] {
  return CHANNEL_MAP.get(channelId)?.storeIds ?? [];
}
