import { createSchema } from "graphql-yoga";
import {
  typeDefs,
  generatedResolvers,
  createDalContext,
  pubsub,
} from "./generated/dal/index.js";

export const schema = createSchema({
  typeDefs,
  resolvers: generatedResolvers,
});

export interface RequestContextOptions {
  /** Set by auth plugin from session/token; null until auth is wired. */
  actorId?: string | null;
}

export function createRequestContext(options?: RequestContextOptions) {
  return createDalContext(pubsub, { actorId: options?.actorId ?? null });
}
