import {
  createOperationApi,
  linkTypeMap,
  type Fields,
  type GraphqlOperation,
} from "@corpdk/graphql-dsl";
import { emitDslModules } from "@corpdk/graphql-dsl/codegen";
import type { SdkBindings } from "../../types.js";
import { fixtureSchema } from "./schema.js";
import * as validation from "./validation.js";

/**
 * Minimal in-repo SDK built from `@corpdk/graphql-dsl` (no dependency on the
 * `create-graphql-sdk` engine): a real linked type map, typed `build*`
 * functions, and zod-backed `./validation` helpers.
 */
const { typeMap: typeMapSource } = emitDslModules(fixtureSchema, {
  typesImport: "./unused.js",
  customScalars: ["DateTime"],
});

const typeMap = linkTypeMap(
  JSON.parse(typeMapSource.replace(/^export default /, "")),
);

type Leaf = true | { __args?: Record<string, unknown> } | Record<string, unknown>;
export type QuerySelection = Partial<
  Record<"hello" | "item" | "items" | "itemConnection", Leaf>
>;
export type MutationSelection = Partial<
  Record<"createItem" | "bulkCreateItem" | "deleteItem", Leaf>
>;
export type SubscriptionSelection = Partial<Record<"itemChanged", Leaf>>;

const queryApi = createOperationApi("query", typeMap.Query!, (op) => op);
const mutationApi = createOperationApi("mutation", typeMap.Mutation!, (op) => op);
const subscriptionApi = createOperationApi(
  "subscription",
  typeMap.Subscription!,
  (op) => op,
);

export function buildQuery(selection: QuerySelection): GraphqlOperation {
  return queryApi.build(selection as Fields);
}

export function buildMutation(selection: MutationSelection): GraphqlOperation {
  return mutationApi.build(selection as Fields);
}

export function buildSubscription(
  selection: SubscriptionSelection,
): GraphqlOperation {
  return subscriptionApi.build(selection as Fields);
}

export { validation };

/** Drop-in value for `runCli({ sdk })`; `satisfies` is the SdkBindings type test. */
export const fixtureSdk = {
  buildQuery,
  buildMutation,
  buildSubscription,
  validation,
} satisfies SdkBindings;
