import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export type IntegrationProvider =
  | "shopify"
  | "google_ads"
  | "google_analytics"
  | "meta"
  | "tiktok"
  | "netsuite";

export const integrationsTable = pgTable("integrations", {
  id:          uuid("id").primaryKey().defaultRandom(),
  provider:    text("provider").notNull().unique(),
  accessToken: text("access_token").notNull(),
  shopDomain:  text("shop_domain"),
  scopes:      text("scopes"),
  status:      text("status").notNull().default("connected"),
  metadata:    text("metadata"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
});

export type Integration = typeof integrationsTable.$inferSelect;
