import type { ColumnModel, EntityModel } from "../model.js";

function zodBaseForColumn(col: ColumnModel): string {
  switch (col.kind) {
    case "boolean":
      return "z.boolean()";
    case "smallint":
    case "integer":
    case "float":
      return applyNumericConstraints("z.number()", col);
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

/** Emits runtime Zod schemas for GraphQL create/update inputs (mutation layer). */
export function generateInputZodModule(entities: EntityModel[]): string {
  const schemas = entities.flatMap((entity) => {
    const lines = [entityCreateSchema(entity)];
    if (entity.auditProfile === "full") {
      lines.push(entityUpdateSchema(entity));
    }
    return lines;
  });

  const registryEntries = entities.flatMap((entity) => {
    const entries = [`  ${entity.graphqlType}CreateInput: ${entity.graphqlType}CreateInputSchema`];
    if (entity.auditProfile === "full") {
      entries.push(
        `  ${entity.graphqlType}UpdateInput: ${entity.graphqlType}UpdateInputSchema`,
      );
    }
    return entries;
  });

  return `import { z } from "zod";

${schemas.join("\n\n")}

/** Lookup by GraphQL input type name (e.g. \`ItemCreateInput\`). */
export const inputZodSchemas = {
${registryEntries.join(",\n")},
} as const;

export type InputZodSchemaName = keyof typeof inputZodSchemas;
`;
}
