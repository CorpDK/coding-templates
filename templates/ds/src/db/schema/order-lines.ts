import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { orders } from "./orders.js";

/** Line items belonging to an order (1:M child); hard-deleted when removed. */
export const orderLines = pgTable(
  "order_lines",
  {
    /** Surrogate primary key. */
    id: uuid("id").primaryKey().defaultRandom(),
    /** FK to orders.id — parent order (M:1 from line perspective). */
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    /** Product or SKU label for this line. */
    sku: varchar("sku", { length: 64 }).notNull(),
    /** Optional line-level description. */
    description: text("description"),
    /** Row creation time (UTC). */
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Last update time (UTC). */
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    /** Actor ID from request context; never client-supplied. */
    createdBy: text("created_by").notNull(),
    /** Actor ID from request context on last update. */
    updatedBy: text("updated_by").notNull(),
  },
  (table) => [index("order_lines_order_id_idx").on(table.orderId)],
);
