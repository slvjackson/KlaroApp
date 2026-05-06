import { pgTable, text, serial, timestamp, integer, json } from "drizzle-orm/pg-core";

// ─── Block types (shared shape between LLM output and frontend) ──────────────

export type BlockTone = "insight" | "comparison" | "warning" | "celebration";

export type CardBlock =
  | { type: "callout";      tone: BlockTone; headline: string; body: string; ctaLabel?: string; ctaHref?: string; icon?: string }
  | { type: "bigNumber";    label: string; value: string; delta?: string; trend?: "up" | "down" | "flat"; sublabel?: string }
  | { type: "text";         tone: BlockTone; content: string }
  | { type: "barChart";     title: string; data: Array<{ label: string; value: number; color?: string }>; unit?: string }
  | { type: "lineChart";    title: string; data: Array<{ x: string; y: number }>; unit?: string }
  | { type: "comparison";   title: string; left: { label: string; value: string; trend?: "up" | "down" | "flat" }; right: { label: string; value: string; trend?: "up" | "down" | "flat" } }
  | { type: "list";         title: string; items: Array<{ label: string; value: string; subtitle?: string }> };

export interface CardEntry {
  id: string;
  narrativeAngle: string;   // e.g., "monthly_recovery", "category_growth", "ticket_trend"
  blocks: CardBlock[];
}

// ─── Table ────────────────────────────────────────────────────────────────────

export const dailyCardBatchesTable = pgTable("daily_card_batches", {
  id:              serial("id").primaryKey(),
  userId:          integer("user_id").notNull(),
  batchStartDate:  text("batch_start_date").notNull(),       // YYYY-MM-DD
  expiresAt:       timestamp("expires_at",  { withTimezone: true }).notNull(),
  cards:               json("cards").$type<CardEntry[]>().notNull(),
  generatedBy:         text("generated_by").notNull(),            // 'ai' | 'fallback'
  seasonalSignature:   text("seasonal_signature").notNull().default(""), // identifier of active sazonal window set at gen time
  createdAt:           timestamp("created_at",  { withTimezone: true }).notNull().defaultNow(),
});

export type DailyCardBatch = typeof dailyCardBatchesTable.$inferSelect;
