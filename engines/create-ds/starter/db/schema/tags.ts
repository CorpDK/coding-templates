import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/** Starter tag entity — replace or extend as your domain grows. */
export const tags = pgTable(
  "tags",
  {
    /** Surrogate primary key. */
    id: uuid("id").primaryKey().defaultRandom(),
    /** Unique tag label (case-sensitive); 2–30 characters. */
    label: varchar("label", { length: 30 }).notNull(),
    /** Soft-delete timestamp (UTC); NULL = active row. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    /** Actor ID who soft-deleted this row. */
    deletedBy: text("deleted_by"),
    /** Row creation time (UTC). */
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Actor ID from request context; never client-supplied. */
    createdBy: text("created_by").notNull(),
  },
  (table) => [
    index("tags_label_idx").on(table.label),
    check("tags_label_min_length", sql`char_length(${table.label}) >= 2`),
  ],
);
