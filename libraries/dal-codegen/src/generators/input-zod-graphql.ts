import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFloat,
  GraphQLID,
  GraphQLInputObjectType,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLScalarType,
  GraphQLString,
  isInputObjectType,
  type GraphQLInputType,
  type GraphQLSchema,
} from "graphql";
import type { EntityModel } from "../model.js";
import { buildDalGraphQLSchema } from "./schema-builder.js";
import { DAL_SCALAR_ZOD_BY_NAME } from "./input-zod-scalars.js";

function collectInputObjectTypes(schema: GraphQLSchema): GraphQLInputObjectType[] {
  const inputs: GraphQLInputObjectType[] = [];
  for (const type of Object.values(schema.getTypeMap())) {
    if (isInputObjectType(type)) {
      inputs.push(type);
    }
  }
  return inputs.sort((a, b) => a.name.localeCompare(b.name));
}

function referencesAnyInputObject(type: GraphQLInputType): boolean {
  let current: GraphQLInputType = type;
  if (current instanceof GraphQLNonNull) current = current.ofType;
  if (current instanceof GraphQLList) {
    return referencesAnyInputObject(current.ofType);
  }
  if (current instanceof GraphQLNonNull) current = current.ofType;
  return current instanceof GraphQLInputObjectType;
}

/** Lazy-wrap inputs that nest other input objects (avoids mutual entity filter cycles). */
function needsLazyDefinition(input: GraphQLInputObjectType): boolean {
  for (const field of Object.values(input.getFields())) {
    if (referencesAnyInputObject(field.type)) return true;
  }
  return false;
}

function collectDependencyNames(
  type: GraphQLInputType,
  selfName: string,
  deps: Set<string>,
): void {
  let current: GraphQLInputType = type;
  if (current instanceof GraphQLNonNull) current = current.ofType;
  if (current instanceof GraphQLList) {
    collectDependencyNames(current.ofType, selfName, deps);
    return;
  }
  if (current instanceof GraphQLNonNull) current = current.ofType;
  if (current instanceof GraphQLInputObjectType && current.name !== selfName) {
    deps.add(current.name);
  }
}

function inputTypeDependencies(input: GraphQLInputObjectType): string[] {
  const deps = new Set<string>();
  for (const field of Object.values(input.getFields())) {
    collectDependencyNames(field.type, input.name, deps);
  }
  return [...deps];
}

function sortInputTypesTopologically(
  inputs: GraphQLInputObjectType[],
): GraphQLInputObjectType[] {
  const byName = new Map(inputs.map((t) => [t.name, t]));
  const sorted: GraphQLInputObjectType[] = [];
  const visited = new Set<string>();

  function visit(name: string): void {
    if (visited.has(name)) return;
    visited.add(name);
    const input = byName.get(name);
    if (!input) return;
    for (const dep of inputTypeDependencies(input)) {
      visit(dep);
    }
    sorted.push(input);
  }

  for (const input of inputs) {
    visit(input.name);
  }
  return sorted;
}

function scalarZodExpr(type: GraphQLScalarType): string {
  if (type === GraphQLString) return "z.string()";
  if (type === GraphQLBoolean) return "z.boolean()";
  if (type === GraphQLID) return "z.string().uuid()";
  if (type === GraphQLInt) return "zPgInt32";
  if (type === GraphQLFloat) return "zPgReal";
  const custom = DAL_SCALAR_ZOD_BY_NAME[type.name];
  if (custom) return custom;
  return "z.unknown()";
}

function typeToZodExpr(type: GraphQLInputType, lazyNames: Set<string>): string {
  let current: GraphQLInputType = type;
  if (current instanceof GraphQLNonNull) current = current.ofType;

  if (current instanceof GraphQLList) {
    let elem: GraphQLInputType = current.ofType;
    if (elem instanceof GraphQLNonNull) elem = elem.ofType;
    return `z.array(${typeToZodExpr(elem, lazyNames)})`;
  }

  if (current instanceof GraphQLEnumType) {
    const values = current.getValues().map((v) => JSON.stringify(v.name));
    return `z.enum([${values.join(", ")}])`;
  }

  if (current instanceof GraphQLInputObjectType) {
    return `${current.name}Schema`;
  }

  if (current instanceof GraphQLScalarType) {
    return scalarZodExpr(current);
  }

  return "z.unknown()";
}

function fieldZodExpr(fieldType: GraphQLInputType, lazyNames: Set<string>): string {
  let required = false;
  let current: GraphQLInputType = fieldType;
  if (current instanceof GraphQLNonNull) {
    required = true;
    current = current.ofType;
  }
  const expr = typeToZodExpr(current, lazyNames);
  return required ? expr : `${expr}.optional()`;
}

function emitInputObjectSchema(
  input: GraphQLInputObjectType,
  lazyNames: Set<string>,
): string {
  const schemaVar = `${input.name}Schema`;
  const fieldLines = Object.entries(input.getFields())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, field]) => `  ${name}: ${fieldZodExpr(field.type, lazyNames)},`)
    .join("\n");
  const objectExpr = `z.object({\n${fieldLines}\n})`;

  if (lazyNames.has(input.name)) {
    return `export const ${schemaVar}: z.ZodTypeAny = z.lazy(() => ${objectExpr});`;
  }
  return `export const ${schemaVar} = ${objectExpr};`;
}

export interface GraphqlInputZodEmit {
  schemaBlocks: string[];
  registryNames: string[];
}

/** Builds Zod schema source for every GraphQL input object in the DAL schema (except overridden names). */
export function emitGraphqlInputZodBlocks(
  entities: EntityModel[],
  skipTypeNames: ReadonlySet<string>,
): GraphqlInputZodEmit {
  const schema = buildDalGraphQLSchema(entities);
  const inputTypes = sortInputTypesTopologically(collectInputObjectTypes(schema));
  const lazyNames = new Set(
    inputTypes.filter(needsLazyDefinition).map((t) => t.name),
  );

  const schemaBlocks: string[] = [];
  const registryNames: string[] = [];

  for (const input of inputTypes) {
    if (skipTypeNames.has(input.name)) continue;
    schemaBlocks.push(emitInputObjectSchema(input, lazyNames));
    registryNames.push(input.name);
  }

  return { schemaBlocks, registryNames };
}

export function entityCreateUpdateSkipSet(entities: EntityModel[]): Set<string> {
  const skip = new Set<string>();
  for (const entity of entities) {
    skip.add(`${entity.graphqlType}CreateInput`);
    if (entity.auditProfile === "full") {
      skip.add(`${entity.graphqlType}UpdateInput`);
    }
  }
  return skip;
}
