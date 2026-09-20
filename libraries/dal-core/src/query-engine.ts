import { and, count, inArray, type Column, type SQL } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import {
  buildProjectedSelectShape,
  type ColumnProjection,
} from "./column-projection.js";
import {
  assertCursorSortMatches,
  buildKeysetSeek,
  buildOrderClauses,
  decodeCursor,
  encodeCursor,
  resolveSortWithTieBreaker,
  reverseOrderClauses,
  validateConnectionPagingArgs,
  type CursorPayload,
  type ResolvedSortKey,
} from "./pagination.js";
import { ValidationError } from "./errors.js";
import { DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT, type SortInput } from "./types.js";
import type { FilterAST } from "./filter-ast.js";
import { QueryTranslator, type QueryTranslatorConfig } from "./query-translator.js";

export interface QueryEngineConfig extends QueryTranslatorConfig {
  entityGraphqlName: string;
  cursorVersion: number;
}

export interface ListArgs {
  filter?: FilterAST | null;
  sort?: SortInput[] | null;
  limit?: number | null;
  includeDeleted?: boolean | null;
}

export interface ConnectionArgs {
  filter?: FilterAST | null;
  sort?: SortInput[] | null;
  first?: number | null;
  after?: string | null;
  last?: number | null;
  before?: string | null;
  includeDeleted?: boolean | null;
}

export class QueryEngine<TRow> {
  private readonly translator: QueryTranslator;
  private readonly sortFieldMap: Record<string, string>;

  constructor(
    private readonly config: QueryEngineConfig,
    private readonly db: PgDatabase<any, any>,
    private readonly sortFieldMapInput: Record<string, string>,
  ) {
    this.translator = new QueryTranslator({ ...config, db });
    this.sortFieldMap = sortFieldMapInput;
  }

  buildWhere(filter: FilterAST | null | undefined, includeDeleted?: boolean | null): SQL | undefined {
    return this.translator.translateFilter(filter, includeDeleted);
  }

  resolveSort(sort?: SortInput[] | null): ResolvedSortKey[] {
    return resolveSortWithTieBreaker(sort, this.sortFieldMap);
  }

  clampLimit(limit: number | null | undefined, field: string): number {
    const n = limit ?? DEFAULT_LIST_LIMIT;
    if (n < 0) throw new ValidationError(`${field} must be >= 0`, [field]);
    if (n > MAX_LIST_LIMIT) throw new ValidationError(`${field} must be <= ${MAX_LIST_LIMIT}`, [field]);
    return n;
  }

  private selectFromTable(projection: ColumnProjection | null | undefined) {
    const shape = buildProjectedSelectShape(this.config.table, projection ?? null);
    return shape ? this.db.select(shape as never) : this.db.select();
  }

  async list(
    args: ListArgs,
    mapRow: (row: TRow) => unknown,
    projection?: ColumnProjection | null,
  ): Promise<unknown[]> {
    const where = this.buildWhere(args.filter, args.includeDeleted);
    const limit = this.clampLimit(args.limit, "limit");
    const resolvedSort = this.resolveSort(args.sort);
    const table = this.config.table;

    let q = this.selectFromTable(projection)
      .from(table)
      .orderBy(...buildOrderClauses(table as unknown as Record<string, unknown>, resolvedSort))
      .limit(limit);
    if (where) q = q.where(where) as typeof q;
    const rows = await q;
    return rows.map((row) => mapRow(row as TRow));
  }

  async count(args: { filter?: FilterAST | null; includeDeleted?: boolean | null }): Promise<number> {
    const where = this.buildWhere(args.filter, args.includeDeleted);
    let q = this.db.select({ value: count() }).from(this.config.table);
    if (where) q = q.where(where) as typeof q;
    const rows = await q;
    return Number(rows[0]?.value ?? 0);
  }

