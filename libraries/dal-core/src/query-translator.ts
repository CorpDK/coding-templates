import {
  and,
  eq,
  exists,
  not,
  notExists,
  sql,
  type Column,
  type SQL,
  type Table,
} from "drizzle-orm";
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
import { isEmptyFilter, isExistenceOnlyFilter } from "./bulk.js";
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
  /** Relations on targetTable for nested M:1 / M:N / inverse 1:1 filters. */
  targetRelations?: RelationDescriptor[];
  /** Relations on childTable for nested 1:M association filters. */
  childRelations?: RelationDescriptor[];
  /** Target entity uses soft delete (codegen sets this when deletedAt is omitted from targetColumns). */
  targetSoftDelete?: boolean;
  /** Child entity uses soft delete (codegen sets this when deletedAt is omitted from childColumns). */
  childSoftDelete?: boolean;
  filterable: boolean;
}

function relationTargetSoftDelete(rel: RelationDescriptor): boolean {
  return rel.targetSoftDelete ?? rel.targetColumns.some((c) => c.drizzleKey === "deletedAt");
}

function relationChildSoftDelete(rel: RelationDescriptor): boolean {
  return rel.childSoftDelete ?? rel.childColumns?.some((c) => c.drizzleKey === "deletedAt") ?? false;
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

  private translateScalarFields(node: FilterAST): SQL[] {
    const parts: SQL[] = [];
    for (const key of scalarFilterKeys(node)) {
      const col = this.columnByGraphql.get(key);
      if (!col) continue;
      const builder = filterBuilderForKind(col.kind);
      const part = builder(col.column, node[key] as never);
      if (part) parts.push(part);
    }
    return parts;
  }

  private translateRelationFilter(rel: RelationDescriptor, relFilter: FilterAST): SQL | undefined {
    const assoc = extractAssociationFilter(relFilter);
    if (assoc) return this.translateAssociation(rel, assoc);
    if (rel.kind === "many-to-one") return this.translateManyToOne(rel, relFilter);
    if (rel.kind === "one-to-one") {
      return rel.ownerFkDrizzleKey
        ? this.translateManyToOne(rel, relFilter)
        : this.translateInverseOneToOne(rel, relFilter);
    }
    return undefined;
  }

  private translateRelationFields(node: FilterAST): SQL[] {
    const parts: SQL[] = [];
    for (const [fieldName, value] of Object.entries(node)) {
      if (this.columnByGraphql.has(fieldName)) continue;
      if (fieldName === "and" || fieldName === "or" || fieldName === "not") continue;
      const rel = this.relationByField.get(fieldName);
      if (!rel || !rel.filterable || value == null || typeof value !== "object") continue;
      const part = this.translateRelationFilter(rel, value as FilterAST);
      if (part) parts.push(part);
    }
    return parts;
  }

  private translateLeaf(node: FilterAST): SQL | undefined {
    const parts = [...this.translateScalarFields(node), ...this.translateRelationFields(node)];
    if (parts.length === 0) return undefined;
    return parts.length === 1 ? parts[0] : and(...parts)!;
  }

  private translateInverseOneToOne(
    rel: RelationDescriptor,
    targetFilter: FilterAST,
  ): SQL | undefined {
    if (!rel.childFkDrizzleKey) return undefined;
    const parentId = (this.config.table as unknown as Record<string, Column>).id;
    const childFk = (rel.targetTable as unknown as Record<string, Column>)[rel.childFkDrizzleKey];
    if (!parentId || !childFk) return undefined;

    const nested = new QueryTranslator({
      db: this.config.db,
      table: rel.targetTable,
      columns: rel.targetColumns,
      relations: rel.targetRelations ?? [],
      softDelete: relationTargetSoftDelete(rel),
      filterBudget: this.config.filterBudget,
    });
    const innerWhere = nested.translateFilter(targetFilter, false, true);
    if (!innerWhere && !isExistenceOnlyFilter(targetFilter)) return undefined;

    const targetSoftDelete = relationTargetSoftDelete(rel);
    const existsParts: SQL[] = [eq(childFk, parentId)];
    if (innerWhere) {
      existsParts.push(innerWhere);
    }
    if (targetSoftDelete) {
      const deletedAt = (rel.targetTable as unknown as Record<string, Column>).deletedAt;
      if (deletedAt) existsParts.push(sql`${deletedAt} IS NULL`);
    }

    return exists(
      this.config.db
        .select({ one: sql`1` })
        .from(rel.targetTable)
        .where(existsParts.length === 1 ? existsParts[0] : and(...existsParts)!),
    );
  }

  private translateManyToOne(rel: RelationDescriptor, targetFilter: FilterAST): SQL | undefined {
    if (!rel.ownerFkDrizzleKey) return undefined;
    const ownerFk = (this.config.table as unknown as Record<string, Column>)[rel.ownerFkDrizzleKey];
    if (!ownerFk) return undefined;

    const nested = new QueryTranslator({
      db: this.config.db,
      table: rel.targetTable,
      columns: rel.targetColumns,
      relations: rel.targetRelations ?? [],
      softDelete: relationTargetSoftDelete(rel),
      filterBudget: this.config.filterBudget,
    });
    const innerWhere = nested.translateFilter(targetFilter, false, true);
    if (!innerWhere && !isExistenceOnlyFilter(targetFilter)) return undefined;

    const targetId = (rel.targetTable as unknown as Record<string, Column>).id;
    const targetSoftDelete = relationTargetSoftDelete(rel);
    const existsParts: SQL[] = [eq(targetId, ownerFk)];
    if (innerWhere) {
      existsParts.push(innerWhere);
    }
    if (targetSoftDelete) {
      const deletedAt = (rel.targetTable as unknown as Record<string, Column>).deletedAt;
      if (deletedAt) existsParts.push(sql`${deletedAt} IS NULL`);
    }

    return exists(
      this.config.db
        .select({ one: sql`1` })
        .from(rel.targetTable)
        .where(existsParts.length === 1 ? existsParts[0] : and(...existsParts)!),
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

  private oneToManyChildContext(rel: RelationDescriptor) {
    const parentId = (this.config.table as unknown as Record<string, Column>).id;
    const childFk = (rel.childTable as unknown as Record<string, Column>)[rel.childFkDrizzleKey!];
    const childTranslator = rel.childColumns
      ? new QueryTranslator({
          db: this.config.db,
          table: rel.childTable!,
          columns: rel.childColumns,
          relations: rel.childRelations ?? [],
          softDelete: relationChildSoftDelete(rel),
          filterBudget: this.config.filterBudget,
        })
      : null;
    const childSoftDelete = relationChildSoftDelete(rel);
    const childDeletedAt = childSoftDelete
      ? (rel.childTable as unknown as Record<string, Column>).deletedAt
      : undefined;
    const childExistsWhere = (inner?: SQL): SQL => {
      const parts: SQL[] = [eq(childFk, parentId)];
      if (inner) parts.push(inner);
      if (childDeletedAt) parts.push(sql`${childDeletedAt} IS NULL`);
      return parts.length === 1 ? parts[0]! : and(...parts)!;
    };
    const childPredicate = (childFilter: FilterAST): SQL | undefined => {
      if (isExistenceOnlyFilter(childFilter)) return undefined;
      return childTranslator?.translateFilter(childFilter, false, true);
    };
    return { childExistsWhere, childPredicate, childFk, parentId, childDeletedAt };
  }

  private oneToManyExistsMatch(
    rel: RelationDescriptor,
    childExistsWhere: (inner?: SQL) => SQL,
    childPredicate: (childFilter: FilterAST) => SQL | undefined,
    filter: FilterAST,
    negate: boolean,
  ): SQL | undefined {
    if (!isExistenceOnlyFilter(filter) && !childPredicate(filter)) return undefined;
    const subquery = this.config.db
      .select({ one: sql`1` })
      .from(rel.childTable!)
      .where(childExistsWhere(childPredicate(filter)));
    return negate ? notExists(subquery) : exists(subquery);
  }

  private translateOneToMany(
    rel: RelationDescriptor,
    assoc: NonNullable<ReturnType<typeof extractAssociationFilter>>,
  ): SQL | undefined {
    const ctx = this.oneToManyChildContext(rel);
    if (assoc.some) {
      return this.oneToManyExistsMatch(rel, ctx.childExistsWhere, ctx.childPredicate, assoc.some, false);
    }
    if (assoc.none) {
      return this.oneToManyExistsMatch(rel, ctx.childExistsWhere, ctx.childPredicate, assoc.none, true);
    }
    if (!assoc.every) return undefined;
    if (isEmptyFilter(assoc.every)) return undefined;
    if (isExistenceOnlyFilter(assoc.every)) return sql`true`;
    const inner = ctx.childPredicate(assoc.every);
    if (!inner) return undefined;
    const everyParts: SQL[] = [eq(ctx.childFk, ctx.parentId), not(inner)];
    if (ctx.childDeletedAt) everyParts.push(sql`${ctx.childDeletedAt} IS NULL`);
    return notExists(
      this.config.db
        .select({ one: sql`1` })
        .from(rel.childTable!)
        .where(everyParts.length === 1 ? everyParts[0] : and(...everyParts)!),
    );
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
      relations: rel.targetRelations ?? [],
      softDelete: relationTargetSoftDelete(rel),
      filterBudget: this.config.filterBudget,
    });

    const targetSoftDelete = relationTargetSoftDelete(rel);
    const targetDeletedAt = targetSoftDelete
      ? (rel.targetTable as unknown as Record<string, Column>).deletedAt
      : undefined;
    const joinSoftDelete = relationChildSoftDelete(rel);
    const joinDeletedAt = joinSoftDelete
      ? (rel.joinTable as unknown as Record<string, Column>).deletedAt
      : undefined;

    const buildExists = (targetFilter: FilterAST, negate = false): SQL | undefined => {
      const inner = isExistenceOnlyFilter(targetFilter)
        ? undefined
        : targetTranslator.translateFilter(targetFilter, false, true);
      if (!inner && !isExistenceOnlyFilter(targetFilter)) return undefined;
      const existsParts: SQL[] = [eq(joinOwnerFk, parentId)];
      if (inner) {
        existsParts.push(inner);
      }
      if (joinDeletedAt) {
        existsParts.push(sql`${joinDeletedAt} IS NULL`);
      }
      if (targetDeletedAt) {
        existsParts.push(sql`${targetDeletedAt} IS NULL`);
      }
      const existsSql = exists(
        this.config.db
          .select({ one: sql`1` })
          .from(rel.joinTable!)
          .innerJoin(rel.targetTable, eq(joinTargetFk, targetId))
          .where(existsParts.length === 1 ? existsParts[0] : and(...existsParts)!),
      );
      return negate ? not(existsSql) : existsSql;
    };

    if (assoc.some) return buildExists(assoc.some);
    if (assoc.none) return buildExists(assoc.none, true);
    if (assoc.every) {
      if (isEmptyFilter(assoc.every)) return undefined;
      if (isExistenceOnlyFilter(assoc.every)) {
        return sql`true`;
      }
      const inner = targetTranslator.translateFilter(assoc.every, false, true);
      if (!inner) return undefined;
      const everyParts: SQL[] = [eq(joinOwnerFk, parentId), not(inner)];
      if (joinDeletedAt) {
        everyParts.push(sql`${joinDeletedAt} IS NULL`);
      }
      if (targetDeletedAt) {
        everyParts.push(sql`${targetDeletedAt} IS NULL`);
      }
      return notExists(
        this.config.db
          .select({ one: sql`1` })
          .from(rel.joinTable!)
          .innerJoin(rel.targetTable, eq(joinTargetFk, targetId))
          .where(everyParts.length === 1 ? everyParts[0] : and(...everyParts)!),
      );
    }
    return undefined;
  }
}
