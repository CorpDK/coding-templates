import { and, eq, exists, not, notExists, sql, type SQL } from "drizzle-orm";
import type { Column, Table } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import {
  buildBooleanFilter,
  buildBigIntFilter,
  buildDateFilter,
  buildDateTimeFilter,
  buildDecimalFilter,
  buildEnumFilter,
  buildFloatFilter,
  buildIdFilter,
  buildIntFilter,
  buildIntervalMsFilter,
  buildStringFilter,
  buildTimeTzFilter,
  combineLogical,
  validateFilterBudget,
  type FilterBudgetLimits,
} from "./filters.js";
import type { FilterAST } from "./filter-ast.js";
import { extractAssociationFilter, scalarFilterKeys } from "./filter-ast.js";

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
  | "interval";

export interface ColumnDescriptor {
  graphqlName: string;
  drizzleKey: string;
  kind: ColumnKind;
  column: Column;
}

export type RelationKind = "many-to-one" | "one-to-many" | "many-to-many" | "one-to-one";

export interface RelationDescriptor {
  fieldName: string;
  kind: RelationKind;
  /** Owner-side FK column on source entity (M:1 / 1:1). */
  ownerFkDrizzleKey?: string;
  /** Child-side FK column on target entity (1:M). */
  childFkDrizzleKey?: string;
  /** Join-table owner FK (M side of M:N). */
  joinOwnerFkDrizzleKey?: string;
  /** Join-table target FK (N side of M:N). */
  joinTargetFkDrizzleKey?: string;
  targetTable: Table;
  targetColumns: ColumnDescriptor[];
  /** Child/join table for 1:M and M:N association filters. */
  childTable?: Table;
  childColumns?: ColumnDescriptor[];
  joinTable?: Table;
  joinColumns?: ColumnDescriptor[];
  filterable: boolean;
}

export interface QueryTranslatorConfig {
  db: PgDatabase<any, any>;
  table: Table;
  columns: ColumnDescriptor[];
  relations: RelationDescriptor[];
  softDelete: boolean;
  filterBudget: FilterBudgetLimits;
}

function filterBuilderForKind(kind: ColumnKind) {
  switch (kind) {
    case "boolean":
      return buildBooleanFilter;
    case "timestamptz":
      return buildDateTimeFilter;
    case "uuid":
      return buildIdFilter;
    case "enum":
      return buildEnumFilter;
    case "smallint":
    case "integer":
      return buildIntFilter;
    case "float":
      return buildFloatFilter;
    case "bigint":
      return buildBigIntFilter;
    case "decimal":
      return buildDecimalFilter;
    case "date":
      return buildDateFilter;
    case "timetz":
      return buildTimeTzFilter;
    case "interval":
      return buildIntervalMsFilter;
    default:
      return buildStringFilter;
  }
}

export class QueryTranslator {
  private readonly columnByGraphql = new Map<string, ColumnDescriptor>();
  private readonly relationByField = new Map<string, RelationDescriptor>();

  constructor(private readonly config: QueryTranslatorConfig) {
    for (const col of config.columns) {
      this.columnByGraphql.set(col.graphqlName, col);
    }
    for (const rel of config.relations) {
      this.relationByField.set(rel.fieldName, rel);
    }
  }

  translateFilter(
    filter: FilterAST | null | undefined,
    includeDeleted?: boolean | null,
    /** When translating nested filters, skip soft-delete guard on root. */
    nested = false,
  ): SQL | undefined {
    validateFilterBudget(filter, this.config.filterBudget);
    const parts: SQL[] = [];

    if (!nested && this.config.softDelete && !includeDeleted) {
      const deletedAt = (this.config.table as unknown as Record<string, Column>).deletedAt;
      if (deletedAt) {
        parts.push(sql`${deletedAt} IS NULL`);
      }
    }

    const leaf = (node: FilterAST): SQL | undefined => this.translateLeaf(node);
    const logical = combineLogical(filter, leaf);
    if (logical) parts.push(logical);

    if (parts.length === 0) return undefined;
    return parts.length === 1 ? parts[0] : and(...parts)!;
  }

  private translateLeaf(node: FilterAST): SQL | undefined {
    const parts: SQL[] = [];

    for (const key of scalarFilterKeys(node)) {
      const col = this.columnByGraphql.get(key);
      if (!col) continue;
      const builder = filterBuilderForKind(col.kind);
      const part = builder(col.column, node[key] as never);
      if (part) parts.push(part);
    }

    for (const [fieldName, value] of Object.entries(node)) {
      if (scalarFilterKeys(node).includes(fieldName)) continue;
      if (fieldName === "and" || fieldName === "or" || fieldName === "not") continue;
      const rel = this.relationByField.get(fieldName);
      if (!rel || !rel.filterable || value == null || typeof value !== "object") continue;
      const relFilter = value as FilterAST;
      const assoc = extractAssociationFilter(relFilter);
      if (assoc) {
        const part = this.translateAssociation(rel, assoc);
        if (part) parts.push(part);
      } else if (rel.kind === "many-to-one" || rel.kind === "one-to-one") {
        const part = this.translateManyToOne(rel, relFilter);
        if (part) parts.push(part);
      }
    }

    if (parts.length === 0) return undefined;
    return parts.length === 1 ? parts[0] : and(...parts)!;
  }

