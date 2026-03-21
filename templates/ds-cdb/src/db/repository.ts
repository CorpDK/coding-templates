import { DocumentNotFoundError } from "couchbase";
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

/** Couchbase implementation — delegates to the native SDK via getDb(). */
export const itemRepository: IItemRepository = {
  findAll: async (): Promise<Item[]> => {
    const { cluster } = getDb();
    const bucket = process.env.DS_CDB_BUCKET!;
    const result = await cluster.query<Item>(
      `SELECT META().id AS id, t.* FROM \`${bucket}\`.\`_default\`.\`items\` AS t`,
    );
    return result.rows.map((row) => ItemSchema.parse(row));
  },

  findOne: async (id: string): Promise<Item | null> => {
    try {
      const result = await getDb().items.get(id);
      return ItemSchema.parse({ ...result.content, id });
    } catch (err) {
      if (err instanceof DocumentNotFoundError) return null;
      throw err;
    }
  },

  create: async (item: Item): Promise<Item> => {
    await getDb().items.insert(item.id, item);
    return item;
  },
};
