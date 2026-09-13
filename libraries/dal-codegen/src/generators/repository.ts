import type { DalConfig } from "../config.js";
import type { ColumnModel, EntityModel } from "../model.js";

type ResolvedDalConfig = Required<DalConfig>;

function tsTypeForColumn(col: ColumnModel): string {
  if (col.kind === "boolean") return "boolean";
  if (col.kind === "enum" && col.enumValues?.length) {
    return col.enumValues.map((value) => JSON.stringify(value)).join(" | ");
  }
  return "string";
}

function inputRef(col: ColumnModel): string {
  if (col.defaultValue !== undefined) {
    return `input.${col.graphqlName} ?? ${JSON.stringify(col.defaultValue)}`;
  }
  return `input.${col.graphqlName}`;
}

function assignCreateValue(col: ColumnModel): string {
  const ref = inputRef(col);
  if (col.kind === "timestamptz") {
    return `      ${col.drizzleKey}: ${ref} ? parseDateTime(${ref}) : undefined,`;
  }
  if (col.kind === "enum") {
    return `      ${col.drizzleKey}: (${ref}) as (typeof table.$inferInsert)["${col.drizzleKey}"],`;
  }
  return `      ${col.drizzleKey}: ${ref},`;
}

function assignUpdateValue(col: ColumnModel): string {
  if (col.kind === "timestamptz") {
    if (col.notNull) {
      return `    if (input.${col.graphqlName} !== undefined && input.${col.graphqlName} !== null) {
      set.${col.drizzleKey} = parseDateTime(input.${col.graphqlName});
    }`;
    }
    return `    if (input.${col.graphqlName} !== undefined) {
      set.${col.drizzleKey} = input.${col.graphqlName} === null ? null : parseDateTime(input.${col.graphqlName});
    }`;
  }
  if (col.kind === "enum") {
    return `    if (input.${col.graphqlName} !== undefined) {
      set.${col.drizzleKey} = input.${col.graphqlName} as (typeof table.$inferInsert)["${col.drizzleKey}"];
    }`;
  }
  return `    if (input.${col.graphqlName} !== undefined) {
      set.${col.drizzleKey} = input.${col.graphqlName};
    }`;
}

const FILTER_BUILDERS = [
  "buildBooleanFilter",
  "buildDateTimeFilter",
  "buildEnumFilter",
  "buildIdFilter",
  "buildStringFilter",
] as const;

function filterBuilderForColumn(col: ColumnModel): string {
  switch (col.kind) {
    case "boolean":
      return "buildBooleanFilter";
    case "timestamptz":
      return "buildDateTimeFilter";
    case "uuid":
      return "buildIdFilter";
    case "enum":
      return "buildEnumFilter";
    default:
      return "buildStringFilter";
  }
}

function requiredFilterBuilders(entity: EntityModel): Set<string> {
  const builders = new Set<string>();
  for (const col of entity.columns) {
    if (!col.isServerManaged || col.drizzleKey === "id") {
      builders.add(filterBuilderForColumn(col));
    }
  }
  return builders;
}

function buildDalCoreImportBlock(entity: EntityModel): string {
  const filterBuilders = requiredFilterBuilders(entity);
  const valueImports = [
    "assertCursorSortMatches",
    "assertValidUuid",
    ...FILTER_BUILDERS.filter((name) => filterBuilders.has(name)),
    "buildKeysetSeek",
    "buildOrderClauses",
    "CHANGE_EVENT_ID_CAP",
    "combineLogical",
    "createUserError",
    "CURSOR_VERSION",
    "decodeCursor",
    "DEFAULT_LIST_LIMIT",
    "encodeCursor",
    "errorPayload",
    "mapDriverError",
    "MAX_LIST_LIMIT",
    "parseDateTime",
    "resolveActorId",
    "resolveFilterBudget",
    "resolveSortWithTieBreaker",
    "reverseOrderClauses",
    "serializeDateTime",
    "successPayload",
    "validateConnectionPagingArgs",
    "validateFilterBudget",
    "ValidationError",
  ];
  const typeImports = [
    "EntityChangeEventPayload",
    "RepositoryContext",
    "ResolvedSortKey",
    "SortInput",
  ];
  return `import {
${valueImports.map((name) => `  ${name},`).join("\n")}
${typeImports.map((name) => `  type ${name},`).join("\n")}
} from "@corpdk/dal-core";`;
}

function cursorSerializeCase(col: ColumnModel): string {
  if (col.kind === "timestamptz") {
    return `      case "${col.drizzleKey}":
        return serializeDateTime(row.${col.drizzleKey})!;`;
  }
  return "";
}

