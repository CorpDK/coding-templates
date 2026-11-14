import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/** Static product categories; hard-deleted when removed (no soft-delete retention). */
export const categories = pgTable(
  "categories",
  {
    /** Surrogate primary key. */
    id: uuid("id").primaryKey().defaultRandom(),
    /** Unique category label shown in navigation. */
    name: varchar("name", { length: 128 }).notNull(),
    /** Optional longer description of the category. */
    description: text("description"),
    /** Whether the category is visible to customers. */
    isVisible: boolean("is_visible").notNull().default(true),
    /** Row creation time (UTC). */
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Last update time (UTC). */
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    /** Actor ID from request context; never client-supplied. */
    createdBy: text("created_by").notNull(),
    /** Actor ID from request context on last update. */
    updatedBy: text("updated_by").notNull(),
  },
  (table) => [index("categories_name_idx").on(table.name)],
);
