import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/** User label names for pure M:N junction navigation (distinct from item `tags`). */
export const labels = pgTable(
  "labels",
  {
    /** Surrogate primary key. */
    id: uuid("id").primaryKey().defaultRandom(),
    /** Unique label text. */
    label: varchar("label", { length: 64 }).notNull(),
    /** Row creation time (UTC). */
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Last update time (UTC). */
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    /** Actor ID from request context; never client-supplied. */
    createdBy: text("created_by").notNull(),
    /** Actor ID from request context on last update. */
    updatedBy: text("updated_by").notNull(),
  },
  (table) => [index("labels_label_idx").on(table.label)],
);
