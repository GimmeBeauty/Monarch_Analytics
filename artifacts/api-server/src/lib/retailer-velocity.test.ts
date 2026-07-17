/**
 * Unit tests for the Retailer Velocity Overview aggregation logic.
 *
 * Covers three critical behaviours:
 *   1. Switching from sell-in to sell-through mode changes the revenue figures.
 *   2. Circana-only retailers (CVS, Walgreens, Publix, Meijer) appear in the
 *      overview when sell-through mode is active (and are absent in sell-in mode).
 *   3. "Best Available" mode uses sell-through figures for retailers whose only
 *      data source is POS (no sell-in rows).
 */

import { describe, it, expect } from "vitest";
import {
  buildRetailerVelocity,
  type SellInEntry,
  type PosRecord,
  type CircanaByUpc,
} from "./retailer-velocity.js";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

/** Sell-in rows: Target (229) and Walmart (231) both have sell-in data. */
const SELL_IN_ENTRIES: SellInEntry[] = [
  { sku: "SKU-A", entityId: 229, revenue: 10_000, units: 200 }, // Target
  { sku: "SKU-B", entityId: 229, revenue:  5_000, units: 100 }, // Target
  { sku: "SKU-A", entityId: 231, revenue:  8_000, units: 160 }, // Walmart
];

const UPC_A = "012345678901";
const UPC_B = "098765432109";

/** Target POS (sell-through) data — different numbers from sell-in. */
const TARGET_POS = new Map<string, PosRecord>([
  [UPC_A, { revenue: 18_000, units: 360 }],
  [UPC_B, { revenue:  9_000, units: 180 }],
]);

/** Walmart POS (sell-through) data. */
const WALMART_POS = new Map<string, PosRecord>([
  [UPC_A, { revenue: 11_000, units: 220 }],
]);

/**
 * Circana POS — only retailers that have NO sell-in rows:
 * CVS (222), Walgreens (1068), Publix (633), Meijer (227).
 */
const CIRCANA_BY_UPC: CircanaByUpc = new Map([
  [UPC_A, new Map<number, PosRecord>([
    [222,  { revenue: 3_000, units: 150, storeCount: 400 }], // CVS
    [1068, { revenue: 2_500, units: 125, storeCount: 300 }], // Walgreens
  ])],
  [UPC_B, new Map<number, PosRecord>([
    [633, { revenue: 1_800, units:  90, storeCount: 200 }], // Publix
    [227, { revenue: 1_200, units:  60, storeCount: 150 }], // Meijer
  ])],
]);

const NUM_WEEKS = 4;

// ─── Test suite ───────────────────────────────────────────────────────────────

describe("buildRetailerVelocity — sell-in mode", () => {
  const results = buildRetailerVelocity({
    entries:        SELL_IN_ENTRIES,
    targetPosByUpc: TARGET_POS,
    walmartPosByUpc: WALMART_POS,
    circanaByUpc:   CIRCANA_BY_UPC,
    dataSource:     "sellin",
    numWeeks:       NUM_WEEKS,
  });

  it("returns only retailers present in sell-in data", () => {
    const entityIds = results.map(r => r.entityId).sort((a, b) => a - b);
    expect(entityIds).toEqual([229, 231]); // Target and Walmart only
  });

  it("does NOT include Circana-only retailers (CVS, Walgreens, Publix, Meijer)", () => {
    const ids = new Set(results.map(r => r.entityId));
    expect(ids.has(222)).toBe(false);  // CVS
    expect(ids.has(1068)).toBe(false); // Walgreens
    expect(ids.has(633)).toBe(false);  // Publix
    expect(ids.has(227)).toBe(false);  // Meijer
  });

  it("uses sell-in revenue totals (not POS figures)", () => {
    const target  = results.find(r => r.entityId === 229)!;
    const walmart = results.find(r => r.entityId === 231)!;
    // Sell-in: Target had 10_000 + 5_000 = 15_000, Walmart had 8_000
    expect(target.totalRevenue).toBe(15_000);
    expect(walmart.totalRevenue).toBe(8_000);
    expect(target.dataSource).toBe("sellin");
    expect(walmart.dataSource).toBe("sellin");
  });

  it("marks all retailers as dataSource = 'sellin'", () => {
    for (const r of results) {
      expect(r.dataSource).toBe("sellin");
    }
  });
});

