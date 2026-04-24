import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/index.js";
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

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

/** Prisma implementation — delegates to the generated client. */
export const itemRepository: IItemRepository = {
  findAll: async (): Promise<Item[]> => {
    const rows = await prisma.item.findMany();
    return rows.map((row) => ItemSchema.parse(row));
  },

  findOne: async (id: string): Promise<Item | null> => {
    const row = await prisma.item.findUnique({ where: { id } });
    if (!row) return null;
    return ItemSchema.parse(row);
  },

  create: async (item: Item): Promise<Item> => {
    const row = await prisma.item.create({ data: item });
    return ItemSchema.parse(row);
  },
};
