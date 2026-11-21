import {
  type GraphQLArgument,
  type GraphQLField,
  type GraphQLInputType,
  type GraphQLObjectType,
  type GraphQLSchema,
  type GraphQLOutputType,
  getNamedType,
  isEnumType,
  isInterfaceType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
  isUnionType,
} from "graphql";
import type {
  LookupCandidate,
  LookupIndex,
  LookupOverride,
  SelectionConfig,
} from "./types.js";
import { CodegenError } from "./types.js";
import { operationKey, resolveCommandNames, toKebabCase } from "./naming.js";
import type { OperationKind } from "./types.js";

function isLeafInput(type: GraphQLInputType): boolean {
  const named = getNamedType(type);
  return isScalarType(named) || isEnumType(named);
}

function unwrapToNamed(type: GraphQLOutputType | GraphQLInputType) {
  return getNamedType(type);
}

function isSingleObjectReturn(
  type: GraphQLOutputType,
): GraphQLObjectType | import("graphql").GraphQLInterfaceType | null {
  const named = unwrapToNamed(type);
  if (isObjectType(named)) return named;
  if (isInterfaceType(named)) return named;
  return null;
}

function requiredArgs(
  field: GraphQLField<unknown, unknown>,
): GraphQLArgument[] {
  return field.args.filter(
    (a) => isNonNullType(a.type) && a.defaultValue === undefined,
  );
}

function argMatchesField(
  arg: GraphQLArgument,
  objectType: GraphQLObjectType | import("graphql").GraphQLInterfaceType,
): { fieldName: string; typeName: string } | null {
  const argNamed = unwrapToNamed(arg.type);
  if (!isScalarType(argNamed) && !isEnumType(argNamed)) return null;
  const fields = objectType.getFields();
  const match = fields[arg.name];
  if (!match) return null;
  const fieldNamed = unwrapToNamed(match.type);
  if (fieldNamed.name !== argNamed.name) return null;
  return { fieldName: arg.name, typeName: fieldNamed.name };
}

function isLookupField(
  field: GraphQLField<unknown, unknown>,
): LookupCandidate | null {
  const returnObject = isSingleObjectReturn(field.type);
  if (!returnObject) return null;
  const req = requiredArgs(field);
  if (req.length === 0) return null;
  const matched: LookupCandidate["requiredArgs"] = [];
  for (const arg of req) {
    const m = argMatchesField(arg, returnObject);
    if (!m) return null;
    matched.push({
      argName: arg.name,
      fieldName: m.fieldName,
      typeName: m.typeName,
    });
  }
  return {
    fieldName: field.name,
    typeName: returnObject.name,
    requiredArgs: matched,
  };
}

function typeNameToFieldName(typeName: string): string {
  return typeName.charAt(0).toLowerCase() + typeName.slice(1);
}

export function chooseLookup(
  typeName: string,
  candidates: LookupCandidate[],
  lookupConfig: SelectionConfig["lookup"],
): LookupCandidate | null {
  if (candidates.length === 0) return null;
  const override = lookupConfig?.[typeName];
  if (typeof override === "string") {
    const found = candidates.find((c) => c.fieldName === override);
    if (!found) {
      throw new CodegenError(
        `selection.lookup.${typeName}: "${override}" is not a valid lookup field`,
      );
    }
    return found;
  }
  if (override && typeof override === "object" && "fields" in override) {
    return null;
  }

  const byTypeNamed = candidates.find(
    (c) => c.fieldName === typeNameToFieldName(typeName),
  );
  if (byTypeNamed) return byTypeNamed;

  const sorted = [...candidates].sort((a, b) => {
    const diff = a.requiredArgs.length - b.requiredArgs.length;
    if (diff !== 0) return diff;
    return a.fieldName.localeCompare(b.fieldName);
  });
  return sorted[0];
}

export function forcedStubFields(
  typeName: string,
  lookupConfig: SelectionConfig["lookup"],
): string[] | null {
  const override = lookupConfig?.[typeName];
  if (override && typeof override === "object" && "fields" in override) {
    return override.fields;
  }
  return null;
}

function interfaceLookup(
  schema: GraphQLSchema,
  type: GraphQLObjectType,
  byType: Map<string, LookupCandidate[]>,
  lookupConfig: SelectionConfig["lookup"],
): LookupCandidate | null {
  for (const iface of type.getInterfaces()) {
    const candidates = byType.get(iface.name);
    if (candidates && candidates.length > 0) {
      return chooseLookup(iface.name, candidates, lookupConfig);
    }
    if (isInterfaceType(iface)) {
      const impls = schema.getPossibleTypes(iface);
      for (const impl of impls) {
        const cands = byType.get(impl.name);
        if (cands && cands.length > 0) {
          return chooseLookup(impl.name, cands, lookupConfig);
        }
      }
    }
  }
  return null;
}

export function buildLookupIndex(
  schema: GraphQLSchema,
  commandNames: Map<string, string>,
  lookupConfig: SelectionConfig["lookup"] = {},
): LookupIndex {
  validateLookupConfig(schema, lookupConfig);

  const byType = new Map<string, LookupCandidate[]>();
  const query = schema.getQueryType();
  if (query) {
    for (const field of Object.values(query.getFields())) {
      const lookup = isLookupField(field);
      if (!lookup) continue;
      const list = byType.get(lookup.typeName) ?? [];
      list.push(lookup);
      byType.set(lookup.typeName, list);
    }
  }

  const commandByField = new Map<string, string>();
  if (query) {
    for (const field of Object.values(query.getFields())) {
      const key = operationKey("query", field.name);
      const cmd = commandNames.get(key);
      if (cmd) commandByField.set(field.name, cmd);
    }
  }

  return { byType, commandByField };
}

