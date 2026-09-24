import type { DalConfig } from "../config.js";
import type { EntityModel } from "../model.js";
import { internalRecordColumns } from "./schema-utils.js";
import {
  assignCreateValue,
  assignUpdateValue,
  constraintMetadataBlock,
  cursorDeserializeBody,
  cursorSerializeBody,
  dalCoreImportBlock,
  mapRowFieldLine,
  tsTypeForColumn,
} from "./repository-scalars.js";

type ResolvedDalConfig = Required<DalConfig>;

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

function relationsVarName(exportName: string): string {
  return `${exportName}Relations`;
}

function relVarName(exportName: string, fieldName: string): string {
  return `${exportName}_${fieldName}Rel`;
}

function resolveRelationTargets(
  rel: EntityModel["relations"][number],
  entities: EntityModel[],
): {
  targetEntity: EntityModel | undefined;
  childEntity: EntityModel | undefined;
} {
  const entityByExport = new Map(entities.map((e) => [e.exportName, e]));
  const target = entityByExport.get(rel.targetExportName);
  let child: EntityModel | undefined;
  if (rel.kind === "one-to-many") {
    child = target;
  } else if (rel.kind === "many-to-many" && rel.joinTableExportName) {
    child = entityByExport.get(rel.joinTableExportName);
  }
  const m2mTarget = rel.kind === "many-to-many" ? target : undefined;
  const targetExport =
    rel.kind === "many-to-many" ? (m2mTarget?.exportName ?? rel.targetExportName) : rel.targetExportName;
  const targetEntity = entityByExport.get(targetExport) ?? target;
  return { targetEntity, childEntity: child };
}

function relationDescriptorWiringLines(
  rel: EntityModel["relations"][number],
  entity: EntityModel,
  varName: string,
  targetEntity: EntityModel | undefined,
  childEntity: EntityModel | undefined,
): string[] {
  const lines: string[] = [];
  if (
    (rel.kind === "many-to-one" ||
      rel.kind === "many-to-many" ||
      (rel.kind === "one-to-one" && rel.ownerFkDrizzleKey)) &&
    targetEntity
  ) {
    lines.push(`${varName}.targetRelations = ${relationsVarName(targetEntity.exportName)};`);
  }
  if (rel.kind === "one-to-many" && childEntity) {
    lines.push(`${varName}.childRelations = ${relationsVarName(childEntity.exportName)};`);
  }
  if (rel.kind === "one-to-one" && rel.childFkDrizzleKey && targetEntity) {
    lines.push(`${varName}.targetRelations = ${relationsVarName(targetEntity.exportName)};`);
  }
  return lines;
}

function buildRelationDescriptorObject(
  rel: EntityModel["relations"][number],
  entities: EntityModel[],
): string {
  const { targetEntity, childEntity } = resolveRelationTargets(rel, entities);

  return `{
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
    childTable: ${childEntity ? childEntity.exportName : "undefined"},
    childColumns: ${childEntity ? `[\n      ${columnDescriptorLines(childEntity.exportName, childEntity)}\n    ]` : "undefined"},
    joinTable: ${rel.joinTableExportName ?? "undefined"},
    joinColumns: undefined,
    targetSoftDelete: ${targetEntity?.deleteStrategy === "soft"},
    childSoftDelete: ${childEntity?.deleteStrategy === "soft"},
    filterable: true,
  }`;
}

