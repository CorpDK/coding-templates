import { createSchema } from "graphql-yoga";
import { randomUUID } from "node:crypto";
import { pubsub } from "./pubsub/index.js";
import { getDb } from "./db/index.js";
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

      """Returns all items stored in DocumentDB."""
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
      Creates a new Item document in DocumentDB after validating the input with Zod.
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

    """A document stored in DocumentDB, validated with Zod on write."""
    type Item {
      """Unique identifier (UUID), stored as _id in DocumentDB."""
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

      items: async (): Promise<Item[]> => {
        const docs = await getDb().items.find({}).toArray();
        return docs.map(({ _id, ...rest }) => ItemSchema.parse({ id: _id, ...rest }));
      },

      item: async (_: unknown, args: { id: string }): Promise<Item | null> => {
        const doc = await getDb().items.findOne({ _id: args.id });
        if (!doc) return null;
        const { _id, ...rest } = doc;
        return ItemSchema.parse({ id: _id, ...rest });
      },
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
        // Validate input at the mutation boundary with Zod
        const input = CreateItemInputSchema.parse(args);
        const doc: Item = ItemSchema.parse({
          id: randomUUID(),
          name: input.name,
          description: input.description,
          active: true,
          createdAt: new Date().toISOString(),
        });
        await getDb().items.insertOne({ _id: doc.id, name: doc.name, description: doc.description, active: doc.active, createdAt: doc.createdAt });
        pubsub.publish("ITEM_CREATED", { itemCreated: doc });
        return doc;
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
