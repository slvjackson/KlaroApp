import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";

export type CostCategory = "api" | "server" | "salary" | "marketing" | "other";

export const operationalCostsTable = pgTable("operational_costs", {
  id: serial("id").primaryKey(),
  category: text("category").$type<CostCategory>().notNull(),
  name: text("name").notNull(),
  amountMonthly: numeric("amount_monthly", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OperationalCost = typeof operationalCostsTable.$inferSelect;
