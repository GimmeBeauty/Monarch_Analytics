/**
 * Pure retailer velocity aggregation logic, extracted for testability.
 *
 * The core of the Retailer Velocity Overview is building a per-retailer revenue
 * total that can come from three sources:
 *   1. NetSuite sell-in (shipments to retailer)
 *   2. Target / Walmart POS data (sell-through, keyed by UPC)
 *   3. Circana POS data (sell-through for CVS, Walgreens, Publix, Meijer)
 *
 * The `dataSource` param controls which data is used:
 *   - "sellin"  → only NetSuite sell-in rows
 *   - anything else ("pos", "bestAvailable", etc.) → prefer POS; fall back to
 *     sell-in only if no POS revenue exists for that retailer
 *
 * Circana-only retailers (CVS, Walgreens, Publix, Meijer) have no sell-in rows
 * and only appear in the output when POS mode is active.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SellInEntry {
  sku: string;
  entityId: number;
  revenue: number;
  units: number;
}

export interface PosRecord {
  revenue: number;
  units: number;
  storeCount?: number;
}

/**
 * circanaByUpc: UPC → (entityId → POS record)
 * Matches the shape built in item-performance.ts.
 */
export type CircanaByUpc = Map<string, Map<number, PosRecord>>;

export interface RetailerAggInput {
  /** Sell-in rows from NetSuite */
  entries: SellInEntry[];
  /** Target POS totals keyed by UPC */
  targetPosByUpc: Map<string, PosRecord>;
  /** Walmart POS totals keyed by UPC */
  walmartPosByUpc: Map<string, PosRecord>;
  /** Circana POS data: UPC → entityId → PosRecord */
  circanaByUpc: CircanaByUpc;
  /** Whether to include POS data ("sellin" = no, anything else = yes) */
  dataSource: string;
  /** Number of weeks in the selected period (used for DPSW) */
  numWeeks: number;
}

export interface RetailerResult {
  entityId: number;
  name: string;
  totalRevenue: number;
  totalUnits: number;
  skuCount: number;
  avgDpsw: number | null;
  dataSource: string;
}

// ─── Static maps ─────────────────────────────────────────────────────────────

export const ENTITY_MAP: Record<number, string> = {
  229:   "Target",
  231:   "Walmart",
  230:   "Ulta Beauty",
  228:   "Kroger",
  222:   "CVS",
  633:   "Publix",
  1068:  "Walgreens",
  227:   "Meijer",
  49270: "Amazon (Pattern)",
  850:   "Shopify",
};

export const STORE_COUNTS_BY_ENTITY: Record<number, number> = {
  229:  2000,
  231:  4700,
  230:  1350,
  228:  2800,
  222:  9000,
  633:  1400,
  1068: 8700,
  227:  500,
};

/** Circana display name → entity ID */
export const CIRCANA_ENTITY_IDS: Record<string, number> = {
  "Meijer Corp-RMA - Food":    227,
  "Publix Corp-RMA - Food":    633,
  "CVS Corp Total-RMA - Drug": 222,
  "Walgreens Corp-RMA - Drug": 1068,
};

// ─── Core aggregation ─────────────────────────────────────────────────────────

/**
 * Builds the `retailers` array for the Retailer Velocity Overview.
 *
 * Behaviour rules:
 * - In sell-in mode (`dataSource === "sellin"`): each retailer's revenue comes
 *   entirely from the sell-in `entries`.
 * - In sell-through / best-available mode (`dataSource !== "sellin"`):
 *   - If POS revenue > 0 for that retailer, use POS revenue and units.
 *   - If no POS data exists, keep sell-in revenue (best-available fallback).
 *   - Circana-only retailers (no sell-in rows) are added to the output.
 */
export function buildRetailerVelocity(input: RetailerAggInput): RetailerResult[] {
  const { entries, targetPosByUpc, walmartPosByUpc, circanaByUpc, dataSource, numWeeks } = input;
  const includePOS = dataSource !== "sellin";

  interface RawAgg {
    entityId: number;
    name: string;
    totalRevenue: number;
    totalUnits: number;
    skuSet: Set<string>;
  }

  const retailerMap = new Map<number, RawAgg>();

  // 1. Seed from sell-in entries
  for (const e of entries) {
    if (!retailerMap.has(e.entityId)) {
      retailerMap.set(e.entityId, {
        entityId: e.entityId,
        name: ENTITY_MAP[e.entityId] ?? String(e.entityId),
        totalRevenue: 0,
        totalUnits: 0,
        skuSet: new Set(),
      });
    }
    const ragg = retailerMap.get(e.entityId)!;
    ragg.totalRevenue += e.revenue;
    ragg.totalUnits   += e.units;
    ragg.skuSet.add(e.sku);
  }

  // 2. In sell-through mode, seed Circana-only retailers that have no sell-in rows
  if (includePOS) {
    for (const entityMap of circanaByUpc.values()) {
      for (const [entityId] of entityMap.entries()) {
        if (!retailerMap.has(entityId)) {
          retailerMap.set(entityId, {
            entityId,
            name: ENTITY_MAP[entityId] ?? String(entityId),
            totalRevenue: 0,
            totalUnits: 0,
            skuSet: new Set(),
          });
        }
      }
    }
  }

  // 3. Compute final revenue/units per retailer (POS override if applicable)
  return Array.from(retailerMap.values()).map(r => {
    const stores = STORE_COUNTS_BY_ENTITY[r.entityId];
    let revenue = r.totalRevenue;
    let units   = r.totalUnits;
    let src     = "sellin";

    if (includePOS) {
      let posRevenue = 0;
      let posUnits   = 0;

      if (r.entityId === 229) {
        for (const v of targetPosByUpc.values()) {
          posRevenue += v.revenue;
          posUnits   += v.units;
        }
      } else if (r.entityId === 231) {
        for (const v of walmartPosByUpc.values()) {
          posRevenue += v.revenue;
          posUnits   += v.units;
        }
      } else {
        // Circana retailer
        for (const entityMap of circanaByUpc.values()) {
          const entry = entityMap.get(r.entityId);
          if (entry) {
            posRevenue += entry.revenue;
            posUnits   += entry.units;
          }
        }
      }

      if (posRevenue > 0 || dataSource === "pos") {
        revenue = posRevenue;
        units   = posUnits;
        src     = "pos";
      }
    }

    return {
      entityId:     r.entityId,
      name:         r.name,
      totalRevenue: revenue,
      totalUnits:   units,
      skuCount:     r.skuSet.size,
      avgDpsw:      stores && numWeeks > 0 ? revenue / stores / numWeeks : null,
      dataSource:   src,
    };
  }).sort((a, b) => b.totalRevenue - a.totalRevenue);
}
