import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core";

export const adminUsers = sqliteTable("admin_users", {
  username: text("username").primaryKey(),
  passwordHash: text("password_hash").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status", { enum: ["active", "ended"] }).default("active"),
  visibleCount: integer("visible_count").default(5),
  takeoverWindowMinutes: integer("takeover_window_minutes"),
  startedAt: integer("started_at").notNull(),
  expectedDurationMinutes: integer("expected_duration_minutes"),
  createdAt: integer("created_at").notNull(),
});

export const trends = sqliteTable("trends", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  value: integer("value").default(0),
  isHidden: integer("is_hidden", { mode: "boolean" }).default(false),
  position: integer("position").notNull(),
});

export type AdminUser = typeof adminUsers.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Trend = typeof trends.$inferSelect;
