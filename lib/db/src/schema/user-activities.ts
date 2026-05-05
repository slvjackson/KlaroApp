import { pgTable, serial, integer, date, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userActivitiesTable = pgTable(
  "user_activities",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id),
    activityDate: date("activity_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userDateUnique: uniqueIndex("user_activities_user_date_unique").on(t.userId, t.activityDate),
  }),
);

export type UserActivity = typeof userActivitiesTable.$inferSelect;
