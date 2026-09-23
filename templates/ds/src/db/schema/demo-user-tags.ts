import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { demoTags } from "./demo-tags.js";
import { demoUsers } from "./demo-users.js";

/** Pure junction (FKs + audit only) — inferred as M:N DemoUser ↔ DemoTag. */
export const demoUserTags = pgTable(
  "demo_user_tags",
  {
    /** Surrogate primary key. */
    id: uuid("id").primaryKey().defaultRandom(),
    /** FK to demo_users.id. */
    demoUserId: uuid("demo_user_id")
      .notNull()
      .references(() => demoUsers.id),
    /** FK to demo_tags.id. */
    demoTagId: uuid("demo_tag_id")
      .notNull()
      .references(() => demoTags.id),
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
    index("demo_user_tags_demo_user_id_idx").on(table.demoUserId),
    index("demo_user_tags_demo_tag_id_idx").on(table.demoTagId),
    uniqueIndex("demo_user_tags_demo_user_id_demo_tag_id_uniq").on(table.demoUserId, table.demoTagId),
  ],
);
