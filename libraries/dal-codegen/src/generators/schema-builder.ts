import {
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLError,
  validateSchema,
  type GraphQLFieldConfigMap,
} from "graphql";
import type { EntityModel } from "../model.js";
import { buildBootstrapSchema } from "./bootstrap-schema.js";
import { buildSchemaRegistry } from "./schema-registry.js";
import { buildEntitySchema } from "./entity-schema.js";

function sortedEntities(entities: EntityModel[]): EntityModel[] {
  return [...entities].sort((a, b) => a.fieldBasename.localeCompare(b.fieldBasename));
}

function mergeFieldMaps(
  maps: GraphQLFieldConfigMap<unknown, unknown>[],
): GraphQLFieldConfigMap<unknown, unknown> {
  return Object.assign({}, ...maps);
}

function formatSchemaError(error: GraphQLError): string {
  const location = error.locations?.[0];
  const loc = location ? ` at line ${location.line}, column ${location.column ?? "?"}` : "";
  return `${error.message}${loc}`;
}

/** Builds a validated GraphQL schema from entity models. */
export function buildDalGraphQLSchema(entities: EntityModel[]): GraphQLSchema {
  if (entities.length === 0) {
    throw new Error("Schema build error: no entities provided");
  }

  const registry = buildSchemaRegistry(entities);
  const bootstrap = buildBootstrapSchema();
  const queryFields: GraphQLFieldConfigMap<unknown, unknown>[] = [bootstrap.queryFields];
  const mutationFields: GraphQLFieldConfigMap<unknown, unknown>[] = [bootstrap.mutationFields];
  const subscriptionFields: GraphQLFieldConfigMap<unknown, unknown>[] = [
    bootstrap.subscriptionFields,
  ];
  const typeMap = new Map(registry.types);

  for (const type of bootstrap.types) {
    typeMap.set(type.name, type);
  }

  for (const entity of sortedEntities(entities)) {
    const bundle = buildEntitySchema(entity, registry);
    for (const type of bundle.types) {
      typeMap.set(type.name, type);
    }
    queryFields.push(bundle.queryFields);
    mutationFields.push(bundle.mutationFields);
    subscriptionFields.push(bundle.subscriptionFields);
  }

  const queryType = new GraphQLObjectType({
    name: "Query",
    description: "Entry points for read-only data fetching.",
    fields: mergeFieldMaps(queryFields),
  });

  const mutationType = new GraphQLObjectType({
    name: "Mutation",
    description: "Entry points for data mutations that trigger side effects.",
    fields: mergeFieldMaps(mutationFields),
  });

  const subscriptionType = new GraphQLObjectType({
    name: "Subscription",
    description: "Real-time event streams delivered over WebSocket.",
    fields: mergeFieldMaps(subscriptionFields),
  });

  typeMap.set("Query", queryType);
  typeMap.set("Mutation", mutationType);
  typeMap.set("Subscription", subscriptionType);

  const schema = new GraphQLSchema({
    query: queryType,
    mutation: mutationType,
    subscription: subscriptionType,
    types: [...typeMap.values()],
  });

  const schemaErrors = validateSchema(schema);
  if (schemaErrors.length > 0) {
    throw new Error(
      `Schema validation error(s):\n${schemaErrors.map((e) => `  - ${formatSchemaError(e)}`).join("\n")}`,
    );
  }

  return schema;
}
