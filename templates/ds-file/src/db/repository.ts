import { getItems, saveItems } from "../storage/index.js";
import type { Item } from "./schemas.js";

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

/** File-based implementation — reads and writes JSON/YAML via storage/index.ts. */
export const itemRepository: IItemRepository = {
  findAll: (): Promise<Item[]> => getItems(),

  findOne: async (id: string): Promise<Item | null> => {
    const all = await getItems();
    return all.find((i) => i.id === id) ?? null;
  },

  create: async (item: Item): Promise<Item> => {
    const existing = await getItems();
    await saveItems([...existing, item]);
    return item;
  },
};
