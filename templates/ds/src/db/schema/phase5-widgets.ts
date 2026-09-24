import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/** Phase 5 constraint fixture: maxLength on code, check constraint on qty. */
export const phase5Widgets = pgTable(
  "phase5_widgets",
  {
    /** Surrogate primary key. */
    id: uuid("id").primaryKey().defaultRandom(),
    /** Short product code (max 12 characters). */
    code: varchar("code", { length: 12 }).notNull(),
    /** Stock quantity; must be greater than zero. */
    qty: integer("qty").notNull(),
    /** Internal note. */
    note: text("note").notNull(),
    /** Row creation time (UTC). */
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Last update time (UTC). */
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    /** Actor ID from request context; never client-supplied. */
    createdBy: text("created_by").notNull(),
    /** Actor ID from request context on last update. */
    updatedBy: text("updated_by").notNull(),
  },
  (table) => [check("phase5_widgets_qty_positive", sql`${table.qty} > 0`)],
);
