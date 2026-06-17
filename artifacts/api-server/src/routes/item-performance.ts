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

// Velocity benchmark factors (Target = 1.0 baseline $/store/week)
const VELOCITY_FACTORS: Record<number, number> = {
  229:  1.00,  // Target — baseline
  231:  0.70,  // Walmart
  230:  0.70,  // Ulta Beauty
  228:  0.50,  // Kroger (grocery)
  633:  0.50,  // Publix (grocery)
  222:  0.20,  // CVS (drug)
  1068: 0.20,  // Walgreens (drug)
  227:  0.50,  // Meijer (grocery)
};

// Circana retailer display name → entity ID
const CIRCANA_ENTITY_IDS: Record<string, number> = {
  "Meijer Corp-RMA - Food":    227,
  "Publix Corp-RMA - Food":    633,
  "CVS Corp Total-RMA - Drug": 222,
  "Walgreens Corp-RMA - Drug": 1068,
};

// Circana time period strings by period key
const CIRCANA_TIME_PERIODS: Record<string, string> = {
  "4w":  "Latest 4 Week Pd Ending 04-19-26",
  "13w": "Latest 13 Week Pd Ending 04-19-26",
  "26w": "Latest 26 Week Pd Ending 04-19-26",
  "52w": "Latest 52 Week Pd Ending 04-19-26",
  "ytd": "Building Calendar Year 2026 Ending 05-10-26",
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

function periodToTargetDateFilter(period: Period): string {
  if (period === "ytd") return `summary_date >= DATE_TRUNC('year', CURRENT_DATE())`;
  const weeks = periodToWeeks(period);
  return `summary_date >= DATEADD('week', -${weeks}, CURRENT_DATE())`;
}

function periodToWalmartDateFilter(period: Period): string {
  if (period === "ytd") return `week_date >= DATE_TRUNC('year', CURRENT_DATE())`;
  const weeks = periodToWeeks(period);
  return `week_date >= DATEADD('week', -${weeks}, CURRENT_DATE())`;
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
    const startParam = req.query.start as string | undefined;
    const endParam   = req.query.end   as string | undefined;

    const rawRetailers = req.query.retailers as string | undefined;
    const retailerIds: number[] = rawRetailers
      ? rawRetailers.split(",").map(Number).filter(Boolean)
      : [];

    // Compute number of weeks and date filters
    let numWeeks          = periodToWeeks(period);
    let dateFilter        = periodToDateFilter(period);
    let targetDateFilter  = periodToTargetDateFilter(period);
    let walmartDateFilter = periodToWalmartDateFilter(period);
    let circanaTimePeriod = CIRCANA_TIME_PERIODS[period] ?? CIRCANA_TIME_PERIODS["4w"];

    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (startParam && endParam && dateRe.test(startParam) && dateRe.test(endParam)) {
      const s = new Date(startParam), e = new Date(endParam);
      const days    = Math.round((e.getTime() - s.getTime()) / 86_400_000);
      numWeeks          = Math.max(1, Math.round(days / 7));
      dateFilter        = `TRANDATE BETWEEN '${startParam}' AND '${endParam}'`;
      targetDateFilter  = `summary_date BETWEEN '${startParam}' AND '${endParam}'`;
      walmartDateFilter = `week_date BETWEEN '${startParam}' AND '${endParam}'`;
      if (days <= 35)       circanaTimePeriod = CIRCANA_TIME_PERIODS["4w"];
      else if (days <= 100) circanaTimePeriod = CIRCANA_TIME_PERIODS["13w"];
      else if (days <= 190) circanaTimePeriod = CIRCANA_TIME_PERIODS["26w"];
      else                  circanaTimePeriod = CIRCANA_TIME_PERIODS["52w"];
    } else if (period === "ytd") {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      numWeeks = Math.max(1, Math.ceil((now.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000)));
    }

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
        WHERE ${dateFilter}
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

    // ── Sell-through: Target (TARGET_PRODUCT_DAILY, keyed by UPC/barcode) ────────
    const targetPosSql = `
      SELECT
        barcode,
        tcin,
        item_description,
        SUM(revenue)    AS revenue,
        SUM(units_sold) AS units_sold
      FROM ${DB_NAME}.RETAIL.TARGET_PRODUCT_DAILY
      WHERE ${targetDateFilter}
      GROUP BY barcode, tcin, item_description
      ORDER BY revenue DESC
      FETCH FIRST 2000 ROWS ONLY
    `;

    // ── Sell-through: Walmart (WALMART_STORE_PRODUCT_WEEKLY, keyed by UPC) ───────
    const walmartPosSql = `
      SELECT
        walmart_upc,
        walmart_item_number,
        product_description,
        SUM(revenue)    AS revenue,
        SUM(units_sold) AS units_sold
      FROM ${DB_NAME}.RETAIL.WALMART_STORE_PRODUCT_WEEKLY
      WHERE ${walmartDateFilter}
      GROUP BY walmart_upc, walmart_item_number, product_description
      ORDER BY revenue DESC
      FETCH FIRST 2000 ROWS ONLY
    `;

    // ── Sell-through: Circana (CVS, Walgreens, Publix, Meijer) ───────────────────
    const circanaPosSql = `
      SELECT
        upc,
        product,
        retailer,
        SUM(dollar_sales)   AS revenue,
        SUM(unit_sales)     AS units,
        MAX(stores_selling) AS store_count
      FROM ${DB_NAME}.RETAIL.CIRCANA_POS_RAW
      WHERE time_period = '${circanaTimePeriod}'
        AND retailer IN (
          'Meijer Corp-RMA - Food',
          'Publix Corp-RMA - Food',
          'CVS Corp Total-RMA - Drug',
          'Walgreens Corp-RMA - Drug'
        )
      GROUP BY upc, product, retailer
      ORDER BY revenue DESC
      FETCH FIRST 5000 ROWS ONLY
    `;

    const includePOS = dataSource !== "sellin";

    let skuRetailerRows: Record<string, unknown>[] = [];
    let weeklyRows: Record<string, unknown>[] = [];
    let targetPosRows: Record<string, unknown>[] = [];
    let walmartPosRows: Record<string, unknown>[] = [];
    let circanaRows: Record<string, unknown>[] = [];

    try {
      [skuRetailerRows, weeklyRows, targetPosRows, walmartPosRows, circanaRows] = await Promise.all([
        querySnowflake(skuRetailerSql),
        querySnowflake(weeklyTrendSql),
        includePOS ? querySnowflake(targetPosSql)  : Promise.resolve([]),
        includePOS ? querySnowflake(walmartPosSql) : Promise.resolve([]),
        includePOS ? querySnowflake(circanaPosSql) : Promise.resolve([]),
      ]);
    } catch (sfErr) {
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

    // ── Build POS lookup maps keyed by UPC ───────────────────────────────────

    const targetPosByUpc = new Map<string, { title: string; tcin: string; revenue: number; units: number }>();
    for (const row of targetPosRows) {
      const upc = String(row["BARCODE"] ?? row["barcode"] ?? "").trim();
      if (!upc) continue;
      const prev = targetPosByUpc.get(upc);
      targetPosByUpc.set(upc, {
        title:   String(row["ITEM_DESCRIPTION"]  ?? row["item_description"]  ?? prev?.title  ?? ""),
        tcin:    String(row["TCIN"]              ?? row["tcin"]              ?? prev?.tcin   ?? ""),
        revenue: (prev?.revenue ?? 0) + safeNum(row["REVENUE"]   ?? row["revenue"]),
        units:   (prev?.units   ?? 0) + safeNum(row["UNITS_SOLD"] ?? row["units_sold"]),
      });
    }

    const walmartPosByUpc = new Map<string, { title: string; itemNumber: string; revenue: number; units: number }>();
    for (const row of walmartPosRows) {
      const upc = String(row["WALMART_UPC"] ?? row["walmart_upc"] ?? "").trim();
      if (!upc) continue;
      const prev = walmartPosByUpc.get(upc);
      walmartPosByUpc.set(upc, {
        title:      String(row["PRODUCT_DESCRIPTION"] ?? row["product_description"] ?? prev?.title      ?? ""),
        itemNumber: String(row["WALMART_ITEM_NUMBER"] ?? row["walmart_item_number"] ?? prev?.itemNumber ?? ""),
        revenue:    (prev?.revenue ?? 0) + safeNum(row["REVENUE"]    ?? row["revenue"]),
        units:      (prev?.units   ?? 0) + safeNum(row["UNITS_SOLD"] ?? row["units_sold"]),
      });
    }

    const circanaByUpc = new Map<string, Map<number, { title: string; revenue: number; units: number; storeCount: number }>>();
    for (const row of circanaRows) {
      const upc        = String(row["UPC"]      ?? row["upc"]      ?? "").trim();
      const retailName = String(row["RETAILER"] ?? row["retailer"] ?? "");
      const entityId   = CIRCANA_ENTITY_IDS[retailName];
      if (!upc || !entityId) continue;
      if (!circanaByUpc.has(upc)) circanaByUpc.set(upc, new Map());
      const entityMap = circanaByUpc.get(upc)!;
      const prev = entityMap.get(entityId);
      entityMap.set(entityId, {
        title:      String(row["PRODUCT"] ?? row["product"] ?? prev?.title ?? ""),
        revenue:    (prev?.revenue    ?? 0) + safeNum(row["REVENUE"] ?? row["revenue"]),
        units:      (prev?.units      ?? 0) + safeNum(row["UNITS"]   ?? row["units"]),
        storeCount: Math.max(prev?.storeCount ?? 0, safeNum(row["STORE_COUNT"] ?? row["store_count"])),
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

    // Velocity-factor-adjusted denominator: store count × retailer velocity factor
    function computeVelocityAdjustedDenom(retailerRevenueMap: Map<number, number>): number {
      let denom = 0;
      for (const [entityId] of retailerRevenueMap) {
        const stores = STORE_COUNTS_BY_ENTITY[entityId];
        const vf     = VELOCITY_FACTORS[entityId] ?? 1.0;
        if (!stores) continue;
        denom += stores * vf;
      }
      return denom;
    }

    const skuResults = Array.from(skuMap.values()).map(agg => {
      const adjDenom    = computeVelocityAdjustedDenom(agg.retailerRevenue);
      const avgDpsw     = adjDenom > 0 ? agg.totalRevenue / adjDenom / numWeeks : 0;
      const targetDpsw  = agg.targetRevenue > 0 ? agg.targetRevenue / STORE_COUNTS_BY_ENTITY[229] / numWeeks : 0;
      const weeklyTrend = weeklyBySku.get(agg.sku) ?? [];

      // Product title: Target POS > Walmart POS > NetSuite
      const targetPos  = agg.upc ? targetPosByUpc.get(agg.upc)  : undefined;
      const walmartPos = agg.upc ? walmartPosByUpc.get(agg.upc) : undefined;
      const resolvedTitle = targetPos?.title || walmartPos?.title || agg.productName;

      // Build byRetailer: seed from sell-in, then merge POS
      const byRetailerMap = new Map<number, {
        entityId: number; name: string; revenue: number; units: number;
        dpsw: number | null; dataSource: string; itemNumber: string;
      }>();

      for (const [entityId, rev] of agg.retailerRevenue.entries()) {
        const stores = STORE_COUNTS_BY_ENTITY[entityId];
        byRetailerMap.set(entityId, {
          entityId,
          name:       ENTITY_MAP[entityId] ?? String(entityId),
          revenue:    rev,
          units:      agg.retailerUnits.get(entityId) ?? 0,
          dpsw:       stores ? rev / stores / numWeeks : null,
          dataSource: "sellin",
          itemNumber: "",
        });
      }

      if (includePOS && agg.upc) {
        if (targetPos) {
          const ex = byRetailerMap.get(229);
          byRetailerMap.set(229, {
            entityId:   229,
            name:       "Target",
            revenue:    ex ? ex.revenue : targetPos.revenue,
            units:      ex ? ex.units   : targetPos.units,
            dpsw:       targetPos.revenue / STORE_COUNTS_BY_ENTITY[229] / numWeeks,
            dataSource: ex ? "sellin+pos" : "pos",
            itemNumber: targetPos.tcin,
          });
        }

        if (walmartPos) {
          const ex = byRetailerMap.get(231);
          byRetailerMap.set(231, {
            entityId:   231,
            name:       "Walmart",
            revenue:    ex ? ex.revenue : walmartPos.revenue,
            units:      ex ? ex.units   : walmartPos.units,
            dpsw:       walmartPos.revenue / STORE_COUNTS_BY_ENTITY[231] / numWeeks,
            dataSource: ex ? "sellin+pos" : "pos",
            itemNumber: walmartPos.itemNumber,
          });
        }

        const circanaForUpc = circanaByUpc.get(agg.upc);
        if (circanaForUpc) {
          for (const [entityId, posData] of circanaForUpc.entries()) {
            const ex     = byRetailerMap.get(entityId);
            const stores = STORE_COUNTS_BY_ENTITY[entityId] ?? posData.storeCount;
            byRetailerMap.set(entityId, {
              entityId,
              name:       ENTITY_MAP[entityId] ?? String(entityId),
              revenue:    ex ? ex.revenue : posData.revenue,
              units:      ex ? ex.units   : posData.units,
              dpsw:       stores > 0 ? posData.revenue / stores / numWeeks : null,
              dataSource: ex ? "sellin+pos" : "pos",
              itemNumber: "",
            });
          }
        }
      }

      const byRetailerArr = Array.from(byRetailerMap.values());
      const hasPOS    = byRetailerArr.some(r => r.dataSource.includes("pos"));
      const hasSellIn = byRetailerArr.some(r => r.dataSource.includes("sellin"));
      const dataSources: string[] = [];
      if (hasSellIn) dataSources.push("sellin");
      if (hasPOS)    dataSources.push("pos");
      if (!dataSources.length) dataSources.push("sellin");

      return {
        sku:          agg.sku,
        productName:  resolvedTitle,
        upc:          agg.upc,
        totalRevenue: agg.totalRevenue,
        totalUnits:   agg.totalUnits,
        avgDpsw,
        targetDpsw,
        vsTargetBenchmark: 0,
        vsRetailAvg:       0,
        retailerCount: agg.retailerCount.size,
        dataSources,
        weeklyTrend,
        byRetailer: byRetailerArr,
      };
    });

    // ── Pass 2: retail avg DPSW and velocity-adjusted benchmark deltas ────────
    const totalRevAll    = skuResults.reduce((s, r) => s + r.totalRevenue, 0);
    const totalStoresAll = Array.from(retailerMap.values()).reduce((s, r) => {
      return s + (STORE_COUNTS_BY_ENTITY[r.entityId] ?? 0);
    }, 0);
    const retailAvgDpsw = totalStoresAll > 0 ? totalRevAll / totalStoresAll / numWeeks : 0;

    for (const sku of skuResults) {
      sku.vsRetailAvg       = sku.avgDpsw - retailAvgDpsw;
      sku.vsTargetBenchmark = sku.targetDpsw - VELOCITY_FACTORS[229]; // vs $1.00/store/week benchmark
    }

    // Apply skuFilter
    let filtered = skuResults;
    if (skuFilter === "above_avg")    filtered = skuResults.filter(s => s.avgDpsw > retailAvgDpsw);
    if (skuFilter === "below_avg")    filtered = skuResults.filter(s => s.avgDpsw < retailAvgDpsw);
    if (skuFilter === "above_target") filtered = skuResults.filter(s => s.targetDpsw > VELOCITY_FACTORS[229]);
    if (skuFilter === "below_target") filtered = skuResults.filter(s => s.targetDpsw < VELOCITY_FACTORS[229]);

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
