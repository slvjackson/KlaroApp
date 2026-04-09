import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const BusinessProfileSchema = z.object({
  businessName: z.string().optional(),
  segment: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  employeeCount: z.number().optional(),
  openDays: z.array(z.string()).optional(),
  openHours: z.object({ start: z.string(), end: z.string() }).optional(),
  monthlyRevenueGoal: z.number().optional(),
  profitMarginGoal: z.number().optional(),
  mainProducts: z.string().optional(),
  salesChannel: z.string().optional(),
  biggestChallenge: z.string().optional(),
});

export type BusinessProfile = z.infer<typeof BusinessProfileSchema>;

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  businessProfile: jsonb("business_profile").$type<BusinessProfile>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
