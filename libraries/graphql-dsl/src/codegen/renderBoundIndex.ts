import type { GraphQLSchema, GraphQLField, GraphQLObjectType } from "graphql";
import { isObjectType } from "graphql";

function isConnectionField(field: GraphQLField<unknown, unknown>): boolean {
  const type = field.type;
  const named = "ofType" in type && type.ofType ? unwrapNamed(type) : type;
  if (!isObjectType(named)) return false;
  const fields = named.getFields();
  const hasPageInfo = Boolean(fields.pageInfo);
  const hasEdgesOrNodes = Boolean(fields.edges || fields.nodes);
  const argNames = new Set(field.args.map((a) => a.name));
  const hasForward = argNames.has("first") && argNames.has("after");
  const hasBackward = argNames.has("last") && argNames.has("before");
  return hasPageInfo && hasEdgesOrNodes && (hasForward || hasBackward);
}

function unwrapNamed(type: { ofType?: unknown }): GraphQLObjectType {
  let current: unknown = type;
  while (
    current &&
    typeof current === "object" &&
    "ofType" in current &&
    (current as { ofType?: unknown }).ofType
  ) {
    current = (current as { ofType: unknown }).ofType;
  }
  return current as GraphQLObjectType;
}

export function connectionFields(schema: GraphQLSchema): string[] {
  const query = schema.getQueryType();
  if (!query) return [];
  return Object.values(query.getFields())
    .filter(isConnectionField)
    .map((f) => f.name);
}

export function renderBoundIndex(
  schema: GraphQLSchema,
  typesImport: string,
  typesNamespace: string,
): string {
  const connections = connectionFields(schema);
  const connectionUnion =
    connections.length > 0
      ? `export type ConnectionField = ${connections.map((c) => JSON.stringify(c)).join(" | ")};`
      : `export type ConnectionField = never;`;

  return `import type * as ${typesNamespace} from "${typesImport}";
import {
  createOperationApi,
  linkTypeMap,
  type FieldsSelection,
  everything,
  iterateConnection as iterateConnectionCore,
  paginateConnection as paginateConnectionCore,
  type IterateConnectionOptions as IterateConnectionOptionsCore,
  v,
} from "@corpdk/graphql-dsl";
import typeMapJson from "./type-map.js";
import type {
  MutationSelection,
  QuerySelection,
  SubscriptionSelection,
} from "./selections.js";

const typeMap = linkTypeMap(typeMapJson as never);

const queryApi = createOperationApi<QuerySelection, typeof typeMap.Query>(
  "query",
  typeMap.Query!,
  (op) => ({ ...op, document: op as never }),
);

export const buildQuery = queryApi.build;
export const defineQuery = queryApi.define;
export type QueryResult<S extends QuerySelection> = FieldsSelection<
  ${typesNamespace}.Query,
  S
>;

const mutationApi = createOperationApi<
  MutationSelection,
  typeof typeMap.Mutation
>(
  "mutation",
  typeMap.Mutation!,
  (op) => ({ ...op, document: op as never }),
);

export const buildMutation = mutationApi.build;
export const defineMutation = mutationApi.define;
export type MutationResult<S extends MutationSelection> = FieldsSelection<
  ${typesNamespace}.Mutation,
  S
>;

const subscriptionApi = createOperationApi<
  SubscriptionSelection,
  typeof typeMap.Subscription
>(
  "subscription",
  typeMap.Subscription!,
  (op) => ({ ...op, document: op as never }),
);

export const buildSubscription = subscriptionApi.build;
export const defineSubscription = subscriptionApi.define;
export type SubscriptionResult<S extends SubscriptionSelection> =
  FieldsSelection<${typesNamespace}.Subscription, S>;

export type IterateConnectionOptions<
  Field extends ConnectionField,
  NodeSel,
> = Omit<
  IterateConnectionOptionsCore<Field, Record<string, unknown>, NodeSel>,
  "build"
>;

export async function* iterateConnection<
  Field extends ConnectionField,
  NodeSel,
>(
  exec: Parameters<typeof iterateConnectionCore>[0],
  options: IterateConnectionOptions<Field, NodeSel> & {
    args: Record<string, unknown>;
    select: NodeSel;
  },
): AsyncGenerator<unknown> {
  yield* iterateConnectionCore(exec, {
    ...options,
    build: (variables) =>
      buildQuery({
        [options.field]: {
          __args: variables,
          nodes: options.select,
          pageInfo: {
            hasNextPage: true,
            endCursor: true,
            hasPreviousPage: true,
            startCursor: true,
          },
        },
      } as QuerySelection),
  });
}

export async function* paginateConnection<
  Field extends ConnectionField,
  NodeSel,
>(
  exec: Parameters<typeof paginateConnectionCore>[0],
  options: IterateConnectionOptions<Field, NodeSel> & {
    args: Record<string, unknown>;
    select: NodeSel;
  },
): AsyncGenerator<import("@corpdk/graphql-dsl").ConnectionPage<unknown>> {
  yield* paginateConnectionCore(exec, {
    ...options,
    build: (variables) =>
      buildQuery({
        [options.field]: {
          __args: variables,
          nodes: options.select,
          pageInfo: {
            hasNextPage: true,
            endCursor: true,
            hasPreviousPage: true,
            startCursor: true,
          },
        },
      } as QuerySelection),
  });
}

export { everything, v, type FieldsSelection, type QuerySelection, type MutationSelection, type SubscriptionSelection };

${connectionUnion}
`;
}