export function validateLookupConfig(
  schema: GraphQLSchema,
  lookupConfig: SelectionConfig["lookup"] = {},
): void {
  if (!lookupConfig) return;
  const typeMap = schema.getTypeMap();
  for (const [typeName, entry] of Object.entries(lookupConfig)) {
    const gqlType = typeMap[typeName];
    if (!gqlType) {
      throw new CodegenError(
        `selection.lookup.${typeName}: type "${typeName}" does not exist in the schema`,
      );
    }
    if (typeof entry === "string") {
      const query = schema.getQueryType();
      if (!query?.getFields()[entry]) {
        throw new CodegenError(
          `selection.lookup.${typeName}: query field "${entry}" does not exist`,
        );
      }
      const candidates = buildTypeLookups(schema).get(typeName) ?? [];
      if (!candidates.some((c) => c.fieldName === entry)) {
        throw new CodegenError(
          `selection.lookup.${typeName}: "${entry}" is not a valid lookup for ${typeName}`,
        );
      }
      continue;
    }
    if (entry && typeof entry === "object" && "fields" in entry) {
      if (!isObjectType(gqlType) && !isInterfaceType(gqlType)) {
        throw new CodegenError(
          `selection.lookup.${typeName}: forced stub fields require an object or interface type`,
        );
      }
      const fields = gqlType.getFields();
      for (const fieldName of entry.fields) {
        if (!fields[fieldName]) {
          throw new CodegenError(
            `selection.lookup.${typeName}: field "${fieldName}" does not exist on type ${typeName}`,
          );
        }
      }
    }
  }
}

function buildTypeLookups(
  schema: GraphQLSchema,
): Map<string, LookupCandidate[]> {
  const byType = new Map<string, LookupCandidate[]>();
  const query = schema.getQueryType();
  if (!query) return byType;
  for (const field of Object.values(query.getFields())) {
    const lookup = isLookupField(field);
    if (!lookup) continue;
    const list = byType.get(lookup.typeName) ?? [];
    list.push(lookup);
    byType.set(lookup.typeName, list);
  }
  return byType;
}

export function isEntityType(
  schema: GraphQLSchema,
  typeName: string,
  lookupIndex: LookupIndex,
  lookupConfig: SelectionConfig["lookup"],
): boolean {
  const forced = forcedStubFields(typeName, lookupConfig);
  if (forced) return true;
  const candidates = lookupIndex.byType.get(typeName);
  if (candidates && candidates.length > 0) return true;
  const type = schema.getType(typeName);
  if (isObjectType(type)) {
    const ifaceLookup = interfaceLookup(
      schema,
      type,
      lookupIndex.byType,
      lookupConfig,
    );
    if (ifaceLookup) return true;
  }
  return false;
}

export function resolveEntityStubFields(
  schema: GraphQLSchema,
  typeName: string,
  lookupIndex: LookupIndex,
  lookupConfig: SelectionConfig["lookup"],
): string[] {
  const forced = forcedStubFields(typeName, lookupConfig);
  if (forced) return forced;

  let candidates = lookupIndex.byType.get(typeName) ?? [];
  let chosen = chooseLookup(typeName, candidates, lookupConfig);
  if (!chosen) {
    const type = schema.getType(typeName);
    if (isObjectType(type)) {
      const iface = interfaceLookup(
        schema,
        type,
        lookupIndex.byType,
        lookupConfig,
      );
      if (iface) chosen = iface;
    }
  }
  if (!chosen) return [];
  return chosen.requiredArgs.map((a) => a.fieldName);
}

export function buildCommandNameMap(
  schema: GraphQLSchema,
  warnings: string[],
): Map<string, string> {
  const inputs: { field: string; kind: OperationKind }[] = [];
  const roots: [OperationKind, GraphQLObjectType | null | undefined][] = [
    ["query", schema.getQueryType()],
    ["mutation", schema.getMutationType()],
    ["subscription", schema.getSubscriptionType()],
  ];
  for (const [kind, root] of roots) {
    if (!root) continue;
    for (const fieldName of Object.keys(root.getFields())) {
      inputs.push({ field: fieldName, kind });
    }
  }
  return resolveCommandNames(inputs, warnings);
}

export function lookupCommandForType(
  schema: GraphQLSchema,
  typeName: string,
  lookupIndex: LookupIndex,
  lookupConfig: SelectionConfig["lookup"],
): string | null {
  let candidates = lookupIndex.byType.get(typeName) ?? [];
  let chosen = chooseLookup(typeName, candidates, lookupConfig);
  if (!chosen) {
    const type = schema.getType(typeName);
    if (isObjectType(type)) {
      chosen = interfaceLookup(schema, type, lookupIndex.byType, lookupConfig);
    }
  }
  if (!chosen) return null;
  return (
    lookupIndex.commandByField.get(chosen.fieldName) ??
    toKebabCase(chosen.fieldName)
  );
}

export function isConnectionType(
  typeName: string,
  schema: GraphQLSchema,
): boolean {
  const type = schema.getType(typeName);
  if (!isObjectType(type)) return false;
  const fields = type.getFields();
  return Boolean(fields.nodes && fields.edges && fields.pageInfo);
}

export function isConnectionField(
  schema: GraphQLSchema,
  field: GraphQLField<unknown, unknown>,
): boolean {
  const named = unwrapToNamed(field.type);
  if (!isObjectType(named)) return false;
  return isConnectionType(named.name, schema);
}
