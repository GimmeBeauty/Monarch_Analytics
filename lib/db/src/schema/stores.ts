import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Stores table — one row per retail/wholesale channel
export const storesTable = pgTable("stores", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  // "shopify" | "amazon" | "target" | "walmart" | "ulta" | "kroger" | custom
  type: text("type").notNull().default("retail"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStoreSchema = createInsertSchema(storesTable).omit({ id: true, createdAt: true });
export type InsertStore = z.infer<typeof insertStoreSchema>;
export type Store = typeof storesTable.$inferSelect;
