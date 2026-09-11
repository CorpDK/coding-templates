import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { createSchema } from "graphql-yoga";
import { randomUUID } from "node:crypto";
import { pubsub } from "./pubsub/index.js";
import { itemRepository } from "./db/repository.js";
import { CreateItemInputSchema, ItemSchema, type Item } from "./db/schemas.js";

const schemaDir = fileURLToPath(new URL("./schema/", import.meta.url));
const typeDefs = readdirSync(schemaDir)
  .filter((f) => f.endsWith(".graphqls"))
  .sort()
  .map((f) => readFileSync(join(schemaDir, f), "utf-8"))
  .join("\n");

export const schema = createSchema({
  typeDefs,
  resolvers: {
    Query: {
      hello: (_: unknown, args: { name?: string }): string =>
        `Hello, ${args.name ?? "world"}!`,

      status: (): { ok: boolean; timestamp: string } => ({
        ok: true,
        timestamp: new Date().toISOString(),
      }),

      items: (): Promise<Item[]> => itemRepository.findAll(),

      item: (_: unknown, args: { id: string }): Promise<Item | null> =>
        itemRepository.findOne(args.id),
    },

    Mutation: {
      ping: (
        _: unknown,
        args: { message: string },
      ): { message: string; timestamp: string } => {
        const result = { message: args.message, timestamp: new Date().toISOString() };
        pubsub.publish("PING_SENT", { pingSent: result });
        return result;
      },

      createItem: async (
        _: unknown,
        args: { name: string; description?: string },
      ): Promise<Item> => {
        const input = CreateItemInputSchema.parse(args);
        const item: Item = ItemSchema.parse({
          id: randomUUID(),
          name: input.name,
          description: input.description,
          active: true,
          createdAt: new Date().toISOString(),
        });
        const created = await itemRepository.create(item);
        pubsub.publish("ITEM_CREATED", { itemCreated: created });
        return created;
      },
    },

    Subscription: {
      pingSent: {
        subscribe: () => pubsub.subscribe("PING_SENT"),
      },
      itemCreated: {
        subscribe: () => pubsub.subscribe("ITEM_CREATED"),
      },
    },
  },
});
