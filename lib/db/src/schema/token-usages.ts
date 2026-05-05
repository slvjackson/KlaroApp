import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export type TokenSource = "chat" | "insight" | "parse" | "steps" | "daily_question";

export const tokenUsagesTable = pgTable("token_usages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  source: text("source").$type<TokenSource>().notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TokenUsage = typeof tokenUsagesTable.$inferSelect;