export function generateRelationDescriptorsModule(entities: EntityModel[]): string {
  const schemaImports = new Set<string>();
  for (const entity of entities) {
    schemaImports.add(entity.exportName);
    for (const rel of entity.relations) {
      if (rel.targetExportName) schemaImports.add(rel.targetExportName);
      if (rel.joinTableExportName) schemaImports.add(rel.joinTableExportName);
    }
  }

  const relDecls: string[] = [];
  const arrayDecls: string[] = [];
  const wiring: string[] = [];
  const mapEntries: string[] = [];

  for (const entity of entities) {
    const filterable = entity.relations.filter((r) => r.filterable);
    const relVars: string[] = [];

    for (const rel of filterable) {
      const varName = relVarName(entity.exportName, rel.fieldName);
      relDecls.push(`const ${varName}: RelationDescriptor = ${buildRelationDescriptorObject(rel, entities)};`);
      relVars.push(varName);

      const { targetEntity, childEntity } = resolveRelationTargets(rel, entities);
      wiring.push(...relationDescriptorWiringLines(rel, entity, varName, targetEntity, childEntity));
    }

    const arrayName = relationsVarName(entity.exportName);
    if (relVars.length === 0) {
      arrayDecls.push(`const ${arrayName}: RelationDescriptor[] = [];`);
    } else {
      arrayDecls.push(`const ${arrayName}: RelationDescriptor[] = [\n  ${relVars.join(",\n  ")},\n];`);
    }
    mapEntries.push(`  [${entity.exportName}, ${arrayName}],`);
  }

  return `// AUTO-GENERATED by @corpdk/dal-codegen — do not edit
import type { RelationDescriptor } from "@corpdk/dal-core";
import type { Table } from "drizzle-orm";
import { ${[...schemaImports].sort((a, b) => a.localeCompare(b)).join(", ")} } from "../../../db/schema/index.js";

${relDecls.join("\n\n")}

${arrayDecls.join("\n\n")}

${wiring.join("\n")}

export const RELATION_DESCRIPTORS_BY_TABLE = new Map<Table, RelationDescriptor[]>([
${mapEntries.join("\n")}
]);
`;
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

function drizzleImportLine(entity: EntityModel, entities: EntityModel[]): string {
  const soft = entity.deleteStrategy === "soft";
  const hasM2m = entity.relations.some((r) => r.kind === "many-to-many");
  const m2mTargetSoft = entity.relations.some((r) => {
    if (r.kind !== "many-to-many") return false;
    const target = entities.find((e) => e.exportName === r.targetExportName);
    return target?.deleteStrategy === "soft";
  });
  const m2mJoinSoft = entity.relations.some((r) => {
    if (r.kind !== "many-to-many" || !r.joinTableExportName) return false;
    const join = entities.find((e) => e.exportName === r.joinTableExportName);
    return join?.deleteStrategy === "soft";
  });
  const parts = ["eq", "inArray"];
  if (soft || m2mTargetSoft || m2mJoinSoft || hasM2m) parts.push("and");
  if (soft || m2mTargetSoft || m2mJoinSoft) parts.push("isNull");
  return `import { ${parts.join(", ")} } from "drizzle-orm";`;
}

function manyToManyTargetRecordImports(entity: EntityModel, entities: EntityModel[]): string {
  const imports = new Set<string>();
  for (const rel of entity.relations) {
    if (rel.kind !== "many-to-many") continue;
    const target = entities.find((e) => e.exportName === rel.targetExportName);
    if (!target) continue;
    imports.add(
      `import type { ${target.graphqlType}Record } from "./generated-${target.fieldBasename}.repository.js";`,
    );
  }
  return [...imports].sort((a, b) => a.localeCompare(b)).join("\n");
}

function activeRowWhere(idExpr: string, soft: boolean): string {
  return soft ? `and(eq(table.id, ${idExpr}), isNull(table.deletedAt))!` : `eq(table.id, ${idExpr})`;
}

function buildRelationProjectionHints(entity: EntityModel): string {
  const hints = entity.relations
    .filter((r) => r.ownerFkDrizzleKey)
    .map(
      (r) =>
        `  { fieldName: "${r.fieldName}", ownerFkDrizzleKey: "${r.ownerFkDrizzleKey}" },`,
    );
  if (hints.length === 0) return "[]";
  return `[\n${hints.join("\n")}\n]`;
}

function parentBatchMethods(entity: EntityModel, entities: EntityModel[]): string {
  const soft = entity.deleteStrategy === "soft";
  const batchWhere = (fk: string) =>
    soft
      ? `and(inArray(table.${fk}, unique), isNull(table.deletedAt))!`
      : `inArray(table.${fk}, unique)`;
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
    const rows = await db.select().from(table).where(${batchWhere(fk)});
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
    const rows = await db.select().from(table).where(${batchWhere(fk)});
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

function manyToManyBatchMethods(entity: EntityModel, entities: EntityModel[]): string {
  const methods: string[] = [];
  for (const rel of entity.relations) {
    if (rel.kind !== "many-to-many") continue;
    if (
      !rel.joinTableExportName ||
      !rel.joinOwnerFkDrizzleKey ||
      !rel.joinTargetFkDrizzleKey
    ) {
      continue;
    }
    const targetEntity = entities.find((e) => e.exportName === rel.targetExportName);
    if (!targetEntity) continue;
    const joinEntity = entities.find((e) => e.exportName === rel.joinTableExportName);

    const joinTable = rel.joinTableExportName;
    const targetExport = rel.targetExportName;
    const ownerFk = rel.joinOwnerFkDrizzleKey;
    const targetFk = rel.joinTargetFkDrizzleKey;
    const targetType = rel.targetGraphqlType;
    const targetSoft = targetEntity.deleteStrategy === "soft";
    const joinSoft = joinEntity?.deleteStrategy === "soft";
    const targetCols = internalRecordColumns(targetEntity);
    const selectFields = [
      `ownerId: ${joinTable}.${ownerFk}`,
      ...targetCols.map((c) => `${c.drizzleKey}: ${targetExport}.${c.drizzleKey}`),
    ].join(",\n      ");
    const mapFields = targetCols.map((c) => mapRowFieldLine(c)).join("\n");
    const whereParts = [`inArray(${joinTable}.${ownerFk}, unique)`];
    if (joinSoft) whereParts.push(`isNull(${joinTable}.deletedAt)`);
    if (targetSoft) whereParts.push(`isNull(${targetExport}.deletedAt)`);
    const whereClause =
      whereParts.length === 1 ? whereParts[0]! : `and(${whereParts.join(", ")})!`;

    methods.push(`  async find${targetType}sBy${entity.graphqlType}Ids(${entity.fieldBasename}Ids: string[]): Promise<Map<string, ${targetType}Record[]>> {
    if (${entity.fieldBasename}Ids.length === 0) return new Map();
    const unique = [...new Set(${entity.fieldBasename}Ids)];
    const rows = await db
      .select({
      ${selectFields}
      })
      .from(${joinTable})
      .innerJoin(${targetExport}, eq(${joinTable}.${targetFk}, ${targetExport}.id))
      .where(${whereClause});
    const map = new Map<string, ${targetType}Record[]>();
    for (const id of unique) map.set(id, []);
    for (const row of rows) {
      const ownerId = row.ownerId as string;
      map.get(ownerId)?.push({
${mapFields}
      });
    }
    return map;
  }`);
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

  const mapRowFields = recordCols.map((col) => mapRowFieldLine(col)).join("\n");

  const columnDescriptors = recordCols
    .map(
      (c) =>
        `  { graphqlName: "${c.graphqlName}", drizzleKey: "${c.drizzleKey}", kind: "${c.kind}" as const, column: table.${c.drizzleKey} },`,
    )
    .join("\n");

  const createValues = businessCols.map((col) => assignCreateValue(col)).join("\n");
  const updateSet = full ? businessCols.map((col) => assignUpdateValue(col)).join("\n") : "";

  const activeIdWhere = activeRowWhere("id", soft);
  const cursorSerializeFn = cursorSerializeBody(entity, sortCols);
  const cursorDeserializeFn = cursorDeserializeBody(entity, sortCols);
  const constraintsBlock = constraintMetadataBlock(entity);

  const schemaImports = [exportName, ...extraTableImports]
    .sort((a, b) => a.localeCompare(b))
    .join(", ");
  const bulkFilterBlock = full
    ? `
    assertFilterBulkConfirm(filter, confirmUpdateAll, "confirmUpdateAll");
    const where = queryEngine.buildWhere(filter);
    if (!where) throw new ValidationError("Filter required", ["filter"]);
    const actor = resolveActorId(ctx.actorId);
    const set: Partial<typeof table.$inferInsert> = {
      updatedAt: new Date(),
      updatedBy: actor,
    };
${updateSet}
    return db.transaction(async (tx) => {
      const matched = await tx.select({ id: table.id }).from(table).where(where).for("update");
      assertFilterBulkCap(matched.length, BULK_FILTER_MAX);
      const ids = matched.map((row) => row.id);
      if (ids.length === 0) {
        return { successCount: 0, failureCount: 0, userErrors: [], matchedIds: [] };
      }
      const updated = await tx.update(table).set(set).where(inArray(table.id, ids)).returning({ id: table.id });
      return { successCount: updated.length, failureCount: 0, userErrors: [], matchedIds: ids };
    });`
    : "";

  const bulkDeleteByFilterBlock = `
    assertFilterBulkConfirm(filter, confirmDeleteAll, "confirmDeleteAll");
    const where = queryEngine.buildWhere(filter);
    if (!where) throw new ValidationError("Filter required", ["filter"]);
    return db.transaction(async (tx) => {
      const matched = await tx.select({ id: table.id }).from(table).where(where).for("update");
      assertFilterBulkCap(matched.length, BULK_FILTER_MAX);
      const ids = matched.map((row) => row.id);
      if (ids.length === 0) {
        return { successCount: 0, failureCount: 0, userErrors: [], matchedIds: [] };
      }
      ${soft ? `const actor = resolveActorId(ctx.actorId);
      const updated = await tx.update(table).set({ deletedAt: new Date(), deletedBy: actor }).where(inArray(table.id, ids)).returning({ id: table.id });` : `const deleted = await tx.delete(table).where(inArray(table.id, ids)).returning({ id: table.id });`}
      return { successCount: ${soft ? "updated" : "deleted"}.length, failureCount: 0, userErrors: [], matchedIds: ids };
    });`;

  const m2mRecordImports = manyToManyTargetRecordImports(entity, entities);

  return `// AUTO-GENERATED by @corpdk/dal-codegen — do not edit
${drizzleImportLine(entity, entities)}
${dalCoreImportBlock(entity)}
import type { GraphQLResolveInfo } from "graphql";
import { db } from "../../../db/index.js";
import { ${schemaImports} } from "../../../db/schema/index.js";
import { RELATION_DESCRIPTORS_BY_TABLE } from "./generated-relation-descriptors.js";
${m2mRecordImports ? `${m2mRecordImports}\n` : ""}

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbConn = typeof db | DbTransaction;

const table = ${exportName};
const FILTER_BUDGET = resolveFilterBudget({ maxDepth: ${config.filterMaxDepth}, maxNodes: ${config.filterMaxNodes} });
const BULK_FILTER_MAX = resolveBulkFilterMax();

const COLUMN_DESCRIPTORS: ColumnDescriptor[] = [
${columnDescriptors}
];

const RELATION_DESCRIPTORS = RELATION_DESCRIPTORS_BY_TABLE.get(table)!;

const RELATION_PROJECTION_HINTS: RelationProjectionHint[] = ${buildRelationProjectionHints(entity)};

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

${constraintsBlock}

function validateCreateInput(input: ${E}CreateInput) {
  validateColumnConstraints(input as Record<string, unknown>, COLUMN_CONSTRAINTS, "create");
}

${full ? `function validateUpdateInput(input: ${E}UpdateInput) {
  validateColumnConstraints(input as Record<string, unknown>, COLUMN_CONSTRAINTS, "update");
}
` : ""}

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

function columnProjectionFromInfo(
  info: GraphQLResolveInfo | undefined,
  sortDrizzleKeys?: string[],
) {
  if (!info) return null;
  return resolveColumnProjectionFromInfo(
    info,
    "${E}",
    COLUMN_DESCRIPTORS,
    ${soft},
    RELATION_PROJECTION_HINTS,
    sortDrizzleKeys,
  );
}

export class Generated${E}Repository {
  mapRow = mapRow;

  async findById(
    id: string,
    opts?: { includeDeleted?: boolean | null },
    info?: GraphQLResolveInfo,
  ): Promise<${E}Record | null> {
    assertValidUuid(id);
    const projection = columnProjectionFromInfo(info);
    const rows = await queryEngine.findByIds([id], opts?.includeDeleted, projection);
    if (rows.length === 0) return null;
    return mapRow(rows[0]);
  }

  async findByIds(ids: string[], opts?: { includeDeleted?: boolean | null }): Promise<${E}Record[]> {
    const rows = await queryEngine.findByIds(ids, opts?.includeDeleted);
    return rows.map(mapRow);
  }

${parentBatchMethods(entity, entities)}

${manyToManyBatchMethods(entity, entities)}

  async list(
    args: {
      filter?: ${E}Filter | null;
      sort?: SortInput[] | null;
      limit?: number | null;
      includeDeleted?: boolean | null;
    },
    info?: GraphQLResolveInfo,
  ): Promise<${E}Record[]> {
    const resolvedSort = queryEngine.resolveSort(args.sort);
    const projection = columnProjectionFromInfo(
      info,
      resolvedSort.map((s) => s.drizzleKey),
    );
    return (await queryEngine.list(args, mapRow, projection)) as ${E}Record[];
  }

  async count(args: {
    filter?: ${E}Filter | null;
    includeDeleted?: boolean | null;
  }): Promise<number> {
    return queryEngine.count(args);
  }

  async listConnection(
    args: {
      filter?: ${E}Filter | null;
      sort?: SortInput[] | null;
      first?: number | null;
      after?: string | null;
      last?: number | null;
      before?: string | null;
      includeDeleted?: boolean | null;
    },
    info?: GraphQLResolveInfo,
  ) {
    const resolvedSort = queryEngine.resolveSort(args.sort);
    const projection = columnProjectionFromInfo(
      info,
      resolvedSort.map((s) => s.drizzleKey),
    );
    return queryEngine.listConnection(
      args,
      mapRow,
      cursorValuesFromRow,
      cursorValuesToDb,
      projection,
    );
  }

  async create(input: ${E}CreateInput, ctx: RepositoryContext, conn: DbConn = db) {
    try {
      validateCreateInput(input);
      const actor = resolveActorId(ctx.actorId);
      const now = new Date();
      const values = {
${createValues}
        createdAt: now,
        ${full ? "updatedAt: now," : ""}
        createdBy: actor,
        ${full ? "updatedBy: actor," : ""}
      };
      const inserted = await conn.insert(table).values(values).returning();
      const row = mapRow(inserted[0]);
      return successPayload({ ${e}: row });
    } catch (err) {
      if (err instanceof ValidationError) {
        return errorPayload({ ${e}: null }, [createUserError("VALIDATION_FAILED", err.message, { field: err.field })]);
      }
      return errorPayload({ ${e}: null }, [mapDriverError(err, "postgresql")]);
    }
  }

  ${full ? `async update(id: string, input: ${E}UpdateInput, ctx: RepositoryContext, conn: DbConn = db) {
    try {
      assertValidUuid(id);
      validateUpdateInput(input);
      const actor = resolveActorId(ctx.actorId);
      const set: Partial<typeof table.$inferInsert> = {
        updatedAt: new Date(),
        updatedBy: actor,
      };
${updateSet}
      const updated = await conn.update(table).set(set).where(${activeIdWhere}).returning();
      if (updated.length === 0) {
        return errorPayload({ ${e}: null }, [createUserError("NOT_FOUND", "${E} not found", { id })]);
      }
      return successPayload({ ${e}: mapRow(updated[0]) });
    } catch (err) {
      if (err instanceof ValidationError) {
        return errorPayload({ ${e}: null }, [createUserError("VALIDATION_FAILED", err.message, { field: err.field })]);
      }
      return errorPayload({ ${e}: null }, [mapDriverError(err, "postgresql")]);
    }
  }` : ""}

  async delete(id: string, ctx: RepositoryContext, conn: DbConn = db) {
    try {
      assertValidUuid(id);
      ${soft ? `const actor = resolveActorId(ctx.actorId);
      const updated = await conn.update(table).set({ deletedAt: new Date(), deletedBy: actor }).where(${activeIdWhere}).returning({ id: table.id });` : `const deleted = await conn.delete(table).where(${activeIdWhere}).returning({ id: table.id });`}
      if (${soft ? "updated" : "deleted"}.length === 0) {
        return errorPayload({ success: false }, [createUserError("NOT_FOUND", "${E} not found", { id })]);
      }
      return successPayload({ success: true });
    } catch (err) {
      return errorPayload({ success: false }, [mapDriverError(err, "postgresql")]);
    }
  }

  async bulkCreate(inputs: ${E}CreateInput[], ctx: RepositoryContext, atomic?: boolean | null) {
    const isAtomic = resolveBulkAtomic(inputs.length, atomic);
    if (isAtomic) {
      return db.transaction(async (tx) => {
        const items: ${E}Record[] = [];
        for (const input of inputs) {
          const result = await this.create(input, ctx, tx);
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
    const userErrors: BulkMutationResult["userErrors"] = [];
    const matchedIds: string[] = [];
    let successCount = 0;
    for (const input of inputs) {
      const result = await this.create(input, ctx);
      if (result.${e} && result.userErrors.length === 0) {
        successCount += 1;
        matchedIds.push(result.${e}.id);
      } else {
        userErrors.push(...result.userErrors);
      }
    }
    return { successCount, failureCount: inputs.length - successCount, userErrors, matchedIds };
  }

  ${full ? `async bulkUpdate(
    updates: Array<{ id: string; input: ${E}UpdateInput }>,
    ctx: RepositoryContext,
    atomic?: boolean | null,
  ) {
    const isAtomic = resolveBulkAtomic(updates.length, atomic);
    if (isAtomic) {
      return db.transaction(async (tx) => {
        const items: ${E}Record[] = [];
        for (const entry of updates) {
          const result = await this.update(entry.id, entry.input, ctx, tx);
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
    const userErrors: BulkMutationResult["userErrors"] = [];
    const matchedIds: string[] = [];
    let successCount = 0;
    for (const entry of updates) {
      const result = await this.update(entry.id, entry.input, ctx);
      if (result.${e} && result.userErrors.length === 0) {
        successCount += 1;
        matchedIds.push(result.${e}.id);
      } else {
        userErrors.push(...result.userErrors.map((e) => ({ ...e, id: e.id ?? entry.id })));
      }
    }
    return { successCount, failureCount: updates.length - successCount, userErrors, matchedIds };
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
      return db.transaction(async (tx) => {
        let count = 0;
        for (const id of ids) {
          const result = await this.delete(id, ctx, tx);
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
    const matchedIds: string[] = [];
    let successCount = 0;
    for (const id of ids) {
      const result = await this.delete(id, ctx);
      if (result.success) {
        successCount += 1;
        matchedIds.push(id);
      } else userErrors.push(...result.userErrors.map((e) => ({ ...e, id: e.id ?? id })));
    }
    return { successCount, failureCount: ids.length - successCount, userErrors, matchedIds };
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
