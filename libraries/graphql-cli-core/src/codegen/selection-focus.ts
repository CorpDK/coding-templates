import {
  type GraphQLObjectType,
  type GraphQLSchema,
  type GraphQLOutputType,
  getNamedType,
  isInterfaceType,
  isListType,
  isObjectType,
  isUnionType,
} from "graphql";
import type { LookupIndex, SelectionConfig } from "./types.js";
import { isConnectionType, isEntityType } from "./lookup-index.js";

function focusFromConnection(
  schema: GraphQLSchema,
  objectType: GraphQLObjectType,
  lookupIndex: LookupIndex,
  lookupConfig: SelectionConfig["lookup"],
): string | null {
  if (!isConnectionType(objectType.name, schema)) return null;
  const nodes = objectType.getFields().nodes;
  if (!nodes) return null;
  const item = getNamedType(nodes.type);
  if (!isObjectType(item)) return null;
  if (!isEntityType(schema, item.name, lookupIndex, lookupConfig)) return null;
  return item.name;
}

function focusFromPayload(
  schema: GraphQLSchema,
  objectType: GraphQLObjectType,
  lookupIndex: LookupIndex,
  lookupConfig: SelectionConfig["lookup"],
  operationField?: string,
): string | null {
  const name = objectType.name;
  const payloadLike =
    name.endsWith("Payload") ||
    name.endsWith("Result") ||
    name.endsWith("Connection");
  if (!payloadLike) return null;

  for (const [fieldName, field] of Object.entries(objectType.getFields())) {
    if (isListType(field.type)) continue;
    const child = getNamedType(field.type);
    if (!isObjectType(child)) continue;
    if (!isEntityType(schema, child.name, lookupIndex, lookupConfig)) continue;

    const typeField = child.name.charAt(0).toLowerCase() + child.name.slice(1);
    if (fieldName === typeField) return child.name;
    if (operationField && fieldName === operationField) return child.name;
  }
  return null;
}

export function findFocusEntity(
  schema: GraphQLSchema,
  returnType: GraphQLOutputType,
  lookupIndex: LookupIndex,
  lookupConfig: SelectionConfig["lookup"],
  operationField?: string,
): string | null {
  const named = getNamedType(returnType);
  if (isUnionType(named) || isInterfaceType(named)) return null;
  if (!isObjectType(named)) return null;

  if (isEntityType(schema, named.name, lookupIndex, lookupConfig)) {
    return named.name;
  }

  const fromConnection = focusFromConnection(
    schema,
    named,
    lookupIndex,
    lookupConfig,
  );
  if (fromConnection) return fromConnection;

  return focusFromPayload(
    schema,
    named,
    lookupIndex,
    lookupConfig,
    operationField,
  );
}