import { createSchema } from "graphql-yoga";
import { pubsub } from "./pubsub/index.js";

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
    }

    """Real-time event streams delivered over WebSocket."""
    type Subscription {
      """
      Fires whenever the ping mutation is called.
      Subscribe to receive real-time updates from mutations.
      """
      pingSent: PingResult!
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
        pubsub.publish("PING_SENT", { pingSent: result });
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
