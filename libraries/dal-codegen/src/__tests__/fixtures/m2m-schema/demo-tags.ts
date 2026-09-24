import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/** Tag labels for M:N navigation fixture. */
export const demoTags = pgTable("demo_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: varchar("label", { length: 64 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: text("created_by").notNull().default("system"),
  updatedBy: text("updated_by").notNull().default("system"),
});
