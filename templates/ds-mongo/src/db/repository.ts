import { getDb } from "./index.js";
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

/** MongoDB implementation — delegates to the native driver via getDb(). */
export const itemRepository: IItemRepository = {
  findAll: async (): Promise<Item[]> => {
    const docs = await getDb().items.find({}).toArray();
    return docs.map(({ _id, ...rest }) => ItemSchema.parse({ id: _id, ...rest }));
  },

  findOne: async (id: string): Promise<Item | null> => {
    const doc = await getDb().items.findOne({ _id: id });
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return ItemSchema.parse({ id: _id, ...rest });
  },

  create: async (item: Item): Promise<Item> => {
    await getDb().items.insertOne({
      _id: item.id,
      name: item.name,
      description: item.description,
      active: item.active,
      createdAt: item.createdAt,
    });
    return item;
  },
};