describe("buildRetailerVelocity — sell-through mode (dataSource = 'pos')", () => {
  const results = buildRetailerVelocity({
    entries:        SELL_IN_ENTRIES,
    targetPosByUpc: TARGET_POS,
    walmartPosByUpc: WALMART_POS,
    circanaByUpc:   CIRCANA_BY_UPC,
    dataSource:     "pos",
    numWeeks:       NUM_WEEKS,
  });

  it("includes Circana-only retailers (CVS, Walgreens, Publix, Meijer)", () => {
    const ids = new Set(results.map(r => r.entityId));
    expect(ids.has(222)).toBe(true);  // CVS
    expect(ids.has(1068)).toBe(true); // Walgreens
    expect(ids.has(633)).toBe(true);  // Publix
    expect(ids.has(227)).toBe(true);  // Meijer
  });

  it("uses POS revenue for Target (different from sell-in)", () => {
    const target = results.find(r => r.entityId === 229)!;
    // POS total: 18_000 + 9_000 = 27_000 — different from sell-in total of 15_000
    expect(target.totalRevenue).toBe(27_000);
    expect(target.dataSource).toBe("pos");
  });

  it("uses POS revenue for Walmart (different from sell-in)", () => {
    const walmart = results.find(r => r.entityId === 231)!;
    // POS total: 11_000 — different from sell-in total of 8_000
    expect(walmart.totalRevenue).toBe(11_000);
    expect(walmart.dataSource).toBe("pos");
  });

  it("uses Circana revenue for CVS", () => {
    const cvs = results.find(r => r.entityId === 222)!;
    expect(cvs.totalRevenue).toBe(3_000);
    expect(cvs.dataSource).toBe("pos");
  });

  it("uses Circana revenue for Walgreens", () => {
    const wag = results.find(r => r.entityId === 1068)!;
    expect(wag.totalRevenue).toBe(2_500);
    expect(wag.dataSource).toBe("pos");
  });

  it("uses Circana revenue for Publix", () => {
    const pub = results.find(r => r.entityId === 633)!;
    expect(pub.totalRevenue).toBe(1_800);
    expect(pub.dataSource).toBe("pos");
  });

  it("uses Circana revenue for Meijer", () => {
    const mei = results.find(r => r.entityId === 227)!;
    expect(mei.totalRevenue).toBe(1_200);
    expect(mei.dataSource).toBe("pos");
  });

  it("overall numbers differ from sell-in mode", () => {
    const sellinResults = buildRetailerVelocity({
      entries:        SELL_IN_ENTRIES,
      targetPosByUpc: TARGET_POS,
      walmartPosByUpc: WALMART_POS,
      circanaByUpc:   CIRCANA_BY_UPC,
      dataSource:     "sellin",
      numWeeks:       NUM_WEEKS,
    });

    const posTarget     = results.find(r => r.entityId === 229)!.totalRevenue;
    const sellinTarget  = sellinResults.find(r => r.entityId === 229)!.totalRevenue;
    expect(posTarget).not.toBe(sellinTarget);

    const posRetailerCount    = results.length;
    const sellinRetailerCount = sellinResults.length;
    expect(posRetailerCount).toBeGreaterThan(sellinRetailerCount);
  });
});

