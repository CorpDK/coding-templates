import type { DalConfig } from "../config.js";
import type { ColumnModel, EntityModel } from "../model.js";
import { internalRecordColumns } from "./schema-utils.js";

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

function collectRelationTableImports(entity: EntityModel, entities: EntityModel[]): Set<string> {
  const imports = new Set<string>();
  for (const rel of entity.relations) {
    if (rel.targetExportName) imports.add(rel.targetExportName);
    if (rel.joinTableExportName) imports.add(rel.joinTableExportName);
    if (rel.kind === "one-to-many" || rel.kind === "many-to-many") {
      const child = entities.find((e) => e.exportName === (rel.joinTableExportName ?? rel.targetExportName));
      if (child) imports.add(child.exportName);
    }
    if (rel.kind === "many-to-many") {
      imports.add(rel.targetExportName);
    }
  }
  return imports;
}

function columnDescriptorLines(entityExport: string, entity: EntityModel): string {
  return entity.columns
    .filter((c) => c.drizzleKey !== "deletedAt" && c.drizzleKey !== "deletedBy")
    .map(
      (c) =>
        `{ graphqlName: "${c.graphqlName}", drizzleKey: "${c.drizzleKey}", kind: "${c.kind}" as const, column: ${entityExport}.${c.drizzleKey} }`,
    )
    .join(",\n      ");
}

function buildRelationDescriptors(entity: EntityModel, entities: EntityModel[]): string {
  if (entity.relations.length === 0) return "[]";

  const entityByExport = new Map(entities.map((e) => [e.exportName, e]));

  const lines = entity.relations
    .filter((r) => r.filterable)
    .map((rel) => {
      const target = entityByExport.get(rel.targetExportName);
      const child =
        rel.kind === "one-to-many"
          ? target
          : rel.kind === "many-to-many" && rel.joinTableExportName
            ? entityByExport.get(rel.joinTableExportName)
            : undefined;
      const m2mTarget = rel.kind === "many-to-many" ? target : undefined;

      const targetExport = rel.kind === "many-to-many" ? (m2mTarget?.exportName ?? rel.targetExportName) : rel.targetExportName;
      const targetEntity = entityByExport.get(targetExport) ?? target;

      return `  {
    fieldName: "${rel.fieldName}",
    kind: "${rel.kind}" as const,
    ownerFkDrizzleKey: ${rel.ownerFkDrizzleKey ? `"${rel.ownerFkDrizzleKey}"` : "undefined"},
    childFkDrizzleKey: ${rel.childFkDrizzleKey ? `"${rel.childFkDrizzleKey}"` : "undefined"},
    joinOwnerFkDrizzleKey: ${rel.joinOwnerFkDrizzleKey ? `"${rel.joinOwnerFkDrizzleKey}"` : "undefined"},
    joinTargetFkDrizzleKey: ${rel.joinTargetFkDrizzleKey ? `"${rel.joinTargetFkDrizzleKey}"` : "undefined"},
    targetTable: ${targetEntity?.exportName ?? rel.targetExportName},
    targetColumns: [
      ${targetEntity ? columnDescriptorLines(targetEntity.exportName, targetEntity) : ""}
    ],
    childTable: ${child ? child.exportName : "undefined"},
    childColumns: ${child ? `[\n      ${columnDescriptorLines(child.exportName, child)}\n    ]` : "undefined"},
    joinTable: ${rel.joinTableExportName ?? "undefined"},
    joinColumns: undefined,
    filterable: true,
  }`;
    });

  return `[\n${lines.join(",\n")}\n]`;
}

function hasParentBatchMethods(entity: EntityModel, entities: EntityModel[]): boolean {
  for (const parent of entities) {
    for (const rel of parent.relations) {
      if (rel.targetExportName !== entity.exportName || !rel.childFkDrizzleKey) continue;
      if (rel.kind === "one-to-many" || (rel.kind === "one-to-one" && !rel.ownerFkDrizzleKey)) {
        return true;
      }
    }
  }
  return false;
}

function drizzleImportLine(needsInArray: boolean): string {
  const parts = ["eq"];
  if (needsInArray) parts.push("inArray");
  return `import { ${parts.join(", ")} } from "drizzle-orm";`;
}

