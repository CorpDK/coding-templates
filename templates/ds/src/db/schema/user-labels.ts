import { isNull } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { labels } from "./labels.js";
import { users } from "./users.js";

/** Pure junction (FKs + audit only) — inferred as M:N User ↔ Label. */
export const userLabels = pgTable(
  "user_labels",
  {
    /** Surrogate primary key. */
    id: uuid("id").primaryKey().defaultRandom(),
    /** FK to users.id. */
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    /** FK to labels.id. */
    labelId: uuid("label_id")
      .notNull()
      .references(() => labels.id),
    /** Row creation time (UTC). */
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Last update time (UTC). */
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    /** Actor ID from request context; never client-supplied. */
    createdBy: text("created_by").notNull(),
    /** Actor ID from request context on last update. */
    updatedBy: text("updated_by").notNull(),
    /** Soft-delete timestamp (UTC); NULL = active link. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    /** Actor ID who soft-deleted this link. */
    deletedBy: text("deleted_by"),
  },
  (table) => [
    index("user_labels_user_id_idx").on(table.userId),
    index("user_labels_label_id_idx").on(table.labelId),
    uniqueIndex("user_labels_user_id_label_id_uniq")
      .on(table.userId, table.labelId)
      .where(isNull(table.deletedAt)),
  ],
);
