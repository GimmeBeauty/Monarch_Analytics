import { Router } from "express";
import { db, storesTable, forecastYearsTable, storeForecastsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

// ─── Stores ─────────────────────────────────────────────────────────────────

// GET /api/forecast/stores — list all stores
router.get("/stores", async (_req, res) => {
  try {
    const stores = await db
      .select()
      .from(storesTable)
      .orderBy(storesTable.id);
    res.json(stores);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stores" });
  }
});

// POST /api/forecast/stores — add a new store
router.post("/stores", async (req, res) => {
  try {
    const { name, type = "retail" } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ error: "Store name is required" });
    }
    const [store] = await db
      .insert(storesTable)
      .values({ name: name.trim(), type })
      .returning();
    res.status(201).json(store);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "A store with that name already exists" });
    }
    res.status(500).json({ error: "Failed to create store" });
  }
});

// ─── Forecast Years ──────────────────────────────────────────────────────────

// GET /api/forecast/years — list all forecast years
router.get("/years", async (_req, res) => {
  try {
    const years = await db
      .select()
      .from(forecastYearsTable)
      .orderBy(forecastYearsTable.year);
    res.json(years);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch years" });
  }
});

// POST /api/forecast/years — add a new forecast year
router.post("/years", async (req, res) => {
  try {
    const { year } = req.body;
    const yearNum = parseInt(year, 10);
    if (!yearNum || yearNum < 2020 || yearNum > 2100) {
      res.status(400).json({ error: "A valid year is required (2020–2100)" });
    }
    const [created] = await db
      .insert(forecastYearsTable)
      .values({ year: yearNum })
      .returning();
    res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "That year already exists" });
    }
    res.status(500).json({ error: "Failed to create year" });
  }
});

// ─── Forecasts ───────────────────────────────────────────────────────────────

// GET /api/forecast/forecasts?store_id=X&year=YYYY
// Returns all 12 monthly rows for a given store + year
router.get("/forecasts", async (req, res) => {
  try {
    const storeId = parseInt(req.query.store_id as string, 10);
    const year = parseInt(req.query.year as string, 10);

    if (!storeId || !year) {
      res.status(400).json({ error: "store_id and year are required" });
    }

    // Look up the forecast_year row
    const [yearRow] = await db
      .select()
      .from(forecastYearsTable)
      .where(eq(forecastYearsTable.year, year));

    if (!yearRow) {
      res.json([]); // no data yet for this year
    }

    const rows = await db
      .select()
      .from(storeForecastsTable)
      .where(
        and(
          eq(storeForecastsTable.storeId, storeId),
          eq(storeForecastsTable.forecastYearId, yearRow.id),
        ),
      )
      .orderBy(storeForecastsTable.month);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch forecasts" });
  }
});

// POST /api/forecast/forecasts — create a new monthly forecast row
router.post("/forecasts", async (req, res) => {
  try {
    const { store_id, year, month, wholesale_price, retail_price } = req.body;

    if (!store_id || !year || !month) {
      res.status(400).json({ error: "store_id, year, and month are required" });
    }
    if (retail_price === undefined || retail_price === null || retail_price === "") {
      res.status(400).json({ error: "retail_price is required" });
    }

    // Upsert the forecast_years row
    const [yearRow] = await db
      .insert(forecastYearsTable)
      .values({ year: parseInt(year, 10) })
      .onConflictDoUpdate({ target: forecastYearsTable.year, set: { year: parseInt(year, 10) } })
      .returning();

    const [row] = await db
      .insert(storeForecastsTable)
      .values({
        storeId: store_id,
        forecastYearId: yearRow.id,
        month: parseInt(month, 10),
        retailPrice: String(retail_price),
        wholesalePrice: wholesale_price !== undefined && wholesale_price !== "" ? String(wholesale_price) : null,
      })
      .returning();

    res.status(201).json(row);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "Forecast for this store/year/month already exists. Use PUT to update." });
    }
    res.status(500).json({ error: "Failed to create forecast" });
  }
});

// PUT /api/forecast/forecasts/:id — update an existing monthly forecast
router.put("/forecasts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { wholesale_price, retail_price } = req.body;

    if (retail_price === undefined || retail_price === null || retail_price === "") {
      res.status(400).json({ error: "retail_price is required" });
    }

    const [updated] = await db
      .update(storeForecastsTable)
      .set({
        retailPrice: String(retail_price),
        wholesalePrice: wholesale_price !== undefined && wholesale_price !== "" ? String(wholesale_price) : null,
      })
      .where(eq(storeForecastsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Forecast row not found" });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update forecast" });
  }
});

// PATCH /api/forecast/forecasts/upsert — upsert all 12 months at once (bulk save)
router.patch("/forecasts/upsert", async (req, res) => {
  try {
    const { store_id, year, months } = req.body;
    // months: Array<{ month: number; wholesale_price?: string; retail_price: string }>

    if (!store_id || !year || !Array.isArray(months)) {
      res.status(400).json({ error: "store_id, year, and months[] are required" });
    }

    // Ensure the year row exists
    const [yearRow] = await db
      .insert(forecastYearsTable)
      .values({ year: parseInt(year, 10) })
      .onConflictDoUpdate({ target: forecastYearsTable.year, set: { year: parseInt(year, 10) } })
      .returning();

    // Upsert each month
    const results = await Promise.all(
      months.map(async (m: { month: number; wholesale_price?: string; retail_price: string }) => {
        return db
          .insert(storeForecastsTable)
          .values({
            storeId: store_id,
            forecastYearId: yearRow.id,
            month: m.month,
            retailPrice: String(m.retail_price || "0"),
            wholesalePrice: m.wholesale_price ? String(m.wholesale_price) : null,
          })
          .onConflictDoUpdate({
            target: [storeForecastsTable.storeId, storeForecastsTable.forecastYearId, storeForecastsTable.month],
            set: {
              retailPrice: String(m.retail_price || "0"),
              wholesalePrice: m.wholesale_price ? String(m.wholesale_price) : null,
            },
          })
          .returning();
      }),
    );

    res.json(results.flat());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to upsert forecasts" });
  }
});

export default router;
