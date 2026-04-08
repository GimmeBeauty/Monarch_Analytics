import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per calendar year being forecast
export const forecastYearsTable = pgTable("forecast_years", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertForecastYearSchema = createInsertSchema(forecastYearsTable).omit({ id: true, createdAt: true });
export type InsertForecastYear = z.infer<typeof insertForecastYearSchema>;
export type ForecastYear = typeof forecastYearsTable.$inferSelect;
