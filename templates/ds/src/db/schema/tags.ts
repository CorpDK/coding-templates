import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/** Immutable tag labels; append-only audit with soft delete for recovery. */
export const tags = pgTable(
  "tags",
  {
    /** Surrogate primary key. */
    id: uuid("id").primaryKey().defaultRandom(),
    /** Unique tag label (case-sensitive). */
    label: varchar("label", { length: 64 }).notNull(),
    /** Soft-delete timestamp (UTC); NULL = active row. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    /** Actor ID who soft-deleted this row. */
    deletedBy: text("deleted_by"),
    /** Row creation time (UTC). */
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Actor ID from request context; never client-supplied. */
    createdBy: text("created_by").notNull(),
  },
  (table) => [index("tags_label_idx").on(table.label)],
);
