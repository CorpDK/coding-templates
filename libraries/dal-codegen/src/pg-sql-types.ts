import type { ColumnKind } from "./model.js";

/** PG types banned on the entity GraphQL surface (v1 — normalize or defer). */
export const BANNED_PG_SQL_TYPES = new Set([
  "macaddr8",
  "point",
  "line",
  "lseg",
  "box",
  "path",
  "polygon",
  "circle",
  "geometry",
  "geography",
]);

const CUSTOM_SQL_TO_KIND: Record<string, ColumnKind> = {
  citext: "citext",
  inet: "inet",
  cidr: "cidr",
  macaddr: "macaddr",
};

export function normalizePgSqlType(sqlType: string): string {
  return sqlType.toLowerCase().trim();
}

export function columnKindFromPgSqlType(sqlType: string): ColumnKind | "banned" | null {
  const key = normalizePgSqlType(sqlType);
  if (BANNED_PG_SQL_TYPES.has(key)) return "banned";
  return CUSTOM_SQL_TO_KIND[key] ?? null;
}

export function bannedPgTypeMessage(
  exportName: string,
  drizzleKey: string,
  pgType: string,
): string {
  return `Column '${exportName}.${drizzleKey}' uses PostgreSQL type '${pgType}' which is not supported on the GraphQL surface in v1. Normalize to supported scalars or remove the column. See dal-pg-type-mapping.md#postgresql-type-coverage.`;
}