  async listConnection(
    args: ConnectionArgs,
    mapRow: (row: TRow) => unknown,
    cursorValuesFromRow: (row: TRow, sort: ResolvedSortKey[]) => unknown[],
    cursorValuesToDb: (values: unknown[], sort: ResolvedSortKey[]) => unknown[],
    projection?: ColumnProjection | null,
  ) {
    validateConnectionPagingArgs(args);
    if (args.first === 0 || args.last === 0) {
      return this.emptyConnection();
    }

    const resolvedSort = this.resolveSort(args.sort);
    const whereParts: SQL[] = [];
    const baseWhere = this.buildWhere(args.filter, args.includeDeleted);
    if (baseWhere) whereParts.push(baseWhere);

    const table = this.config.table;
    const seekColumns = resolvedSort.map(
      (s) => (table as unknown as Record<string, Column>)[s.drizzleKey],
    );
    const seekDirections = resolvedSort.map((s) => s.direction);

    if (args.after) {
      const decoded = decodeCursor(
        args.after,
        this.config.entityGraphqlName,
        "after",
        this.config.cursorVersion,
      );
      assertCursorSortMatches(decoded, resolvedSort, "after");
      whereParts.push(
        buildKeysetSeek(seekColumns, seekDirections, cursorValuesToDb(decoded.values, resolvedSort), "after"),
      );
    } else if (args.before) {
      const decoded = decodeCursor(
        args.before,
        this.config.entityGraphqlName,
        "before",
        this.config.cursorVersion,
      );
      assertCursorSortMatches(decoded, resolvedSort, "before");
      whereParts.push(
        buildKeysetSeek(seekColumns, seekDirections, cursorValuesToDb(decoded.values, resolvedSort), "before"),
      );
    }

    const where = whereParts.length ? and(...whereParts) : undefined;
    const edgeCursor = (row: TRow): string =>
      encodeCursor({
        version: this.config.cursorVersion,
        entity: this.config.entityGraphqlName,
        sort: resolvedSort.map((s) => ({ field: s.field, direction: s.direction })),
        values: cursorValuesFromRow(row, resolvedSort),
        includeDeleted: args.includeDeleted ?? false,
      } satisfies CursorPayload);

    if (args.last != null) {
      const last = this.clampLimit(args.last, "last");
      let q = this.selectFromTable(projection)
        .from(table)
        .orderBy(...reverseOrderClauses(table as unknown as Record<string, unknown>, resolvedSort))
        .limit(last + 1);
      if (where) q = q.where(where) as typeof q;
      const rows = (await q) as TRow[];
      const hasPreviousPage = rows.length > last;
      const slice = (hasPreviousPage ? rows.slice(0, last) : rows).reverse();
      const edges = slice.map((row) => ({ node: mapRow(row), cursor: edgeCursor(row) }));
      return {
        edges,
        nodes: edges.map((e) => e.node),
        pageInfo: {
          hasNextPage: Boolean(args.before),
          hasPreviousPage,
          startCursor: edges[0]?.cursor ?? null,
          endCursor: edges[edges.length - 1]?.cursor ?? null,
        },
      };
    }

    const first = this.clampLimit(args.first, "first");
    let q = this.selectFromTable(projection)
      .from(table)
      .orderBy(...buildOrderClauses(table as unknown as Record<string, unknown>, resolvedSort))
      .limit(first + 1);
    if (where) q = q.where(where) as typeof q;
    const rows = (await q) as TRow[];
    const hasNextPage = rows.length > first;
    const slice = hasNextPage ? rows.slice(0, first) : rows;
    const edges = slice.map((row) => ({ node: mapRow(row), cursor: edgeCursor(row) }));
    return {
      edges,
      nodes: edges.map((e) => e.node),
      pageInfo: {
        hasNextPage,
        hasPreviousPage: Boolean(args.after),
        startCursor: edges[0]?.cursor ?? null,
        endCursor: edges[edges.length - 1]?.cursor ?? null,
      },
    };
  }

  private emptyConnection() {
    return {
      edges: [],
      nodes: [],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: null,
        endCursor: null,
      },
    };
  }

  async findByIds(
    ids: string[],
    includeDeleted?: boolean | null,
    projection?: ColumnProjection | null,
  ): Promise<TRow[]> {
    if (ids.length === 0) return [];
    const unique = [...new Set(ids)];
    const idCol = (this.config.table as unknown as Record<string, Column>).id;
    const parts: SQL[] = [inArray(idCol as never, unique as never[])];
    const softPart =
      this.config.softDelete && !includeDeleted
        ? this.translator.translateFilter({}, false)
        : undefined;
    if (softPart) parts.push(softPart);
    let q = this.selectFromTable(projection)
      .from(this.config.table)
      .where(and(...parts)!);
    return (await q) as TRow[];
  }
}
