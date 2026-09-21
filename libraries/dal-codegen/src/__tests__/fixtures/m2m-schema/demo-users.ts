import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/** Users for M:N navigation fixture. */
export const demoUsers = pgTable("demo_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 64 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: text("created_by").notNull().default("system"),
  updatedBy: text("updated_by").notNull().default("system"),
});