function dalCoreImportBlock(_entity: EntityModel): string {
  const valueImports = [
    "assertFilterBulkCap",
    "assertFilterBulkConfirm",
    "assertValidUuid",
    "createUserError",
    "CHANGE_EVENT_ID_CAP",
    "CURSOR_VERSION",
    "errorPayload",
    "mapDriverError",
    "parseDateTime",
    "QueryEngine",
    "resolveActorId",
    "resolveBulkAtomic",
    "resolveBulkFilterMax",
    "resolveFilterBudget",
    "serializeDateTime",
    "successPayload",
    "ValidationError",
  ];
  const typeImports = [
    "BulkMutationResult",
    "ColumnDescriptor",
    "EntityChangeEventPayload",
    "FilterAST",
    "RelationDescriptor",
    "RepositoryContext",
    "ResolvedSortKey",
    "SortInput",
  ];
  valueImports.sort();
  typeImports.sort();
  return `import {
  ${valueImports.join(",\n  ")},
  type ${typeImports.join(",\n  type ")},
} from "@corpdk/dal-core";`;
}

function cursorSerializeBody(sortCols: ColumnModel[]): string {
  const tzCols = sortCols.filter((c) => c.kind === "timestamptz");
  if (tzCols.length === 0) {
    return `  return resolvedSort.map((s) => row[s.drizzleKey as keyof typeof row]);`;
  }
  if (tzCols.length === 1) {
    const c = tzCols[0]!;
    const expr = c.notNull
      ? `serializeDateTime(row.${c.drizzleKey})!`
      : `row.${c.drizzleKey} != null ? serializeDateTime(row.${c.drizzleKey}) : null`;
    return `  return resolvedSort.map((s) => {
    if (s.drizzleKey === "${c.drizzleKey}") return ${expr};
    return row[s.drizzleKey as keyof typeof row];
  });`;
  }
  const cases = tzCols
    .map((c) => {
      const expr = c.notNull
        ? `return serializeDateTime(row.${c.drizzleKey})!;`
        : `return row.${c.drizzleKey} != null ? serializeDateTime(row.${c.drizzleKey}) : null;`;
      return `      case "${c.drizzleKey}":
        ${expr}`;
    })
    .join("\n");
  return `  return resolvedSort.map((s) => {
    switch (s.drizzleKey) {
${cases}
      default:
        return row[s.drizzleKey as keyof typeof row];
    }
  });`;
}

function cursorDeserializeBody(sortCols: ColumnModel[]): string {
  const tzCols = sortCols.filter((c) => c.kind === "timestamptz");
  if (tzCols.length === 0) {
    return `  return values;`;
  }
  if (tzCols.length === 1) {
    const c = tzCols[0]!;
    return `  return values.map((value, index) => {
    if (resolvedSort[index]?.drizzleKey === "${c.drizzleKey}") return new Date(value as string);
    return value;
  });`;
  }
  const cases = tzCols
    .map((c) => `      case "${c.drizzleKey}":
        return new Date(value as string);`)
    .join("\n");
  return `  return values.map((value, index) => {
    switch (resolvedSort[index]?.drizzleKey) {
${cases}
      default:
        return value;
    }
  });`;
}

