import { boolean, integer, pgTable, text, varchar } from "drizzle-orm/pg-core";

// Add your tables here.
// Example:

export const items = pgTable("items", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  description: text(),
  active: boolean().default(true),
});
