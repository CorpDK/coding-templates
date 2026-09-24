import {
  GraphQLBoolean,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
  type GraphQLFieldConfigMap,
  type GraphQLNamedType,
} from "graphql";

export interface BootstrapSchemaBundle {
  types: GraphQLNamedType[];
  queryFields: GraphQLFieldConfigMap<unknown, unknown>;
  mutationFields: GraphQLFieldConfigMap<unknown, unknown>;
  subscriptionFields: GraphQLFieldConfigMap<unknown, unknown>;
}

/** Server health and connectivity bootstrap fields (hello, status, ping, pingSent). */
export function buildBootstrapSchema(): BootstrapSchemaBundle {
  const serverStatusType = new GraphQLObjectType({
    name: "ServerStatus",
    description: "Current health state of the server.",
    fields: {
      ok: {
        type: new GraphQLNonNull(GraphQLBoolean),
        description: "True when the server is operating normally.",
      },
      timestamp: {
        type: new GraphQLNonNull(GraphQLString),
        description: "ISO-8601 timestamp of when this status was generated.",
      },
    },
  });

  const pingResultType = new GraphQLObjectType({
    name: "PingResult",
    description: "Result returned by the ping mutation and emitted on the pingSent subscription.",
    fields: {
      message: {
        type: new GraphQLNonNull(GraphQLString),
        description: "The message that was sent with the ping.",
      },
      timestamp: {
        type: new GraphQLNonNull(GraphQLString),
        description: "ISO-8601 timestamp of when the ping was processed.",
      },
    },
  });

  const queryFields: GraphQLFieldConfigMap<unknown, unknown> = {
    hello: {
      type: new GraphQLNonNull(GraphQLString),
      description: "Returns a personalised greeting. Omit name to receive the default greeting.",
      args: {
        name: {
          type: GraphQLString,
          description: "Optional name to include in the greeting.",
        },
      },
    },
    status: {
      type: new GraphQLNonNull(serverStatusType),
      description: "Returns the current server health status and a server-side timestamp.",
    },
  };

  const mutationFields: GraphQLFieldConfigMap<unknown, unknown> = {
    ping: {
      type: new GraphQLNonNull(pingResultType),
      description:
        "Sends a ping with a custom message and broadcasts it to all pingSent subscribers. Use this to verify end-to-end real-time connectivity.",
      args: {
        message: {
          type: new GraphQLNonNull(GraphQLString),
          description: "The message payload to broadcast to all active subscribers.",
        },
      },
    },
  };

  const subscriptionFields: GraphQLFieldConfigMap<unknown, unknown> = {
    pingSent: {
      type: new GraphQLNonNull(pingResultType),
      description:
        "Fires whenever the ping mutation is called. Subscribe to receive real-time updates from mutations.",
    },
  };

  return {
    types: [serverStatusType, pingResultType],
    queryFields,
    mutationFields,
    subscriptionFields,
  };
}
