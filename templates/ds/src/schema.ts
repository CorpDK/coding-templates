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

export function createRequestContext() {
  return createDalContext(pubsub);
}
