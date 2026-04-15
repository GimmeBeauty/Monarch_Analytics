import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export type TokenType = "invite" | "password_reset";

export const authTokensTable = pgTable("auth_tokens", {
  id:         uuid("id").primaryKey().defaultRandom(),
  userId:     uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  tokenHash:  text("token_hash").notNull().unique(), // SHA-256 hash of the raw token
  type:       text("type").notNull(),                 // 'invite' | 'password_reset'
  expiresAt:  timestamp("expires_at").notNull(),
  usedAt:     timestamp("used_at"),                   // null = not yet used
  createdAt:  timestamp("created_at").defaultNow().notNull(),
});

export type AuthToken = typeof authTokensTable.$inferSelect;
