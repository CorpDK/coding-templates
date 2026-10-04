import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/** Registered customers who place orders; also participates in M:N labels via userLabels. */
export const users = pgTable(
  "users",
  {
    /** Surrogate primary key. */
    id: uuid("id").primaryKey().defaultRandom(),
    /** Display name. */
    name: varchar("name", { length: 64 }).notNull(),
    /** Row creation time (UTC). */
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Last update time (UTC). */
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    /** Actor ID from request context; never client-supplied. */
    createdBy: text("created_by").notNull(),
    /** Actor ID from request context on last update. */
    updatedBy: text("updated_by").notNull(),
  },
  (table) => [index("users_name_idx").on(table.name)],
);
