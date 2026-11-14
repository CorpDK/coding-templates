import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { items } from "./items.js";

/** Optional extended specifications for a catalog item (1:1 dependent); hard delete. */
export const itemDetails = pgTable(
  "item_details",
  {
    /** Surrogate primary key. */
    id: uuid("id").primaryKey().defaultRandom(),
    /** FK to items.id — enforces 1:1 via unique index (dependent side). */
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id),
    /** Technical specifications (plain text; not JSON). */
    specifications: text("specifications"),
    /** Warranty and support notes for the item. */
    warrantyNotes: text("warranty_notes"),
    /** Row creation time (UTC). */
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Last update time (UTC). */
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    /** Actor ID from request context; never client-supplied. */
    createdBy: text("created_by").notNull(),
    /** Actor ID from request context on last update. */
    updatedBy: text("updated_by").notNull(),
  },
  (table) => [
    index("item_details_item_id_idx").on(table.itemId),
    uniqueIndex("item_details_item_id_uniq").on(table.itemId),
  ],
);
