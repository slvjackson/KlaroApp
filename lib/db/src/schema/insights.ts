import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const insertInsightSchema = createInsertSchema(insightsTable).omit({ id: true, createdAt: true, archivedAt: true });
export type InsertInsight = z.infer<typeof insertInsightSchema>;
export type Insight = typeof insightsTable.$inferSelect;