  private translateManyToOne(rel: RelationDescriptor, targetFilter: FilterAST): SQL | undefined {
    if (!rel.ownerFkDrizzleKey) return undefined;
    const ownerFk = (this.config.table as unknown as Record<string, Column>)[rel.ownerFkDrizzleKey];
    if (!ownerFk) return undefined;

    const nested = new QueryTranslator({
      db: this.config.db,
      table: rel.targetTable,
      columns: rel.targetColumns,
      relations: [],
      softDelete: rel.targetColumns.some((c) => c.drizzleKey === "deletedAt"),
      filterBudget: this.config.filterBudget,
    });
    const innerWhere = nested.translateFilter(targetFilter, false, true);
    if (!innerWhere) return undefined;

    const targetId = (rel.targetTable as unknown as Record<string, Column>).id;
    return exists(
      this.config.db
        .select({ one: sql`1` })
        .from(rel.targetTable)
        .where(and(eq(targetId, ownerFk), innerWhere)!),
    );
  }

  private translateAssociation(
    rel: RelationDescriptor,
    assoc: ReturnType<typeof extractAssociationFilter>,
  ): SQL | undefined {
    if (!assoc) return undefined;

    if (rel.kind === "one-to-many" && rel.childTable && rel.childFkDrizzleKey) {
      return this.translateOneToMany(rel, assoc);
    }
    if (rel.kind === "many-to-many" && rel.joinTable && rel.joinOwnerFkDrizzleKey && rel.joinTargetFkDrizzleKey) {
      return this.translateManyToMany(rel, assoc);
    }
    return undefined;
  }

  private translateOneToMany(
    rel: RelationDescriptor,
    assoc: NonNullable<ReturnType<typeof extractAssociationFilter>>,
  ): SQL | undefined {
    const parentId = (this.config.table as unknown as Record<string, Column>).id;
    const childFk = (rel.childTable as unknown as Record<string, Column>)[rel.childFkDrizzleKey!];
    const childTranslator = rel.childColumns
      ? new QueryTranslator({
          db: this.config.db,
          table: rel.childTable!,
          columns: rel.childColumns,
          relations: [],
          softDelete: rel.childColumns.some((c) => c.drizzleKey === "deletedAt"),
          filterBudget: this.config.filterBudget,
        })
      : null;

    const childPredicate = (childFilter: FilterAST): SQL | undefined =>
      childTranslator?.translateFilter(childFilter, false, true);

    if (assoc.some) {
      const inner = childPredicate(assoc.some);
      if (!inner) return undefined;
      return exists(
        this.config.db
          .select({ one: sql`1` })
          .from(rel.childTable!)
          .where(and(eq(childFk, parentId), inner)!),
      );
    }
    if (assoc.none) {
      const inner = childPredicate(assoc.none);
      if (!inner) return undefined;
      return notExists(
        this.config.db
          .select({ one: sql`1` })
          .from(rel.childTable!)
          .where(and(eq(childFk, parentId), inner)!),
      );
    }
    if (assoc.every) {
      const inner = childPredicate(assoc.every);
      if (!inner) return undefined;
      return notExists(
        this.config.db
          .select({ one: sql`1` })
          .from(rel.childTable!)
          .where(and(eq(childFk, parentId), not(inner))!),
      );
    }
    return undefined;
  }

  private translateManyToMany(
    rel: RelationDescriptor,
    assoc: NonNullable<ReturnType<typeof extractAssociationFilter>>,
  ): SQL | undefined {
    const parentId = (this.config.table as unknown as Record<string, Column>).id;
    const joinOwnerFk = (rel.joinTable as unknown as Record<string, Column>)[rel.joinOwnerFkDrizzleKey!];
    const joinTargetFk = (rel.joinTable as unknown as Record<string, Column>)[rel.joinTargetFkDrizzleKey!];
    const targetId = (rel.targetTable as unknown as Record<string, Column>).id;

    const targetTranslator = new QueryTranslator({
      db: this.config.db,
      table: rel.targetTable,
      columns: rel.targetColumns,
      relations: [],
      softDelete: rel.targetColumns.some((c) => c.drizzleKey === "deletedAt"),
      filterBudget: this.config.filterBudget,
    });

    const buildExists = (targetFilter: FilterAST, negate = false): SQL | undefined => {
      const inner = targetTranslator.translateFilter(targetFilter, false, true);
      if (!inner) return undefined;
      const existsSql = exists(
        this.config.db
          .select({ one: sql`1` })
          .from(rel.joinTable!)
          .innerJoin(rel.targetTable, eq(joinTargetFk, targetId))
          .where(and(eq(joinOwnerFk, parentId), inner)!),
      );
      return negate ? not(existsSql) : existsSql;
    };

    if (assoc.some) return buildExists(assoc.some);
    if (assoc.none) return buildExists(assoc.none, true);
    if (assoc.every) {
      const inner = targetTranslator.translateFilter(assoc.every, false, true);
      if (!inner) return undefined;
      return notExists(
        this.config.db
          .select({ one: sql`1` })
          .from(rel.joinTable!)
          .innerJoin(rel.targetTable, eq(joinTargetFk, targetId))
          .where(and(eq(joinOwnerFk, parentId), not(inner))!),
      );
    }
    return undefined;
  }
}
