import { pgTable, text, serial, timestamp, integer, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const insightsTable = pgTable("insights", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  recommendation: text("recommendation").notNull(),
  periodLabel: text("period_label").notNull(),
  tone: text("tone"),
  steps: json("steps").$type<string[]>(),
  stepsProgress: json("steps_progress").$type<boolean[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  // Why was the insight archived? Distinguishes lifecycle states without an enum table.
  // null            → active
  // "dismissed"     → user passively dismissed (lido, soft, restorable)
  // "discarded"     → user actively rejected as not useful (restorable)
  // "user_archived" → user archived a pinned mission (restorable)
  // "auto_stale"    → system auto-archived after activity threshold (restorable)
  archivedReason: text("archived_reason"),
  pinnedAt: timestamp("pinned_at", { withTimezone: true }),
});

export const insertInsightSchema = createInsertSchema(insightsTable).omit({ id: true, createdAt: true, archivedAt: true });
export type InsertInsight = z.infer<typeof insertInsightSchema>;
export type Insight = typeof insightsTable.$inferSelect;
