import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core";

export const adminUsers = sqliteTable("admin_users", {
  username: text("username").primaryKey(),
  passwordHash: text("password_hash").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  // New sessions start "stopped" — the clock only runs while "active".
  status: text("status", { enum: ["active", "ended", "stopped"] }).default(
    "stopped"
  ),
  visibleCount: integer("visible_count").default(5),
  takeoverWindowMinutes: integer("takeover_window_minutes"),
  startedAt: integer("started_at").notNull(),
  expectedDurationMinutes: integer("expected_duration_minutes"),
  createdAt: integer("created_at").notNull(),
  backgroundImagePath: text("background_image_path"),
});

export const trends = sqliteTable("trends", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  value: integer("value").default(0),
  incrementRate: integer("increment_rate").default(0),
  isPaused: integer("is_paused", { mode: "boolean" }).default(false),
  isHidden: integer("is_hidden", { mode: "boolean" }).default(false),
  position: integer("position").notNull(),
  imagePath: text("image_path"),
  rampStages: text("ramp_stages"), // JSON array of {pct: number, rate: number}
  isTakeoverTrend: integer("is_takeover_trend", { mode: "boolean" }).default(false),
  color: text("color"),
});

export type AdminUser = typeof adminUsers.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Trend = typeof trends.$inferSelect;
