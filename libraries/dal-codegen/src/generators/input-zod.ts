import type { ColumnModel, EntityModel } from "../model.js";
import {
  emitGraphqlInputZodBlocks,
  entityCreateUpdateSkipSet,
} from "./input-zod-graphql.js";
import {
  dalScalarZodExprForColumnKind,
  INPUT_ZOD_DAL_SCALAR_IMPORT,
} from "./input-zod-scalars.js";

const NUMERIC_DAL_SCALAR_KINDS = new Set<ColumnModel["kind"]>([
  "smallint",
  "double",
  "decimal",
]);

function zodBaseForColumn(col: ColumnModel): string {
  const scalarExpr = dalScalarZodExprForColumnKind(col.kind);
  if (scalarExpr) {
    if (NUMERIC_DAL_SCALAR_KINDS.has(col.kind)) {
      return applyNumericConstraints(scalarExpr, col);
    }
    if (col.kind === "citext") {
      return applyStringConstraints(scalarExpr, col);
    }
    return scalarExpr;
  }
  switch (col.kind) {
    case "boolean":
      return "z.boolean()";
    case "integer":
      return applyNumericConstraints("zPgInt32", col);
    case "real":
      return applyNumericConstraints("zPgReal", col);
    case "enum":
      if (col.enumValues?.length) {
        return `z.enum([${col.enumValues.map((v) => JSON.stringify(v)).join(", ")}])`;
      }
      return "z.string()";
    case "uuid":
      return applyStringConstraints("z.string().uuid()", col);
    default:
      return applyStringConstraints("z.string()", col);
  }
}

function applyStringConstraints(base: string, col: ColumnModel): string {
  let schema = base;
  if (col.minLength != null) schema += `.min(${col.minLength})`;
  if (col.maxLength != null) schema += `.max(${col.maxLength})`;
  return schema;
}

function applyNumericConstraints(base: string, col: ColumnModel): string {
  let schema = base;
  if (col.minInclusive != null) schema += `.min(${col.minInclusive})`;
  if (col.minExclusive != null) schema += `.gt(${col.minExclusive})`;
  return schema;
}

function createFieldSchema(col: ColumnModel): string {
  const base = zodBaseForColumn(col);
  const required = col.notNull && !col.hasDefault;
  if (required) return base;
  if (!col.notNull) {
    return `z.union([${base}, z.null()]).optional()`;
  }
  return `${base}.optional()`;
}

function updateFieldSchema(col: ColumnModel): string {
  const base = zodBaseForColumn(col);
  if (!col.notNull) {
    return `z.union([${base}, z.null()]).optional()`;
  }
  return `${base}.optional()`;
}

function entityCreateSchema(entity: EntityModel): string {
  const businessCols = entity.columns.filter((c) => c.isBusiness);
  const fields = businessCols
    .map((col) => `  ${col.graphqlName}: ${createFieldSchema(col)},`)
    .join("\n");
  return `export const ${entity.graphqlType}CreateInputSchema = z.object({\n${fields}\n});`;
}

function entityUpdateSchema(entity: EntityModel): string {
  const businessCols = entity.columns.filter((c) => c.isBusiness);
  const fields = businessCols
    .map((col) => `  ${col.graphqlName}: ${updateFieldSchema(col)},`)
    .join("\n");
  return `export const ${entity.graphqlType}UpdateInputSchema = z.object({\n${fields}\n});`;
}

function entityInputSchemas(entities: EntityModel[]): {
  blocks: string[];
  registryNames: string[];
} {
  const blocks: string[] = [];
  const registryNames: string[] = [];

  for (const entity of entities) {
    blocks.push(entityCreateSchema(entity));
    registryNames.push(`${entity.graphqlType}CreateInput`);
    if (entity.auditProfile === "full") {
      blocks.push(entityUpdateSchema(entity));
      registryNames.push(`${entity.graphqlType}UpdateInput`);
    }
  }

  return { blocks, registryNames };
}

