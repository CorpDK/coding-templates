import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/** Append-only security and domain audit trail; rows never updated after insert. */
export const auditEvents = pgTable(
  "audit_events",
  {
    /** Surrogate primary key. */
    id: uuid("id").primaryKey().defaultRandom(),
    /** Action verb describing the audited event (e.g. ITEM_CREATED). */
    action: varchar("action", { length: 128 }).notNull(),
    /** Serialized event payload (plain text; not JSON column). */
    payload: text("payload").notNull(),
    /** Row creation time (UTC). */
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Actor ID from request context; never client-supplied. */
    createdBy: text("created_by").notNull(),
  },
  (table) => [index("audit_events_action_idx").on(table.action)],
);
