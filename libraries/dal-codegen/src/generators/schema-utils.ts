import type { ColumnModel, EntityModel } from "../model.js";

export function scalarForColumn(col: ColumnModel): string {
  switch (col.kind) {
    case "uuid":
      return "ID";
    case "boolean":
      return "Boolean";
    case "timestamptz":
      return "DateTime";
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
    case "enum":
      return `${col.enumName}Filter`;
    default:
      return "StringFilter";
  }
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
