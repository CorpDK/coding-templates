import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { labels } from "./labels.js";
import { users } from "./users.js";

export const userLabels = pgTable(
  "user_labels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    labelId: uuid("label_id")
      .notNull()
      .references(() => labels.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by").notNull().default("system"),
    updatedBy: text("updated_by").notNull().default("system"),
  },
  (table) => [
    index("user_labels_user_id_idx").on(table.userId),
    index("user_labels_label_id_idx").on(table.labelId),
    uniqueIndex("user_labels_user_id_label_id_uniq").on(table.userId, table.labelId),
  ],
);
