import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import { querySnowflake } from "../lib/snowflake.js";

const router = Router();
router.use(authenticate);

const DB_NAME = process.env.SNOWFLAKE_DATABASE ?? "MONARCH_RAW";

// ─── Constants ────────────────────────────────────────────────────────────────

const STORE_COUNTS: Record<number, number> = {
  229: 2000,  // Target
  231: 4700,  // Walmart
  230: 1350,  // Ulta Beauty
  228: 2800,  // Kroger
  222: 9000,  // CVS
  633: 9000,  // Walgreens — entity 633 maps to Walgreens per spec entity map
  // Note: spec lists Walgreens as 633 but entity map shows 633=Publix, 1068=Walgreens
  // Using the spec's entity→retailer mapping verbatim
};

// Entity ID → retailer name (per spec)
const ENTITY_MAP: Record<number, string> = {
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

const STORE_COUNTS_BY_ENTITY: Record<number, number> = {
  229:  2000,   // Target
  231:  4700,   // Walmart
  230:  1350,   // Ulta Beauty
  228:  2800,   // Kroger
  222:  9000,   // CVS
  633:  1400,   // Publix
  1068: 8700,   // Walgreens
  227:  500,    // Meijer
};

// Retailers to exclude from DPSW (DTC channels)
const DTC_ENTITY_IDS = [850, 49270]; // Shopify, Amazon Pattern

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Period = "4w" | "13w" | "26w" | "52w" | "ytd";

function periodToWeeks(period: Period): number {
  if (period === "4w")  return 4;
  if (period === "13w") return 13;
  if (period === "26w") return 26;
  if (period === "52w") return 52;
  return 0; // ytd — computed dynamically
}

function periodToDateFilter(period: Period): string {
  if (period === "ytd") {
    return `TRANDATE >= DATE_TRUNC('year', CURRENT_DATE())`;
  }
  const weeks = periodToWeeks(period);
  return `TRANDATE >= DATEADD('week', -${weeks}, CURRENT_DATE())`;
}

function periodLabel(period: Period): string {
  if (period === "4w")  return "Last 4 Weeks";
  if (period === "13w") return "Last 13 Weeks";
  if (period === "26w") return "Last 26 Weeks";
  if (period === "52w") return "Last 52 Weeks";
  return "Year to Date";
}

function safeNum(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

// ─── GET /api/item-performance ────────────────────────────────────────────────

router.get("/", async (req, res) => {
  try {
    const period     = (req.query.period     as Period)  || "4w";
    const dataSource = (req.query.dataSource as string)  || "all";
    const skuFilter  = (req.query.skuFilter  as string)  || "all";

    const rawRetailers = req.query.retailers as string | undefined;
    const retailerIds: number[] = rawRetailers
      ? rawRetailers.split(",").map(Number).filter(Boolean)
      : [];

    // Compute number of weeks for DPSW denominator
    let numWeeks = periodToWeeks(period);
    if (period === "ytd") {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      numWeeks = Math.max(1, Math.ceil((now.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000)));
    }

    const dateFilter = periodToDateFilter(period);

    // Build optional retailer filter
    const dtcList = DTC_ENTITY_IDS.join(", ");
    let retailerFilter = `AND d.ENTITY_ID NOT IN (${dtcList})`;
    if (retailerIds.length > 0) {
      retailerFilter += ` AND d.ENTITY_ID IN (${retailerIds.join(", ")})`;
    }

    // ── SKU + Retailer aggregation (NetSuite sell-in) ──────────────────────────
    const skuRetailerSql = `
      WITH deduped AS (
        SELECT *,
          ROW_NUMBER() OVER (
            PARTITION BY ENTITY_ID, TRANDATE, ITEM_ID, SKU
            ORDER BY LOADED_AT DESC
          ) AS rn
        FROM ${DB_NAME}.FINANCE.NETSUITE_SALES_BY_PRODUCT
        WHERE ${dateFilter}
      ),
      base AS (
        SELECT
          d.SKU,
          d.PRODUCT_NAME,
          d.UPCCODE,
          COALESCE(em.STORE_NAME, 'Meijer') AS RETAILER,
          d.ENTITY_ID,
          SUM(d.REVENUE) AS TOTAL_REVENUE,
          SUM(d.UNITS)   AS TOTAL_UNITS
        FROM deduped d
        LEFT JOIN ${DB_NAME}.FINANCE.NETSUITE_ENTITY_MAP em
          ON d.ENTITY_ID = em.ENTITY_ID
        WHERE d.rn = 1
          ${retailerFilter}
        GROUP BY d.SKU, d.PRODUCT_NAME, d.UPCCODE, em.STORE_NAME, d.ENTITY_ID
      )
      SELECT * FROM base
      ORDER BY TOTAL_REVENUE DESC
      FETCH FIRST 1000 ROWS ONLY
    `;

    // ── Weekly trend for sparklines (last 8 weeks, regardless of period) ───────
    const weeklyTrendSql = `
      WITH deduped AS (
        SELECT *,
          ROW_NUMBER() OVER (
            PARTITION BY ENTITY_ID, TRANDATE, ITEM_ID, SKU
            ORDER BY LOADED_AT DESC
          ) AS rn
        FROM ${DB_NAME}.FINANCE.NETSUITE_SALES_BY_PRODUCT
        WHERE TRANDATE >= DATEADD('week', -8, CURRENT_DATE())
      ),
      weekly AS (
        SELECT
          d.SKU,
          TO_VARCHAR(DATE_TRUNC('week', d.TRANDATE), 'YYYY-"W"WW') AS WEEK_LABEL,
          DATE_TRUNC('week', d.TRANDATE) AS WEEK_START,
          SUM(d.REVENUE) AS REVENUE
        FROM deduped d
        WHERE d.rn = 1
          AND d.ENTITY_ID NOT IN (${dtcList})
        GROUP BY d.SKU, DATE_TRUNC('week', d.TRANDATE)
      )
      SELECT * FROM weekly
      ORDER BY SKU, WEEK_START
      FETCH FIRST 5000 ROWS ONLY
    `;

    // Run both queries in parallel
    let skuRetailerRows: Record<string, unknown>[] = [];
    let weeklyRows: Record<string, unknown>[] = [];

    try {
      [skuRetailerRows, weeklyRows] = await Promise.all([
        querySnowflake(skuRetailerSql),
        querySnowflake(weeklyTrendSql),
      ]);
    } catch (sfErr) {
      // Snowflake unavailable — return empty structure with error flag
      return res.status(503).json({
        error: "Data warehouse unavailable",
        summary: null,
        skus: [],
        retailers: [],
        storeCountsUsed: STORE_COUNTS_BY_ENTITY,
        periodLabel: periodLabel(period),
        dataSourceNote: "NetSuite data reflects sell-in (shipments to retailer). Target and Circana data reflects consumer sell-through.",
      });
    }

    // ── Build weekly trend map: sku → [{week, revenue}] ──────────────────────
    const weeklyBySku = new Map<string, { week: string; revenue: number }[]>();
    for (const row of weeklyRows) {
      const sku  = String(row["SKU"] ?? "");
      const week = String(row["WEEK_LABEL"] ?? "");
      const rev  = safeNum(row["REVENUE"]);
      if (!sku) continue;
      if (!weeklyBySku.has(sku)) weeklyBySku.set(sku, []);
      weeklyBySku.get(sku)!.push({ week, revenue: rev });
    }

    // ── Aggregate by SKU across retailers ─────────────────────────────────────
    interface SkuRetailerEntry {
      sku: string;
      productName: string;
      upc: string;
      retailer: string;
      entityId: number;
      revenue: number;
      units: number;
    }

    const entries: SkuRetailerEntry[] = skuRetailerRows.map(row => ({
      sku:         String(row["SKU"]          ?? ""),
      productName: String(row["PRODUCT_NAME"] ?? ""),
      upc:         String(row["UPCCODE"]      ?? ""),
      retailer:    String(row["RETAILER"]     ?? ""),
      entityId:    Number(row["ENTITY_ID"]    ?? 0),
      revenue:     safeNum(row["TOTAL_REVENUE"]),
      units:       safeNum(row["TOTAL_UNITS"]),
    })).filter(e => e.sku);

    // Per-SKU aggregation
    interface SkuAgg {
      sku: string;
      productName: string;
      upc: string;
      totalRevenue: number;
      totalUnits: number;
      targetRevenue: number;
      retailerRevenue: Map<number, number>; // entityId → revenue
      retailerUnits: Map<number, number>;
      retailerCount: Set<number>;
    }

    const skuMap = new Map<string, SkuAgg>();

    for (const e of entries) {
      if (!skuMap.has(e.sku)) {
        skuMap.set(e.sku, {
          sku: e.sku,
          productName: e.productName,
          upc: e.upc,
          totalRevenue: 0,
          totalUnits: 0,
          targetRevenue: 0,
          retailerRevenue: new Map(),
          retailerUnits: new Map(),
          retailerCount: new Set(),
        });
      }
      const agg = skuMap.get(e.sku)!;
      agg.totalRevenue += e.revenue;
      agg.totalUnits   += e.units;
      if (e.entityId === 229) agg.targetRevenue += e.revenue;
      agg.retailerRevenue.set(e.entityId, (agg.retailerRevenue.get(e.entityId) ?? 0) + e.revenue);
      agg.retailerUnits.set(e.entityId,   (agg.retailerUnits.get(e.entityId)   ?? 0) + e.units);
      if (STORE_COUNTS_BY_ENTITY[e.entityId]) {
        agg.retailerCount.add(e.entityId);
      }
    }

    // ── Compute per-retailer aggregate totals ─────────────────────────────────
    interface RetailerAgg {
      entityId: number;
      name: string;
      totalRevenue: number;
      totalUnits: number;
      skuSet: Set<string>;
    }

    const retailerMap = new Map<number, RetailerAgg>();

    for (const e of entries) {
      if (!retailerMap.has(e.entityId)) {
        retailerMap.set(e.entityId, {
          entityId: e.entityId,
          name: ENTITY_MAP[e.entityId] ?? e.retailer,
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

    // ── Compute DPSW values ───────────────────────────────────────────────────

    // Total weighted store count across all carrying retailers (for retail avg DPSW)
    function computeWeightedStoreDenominator(retailerRevenueMap: Map<number, number>): number {
      let totalRevenue = 0;
      let weightedStores = 0;
      for (const [entityId, rev] of retailerRevenueMap) {
        const stores = STORE_COUNTS_BY_ENTITY[entityId];
        if (!stores) continue;
        totalRevenue  += rev;
        weightedStores += stores;
      }
      return weightedStores;
    }

    const skuResults = Array.from(skuMap.values()).map(agg => {
      const weightedStores = computeWeightedStoreDenominator(agg.retailerRevenue);
      const avgDpsw     = weightedStores > 0 ? agg.totalRevenue / weightedStores / numWeeks : 0;
      const targetDpsw  = agg.targetRevenue / STORE_COUNTS_BY_ENTITY[229] / numWeeks;
      const weeklyTrend = weeklyBySku.get(agg.sku) ?? [];

      return {
        sku:          agg.sku,
        productName:  agg.productName,
        upc:          agg.upc,
        totalRevenue: agg.totalRevenue,
        totalUnits:   agg.totalUnits,
        avgDpsw,
        targetDpsw,
        vsTargetBenchmark: 0, // filled in pass 2
        vsRetailAvg:       0, // filled in pass 2
        retailerCount: agg.retailerCount.size,
        dataSources:   ["sellin"] as string[],
        weeklyTrend,
        // retailer breakdown for drawer
        byRetailer: Array.from(agg.retailerRevenue.entries()).map(([entityId, rev]) => ({
          entityId,
          name:       ENTITY_MAP[entityId] ?? String(entityId),
          revenue:    rev,
          units:      agg.retailerUnits.get(entityId) ?? 0,
          dpsw:       STORE_COUNTS_BY_ENTITY[entityId]
                        ? rev / STORE_COUNTS_BY_ENTITY[entityId] / numWeeks
                        : null,
          dataSource: "sellin",
        })),
      };
    });

    // ── Pass 2: compute retail avg DPSW and benchmark deltas ─────────────────
    const totalRevAll    = skuResults.reduce((s, r) => s + r.totalRevenue, 0);
    const totalStoresAll = Array.from(retailerMap.values()).reduce((s, r) => {
      return s + (STORE_COUNTS_BY_ENTITY[r.entityId] ?? 0);
    }, 0);
    const retailAvgDpsw = totalStoresAll > 0 ? totalRevAll / totalStoresAll / numWeeks : 0;
    const targetAvgDpsw = skuResults.reduce((s, r) => s + r.targetDpsw, 0) / Math.max(1, skuResults.length);

    for (const sku of skuResults) {
      sku.vsRetailAvg       = sku.avgDpsw - retailAvgDpsw;
      sku.vsTargetBenchmark = sku.targetDpsw - targetAvgDpsw;
    }

    // Apply skuFilter
    let filtered = skuResults;
    if (skuFilter === "above_avg")    filtered = skuResults.filter(s => s.avgDpsw > retailAvgDpsw);
    if (skuFilter === "below_avg")    filtered = skuResults.filter(s => s.avgDpsw < retailAvgDpsw);
    if (skuFilter === "above_target") filtered = skuResults.filter(s => s.targetDpsw > targetAvgDpsw);
    if (skuFilter === "below_target") filtered = skuResults.filter(s => s.targetDpsw < targetAvgDpsw);

    // ── Summary KPI cards ─────────────────────────────────────────────────────
    const sorted        = [...skuResults].sort((a, b) => b.avgDpsw - a.avgDpsw);
    const topByDpsw     = sorted[0];
    const topByRevenue  = [...skuResults].sort((a, b) => b.totalRevenue - a.totalRevenue)[0];
    const aboveAvgSkus  = skuResults.filter(s => s.avgDpsw > retailAvgDpsw);

    // Biggest opportunity: SKU with largest gap where Target DPSW < retail avg DPSW
    const opportunity = [...skuResults]
      .filter(s => s.retailerCount > 1 && s.targetDpsw < s.avgDpsw)
      .sort((a, b) => (b.avgDpsw - b.targetDpsw) - (a.avgDpsw - a.targetDpsw))[0];

    const summary = {
      topSkuByDpsw: topByDpsw ? {
        sku:         topByDpsw.sku,
        productName: topByDpsw.productName,
        dpsw:        topByDpsw.avgDpsw,
      } : null,
      skusAboveAvg: {
        count: aboveAvgSkus.length,
        pct:   skuResults.length > 0 ? (aboveAvgSkus.length / skuResults.length) * 100 : 0,
      },
      highestVolumeSku: topByRevenue ? {
        sku:         topByRevenue.sku,
        productName: topByRevenue.productName,
        revenue:     topByRevenue.totalRevenue,
      } : null,
      biggestOpportunity: opportunity ? {
        sku:         opportunity.sku,
        productName: opportunity.productName,
        gap:         opportunity.avgDpsw - opportunity.targetDpsw,
      } : null,
    };

    // ── Retailer response rows ────────────────────────────────────────────────
    const retailers = Array.from(retailerMap.values()).map(r => {
      const stores = STORE_COUNTS_BY_ENTITY[r.entityId];
      return {
        entityId:     r.entityId,
        name:         r.name,
        totalRevenue: r.totalRevenue,
        totalUnits:   r.totalUnits,
        skuCount:     r.skuSet.size,
        avgDpsw:      stores ? r.totalRevenue / stores / numWeeks : null,
        dataSource:   "sellin",
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);

    return res.json({
      summary,
      skus:            filtered,
      retailers,
      storeCountsUsed: STORE_COUNTS_BY_ENTITY,
      periodLabel:     periodLabel(period),
      dataSourceNote:  "NetSuite data reflects sell-in (shipments to retailer). Target and Circana data reflects consumer sell-through.",
    });

  } catch (err) {
    console.error("[item-performance]", err);
    res.status(500).json({ error: "Failed to fetch item performance data" });
    return;
  }
});

export default router;