function parentBatchMethods(entity: EntityModel, entities: EntityModel[]): string {
  const methods: string[] = [];
  for (const parent of entities) {
    for (const rel of parent.relations) {
      if (rel.targetExportName !== entity.exportName || !rel.childFkDrizzleKey) continue;
      const parentType = parent.graphqlType;
      const fk = rel.childFkDrizzleKey;

      if (rel.kind === "one-to-many") {
        methods.push(`  async findBy${parentType}Ids(${parent.fieldBasename}Ids: string[]): Promise<Map<string, ${entity.graphqlType}Record[]>> {
    if (${parent.fieldBasename}Ids.length === 0) return new Map();
    const unique = [...new Set(${parent.fieldBasename}Ids)];
    const rows = await db.select().from(table).where(inArray(table.${fk}, unique));
    const map = new Map<string, ${entity.graphqlType}Record[]>();
    for (const id of unique) map.set(id, []);
    for (const row of rows) {
      const key = row.${fk} as string;
      map.get(key)?.push(mapRow(row));
    }
    return map;
  }`);
      }

      if (rel.kind === "one-to-one" && !rel.ownerFkDrizzleKey) {
        methods.push(`  async findOneBy${parentType}Ids(${parent.fieldBasename}Ids: string[]): Promise<Map<string, ${entity.graphqlType}Record | undefined>> {
    if (${parent.fieldBasename}Ids.length === 0) return new Map();
    const unique = [...new Set(${parent.fieldBasename}Ids)];
    const rows = await db.select().from(table).where(inArray(table.${fk}, unique));
    const map = new Map<string, ${entity.graphqlType}Record | undefined>();
    for (const id of unique) map.set(id, undefined);
    for (const row of rows) {
      map.set(row.${fk} as string, mapRow(row));
    }
    return map;
  }`);
      }
    }
  }
  return methods.join("\n\n");
}

