import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { categories } from "./categories.js";

/** Customer-facing catalog items; soft-deleted rows retained per retention policy. */
export const items = pgTable(
  "items",
  {
    /** Surrogate primary key. */
    id: uuid("id").primaryKey().defaultRandom(),
    /** FK to categories.id — parent category (M:1). */
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    /** Display name of the item. */
    name: varchar("name", { length: 255 }).notNull(),
    /** Optional longer description of the item. */
    description: text("description"),
    /** Whether the item is currently active. */
    isActive: boolean("is_active").notNull().default(true),
    /** Whether the item has file attachments in object storage. */
    hasAttachments: boolean("has_attachments").notNull().default(false),
    /** Soft-delete timestamp (UTC); NULL = active row. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    /** Actor ID who soft-deleted this row. */
    deletedBy: text("deleted_by"),
    /** Row creation time (UTC). */
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Last update time (UTC). */
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    /** Actor ID from request context; never client-supplied. */
    createdBy: text("created_by").notNull(),
    /** Actor ID from request context on last update. */
    updatedBy: text("updated_by").notNull(),
  },
  (table) => [index("items_category_id_idx").on(table.categoryId)],
);
