import { createSchema } from "graphql-yoga";
import { pubsub } from "./pubsub/index.js";

export const schema = createSchema({
  typeDefs: /* GraphQL */ `
    type Query {
      hello(name: String): String!
      status: ServerStatus!
    }

    type Mutation {
      """
      Example mutation — fires a pingSent subscription event.
      Every mutation should publish to a corresponding subscription topic.
      """
      ping(message: String!): PingResult!
    }

    type Subscription {
      """
      Fires whenever the ping mutation is called.
      Subscribe to receive real-time updates from mutations.
      """
      pingSent: PingResult!
    }

    type ServerStatus {
      ok: Boolean!
      timestamp: String!
    }

    type PingResult {
      message: String!
      timestamp: String!
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
    },
    Mutation: {
      ping: (
        _: unknown,
        args: { message: string },
      ): { message: string; timestamp: string } => {
        const result = { message: args.message, timestamp: new Date().toISOString() };
        pubsub.publish("PING_SENT", result);
        return result;
      },
    },
    Subscription: {
      pingSent: {
        subscribe: () => pubsub.subscribe("PING_SENT"),
      },
    },
  },
});
