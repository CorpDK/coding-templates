import { eq } from "drizzle-orm";
import { db } from "./index.js";
import { items } from "../../drizzle/schema.js";
import { ItemSchema, type Item } from "./schemas.js";

/**
 * Common repository interface for Item persistence.
 *
 * Every DS template implements this interface in its own db/repository.ts
 * using its native storage layer (Prisma, Drizzle, MongoDB, Couchbase,
 * or JSON/YAML files). The GraphQL resolvers in schema.ts import only
 * this interface — swap the implementation to switch backends.
 */
export interface IItemRepository {
  findAll(): Promise<Item[]>;
  findOne(id: string): Promise<Item | null>;
  create(item: Item): Promise<Item>;
}

/** Drizzle implementation — delegates to the ORM via the db instance. */
export const itemRepository: IItemRepository = {
  findAll: async (): Promise<Item[]> => {
    const rows = await db.select().from(items);
    return rows.map((row) => ItemSchema.parse(row));
  },

  findOne: async (id: string): Promise<Item | null> => {
    const rows = await db.select().from(items).where(eq(items.id, id));
    if (rows.length === 0) return null;
    return ItemSchema.parse(rows[0]);
  },

  create: async (item: Item): Promise<Item> => {
    await db.insert(items).values(item);
    return item;
  },
};