/** Emits runtime Zod schemas for all DAL GraphQL input object types. */
export function generateInputZodModule(entities: EntityModel[]): string {
  const skip = entityCreateUpdateSkipSet(entities);
  const entityPart = entityInputSchemas(entities);
  const graphqlPart = emitGraphqlInputZodBlocks(entities, skip);

  const allRegistryNames = [...entityPart.registryNames, ...graphqlPart.registryNames].sort(
    (a, b) => a.localeCompare(b),
  );

  const registryEntries = allRegistryNames.map(
    (name) => `  ${name}: ${name}Schema`,
  );

  const schemaBlocks = [...entityPart.blocks, ...graphqlPart.schemaBlocks];

  return `${INPUT_ZOD_DAL_SCALAR_IMPORT}
import { GraphQLError } from "graphql";
import { z, type ZodError, type ZodType } from "zod";

${schemaBlocks.join("\n\n")}

/** Lookup by GraphQL input type name (e.g. \`ItemCreateInput\`, \`ItemFilter\`). */
export const inputZodSchemas = {
${registryEntries.join(",\n")},
} as const;

export type InputZodSchemaName = keyof typeof inputZodSchemas;

export type GraphqlInputParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; userErrors: MutationUserError[] };

function zodErrorToUserErrors(error: ZodError): MutationUserError[] {
  return error.issues.map((issue) =>
    createUserError("VALIDATION_FAILED", issue.message, {
      field: issue.path.length > 0 ? issue.path.map(String) : undefined,
    }),
  );
}

export function safeParseGraphqlInput<TName extends InputZodSchemaName>(
  schemaName: TName,
  value: unknown,
): GraphqlInputParseResult<
  ReturnType<(typeof inputZodSchemas)[TName]["parse"]>
> {
  const result = inputZodSchemas[schemaName].safeParse(value);
  if (result.success) {
    return { ok: true, data: result.data as ReturnType<(typeof inputZodSchemas)[TName]["parse"]> };
  }
  return { ok: false, userErrors: zodErrorToUserErrors(result.error) };
}

export function safeParseGraphqlInputList<TName extends InputZodSchemaName>(
  schemaName: TName,
  value: unknown,
): GraphqlInputParseResult<
  ReturnType<(typeof inputZodSchemas)[TName]["parse"]>[]
> {
  const result = z.array(inputZodSchemas[schemaName]).safeParse(value);
  if (result.success) {
    return {
      ok: true,
      data: result.data as ReturnType<(typeof inputZodSchemas)[TName]["parse"]>[],
    };
  }
  return { ok: false, userErrors: zodErrorToUserErrors(result.error) };
}

export function safeParseOptionalGraphqlInput<TName extends InputZodSchemaName>(
  schemaName: TName,
  value: unknown,
): GraphqlInputParseResult<
  ReturnType<(typeof inputZodSchemas)[TName]["parse"]> | undefined
> {
  if (value === undefined || value === null) {
    return { ok: true, data: undefined };
  }
  return safeParseGraphqlInput(schemaName, value);
}

export function safeParseOptionalGraphqlInputList<TName extends InputZodSchemaName>(
  schemaName: TName,
  value: unknown,
): GraphqlInputParseResult<
  ReturnType<(typeof inputZodSchemas)[TName]["parse"]>[] | undefined
> {
  if (value === undefined || value === null) {
    return { ok: true, data: undefined };
  }
  return safeParseGraphqlInputList(schemaName, value);
}

export function unwrapGraphqlInputParseResult<T>(
  result: GraphqlInputParseResult<T>,
): T {
  if (result.ok) return result.data;
  throw new GraphQLError(
    result.userErrors.map((err) => err.message).join("; "),
    {
      extensions: {
        code: "BAD_USER_INPUT",
        userErrors: result.userErrors,
      },
    },
  );
}

export function parseGraphqlInput<TName extends InputZodSchemaName>(
  schemaName: TName,
  value: unknown,
): ReturnType<(typeof inputZodSchemas)[TName]["parse"]> {
  const schema = inputZodSchemas[schemaName] as ZodType;
  return schema.parse(value) as ReturnType<(typeof inputZodSchemas)[TName]["parse"]>;
}

/** Parse an optional GraphQL input; returns undefined when value is null or omitted. */
export function parseOptionalGraphqlInput<TName extends InputZodSchemaName>(
  schemaName: TName,
  value: unknown,
): ReturnType<(typeof inputZodSchemas)[TName]["parse"]> | undefined {
  if (value === undefined || value === null) return undefined;
  return parseGraphqlInput(schemaName, value);
}

/** Parse a list argument whose elements use a registered input schema. */
export function parseGraphqlInputList<TName extends InputZodSchemaName>(
  schemaName: TName,
  value: unknown,
): ReturnType<(typeof inputZodSchemas)[TName]["parse"]>[] | undefined {
  if (value === undefined || value === null) return undefined;
  return z.array(inputZodSchemas[schemaName]).parse(value) as ReturnType<
    (typeof inputZodSchemas)[TName]["parse"]
  >[];
}
`;
}
