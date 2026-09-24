import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/** Fixture entity for Phase 5 codegen tests. */
export const phase5Widgets = pgTable(
  "phase5_widgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Short product code. */
    code: varchar("code", { length: 12 }).notNull(),
    /** Stock quantity. */
    qty: integer("qty").notNull(),
    /** Internal note. */
    note: text("note").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by").notNull().default("system"),
    updatedBy: text("updated_by").notNull().default("system"),
  },
  (table) => ({
    qtyPositive: check("qty_positive", sql`${table.qty} > 0`),
  }),
);
