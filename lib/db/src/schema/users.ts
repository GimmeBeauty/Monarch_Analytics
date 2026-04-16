import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id:           uuid("id").primaryKey().defaultRandom(),
  email:        text("email").notNull().unique(),
  passwordHash: text("password_hash"),  // null until password is set
  name:         text("name"),
  title:        text("title"),          // job title / role description
  avatarUrl:    text("avatar_url"),     // base64 data URL or hosted URL
  role:         text("role").notNull().default("user"),    // 'owner' | 'admin' | 'user'
  status:       text("status").notNull().default("invited"), // 'invited' | 'active' | 'disabled'
  lastLoginAt:  timestamp("last_login_at"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
  updatedAt:    timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true, createdAt: true, updatedAt: true, passwordHash: true, lastLoginAt: true,
});

export const selectUserSchema = createSelectSchema(usersTable).omit({ passwordHash: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
export type PublicUser = Omit<User, "passwordHash">;

export type UserRole   = "owner" | "admin" | "user";
export type UserStatus = "invited" | "active" | "disabled";
