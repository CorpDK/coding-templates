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

const SPEC_BUILTIN_SCALARS: Record<
  "ID" | "String" | "Int" | "Float" | "Boolean",
  string
> = {
  ID: "z.string()",
  String: "z.string()",
  Int: "z.number().int().min(-2147483648).max(2147483647)",
  Float: "z.number().finite()",
  Boolean: "z.boolean()",
};

export type BuiltinScalarName = keyof typeof SPEC_BUILTIN_SCALARS;

export interface EmitGraphqlInputZodOptions {
  /** Custom GraphQL scalar name → Zod expression source (inline or registry ref). */
  scalars?: Record<string, string>;
  builtinScalars?: Partial<Record<BuiltinScalarName, string>>;
  skipTypeNames?: ReadonlySet<string>;
  /** Extra import lines prepended before schema blocks in `schemaBlocks`. */
  preamble?: string;
  /** `registry` emits `scalarZodSchemas.Name`; `inline` repeats expressions (DAL passes inline). */
  scalarReferences?: "registry" | "inline";
}

export interface GraphqlInputZodEmit {
  schemaBlocks: string[];
  registryNames: string[];
  /** Present when `scalarReferences: "registry"`. */
  scalarRegistryBlocks?: string[];
  scalarRegistryNames?: string[];
}

type ScalarFieldEmitOptions = Required<
  Pick<
    EmitGraphqlInputZodOptions,
    "scalars" | "builtinScalars" | "scalarReferences"
  >
>;

function collectInputObjectTypes(
  schema: GraphQLSchema,
): GraphQLInputObjectType[] {
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

function builtinScalarZodExpr(
  type: GraphQLScalarType,
  builtinScalars: Partial<Record<BuiltinScalarName, string>>,
): string | null {
  if (type === GraphQLString)
    return builtinScalars.String ?? SPEC_BUILTIN_SCALARS.String;
  if (type === GraphQLBoolean)
    return builtinScalars.Boolean ?? SPEC_BUILTIN_SCALARS.Boolean;
  if (type === GraphQLID) return builtinScalars.ID ?? SPEC_BUILTIN_SCALARS.ID;
  if (type === GraphQLInt)
    return builtinScalars.Int ?? SPEC_BUILTIN_SCALARS.Int;
  if (type === GraphQLFloat)
    return builtinScalars.Float ?? SPEC_BUILTIN_SCALARS.Float;
  return null;
}

function scalarZodExpr(
  type: GraphQLScalarType,
  options: ScalarFieldEmitOptions,
): string {
  const builtin = builtinScalarZodExpr(type, options.builtinScalars);
  if (builtin) return builtin;
  const custom = options.scalars[type.name];
  if (custom) {
    if (options.scalarReferences === "registry") {
      return `scalarZodSchemas.${type.name}`;
    }
    return custom;
  }
  return "z.unknown()";
}

function typeToZodExpr(
  type: GraphQLInputType,
  lazyNames: Set<string>,
  options: ScalarFieldEmitOptions,
): string {
  let current: GraphQLInputType = type;
  if (current instanceof GraphQLNonNull) current = current.ofType;

  if (current instanceof GraphQLList) {
    let elem: GraphQLInputType = current.ofType;
    if (elem instanceof GraphQLNonNull) elem = elem.ofType;
    return `z.array(${typeToZodExpr(elem, lazyNames, options)})`;
  }

  if (current instanceof GraphQLEnumType) {
    const values = current.getValues().map((v) => JSON.stringify(v.name));
    return `z.enum([${values.join(", ")}])`;
  }

  if (current instanceof GraphQLInputObjectType) {
    return `${current.name}Schema`;
  }

  if (current instanceof GraphQLScalarType) {
    return scalarZodExpr(current, options);
  }

  return "z.unknown()";
}

function fieldZodExpr(
  fieldType: GraphQLInputType,
  lazyNames: Set<string>,
  options: ScalarFieldEmitOptions,
): string {
  let required = false;
  let current: GraphQLInputType = fieldType;
  if (current instanceof GraphQLNonNull) {
    required = true;
    current = current.ofType;
  }
  const expr = typeToZodExpr(current, lazyNames, options);
  return required ? expr : `${expr}.optional()`;
}

function emitInputObjectSchema(
  input: GraphQLInputObjectType,
  lazyNames: Set<string>,
  options: ScalarFieldEmitOptions,
): string {
  const schemaVar = `${input.name}Schema`;
  const fieldLines = Object.entries(input.getFields())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([name, field]) =>
        `  ${name}: ${fieldZodExpr(field.type, lazyNames, options)},`,
    )
    .join("\n");
  const objectExpr = `z.object({\n${fieldLines}\n})`;

  if (lazyNames.has(input.name)) {
    return `export const ${schemaVar}: z.ZodTypeAny = z.lazy(() => ${objectExpr});`;
  }
  return `export const ${schemaVar} = ${objectExpr};`;
}

/** Builds Zod schema source for GraphQL input object types in a schema. */
export function emitGraphqlInputZodBlocks(
  schema: GraphQLSchema,
  options: EmitGraphqlInputZodOptions = {},
): GraphqlInputZodEmit {
  const resolved = {
    scalars: options.scalars ?? {},
    builtinScalars: options.builtinScalars ?? {},
    scalarReferences: options.scalarReferences ?? "registry",
  };
  const skipTypeNames = options.skipTypeNames ?? new Set<string>();

  const inputTypes = sortInputTypesTopologically(
    collectInputObjectTypes(schema),
  );
  const lazyNames = new Set(
    inputTypes.filter(needsLazyDefinition).map((t) => t.name),
  );

  const schemaBlocks: string[] = [];
  if (options.preamble?.trim()) {
    schemaBlocks.push(options.preamble.trim());
  }
  const registryNames: string[] = [];

  for (const input of inputTypes) {
    if (skipTypeNames.has(input.name)) continue;
    schemaBlocks.push(emitInputObjectSchema(input, lazyNames, resolved));
    registryNames.push(input.name);
  }

  if (
    resolved.scalarReferences === "registry" &&
    Object.keys(resolved.scalars).length > 0
  ) {
    const scalarRegistryNames = Object.keys(resolved.scalars).sort((a, b) =>
      a.localeCompare(b),
    );
    const scalarEntries = scalarRegistryNames.map(
      (name) => `  ${name}: ${resolved.scalars[name]},`,
    );
    const scalarRegistryBlocks = [
      `export const scalarZodSchemas = {\n${scalarEntries.join("\n")}\n} as const;`,
      "export type ScalarZodSchemaName = keyof typeof scalarZodSchemas;",
    ];
    return {
      schemaBlocks,
      registryNames,
      scalarRegistryBlocks,
      scalarRegistryNames,
    };
  }

  return { schemaBlocks, registryNames };
}
