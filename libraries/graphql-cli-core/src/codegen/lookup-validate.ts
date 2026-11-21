import {
  type GraphQLNamedType,
  type GraphQLSchema,
  isInterfaceType,
  isObjectType,
} from "graphql";
import {
  type LookupCandidate,
  type LookupOverride,
  type SelectionConfig,
  CodegenError,
} from "./types.js";

function isForcedStubEntry(
  entry: LookupOverride,
): entry is { fields: string[] } {
  return typeof entry === "object" && entry !== null && "fields" in entry;
}

function validateStringLookupEntry(
  schema: GraphQLSchema,
  typeName: string,
  entry: string,
  candidates: LookupCandidate[],
): void {
  const query = schema.getQueryType();
  if (!query?.getFields()[entry]) {
    throw new CodegenError(
      `selection.lookup.${typeName}: query field "${entry}" does not exist`,
    );
  }
  if (!candidates.some((c) => c.fieldName === entry)) {
    throw new CodegenError(
      `selection.lookup.${typeName}: "${entry}" is not a valid lookup for ${typeName}`,
    );
  }
}

function validateForcedStubEntry(
  gqlType: GraphQLNamedType,
  typeName: string,
  entry: { fields: string[] },
): void {
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

export function validateLookupConfig(
  schema: GraphQLSchema,
  candidatesByType: Map<string, LookupCandidate[]>,
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
      validateStringLookupEntry(
        schema,
        typeName,
        entry,
        candidatesByType.get(typeName) ?? [],
      );
      continue;
    }
    if (isForcedStubEntry(entry)) {
      validateForcedStubEntry(gqlType, typeName, entry);
    }
  }
}