import { boolean, pgTable, text, varchar } from "drizzle-orm/pg-core";

// Add your tables here.

export const items = pgTable("items", {
  // UUID stored as text — consistent with document and file DS templates
  // and works across all supported SQL dialects without transformation.
  id: text().primaryKey(),
  name: varchar({ length: 255 }).notNull(),
  description: text(),
  active: boolean().notNull().default(true),
  // ISO-8601 string — consistent with other DS templates.
  createdAt: text().notNull(),
});
