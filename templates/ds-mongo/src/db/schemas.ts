import { z } from "zod";

/**
 * Zod schema for an Item document stored in MongoDB.
 *
 * Zod schemas serve the same purpose as Prisma models or Drizzle table
 * definitions in the other DS packages — they define the document shape
 * and provide runtime validation at the mutation boundary.
 *
 * Add new document schemas here as your data model grows.
 */
export const ItemSchema = z.object({
  /** Unique document key (UUID), stored as _id in MongoDB. */
  id: z.string().uuid(),
  /** Display name of the item. */
  name: z.string().min(1).max(255),
  /** Optional longer description. */
  description: z.string().optional(),
  /** Whether the item is active. Defaults to true on creation. */
  active: z.boolean().default(true),
  /** ISO-8601 timestamp of when the document was created. */
  createdAt: z.string().datetime(),
});

export type Item = z.infer<typeof ItemSchema>;

/** Input schema for creating a new item — subset of ItemSchema. */
export const CreateItemInputSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

export type CreateItemInput = z.infer<typeof CreateItemInputSchema>;
