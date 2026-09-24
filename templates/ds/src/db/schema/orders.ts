import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { orderStatusEnum } from "./enums.js";

/** Customer purchase orders; soft-deleted rows retained per retention policy. */
export const orders = pgTable(
  "orders",
  {
    /** Surrogate primary key. */
    id: uuid("id").primaryKey().defaultRandom(),
    /** PII: customer display name on the order. */
    customerName: varchar("customer_name", { length: 255 }).notNull(),
    /** Optional order notes from the customer. */
    notes: text("notes"),
    /** Lifecycle state: PENDING → IN_PROGRESS → COMPLETED or CANCELLED. */
    status: orderStatusEnum("status").notNull().default("PENDING"),
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
  (table) => [index("orders_status_created_at_idx").on(table.status, table.createdAt)],
);
