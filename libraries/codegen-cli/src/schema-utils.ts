import {
  type GraphQLSchema,
  type GraphQLOutputType,
  type GraphQLInputType,
  type GraphQLObjectType,
  isScalarType,
  isEnumType,
  isObjectType,
  isNonNullType,
  isListType,
  getNamedType,
} from "graphql";

export type OperationType = "query" | "mutation" | "subscription";

export interface ArgDescriptor {
  name: string;
  /** Full GraphQL type string, e.g. "ID!", "String", "[Item!]!" */
  graphqlType: string;
  /** Type for node:util parseArgs — scalars other than Boolean become "string" */
  parseType: "string" | "boolean";
  description: string;
  required: boolean;
}

export interface OperationDescriptor {
  operationType: OperationType;
  /** camelCase field name from the schema, e.g. "createItem" */
  fieldName: string;
  /** kebab-case command name for the CLI, e.g. "create-item" */
  commandName: string;
  description: string;
  args: ArgDescriptor[];
  /** Ready-to-execute GraphQL document string */
  document: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toKebabCase(name: string): string {
  return name
    .replaceAll(/([A-Z])/g, "-$1")
    .toLowerCase()
    .replace(/^-/, "");
}

function toPascalCase(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function getGraphqlTypeString(type: GraphQLInputType): string {
  if (isNonNullType(type)) return `${getGraphqlTypeString(type.ofType)}!`;
  if (isListType(type)) return `[${getGraphqlTypeString(type.ofType)}]`;
  return (type as { name: string }).name;
}

function getParseType(type: GraphQLInputType): "string" | "boolean" {
  const named = getNamedType(type);
  if (named.name === "Boolean") return "boolean";
  return "string";
}

/**
 * Recursively build a selection set string for all scalar/enum leaf fields.
 * Returns null for scalar return types (no braces needed).
 */
function buildSelectionSet(type: GraphQLOutputType, depth = 0): string | null {
  if (depth > 6) return null;

  const named = getNamedType(type);

  if (isScalarType(named) || isEnumType(named)) {
    return null;
  }

  if (isObjectType(named)) {
    const fields = (named as GraphQLObjectType).getFields();
    const parts: string[] = [];

    for (const [fieldName, field] of Object.entries(fields)) {
      const namedFieldType = getNamedType(field.type);
      if (isScalarType(namedFieldType) || isEnumType(namedFieldType)) {
        parts.push(fieldName);
      } else {
        const nested = buildSelectionSet(field.type, depth + 1);
        if (nested) parts.push(`${fieldName} ${nested}`);
      }
    }

    if (parts.length === 0) return null;
    return `{ ${parts.join(" ")} }`;
  }

  return null;
}

function buildDocument(
  opType: OperationType,
  fieldName: string,
  args: ArgDescriptor[],
  returnType: GraphQLOutputType,
): string {
  const opName = toPascalCase(fieldName);
  const selection = buildSelectionSet(returnType);

  const varDecls = args.map((a) => `$${a.name}: ${a.graphqlType}`);
  const varStr = varDecls.length > 0 ? `(${varDecls.join(", ")})` : "";

  const fieldArgs = args.map((a) => `${a.name}: $${a.name}`);
  const fieldArgStr = fieldArgs.length > 0 ? `(${fieldArgs.join(", ")})` : "";

  const fieldPart = selection
    ? `${fieldName}${fieldArgStr} ${selection}`
    : `${fieldName}${fieldArgStr}`;

  return `${opType} ${opName}${varStr} { ${fieldPart} }`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Extract all query/mutation/subscription operations from a GraphQLSchema. */
export function extractOperations(
  schema: GraphQLSchema,
): OperationDescriptor[] {
  const ops: OperationDescriptor[] = [];

  const roots: [string, GraphQLObjectType | null | undefined][] = [
    ["query", schema.getQueryType()],
    ["mutation", schema.getMutationType()],
    ["subscription", schema.getSubscriptionType()],
  ];

  for (const [opType, rootType] of roots) {
    if (!rootType) continue;
    const fields = rootType.getFields();

    for (const [fieldName, field] of Object.entries(fields)) {
      const args: ArgDescriptor[] = field.args.map((arg) => ({
        name: arg.name,
        graphqlType: getGraphqlTypeString(arg.type),
        parseType: getParseType(arg.type),
        description: arg.description ?? "",
        required: isNonNullType(arg.type),
      }));

      ops.push({
        operationType: opType as OperationType,
        fieldName,
        commandName: toKebabCase(fieldName),
        description: field.description ?? "",
        args,
        document: buildDocument(
          opType as OperationType,
          fieldName,
          args,
          field.type,
        ),
      });
    }
  }

  return ops;
}