describe("buildRetailerVelocity — best-available mode (dataSource = 'bestAvailable')", () => {
  /**
   * In best-available mode, `includePOS = dataSource !== "sellin"` is true.
   * For retailers where POS revenue > 0, POS figures are used.
   * For a retailer with sell-in data but no POS data, sell-in is kept (fallback).
   */

  // Kroger (228) has sell-in data but no POS data in any of our maps
  const entriesWithKroger: SellInEntry[] = [
    ...SELL_IN_ENTRIES,
    { sku: "SKU-A", entityId: 228, revenue: 4_000, units: 80 }, // Kroger — sell-in only
  ];

  const results = buildRetailerVelocity({
    entries:        entriesWithKroger,
    targetPosByUpc: TARGET_POS,
    walmartPosByUpc: WALMART_POS,
    circanaByUpc:   CIRCANA_BY_UPC,
    dataSource:     "bestAvailable",
    numWeeks:       NUM_WEEKS,
  });

  it("includes Circana-only retailers", () => {
    const ids = new Set(results.map(r => r.entityId));
    expect(ids.has(222)).toBe(true);  // CVS
    expect(ids.has(1068)).toBe(true); // Walgreens
    expect(ids.has(633)).toBe(true);  // Publix
    expect(ids.has(227)).toBe(true);  // Meijer
  });

  it("uses POS figures for Target (POS available)", () => {
    const target = results.find(r => r.entityId === 229)!;
    expect(target.totalRevenue).toBe(27_000); // Target POS: 18_000 + 9_000
    expect(target.dataSource).toBe("pos");
  });

  it("falls back to sell-in for Kroger (no POS data available)", () => {
    const kroger = results.find(r => r.entityId === 228)!;
    expect(kroger.totalRevenue).toBe(4_000); // sell-in value preserved
    expect(kroger.dataSource).toBe("sellin"); // best-available used sell-in as fallback
  });

  it("Circana retailers match sell-through figures exactly", () => {
    const posResults = buildRetailerVelocity({
      entries:        entriesWithKroger,
      targetPosByUpc: TARGET_POS,
      walmartPosByUpc: WALMART_POS,
      circanaByUpc:   CIRCANA_BY_UPC,
      dataSource:     "pos",
      numWeeks:       NUM_WEEKS,
    });

    for (const entityId of [222, 1068, 633, 227]) {
      const ba  = results.find(r => r.entityId === entityId)!;
      const pos = posResults.find(r => r.entityId === entityId)!;
      expect(ba.totalRevenue).toBe(pos.totalRevenue);
      expect(ba.totalUnits).toBe(pos.totalUnits);
    }
  });
});

describe("buildRetailerVelocity — DPSW calculation", () => {
  it("computes avgDpsw = revenue / storeCount / numWeeks", () => {
    // Target (229): 2000 stores, POS revenue = 27_000, 4 weeks → 27_000 / 2000 / 4 = 3.375
    const results = buildRetailerVelocity({
      entries:        SELL_IN_ENTRIES,
      targetPosByUpc: TARGET_POS,
      walmartPosByUpc: WALMART_POS,
      circanaByUpc:   CIRCANA_BY_UPC,
      dataSource:     "pos",
      numWeeks:       NUM_WEEKS,
    });

    const target = results.find(r => r.entityId === 229)!;
    expect(target.avgDpsw).toBeCloseTo(27_000 / 2000 / 4, 6);
  });

  it("returns null avgDpsw for a retailer with unknown store count", () => {
    const unknownEntityId = 9999;
    const entries: SellInEntry[] = [
      { sku: "SKU-X", entityId: unknownEntityId, revenue: 5_000, units: 50 },
    ];
    const results = buildRetailerVelocity({
      entries,
      targetPosByUpc: new Map(),
      walmartPosByUpc: new Map(),
      circanaByUpc:   new Map(),
      dataSource:     "sellin",
      numWeeks:       4,
    });

    const retailer = results.find(r => r.entityId === unknownEntityId)!;
    expect(retailer.avgDpsw).toBeNull();
  });
});
