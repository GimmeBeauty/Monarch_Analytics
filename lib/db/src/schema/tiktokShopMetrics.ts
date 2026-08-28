import { pgTable, serial, date, numeric, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Daily TikTok Shop ad performance metrics (spend, impressions, clicks,
 * conversions, revenue) synced from the TikTok Shop API.
 *
 * TikTok Shop has no external Snowflake pipeline like the other core ad
 * channels (Meta/Google/TikTok Ads/Pinterest, which live in ADS.*_RAW), so
 * this table is populated directly by the api-server via an on-demand sync
 * against TikTok Shop's own API using the connected OAuth token.
 */
export const tiktokShopDailyMetricsTable = pgTable("tiktok_shop_daily_metrics", {
  id:          serial("id").primaryKey(),
  date:        date("date", { mode: "string" }).notNull(),
  spend:       numeric("spend", { precision: 12, scale: 2 }).notNull().default("0"),
  impressions: integer("impressions").notNull().default(0),
  clicks:      integer("clicks").notNull().default(0),
  conversions: integer("conversions").notNull().default(0),
  revenue:     numeric("revenue", { precision: 12, scale: 2 }).notNull().default("0"),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  dateIdx: uniqueIndex("tiktok_shop_daily_metrics_date_idx").on(t.date),
}));

export type TiktokShopDailyMetric = typeof tiktokShopDailyMetricsTable.$inferSelect;
