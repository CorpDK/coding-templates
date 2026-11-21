import {
  type GraphQLArgument,
  type GraphQLInputType,
  type GraphQLSchema,
  getNamedType,
  isEnumType,
  isInputObjectType,
  isListType,
  isNonNullType,
  isScalarType,
} from "graphql";
import type {
  ArgDescriptor,
  ExtractedOperation,
  IncludeExcludeConfig,
  LookupIndex,
  OperationKind,
  SelectionConfig,
} from "./types.js";
import {
  fieldIncluded,
  isDestructiveMutation,
  operationKey,
  resolveReservedArgFlag,
} from "./naming.js";
import { isConnectionField } from "./lookup-index.js";
import { emitSelectionForOperation } from "./selection.js";

const BUILTIN_SCALARS = new Set(["String", "Int", "Float", "Boolean", "ID"]);

function graphqlTypeString(type: GraphQLInputType): string {
  if (isNonNullType(type)) return `${graphqlTypeString(type.ofType)}!`;
  if (isListType(type)) return `[${graphqlTypeString(type.ofType)}]`;
  return (type as { name: string }).name;
}

function describeArg(arg: GraphQLArgument, warnings: string[]): ArgDescriptor {
  const named = getNamedType(arg.type);
  let kind: ArgDescriptor["kind"] = "scalar";
  if (isEnumType(named)) kind = "enum";
  else if (isInputObjectType(named)) kind = "input";

  const flag = resolveReservedArgFlag(arg.name, warnings);

  const desc: ArgDescriptor = {
    name: arg.name,
    flag,
    graphqlType: graphqlTypeString(arg.type),
    kind,
    list: Boolean(
      isListType(arg.type) ||
      (isNonNullType(arg.type) && isListType(arg.type.ofType)),
    ),
    required: isNonNullType(arg.type) && arg.defaultValue === undefined,
    description: arg.description ?? undefined,
  };

  if (arg.defaultValue !== undefined) {
    desc.defaultValue = arg.defaultValue;
  }

  if (isEnumType(named)) {
    desc.enumValues = named.getValues().map((v) => v.name);
  }

  if (isInputObjectType(named)) {
    desc.inputZodSchemaName = named.name;
  }

  if (isScalarType(named) && !BUILTIN_SCALARS.has(named.name)) {
    desc.scalarZodSchemaName = named.name;
    desc.scalarWire = "string";
  }

  return desc;
}

function detectPagination(
  schema: GraphQLSchema,
  field: import("graphql").GraphQLField<unknown, unknown>,
  connection: "nodes" | "edges",
): ExtractedOperation["paginated"] {
  if (!isConnectionField(schema, field)) return undefined;
  const names = new Set(field.args.map((a) => a.name));
  const forward = names.has("first") || names.has("after");
  const backward = names.has("last") || names.has("before");
  let direction: "forward" | "backward" | "both" = "forward";
  if (forward && backward) direction = "both";
  else if (backward && !forward) direction = "backward";
  return { direction, nodes: connection };
}

export function extractOperations(
  schema: GraphQLSchema,
  lookupIndex: LookupIndex,
  commandNames: Map<string, string>,
  options: {
    selection?: SelectionConfig;
    include?: IncludeExcludeConfig;
    exclude?: IncludeExcludeConfig;
    guard?: { destructive?: string[] };
  } = {},
): ExtractedOperation[] {
  const include = options.include ?? {
    queries: [],
    mutations: [],
    subscriptions: [],
  };
  const exclude = options.exclude ?? {
    queries: [],
    mutations: [],
    subscriptions: [],
  };
  const selection = options.selection ?? { policy: "relation-ids" as const };
  const destructivePatterns = options.guard?.destructive;

  const ops: ExtractedOperation[] = [];

  const roots: [OperationKind, ReturnType<GraphQLSchema["getQueryType"]>][] = [
    ["query", schema.getQueryType()],
    ["mutation", schema.getMutationType()],
    ["subscription", schema.getSubscriptionType()],
  ];

  for (const [kind, root] of roots) {
    if (!root) continue;
    for (const [fieldName, field] of Object.entries(root.getFields())) {
      if (!fieldIncluded(fieldName, kind, include, exclude)) continue;

      const cmd =
        commandNames.get(operationKey(kind, fieldName)) ??
        fieldName.replaceAll(/([A-Z])/g, "-$1").toLowerCase();

      const argWarnings: string[] = [];
      const args = field.args.map((a) => describeArg(a, argWarnings));

      const {
        selection: sel,
        followUps,
        warnings: selWarnings,
      } = emitSelectionForOperation(
        schema,
        lookupIndex,
        fieldName,
        field.type,
        selection,
      );

      const destructive =
        kind === "mutation" &&
        isDestructiveMutation(fieldName, destructivePatterns);

      const paginated =
        kind === "query"
          ? detectPagination(schema, field, selection.connection ?? "nodes")
          : undefined;

      ops.push({
        kind,
        field: fieldName,
        command: cmd,
        description: field.description ?? undefined,
        deprecated: field.deprecationReason ?? undefined,
        destructive,
        paginated,
        args,
        returnType: field.type,
        selection: sel,
        followUps,
        warnings: [...argWarnings, ...selWarnings],
      });
    }
  }

  return ops;
}
