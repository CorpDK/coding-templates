import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/** Demo tag labels for pure M:N junction navigation. */
export const demoTags = pgTable(
  "demo_tags",
  {
    /** Surrogate primary key. */
    id: uuid("id").primaryKey().defaultRandom(),
    /** Unique tag label. */
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
  (table) => [index("demo_tags_label_idx").on(table.label)],
);
