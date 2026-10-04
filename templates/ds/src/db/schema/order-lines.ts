import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { items } from "./items.js";
import { orders } from "./orders.js";

/** One catalog item per line on an order (1:M order → lines; each line → one item); hard-deleted when removed. */
export const orderLines = pgTable(
  "order_lines",
  {
    /** Surrogate primary key. */
    id: uuid("id").primaryKey().defaultRandom(),
    /** FK to orders.id — parent order (M:1 from line perspective). */
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    /** FK to items.id — catalog item this line purchases (exactly one item per line). */
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id),
    /** Units ordered for this line (default 1). */
    quantity: integer("quantity").notNull().default(1),
    /** Product or SKU label snapshot at order time. */
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
  (table) => [
    index("order_lines_order_id_idx").on(table.orderId),
    index("order_lines_item_id_idx").on(table.itemId),
    check("order_lines_quantity_positive", sql`${table.quantity} > 0`),
  ],
);
