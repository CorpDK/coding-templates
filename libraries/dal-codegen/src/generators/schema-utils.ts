import type { ColumnModel, EntityModel } from "../model.js";
import { formatValidationHint } from "../constraint-infer.js";

export function scalarForColumn(col: ColumnModel): string {
  switch (col.kind) {
    case "uuid":
      return "ID";
    case "boolean":
      return "Boolean";
    case "timestamptz":
      return "DateTime";
    case "smallint":
    case "integer":
      return "Int";
    case "float":
      return "Float";
    case "bigint":
      return "BigInt";
    case "decimal":
      return "Decimal";
    case "date":
      return "Date";
    case "timetz":
      return "TimeTz";
    case "interval":
      return "IntervalMs";
    case "enum":
      return col.enumName ?? "String";
    default:
      return "String";
  }
}

export function toSortEnumMember(graphqlName: string): string {
  return graphqlName.replace(/([A-Z])/g, "_$1").toUpperCase();
}

export function filterForColumn(col: ColumnModel): string {
  switch (col.kind) {
    case "uuid":
      return "IDFilter";
    case "boolean":
      return "BooleanFilter";
    case "timestamptz":
      return "DateTimeFilter";
    case "smallint":
    case "integer":
      return "IntFilter";
    case "float":
      return "FloatFilter";
    case "bigint":
      return "BigIntFilter";
    case "decimal":
      return "DecimalFilter";
    case "date":
      return "DateFilter";
    case "timetz":
      return "TimeTzFilter";
    case "interval":
      return "IntervalMsFilter";
    case "enum":
      return `${col.enumName}Filter`;
    default:
      return "StringFilter";
  }
}

export function columnGraphqlDescription(col: ColumnModel): string | undefined {
  const hint = formatValidationHint({
    maxLength: col.maxLength,
    minExclusive: col.minExclusive,
    minInclusive: col.minInclusive,
  });
  if (col.comment && hint) return `${col.comment} ${hint}`;
  if (hint) return hint;
  return col.comment || undefined;
}

export function visibleOutputColumns(entity: EntityModel): ColumnModel[] {
  return entity.columns.filter(
    (c) =>
      c.drizzleKey !== "deletedAt" &&
      c.drizzleKey !== "deletedBy" &&
      !c.omitFromOutput,
  );
}

export function filterableColumns(entity: EntityModel): ColumnModel[] {
  return entity.columns.filter(
    (c) => !(c.isServerManaged && c.drizzleKey !== "id") && !c.omitFromOutput,
  );
}

export function internalRecordColumns(entity: EntityModel): ColumnModel[] {
  return entity.columns.filter(
    (c) => c.drizzleKey !== "deletedAt" && c.drizzleKey !== "deletedBy",
  );
}

export function businessColumnsWithConstraints(entity: EntityModel): ColumnModel[] {
  return entity.columns.filter(
    (c) =>
      c.isBusiness &&
      (c.maxLength != null || c.minExclusive != null || c.minInclusive != null),
  );
}