function cursorDeserializeCase(col: ColumnModel): string {
  if (col.kind === "timestamptz") {
    return `      case "${col.drizzleKey}":
        return new Date(value as string);`;
  }
  return "";
}

export function generateRepository(entity: EntityModel, config: ResolvedDalConfig): string {
  const E = entity.graphqlType;
  const e = entity.fieldBasename;
  const exportName = entity.exportName;
  const soft = entity.deleteStrategy === "soft";
  const full = entity.auditProfile === "full";

  const businessCols = entity.columns.filter((c) => c.isBusiness);
  const outputCols = entity.columns.filter(
    (c) => c.drizzleKey !== "deletedAt" && c.drizzleKey !== "deletedBy",
  );
  const sortCols = outputCols;

  const mapRowFields = outputCols
    .map((col) => {
      if (col.kind === "timestamptz") {
        return col.notNull
          ? `    ${col.graphqlName}: serializeDateTime(row.${col.drizzleKey})!,`
          : `    ${col.graphqlName}: row.${col.drizzleKey} != null ? serializeDateTime(row.${col.drizzleKey}) : null,`;
      }
      return `    ${col.graphqlName}: row.${col.drizzleKey},`;
    })
    .join("\n");

  const filterCases = entity.columns
    .filter((c) => !c.isServerManaged || c.drizzleKey === "id")
    .map((col) => {
      const builder = filterBuilderForColumn(col);
      return `    if (node.${col.graphqlName} !== undefined) {
      const part = ${builder}(table.${col.drizzleKey}, node.${col.graphqlName});
      if (part) leafParts.push(part);
    }`;
    })
    .join("\n");

  const createValues = businessCols.map((col) => assignCreateValue(col)).join("\n");
  const updateSet = full ? businessCols.map((col) => assignUpdateValue(col)).join("\n") : "";

  const cursorSerializeCases = sortCols
    .filter((c) => c.kind === "timestamptz")
    .map((c) => cursorSerializeCase(c))
    .filter(Boolean)
    .join("\n");

  const cursorDeserializeCases = sortCols
    .filter((c) => c.kind === "timestamptz")
    .map((c) => cursorDeserializeCase(c))
    .filter(Boolean)
    .join("\n");

  return `// AUTO-GENERATED by @corpdk/dal-codegen — do not edit
import { and, count, eq, sql, type SQL } from "drizzle-orm";
${buildDalCoreImportBlock(entity)}
import { db } from "../../../db/index.js";
import { ${exportName} } from "../../../db/schema/index.js";

const table = ${exportName};
const FILTER_BUDGET = resolveFilterBudget({ maxDepth: ${config.filterMaxDepth}, maxNodes: ${config.filterMaxNodes} });

export type ${E}Record = {
${outputCols.map((c) => `  ${c.graphqlName}: ${tsTypeForColumn(c)}${c.notNull ? "" : " | null"};`).join("\n")}
};

export type ${E}CreateInput = {
${businessCols.map((c) => `  ${c.graphqlName}${c.notNull && !c.hasDefault ? "" : "?"}: ${tsTypeForColumn(c)}${!c.notNull ? " | null" : ""};`).join("\n")}
};

${full ? `export type ${E}UpdateInput = Partial<${E}CreateInput>;` : ""}

export type ${E}Filter = Record<string, unknown> & {
  and?: ${E}Filter[];
  or?: ${E}Filter[];
  not?: ${E}Filter;
};

function mapRow(row: typeof table.$inferSelect): ${E}Record {
  return {
${mapRowFields}
  };
}

function buildWhere(filter: ${E}Filter | null | undefined, includeDeleted?: boolean | null): SQL | undefined {
  validateFilterBudget(filter, FILTER_BUDGET);
  const parts: SQL[] = [];
  ${soft ? `if (!includeDeleted) {
    parts.push(sql\`\${table.deletedAt} IS NULL\`);
  }` : ""}

  const leaf = (node: ${E}Filter): SQL | undefined => {
    const leafParts: SQL[] = [];
${filterCases}
    if (leafParts.length === 0) return undefined;
    return leafParts.length === 1 ? leafParts[0] : and(...leafParts)!;
  };

  const logical = combineLogical(filter, leaf);
  if (logical) parts.push(logical);
  if (parts.length === 0) return undefined;
  return parts.length === 1 ? parts[0] : and(...parts)!;
}

const SORT_FIELD_MAP: Record<string, keyof typeof table.$inferSelect> = {
${sortCols
  .map(
    (c) =>
      `  ${c.graphqlName.replace(/([A-Z])/g, "_$1").toUpperCase()}: "${c.drizzleKey}",`,
  )
  .join("\n")}
};

function resolveSort(sort?: SortInput[] | null): ResolvedSortKey[] {
  return resolveSortWithTieBreaker(sort, SORT_FIELD_MAP as Record<string, string>);
}

function cursorValuesFromRow(row: typeof table.$inferSelect, resolvedSort: ResolvedSortKey[]): unknown[] {
  return resolvedSort.map((s) => {
    switch (s.drizzleKey) {
${cursorSerializeCases}
      default:
        return row[s.drizzleKey as keyof typeof row];
    }
  });
}

function cursorValuesToDb(values: unknown[], resolvedSort: ResolvedSortKey[]): unknown[] {
  return values.map((value, index) => {
    switch (resolvedSort[index]?.drizzleKey) {
${cursorDeserializeCases}
      default:
        return value;
    }
  });
}

function edgeCursor(
  row: typeof table.$inferSelect,
  resolvedSort: ResolvedSortKey[],
  includeDeleted?: boolean | null,
): string {
  return encodeCursor({
    version: CURSOR_VERSION,
    entity: "${E}",
    sort: resolvedSort.map((s) => ({ field: s.field, direction: s.direction })),
    values: cursorValuesFromRow(row, resolvedSort),
    includeDeleted: includeDeleted ?? false,
  });
}

function emptyConnection() {
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

function clampLimit(limit: number | null | undefined, field: string): number {
  const n = limit ?? DEFAULT_LIST_LIMIT;
  if (n < 0) throw new ValidationError(\`\${field} must be >= 0\`, [field]);
  if (n > MAX_LIST_LIMIT) throw new ValidationError(\`\${field} must be <= \${MAX_LIST_LIMIT}\`, [field]);
  return n;
}

export class Generated${E}Repository {
  mapRow = mapRow;

  async findById(id: string, opts?: { includeDeleted?: boolean | null }): Promise<${E}Record | null> {
    assertValidUuid(id);
    const where = buildWhere({ id: { eq: id } } as ${E}Filter, opts?.includeDeleted);
    const rows = await db.select().from(table).where(where!);
    if (rows.length === 0) return null;
    return mapRow(rows[0]);
  }

  async list(args: {
    filter?: ${E}Filter | null;
    sort?: SortInput[] | null;
    limit?: number | null;
    includeDeleted?: boolean | null;
  }): Promise<${E}Record[]> {
    const where = buildWhere(args.filter, args.includeDeleted);
    const limit = clampLimit(args.limit, "limit");
    const resolvedSort = resolveSort(args.sort);
    let q = db
      .select()
      .from(table)
      .orderBy(...buildOrderClauses(table as unknown as Record<string, unknown>, resolvedSort))
      .limit(limit);
    if (where) q = q.where(where) as typeof q;
    const rows = await q;
    return rows.map(mapRow);
  }

  async count(args: {
    filter?: ${E}Filter | null;
    includeDeleted?: boolean | null;
  }): Promise<number> {
    const where = buildWhere(args.filter, args.includeDeleted);
    let q = db.select({ value: count() }).from(table);
    if (where) q = q.where(where) as typeof q;
    const rows = await q;
    return Number(rows[0]?.value ?? 0);
  }

  async listConnection(args: {
    filter?: ${E}Filter | null;
    sort?: SortInput[] | null;
    first?: number | null;
    after?: string | null;
    last?: number | null;
    before?: string | null;
    includeDeleted?: boolean | null;
  }) {
    validateConnectionPagingArgs(args);
    if (args.first === 0 || args.last === 0) return emptyConnection();

    const resolvedSort = resolveSort(args.sort);
    const whereParts: SQL[] = [];
    const baseWhere = buildWhere(args.filter, args.includeDeleted);
    if (baseWhere) whereParts.push(baseWhere);

    const seekColumns = resolvedSort.map((s) => table[s.drizzleKey as keyof typeof table] as typeof table.id);
    const seekDirections = resolvedSort.map((s) => s.direction);

    if (args.after) {
      const decoded = decodeCursor(args.after, "${E}", "after");
      assertCursorSortMatches(decoded, resolvedSort, "after");
      whereParts.push(
        buildKeysetSeek(
          seekColumns,
          seekDirections,
          cursorValuesToDb(decoded.values, resolvedSort),
          "after",
        ),
      );
    } else if (args.before) {
      const decoded = decodeCursor(args.before, "${E}", "before");
      assertCursorSortMatches(decoded, resolvedSort, "before");
      whereParts.push(
        buildKeysetSeek(
          seekColumns,
          seekDirections,
          cursorValuesToDb(decoded.values, resolvedSort),
          "before",
        ),
      );
    }

    const where = whereParts.length ? and(...whereParts) : undefined;

    if (args.last != null) {
      const last = clampLimit(args.last, "last");
      let q = db
        .select()
        .from(table)
        .orderBy(...reverseOrderClauses(table as unknown as Record<string, unknown>, resolvedSort))
        .limit(last + 1);
      if (where) q = q.where(where) as typeof q;
      const rows = await q;
      const hasPreviousPage = rows.length > last;
      const slice = (hasPreviousPage ? rows.slice(0, last) : rows).reverse();
      const edges = slice.map((row) => ({
        node: mapRow(row),
        cursor: edgeCursor(row, resolvedSort, args.includeDeleted),
      }));
      return {
        edges,
        nodes: edges.map((edge) => edge.node),
        pageInfo: {
          hasNextPage: Boolean(args.before),
          hasPreviousPage,
          startCursor: edges[0]?.cursor ?? null,
          endCursor: edges[edges.length - 1]?.cursor ?? null,
        },
      };
    }

    const first = clampLimit(args.first, "first");
    let q = db
      .select()
      .from(table)
      .orderBy(...buildOrderClauses(table as unknown as Record<string, unknown>, resolvedSort))
      .limit(first + 1);
    if (where) q = q.where(where) as typeof q;
    const rows = await q;
    const hasNextPage = rows.length > first;
    const slice = hasNextPage ? rows.slice(0, first) : rows;
    const edges = slice.map((row) => ({
      node: mapRow(row),
      cursor: edgeCursor(row, resolvedSort, args.includeDeleted),
    }));
    return {
      edges,
      nodes: edges.map((edge) => edge.node),
      pageInfo: {
        hasNextPage,
        hasPreviousPage: Boolean(args.after),
        startCursor: edges[0]?.cursor ?? null,
        endCursor: edges[edges.length - 1]?.cursor ?? null,
      },
    };
  }

  async create(input: ${E}CreateInput, ctx: RepositoryContext) {
    try {
      const actor = resolveActorId(ctx.actorId);
      const now = new Date();
      const values = {
${createValues}
        createdAt: now,
        ${full ? "updatedAt: now," : ""}
        createdBy: actor,
        ${full ? "updatedBy: actor," : ""}
      };
      const inserted = await db.insert(table).values(values).returning();
      const row = mapRow(inserted[0]);
      return successPayload({ ${e}: row });
    } catch (err) {
      if (err instanceof ValidationError) {
        return errorPayload({ ${e}: null }, [createUserError("VALIDATION_FAILED", err.message, { field: err.field })]);
      }
      return errorPayload({ ${e}: null }, [mapDriverError(err)]);
    }
  }

  ${full ? `async update(id: string, input: ${E}UpdateInput, ctx: RepositoryContext) {
    try {
      assertValidUuid(id);
      const existing = await this.findById(id);
      if (!existing) {
        return errorPayload({ ${e}: null }, [createUserError("NOT_FOUND", "${E} not found", { id })]);
      }
      const actor = resolveActorId(ctx.actorId);
      const set: Partial<typeof table.$inferInsert> = {
        updatedAt: new Date(),
        updatedBy: actor,
      };
${updateSet}
      const updated = await db.update(table).set(set).where(eq(table.id, id)).returning();
      return successPayload({ ${e}: mapRow(updated[0]) });
    } catch (err) {
      if (err instanceof ValidationError) {
        return errorPayload({ ${e}: null }, [createUserError("VALIDATION_FAILED", err.message, { field: err.field })]);
      }
      return errorPayload({ ${e}: null }, [mapDriverError(err)]);
    }
  }` : ""}

  async delete(id: string, ctx: RepositoryContext) {
    try {
      assertValidUuid(id);
      const existing = await this.findById(id);
      if (!existing) {
        return errorPayload({ success: false }, [createUserError("NOT_FOUND", "${E} not found", { id })]);
      }
      ${soft ? `const actor = resolveActorId(ctx.actorId);
      await db.update(table).set({ deletedAt: new Date(), deletedBy: actor }).where(eq(table.id, id));` : `await db.delete(table).where(eq(table.id, id));`}
      return successPayload({ success: true });
    } catch (err) {
      return errorPayload({ success: false }, [mapDriverError(err)]);
    }
  }

  toChangeEvent(operation: EntityChangeEventPayload["operation"], ids: string[]): EntityChangeEventPayload {
    const count = ids.length;
    const isTruncated = count > CHANGE_EVENT_ID_CAP;
    return {
      operation,
      ids: isTruncated ? [] : ids,
      isTruncated,
      count,
    };
  }
}
`;
}

export function generateRepositoryIndex(entities: EntityModel[]): string {
  const imports = entities
    .map(
      (e) =>
        `export { Generated${e.graphqlType}Repository } from "./generated-${e.fieldBasename}.repository.js";`,
    )
    .join("\n");
  return `// AUTO-GENERATED by @corpdk/dal-codegen — do not edit
${imports}
`;
}
