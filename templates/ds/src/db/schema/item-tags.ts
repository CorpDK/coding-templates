import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { items } from "./items.js";
import { tags } from "./tags.js";

/**
 * Enriched M:N junction linking items to tags — carries business columns beyond the two FKs
 * (assignedAt records when the tag was applied). Full audit, hard delete on unlink.
 */
export const itemTags = pgTable(
  "item_tags",
  {
    /** Surrogate primary key. */
    id: uuid("id").primaryKey().defaultRandom(),
    /** FK to items.id. */
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id),
    /** FK to tags.id. */
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id),
    /** UTC instant when this tag was assigned to the item (enriched junction field). */
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
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
    index("item_tags_item_id_idx").on(table.itemId),
    index("item_tags_tag_id_idx").on(table.tagId),
    uniqueIndex("item_tags_item_id_tag_id_uniq").on(table.itemId, table.tagId),
  ],
);