export function generateRepository(
  entity: EntityModel,
  entities: EntityModel[],
  config: ResolvedDalConfig,
): string {
  const E = entity.graphqlType;
  const e = entity.fieldBasename;
  const exportName = entity.exportName;
  const soft = entity.deleteStrategy === "soft";
  const full = entity.auditProfile === "full";

  const businessCols = entity.columns.filter((c) => c.isBusiness);
  const recordCols = internalRecordColumns(entity);
  const sortCols = recordCols;

  const extraTableImports = collectRelationTableImports(entity, entities);
  extraTableImports.delete(exportName);

  const mapRowFields = recordCols
    .map((col) => {
      if (col.kind === "timestamptz") {
        return col.notNull
          ? `    ${col.graphqlName}: serializeDateTime(row.${col.drizzleKey})!,`
          : `    ${col.graphqlName}: row.${col.drizzleKey} != null ? serializeDateTime(row.${col.drizzleKey}) : null,`;
      }
      return `    ${col.graphqlName}: row.${col.drizzleKey},`;
    })
    .join("\n");

  const columnDescriptors = recordCols
    .map(
      (c) =>
        `  { graphqlName: "${c.graphqlName}", drizzleKey: "${c.drizzleKey}", kind: "${c.kind}" as const, column: table.${c.drizzleKey} },`,
    )
    .join("\n");

  const createValues = businessCols.map((col) => assignCreateValue(col)).join("\n");
  const updateSet = full ? businessCols.map((col) => assignUpdateValue(col)).join("\n") : "";

  const needsInArray = hasParentBatchMethods(entity, entities);
  const cursorSerializeFn = cursorSerializeBody(sortCols);
  const cursorDeserializeFn = cursorDeserializeBody(sortCols);

  const schemaImports = [exportName, ...extraTableImports].sort().join(", ");
  const bulkFilterBlock = full
    ? `
    assertFilterBulkConfirm(filter, confirmUpdateAll, "confirmUpdateAll");
    const matched = await this.count({ filter });
    assertFilterBulkCap(matched, BULK_FILTER_MAX);
    const where = queryEngine.buildWhere(filter);
    if (!where) throw new ValidationError("Filter required", ["filter"]);
    const actor = resolveActorId(ctx.actorId);
    const set: Partial<typeof table.$inferInsert> = {
      updatedAt: new Date(),
      updatedBy: actor,
    };
${updateSet}
    return db.transaction(async () => {
      const updated = await db.update(table).set(set).where(where).returning({ id: table.id });
      return { successCount: updated.length, failureCount: 0, userErrors: [] };
    });`
    : "";

  const bulkDeleteByFilterBlock = `
    assertFilterBulkConfirm(filter, confirmDeleteAll, "confirmDeleteAll");
    const matched = await this.count({ filter });
    assertFilterBulkCap(matched, BULK_FILTER_MAX);
    const where = queryEngine.buildWhere(filter);
    if (!where) throw new ValidationError("Filter required", ["filter"]);
    return db.transaction(async () => {
      ${soft ? `const actor = resolveActorId(ctx.actorId);
      const updated = await db.update(table).set({ deletedAt: new Date(), deletedBy: actor }).where(where).returning({ id: table.id });` : `const deleted = await db.delete(table).where(where).returning({ id: table.id });`}
      return { successCount: ${soft ? "updated" : "deleted"}.length, failureCount: 0, userErrors: [] };
    });`;

  return `// AUTO-GENERATED by @corpdk/dal-codegen — do not edit
${drizzleImportLine(needsInArray)}
${dalCoreImportBlock(entity)}
import { db } from "../../../db/index.js";
import { ${schemaImports} } from "../../../db/schema/index.js";

const table = ${exportName};
const FILTER_BUDGET = resolveFilterBudget({ maxDepth: ${config.filterMaxDepth}, maxNodes: ${config.filterMaxNodes} });
const BULK_FILTER_MAX = resolveBulkFilterMax();

const COLUMN_DESCRIPTORS: ColumnDescriptor[] = [
${columnDescriptors}
];

const RELATION_DESCRIPTORS: RelationDescriptor[] = ${buildRelationDescriptors(entity, entities)};

const queryEngine = new QueryEngine<typeof table.$inferSelect>(
  {
    db,
    table,
    columns: COLUMN_DESCRIPTORS,
    relations: RELATION_DESCRIPTORS,
    softDelete: ${soft},
    filterBudget: FILTER_BUDGET,
    entityGraphqlName: "${E}",
    cursorVersion: CURSOR_VERSION,
  },
  db,
  {
${sortCols
  .map(
    (c) =>
      `    ${c.graphqlName.replace(/([A-Z])/g, "_$1").toUpperCase()}: "${c.drizzleKey}",`,
  )
  .join("\n")}
  },
);

export type ${E}Record = {
${recordCols.map((c) => `  ${c.graphqlName}: ${tsTypeForColumn(c)}${c.notNull ? "" : " | null"};`).join("\n")}
};

export type ${E}CreateInput = {
${businessCols.map((c) => `  ${c.graphqlName}${c.notNull && !c.hasDefault ? "" : "?"}: ${tsTypeForColumn(c)}${!c.notNull ? " | null" : ""};`).join("\n")}
};

${full ? `export type ${E}UpdateInput = Partial<${E}CreateInput>;` : ""}

export type ${E}Filter = FilterAST;

function mapRow(row: typeof table.$inferSelect): ${E}Record {
  return {
${mapRowFields}
  };
}

function cursorValuesFromRow(row: typeof table.$inferSelect, resolvedSort: ResolvedSortKey[]): unknown[] {
${cursorSerializeFn}
}

function cursorValuesToDb(values: unknown[], resolvedSort: ResolvedSortKey[]): unknown[] {
${cursorDeserializeFn}
}

export class Generated${E}Repository {
  mapRow = mapRow;

  async findById(id: string, opts?: { includeDeleted?: boolean | null }): Promise<${E}Record | null> {
    assertValidUuid(id);
    const rows = await queryEngine.findByIds([id], opts?.includeDeleted);
    if (rows.length === 0) return null;
    return mapRow(rows[0]);
  }

  async findByIds(ids: string[], opts?: { includeDeleted?: boolean | null }): Promise<${E}Record[]> {
    const rows = await queryEngine.findByIds(ids, opts?.includeDeleted);
    return rows.map(mapRow);
  }

${parentBatchMethods(entity, entities)}

  async list(args: {
    filter?: ${E}Filter | null;
    sort?: SortInput[] | null;
    limit?: number | null;
    includeDeleted?: boolean | null;
  }): Promise<${E}Record[]> {
    return (await queryEngine.list(args, mapRow)) as ${E}Record[];
  }

  async count(args: {
    filter?: ${E}Filter | null;
    includeDeleted?: boolean | null;
  }): Promise<number> {
    return queryEngine.count(args);
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
    return queryEngine.listConnection(args, mapRow, cursorValuesFromRow, cursorValuesToDb);
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

  async bulkCreate(inputs: ${E}CreateInput[], ctx: RepositoryContext, atomic?: boolean | null) {
    const isAtomic = resolveBulkAtomic(inputs.length, atomic);
    if (isAtomic) {
      return db.transaction(async () => {
        const items: ${E}Record[] = [];
        for (const input of inputs) {
          const result = await this.create(input, ctx);
          if (result.userErrors.length > 0) throw new ValidationError(result.userErrors[0]!.message);
          if (result.${e}) items.push(result.${e});
        }
        return { items, userErrors: [] as const };
      }).catch((err) => {
        if (err instanceof ValidationError) {
          return { successCount: 0, failureCount: inputs.length, userErrors: [createUserError("VALIDATION_FAILED", err.message)] } satisfies BulkMutationResult;
        }
        throw err;
      });
    }
    const items: ${E}Record[] = [];
    const userErrors: BulkMutationResult["userErrors"] = [];
    let successCount = 0;
    for (const input of inputs) {
      const result = await this.create(input, ctx);
      if (result.${e} && result.userErrors.length === 0) {
        items.push(result.${e});
        successCount += 1;
      } else {
        userErrors.push(...result.userErrors);
      }
    }
    return { successCount, failureCount: inputs.length - successCount, userErrors };
  }

  ${full ? `async bulkUpdate(
    updates: Array<{ id: string; input: ${E}UpdateInput }>,
    ctx: RepositoryContext,
    atomic?: boolean | null,
  ) {
    const isAtomic = resolveBulkAtomic(updates.length, atomic);
    if (isAtomic) {
      return db.transaction(async () => {
        const items: ${E}Record[] = [];
        for (const entry of updates) {
          const result = await this.update(entry.id, entry.input, ctx);
          if (result.userErrors.length > 0) throw new ValidationError(result.userErrors[0]!.message);
          if (result.${e}) items.push(result.${e});
        }
        return { items, userErrors: [] as const };
      }).catch((err) => {
        if (err instanceof ValidationError) {
          return { successCount: 0, failureCount: updates.length, userErrors: [createUserError("VALIDATION_FAILED", err.message)] } satisfies BulkMutationResult;
        }
        throw err;
      });
    }
    const items: ${E}Record[] = [];
    const userErrors: BulkMutationResult["userErrors"] = [];
    let successCount = 0;
    for (const entry of updates) {
      const result = await this.update(entry.id, entry.input, ctx);
      if (result.${e} && result.userErrors.length === 0) {
        items.push(result.${e});
        successCount += 1;
      } else {
        userErrors.push(...result.userErrors.map((e) => ({ ...e, id: e.id ?? entry.id })));
      }
    }
    return { successCount, failureCount: updates.length - successCount, userErrors };
  }

  async bulkUpdateByFilter(
    filter: ${E}Filter,
    input: ${E}UpdateInput,
    ctx: RepositoryContext,
    confirmUpdateAll?: boolean | null,
  ): Promise<BulkMutationResult> {${bulkFilterBlock}
  }` : ""}

  async bulkDelete(ids: string[], ctx: RepositoryContext, atomic?: boolean | null) {
    const isAtomic = resolveBulkAtomic(ids.length, atomic);
    if (isAtomic) {
      return db.transaction(async () => {
        let count = 0;
        for (const id of ids) {
          const result = await this.delete(id, ctx);
          if (!result.success) throw new ValidationError(result.userErrors[0]?.message ?? "Delete failed");
          count += 1;
        }
        return { count, userErrors: [] as const };
      }).catch((err) => {
        if (err instanceof ValidationError) {
          return { successCount: 0, failureCount: ids.length, userErrors: [createUserError("VALIDATION_FAILED", err.message)] } satisfies BulkMutationResult;
        }
        throw err;
      });
    }
    const userErrors: BulkMutationResult["userErrors"] = [];
    let successCount = 0;
    for (const id of ids) {
      const result = await this.delete(id, ctx);
      if (result.success) successCount += 1;
      else userErrors.push(...result.userErrors.map((e) => ({ ...e, id: e.id ?? id })));
    }
    return { successCount, failureCount: ids.length - successCount, userErrors };
  }

  async bulkDeleteByFilter(
    filter: ${E}Filter,
    ctx: RepositoryContext,
    confirmDeleteAll?: boolean | null,
  ): Promise<BulkMutationResult> {${bulkDeleteByFilterBlock}
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
