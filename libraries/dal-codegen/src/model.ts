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

export type ColumnKind =
  | "uuid"
  | "text"
  | "varchar"
  | "boolean"
  | "timestamptz"
  | "enum"
  | "unsupported";

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
  sourceFile: string;
}

const AUDIT_COLS = ["createdAt", "updatedAt", "createdBy", "updatedBy"] as const;
const SOFT_DELETE_COLS = ["deletedAt", "deletedBy"] as const;

function inferColumnKind(columnType: string): ColumnKind {
  if (columnType === "PgUUID") return "uuid";
  if (columnType === "PgText" || columnType === "PgChar") return "text";
  if (columnType === "PgVarchar") return "varchar";
  if (columnType === "PgBoolean") return "boolean";
  if (columnType === "PgTimestamp") return "timestamptz";
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
  const nonIndex = files.filter((f) => !f.endsWith("/index.ts") && !f.endsWith("\\index.ts"));
  return nonIndex.length > 0 ? nonIndex : files;
}

async function importSchemaModule(file: string): Promise<Record<string, unknown>> {
  try {
    return (await import(pathToFileURL(file).href)) as Record<string, unknown>;
  } catch {
    const { register } = await import("tsx/esm/api");
    register();
    return (await import(pathToFileURL(file).href)) as Record<string, unknown>;
  }
}

export async function loadEntities(schemaPath: string, strict: boolean): Promise<EntityModel[]> {
  const files = collectSchemaFiles(schemaPath);
  const entities: EntityModel[] = [];

  for (const file of files) {
    const mod = await importSchemaModule(file);
    const { tableComments, columnComments } = parseCommentsFromSource(file);

    for (const [exportName, value] of Object.entries(mod)) {
      if (!isTable(value)) continue;

      const config = getTableConfig(value);
      const cols = getTableColumns(value);
      const colModels: ColumnModel[] = [];

      for (const [drizzleKey, col] of Object.entries(cols)) {
        const kind = inferColumnKind(col.columnType);
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
          const pgEnumRef = colWithEnum.enum;
          if (pgEnumRef?.enumName) {
            enumName = pgEnumNameToGraphql(pgEnumRef.enumName);
            enumValues = pgEnumRef.enumValues ?? colWithEnum.enumValues;
          }
          if (!enumName || !enumValues?.length) {
            throw new Error(
              `Column '${exportName}.${drizzleKey}' is enum but enum metadata is missing`,
            );
          }
        }
        const colWithDefault = col as typeof col & { default?: unknown; defaultFn?: unknown };
        let defaultValue: string | boolean | number | undefined;
        if (col.hasDefault && colWithDefault.default !== undefined && colWithDefault.defaultFn === undefined) {
          const dv = colWithDefault.default;
          if (typeof dv === "string" || typeof dv === "boolean" || typeof dv === "number") {
            defaultValue = dv;
          }
        }

        colModels.push({
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
        });
      }

      if (!colModels.some((c) => c.drizzleKey === "id" && c.kind === "uuid")) {
        throw new Error(`Entity '${exportName}' must have uuid 'id' primary key`);
      }

      const tableComment = tableComments.get(exportName) ?? "";
      if (strict && !tableComment) {
        throw new Error(`Missing table comment on ${exportName} (strict mode)`);
      }

      const auditProfile = inferAuditProfile(colModels);
      entities.push({
        exportName,
        tableName: config.name,
        graphqlType: toGraphqlTypeName(exportName),
        fieldBasename: toGraphqlFieldBasename(exportName),
        listField: toGraphqlListField(exportName),
        auditProfile,
        deleteStrategy: inferDeleteStrategy(colModels),
        tableComment,
        columns: colModels,
        sourceFile: file,
      });
    }
  }

  return entities.sort((a, b) => a.exportName.localeCompare(b.exportName));
}
