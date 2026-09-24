import { readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { getTableColumns, isTable } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import type { AuditProfile, DeleteStrategy } from "@corpdk/dal-core";
import {
  toGraphqlFieldBasename,
  toGraphqlFieldName,
  toGraphqlListField,
  toGraphqlTypeName,
} from "@corpdk/dal-core";
import { parseCommentsFromSource } from "./comments.js";
import {
  inferCheckConstraintsForTable,
  inferLengthConstraint,
} from "./constraint-infer.js";
import { attachRelations } from "./relations.js";

export type ColumnKind =
  | "uuid"
  | "text"
  | "varchar"
  | "boolean"
  | "timestamptz"
  | "enum"
  | "smallint"
  | "integer"
  | "bigint"
  | "decimal"
  | "float"
  | "date"
  | "timetz"
  | "interval"
  | "unsupported";

export type RelationKind = "many-to-one" | "one-to-many" | "many-to-many" | "one-to-one";

export interface RelationModel {
  fieldName: string;
  kind: RelationKind;
  targetExportName: string;
  targetGraphqlType: string;
  ownerFkDrizzleKey?: string;
  ownerFkGraphqlName?: string;
  childFkDrizzleKey?: string;
  joinTableExportName?: string;
  joinOwnerFkDrizzleKey?: string;
  joinTargetFkDrizzleKey?: string;
  filterable: boolean;
  navigationList: boolean;
  navigationNullable: boolean;
}

export interface ColumnModel {
  drizzleKey: string;
  physicalName: string;
  graphqlName: string;
  kind: ColumnKind;
  notNull: boolean;
  hasDefault: boolean;
  /** Static Drizzle `.default()` value when inferrable (enum/string/boolean). */
  defaultValue?: string | boolean | number;
  comment: string;
  enumName?: string;
  enumValues?: string[];
  /** Audit / soft-delete / server-managed columns excluded from create/update inputs. */
  isServerManaged: boolean;
  isBusiness: boolean;
  /** FK scalars omitted from GraphQL output (Phase 2 — §2.7). */
  omitFromOutput?: boolean;
  maxLength?: number;
  minExclusive?: number;
  minInclusive?: number;
}

export interface EntityModel {
  exportName: string;
  tableName: string;
  graphqlType: string;
  fieldBasename: string;
  listField: string;
  auditProfile: AuditProfile;
  deleteStrategy: DeleteStrategy;
  tableComment: string;
  columns: ColumnModel[];
  relations: RelationModel[];
  sourceFile: string;
}

const AUDIT_COLS = ["createdAt", "updatedAt", "createdBy", "updatedBy"] as const;
const SOFT_DELETE_COLS = ["deletedAt", "deletedBy"] as const;

interface DrizzleColumnWithTz {
  withTimezone?: boolean;
}

const SIMPLE_PG_COLUMN_KINDS: Record<string, ColumnKind> = {
  PgUUID: "uuid",
  PgText: "text",
  PgChar: "text",
  PgVarchar: "varchar",
  PgBoolean: "boolean",
  PgSmallInt: "smallint",
  PgInteger: "integer",
  PgBigInt53: "bigint",
  PgBigInt64: "bigint",
  PgNumeric: "decimal",
  PgReal: "float",
  PgDoublePrecision: "float",
  PgDateString: "date",
  PgDate: "date",
  PgInterval: "interval",
};

function requireWithTimezone(
  exportName: string,
  drizzleKey: string,
  col: DrizzleColumnWithTz,
  pgTypeLabel: string,
  expectedType: string,
): void {
  if (!col.withTimezone) {
    throw new Error(
      `Column '${exportName}.${drizzleKey}' uses ${pgTypeLabel} without time zone — use ${expectedType} only.`,
    );
  }
}

function inferColumnKind(
  exportName: string,
  drizzleKey: string,
  col: { columnType: string } & DrizzleColumnWithTz,
): ColumnKind {
  const columnType = col.columnType;
  const simple = SIMPLE_PG_COLUMN_KINDS[columnType];
  if (simple) return simple;
  if (columnType === "PgMoney") {
    throw new Error(
      `Column '${exportName}.${drizzleKey}' uses banned PostgreSQL type 'money'. Use integer cents or numeric/decimal.`,
    );
  }
  if (columnType === "PgTimestamp") {
    requireWithTimezone(exportName, drizzleKey, col, "timestamp", "timestamptz");
    return "timestamptz";
  }
  if (columnType === "PgTime") {
    requireWithTimezone(exportName, drizzleKey, col, "time", "timetz");
    return "timetz";
  }
  if (columnType.startsWith("PgEnum")) return "enum";
  return "unsupported";
}

/** Map PostgreSQL enum name (snake_case) to GraphQL PascalCase type. */
function pgEnumNameToGraphql(enumName: string): string {
  return enumName
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

interface DrizzlePgEnumRef {
  enumName?: string;
  enumValues?: string[];
}

interface DrizzleColumnWithEnum {
  enum?: DrizzlePgEnumRef;
  enumValues?: string[];
}

function inferAuditProfile(columns: ColumnModel[]): AuditProfile {
  const keys = new Set(columns.map((c) => c.drizzleKey));
  const has = (k: string) => keys.has(k);
  if (AUDIT_COLS.every(has)) return "full";
  if (has("createdAt") && has("createdBy") && !has("updatedAt") && !has("updatedBy")) {
    return "append-only";
  }
  throw new Error(
    `Invalid audit profile — requires full (createdAt, updatedAt, createdBy, updatedBy) or append-only (createdAt, createdBy only)`,
  );
}

function inferDeleteStrategy(columns: ColumnModel[]): DeleteStrategy {
  return columns.some((c) => c.drizzleKey === "deletedAt") ? "soft" : "hard";
}

function isServerManaged(drizzleKey: string): boolean {
  return (
    drizzleKey === "id" ||
    AUDIT_COLS.includes(drizzleKey as (typeof AUDIT_COLS)[number]) ||
    SOFT_DELETE_COLS.includes(drizzleKey as (typeof SOFT_DELETE_COLS)[number])
  );
}

export function collectSchemaFiles(schemaPath: string): string[] {
  const st = statSync(schemaPath);
  if (st.isFile()) return [schemaPath];
  const files = readdirSync(schemaPath)
    .filter((f: string) => extname(f) === ".ts" && !f.endsWith(".d.ts"))
    .map((f: string) => join(schemaPath, f));
  const nonIndex = files.filter(
    (f) => !f.endsWith("/index.ts") && !f.endsWith(String.raw`\index.ts`),
  );
  return nonIndex.length > 0 ? nonIndex : files;
}

export async function importSchemaModule(file: string): Promise<Record<string, unknown>> {
  try {
    return (await import(pathToFileURL(file).href)) as Record<string, unknown>;
  } catch {
    const { register } = await import("tsx/esm/api");
    register();
    return (await import(pathToFileURL(file).href)) as Record<string, unknown>;
  }
}

function inferEnumMetadata(
  exportName: string,
  drizzleKey: string,
  col: DrizzleColumnWithEnum,
): { enumName: string; enumValues: string[] } {
  const pgEnumRef = col.enum;
  const enumName = pgEnumRef?.enumName ? pgEnumNameToGraphql(pgEnumRef.enumName) : undefined;
  const enumValues = pgEnumRef?.enumValues ?? col.enumValues;
  if (!enumName || !enumValues?.length) {
    throw new Error(`Column '${exportName}.${drizzleKey}' is enum but enum metadata is missing`);
  }
  return { enumName, enumValues };
}

function inferStaticDefault(col: {
  hasDefault: boolean;
  default?: unknown;
  defaultFn?: unknown;
}): string | boolean | number | undefined {
  if (!col.hasDefault || col.default === undefined || col.defaultFn !== undefined) {
    return undefined;
  }
  const dv = col.default;
  if (typeof dv === "string" || typeof dv === "boolean" || typeof dv === "number") {
    return dv;
  }
  return undefined;
}

function buildColumnModel(
  exportName: string,
  drizzleKey: string,
  col: ReturnType<typeof getTableColumns>[string],
  strict: boolean,
  columnComments: Map<string, Map<string, string>>,
  checkConstraints: Map<string, { minExclusive?: number; minInclusive?: number }>,
): ColumnModel {
  const kind = inferColumnKind(exportName, drizzleKey, col);
  if (kind === "unsupported") {
    throw new Error(
      `Column '${exportName}.${drizzleKey}' uses unsupported type '${col.columnType}'. See dal-pg-type-mapping.md`,
    );
  }
  const comment = columnComments.get(exportName)?.get(drizzleKey) ?? "";
  if (strict && !comment) {
    throw new Error(`Missing comment on ${exportName}.${drizzleKey} (strict mode)`);
  }
  const colWithEnum = col as typeof col & DrizzleColumnWithEnum;
  let enumName: string | undefined;
  let enumValues: string[] | undefined;
  if (kind === "enum") {
    ({ enumName, enumValues } = inferEnumMetadata(exportName, drizzleKey, colWithEnum));
  }
  const colWithDefault = col as typeof col & { default?: unknown; defaultFn?: unknown };
  const defaultValue = inferStaticDefault(colWithDefault);
  const lengthMeta = inferLengthConstraint(col);
  const checkMeta = checkConstraints.get(drizzleKey);
  return {
    drizzleKey,
    physicalName: col.name,
    graphqlName: toGraphqlFieldName(drizzleKey, col.name),
    kind,
    notNull: col.notNull,
    hasDefault: col.hasDefault,
    defaultValue,
    comment,
    enumName,
    enumValues,
    isServerManaged: isServerManaged(drizzleKey),
    isBusiness: !isServerManaged(drizzleKey),
    maxLength: lengthMeta,
    minExclusive: checkMeta?.minExclusive,
    minInclusive: checkMeta?.minInclusive,
  };
}

function buildEntityFromTable(
  exportName: string,
  value: unknown,
  file: string,
  strict: boolean,
  tableComments: Map<string, string>,
  columnComments: Map<string, Map<string, string>>,
): EntityModel {
  const config = getTableConfig(value as Parameters<typeof getTableConfig>[0]);
  const cols = getTableColumns(value as Parameters<typeof getTableColumns>[0]);
  const checkConstraints = inferCheckConstraintsForTable(config.checks, Object.keys(cols));
  const colModels = Object.entries(cols).map(([drizzleKey, col]) =>
    buildColumnModel(exportName, drizzleKey, col, strict, columnComments, checkConstraints),
  );
  if (!colModels.some((c) => c.drizzleKey === "id" && c.kind === "uuid")) {
    throw new Error(`Entity '${exportName}' must have uuid 'id' primary key`);
  }
  const tableComment = tableComments.get(exportName) ?? "";
  if (strict && !tableComment) {
    throw new Error(`Missing table comment on ${exportName} (strict mode)`);
  }
  const auditProfile = inferAuditProfile(colModels);
  return {
    exportName,
    tableName: config.name,
    graphqlType: toGraphqlTypeName(exportName),
    fieldBasename: toGraphqlFieldBasename(exportName),
    listField: toGraphqlListField(exportName),
    auditProfile,
    deleteStrategy: inferDeleteStrategy(colModels),
    tableComment,
    columns: colModels,
    relations: [],
    sourceFile: file,
  };
}

export async function loadEntities(schemaPath: string, strict: boolean): Promise<EntityModel[]> {
  const files = collectSchemaFiles(schemaPath);
  const entities: EntityModel[] = [];
  const schemaModules: Record<string, unknown>[] = [];

  for (const file of files) {
    const mod = await importSchemaModule(file);
    schemaModules.push(mod);
    const { tableComments, columnComments } = parseCommentsFromSource(file);

    for (const [exportName, value] of Object.entries(mod)) {
      if (!isTable(value)) continue;
      entities.push(buildEntityFromTable(exportName, value, file, strict, tableComments, columnComments));
    }
  }

  attachRelations(entities, schemaModules);
  return entities.sort((a, b) => a.exportName.localeCompare(b.exportName));
}
