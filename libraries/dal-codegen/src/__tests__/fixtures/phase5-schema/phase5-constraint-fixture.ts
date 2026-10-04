import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/** Isolated fixture mirroring commerce tag label + order line quantity constraints. */
export const phase5ConstraintFixtures = pgTable(
  "phase5_constraint_fixtures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Tag-like label (2–30 characters). */
    label: varchar("label", { length: 30 }).notNull(),
    /** Line quantity; must be greater than zero. */
    quantity: integer("quantity").notNull(),
    /** Internal note. */
    note: text("note").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by").notNull().default("system"),
    updatedBy: text("updated_by").notNull().default("system"),
  },
  (table) => [
    check("phase5_constraint_fixtures_label_min_length", sql`char_length(${table.label}) >= 2`),
    check("phase5_constraint_fixtures_quantity_positive", sql`${table.quantity} > 0`),
  ],
);
