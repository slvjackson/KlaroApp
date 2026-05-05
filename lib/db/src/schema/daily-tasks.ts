import { pgTable, serial, integer, date, text, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export type DailyTaskKey =
  | "categorize_others"
  | "review_top_expenses"
  | "confirm_pending"
  | "business_question"
  | "ask_klaro"
  | "read_insight"
  | "complete_anamnese"
  | "set_revenue_goal";

export const dailyTasksTable = pgTable(
  "daily_tasks",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id),
    taskDate: date("task_date").notNull(),
    taskKey: text("task_key").$type<DailyTaskKey>().notNull(),
    params: jsonb("params"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userDateKeyUnique: uniqueIndex("daily_tasks_user_date_key_unique").on(t.userId, t.taskDate, t.taskKey),
  }),
);

export type DailyTask = typeof dailyTasksTable.$inferSelect;
