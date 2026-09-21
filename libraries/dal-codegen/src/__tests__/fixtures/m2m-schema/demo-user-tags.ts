import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { demoTags } from "./demo-tags.js";
import { demoUsers } from "./demo-users.js";

/** Pure junction table (FKs + audit only) for M:N inference tests. */
export const demoUserTags = pgTable(
  "demo_user_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    demoUserId: uuid("demo_user_id")
      .notNull()
      .references(() => demoUsers.id),
    demoTagId: uuid("demo_tag_id")
      .notNull()
      .references(() => demoTags.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by").notNull().default("system"),
    updatedBy: text("updated_by").notNull().default("system"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: text("deleted_by"),
  },
  (table) => [
    index("demo_user_tags_demo_user_id_idx").on(table.demoUserId),
    index("demo_user_tags_demo_tag_id_idx").on(table.demoTagId),
    uniqueIndex("demo_user_tags_demo_user_id_demo_tag_id_uniq").on(table.demoUserId, table.demoTagId),
  ],
);
