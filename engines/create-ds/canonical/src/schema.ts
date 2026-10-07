import { createSchema } from "graphql-yoga";
import { typeDefs } from "./generated/generated-schema.js";
import {
  generatedResolvers,
  createDalContext,
  pubsub,
} from "./generated/dal/index.js";
import {
  otelSmokeResolvers,
  otelSmokeTestEnabled,
  otelSmokeTypeDefs,
} from "./observability/otel-smoke-extensions.js";

const resolvers = otelSmokeTestEnabled
  ? {
      ...generatedResolvers,
      Query: {
        ...generatedResolvers.Query,
        ...otelSmokeResolvers.Query,
      },
    }
  : generatedResolvers;

export const schema = createSchema({
  typeDefs: otelSmokeTestEnabled ? [typeDefs, otelSmokeTypeDefs] : typeDefs,
  resolvers,
});

export interface RequestContextOptions {
  /** Set by auth plugin from session/token; null until auth is wired. */
  actorId?: string | null;
}

export function createRequestContext(options?: RequestContextOptions) {
  return createDalContext(pubsub, { actorId: options?.actorId ?? null });
}
