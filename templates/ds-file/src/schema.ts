import { createSchema } from "graphql-yoga";
import { randomUUID } from "node:crypto";
import { pubsub } from "./pubsub/index.js";
import { itemRepository } from "./db/repository.js";
import { CreateItemInputSchema, ItemSchema, type Item } from "./db/schemas.js";

export const schema = createSchema({
  typeDefs: /* GraphQL */ `
    """Entry points for read-only data fetching."""
    type Query {
      """Returns a personalised greeting. Omit name to receive the default greeting."""
      hello(
        """Optional name to include in the greeting."""
        name: String
      ): String!

      """Returns the current server health status and a server-side timestamp."""
      status: ServerStatus!

      """Returns all items."""
      items: [Item!]!

      """Returns a single item by its ID. Returns null if not found."""
      item(
        """The UUID of the item to fetch."""
        id: ID!
      ): Item
    }

    """Entry points for data mutations that trigger side effects."""
    type Mutation {
      """
      Sends a ping with a custom message and broadcasts it to all pingSent subscribers.
      Use this to verify end-to-end real-time connectivity.
      """
      ping(
        """The message payload to broadcast to all active subscribers."""
        message: String!
      ): PingResult!

      """
      Creates a new item and persists it to the data service.
      Broadcasts the created item to all itemCreated subscribers.
      """
      createItem(
        """Display name of the item. Must be between 1 and 255 characters."""
        name: String!
        """Optional longer description of the item."""
        description: String
      ): Item!
    }

    """Real-time event streams delivered over WebSocket."""
    type Subscription {
      """
      Fires whenever the ping mutation is called.
      Subscribe to receive real-time updates from mutations.
      """
      pingSent: PingResult!

      """
      Fires whenever a new item is created via the createItem mutation.
      Subscribe to receive real-time item creation events.
      """
      itemCreated: Item!
    }

    """Current health state of the server."""
    type ServerStatus {
      """True when the server is operating normally."""
      ok: Boolean!
      """ISO-8601 timestamp of when this status was generated."""
      timestamp: String!
    }

    """Result returned by the ping mutation and emitted on the pingSent subscription."""
    type PingResult {
      """The message that was sent with the ping."""
      message: String!
      """ISO-8601 timestamp of when the ping was processed."""
      timestamp: String!
    }

    """A data item."""
    type Item {
      """Unique identifier (UUID)."""
      id: ID!
      """Display name of the item."""
      name: String!
      """Optional longer description of the item."""
      description: String
      """Whether the item is currently active."""
      active: Boolean!
      """ISO-8601 timestamp of when the item was created."""
      createdAt: String!
    }
  `,
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
