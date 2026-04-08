import { pgTable, serial, integer, numeric, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { storesTable } from "./stores";
import { forecastYearsTable } from "./forecastYears";

// Monthly forecast values per store per year
// wholesale_price is nullable — Shopify is DTC so no wholesale price applies
export const storeForecastsTable = pgTable(
  "store_forecasts",
  {
    id: serial("id").primaryKey(),
    storeId: integer("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "cascade" }),
    forecastYearId: integer("forecast_year_id")
      .notNull()
      .references(() => forecastYearsTable.id, { onDelete: "cascade" }),
    // 1 = January … 12 = December
    month: integer("month").notNull(),
    // nullable: not applicable for Shopify (DTC)
    wholesalePrice: numeric("wholesale_price", { precision: 12, scale: 2 }),
    // required for all stores
    retailPrice: numeric("retail_price", { precision: 12, scale: 2 }).notNull(),
  },
  (t) => [
    // one row per store × year × month
    uniqueIndex("store_year_month_idx").on(t.storeId, t.forecastYearId, t.month),
  ],
);

export const insertStoreForecastSchema = createInsertSchema(storeForecastsTable)
  .omit({ id: true })
  .extend({
    month: z.number().int().min(1).max(12),
    retailPrice: z.string().min(1, "Retail price is required"),
    wholesalePrice: z.string().optional().nullable(),
  });

export type InsertStoreForecast = z.infer<typeof insertStoreForecastSchema>;
export type StoreForecast = typeof storeForecastsTable.$inferSelect;
