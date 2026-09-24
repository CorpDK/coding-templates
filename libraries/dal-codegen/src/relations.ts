import type { Column } from "drizzle-orm";
import { isTable } from "drizzle-orm";
import { is } from "drizzle-orm/entity";
import {
  createTableRelationsHelpers,
  extractTablesRelationalConfig,
  Many,
  One,
} from "drizzle-orm/relations";
import { getTableConfig } from "drizzle-orm/pg-core";
import { toGraphqlTypeName } from "@corpdk/dal-core";
import type { EntityModel, RelationModel } from "./model.js";

function hasUniqueOnColumn(exportName: string, drizzleKey: string, combined: Record<string, unknown>): boolean {
  const table = combined[exportName];
  if (!isTable(table)) return false;
  const config = getTableConfig(table);
  const cols = config.columns;
  const targetCol = cols[drizzleKey as keyof typeof cols];
  if (!targetCol) return false;
  return config.indexes.some(
    (idx) =>
      idx.config.unique &&
      idx.config.columns.length === 1 &&
      idx.config.columns[0] === targetCol,
  );
}

function singularize(exportName: string): string {
  if (exportName.endsWith("ies")) return exportName.slice(0, -3) + "y";
  if (exportName.endsWith("s")) return exportName.slice(0, -1);
  return exportName;
}

function columnDrizzleKey(
  tableExport: string,
  col: Column,
  tables: ReturnType<typeof extractTablesRelationalConfig>["tables"],
): string {
  const cols = tables[tableExport]?.columns;
  if (!cols) return col.name;
  for (const [key, value] of Object.entries(cols)) {
    if (value === col) return key;
  }
  return col.name;
}

function resolveTableExport(
  relation: { referencedTableName: string },
  tables: ReturnType<typeof extractTablesRelationalConfig>["tables"],
  tableNamesMap: Record<string, string>,
): string | undefined {
  const dbName = relation.referencedTableName;
  for (const [uniqueName, tsName] of Object.entries(tableNamesMap)) {
    if (uniqueName.endsWith(`.${dbName}`) || uniqueName === dbName) return tsName;
  }
  return Object.entries(tables).find(([, cfg]) => cfg.dbName === dbName)?.[0];
}

function fkMatchesEntity(fkKey: string, entityExport: string): boolean {
  if (!fkKey.endsWith("Id")) return false;
  const prefix = fkKey.slice(0, -2);
  return prefix === singularize(entityExport) || `${prefix}s` === entityExport;
}

/** FK column on the child table that references the parent entity (not parent.id). */
function childFkReferencingParent(
  childExport: string,
  parentExport: string,
  tables: ReturnType<typeof extractTablesRelationalConfig>["tables"],
): string | undefined {
  const child = tables[childExport];
  if (!child) return undefined;
  const fkKeys = Object.keys(child.columns).filter((k) => k.endsWith("Id") && k !== "id");
  return fkKeys.find((fk) => fkMatchesEntity(fk, parentExport));
}

function inferManyToMany(
  junctionExport: string,
  ownerExport: string,
  tables: ReturnType<typeof extractTablesRelationalConfig>["tables"],
): { joinOwnerFk: string; joinTargetFk: string; targetExport: string } | null {
  const junction = tables[junctionExport];
  if (!junction) return null;
  const fkKeys = Object.keys(junction.columns).filter((k) => k.endsWith("Id") && k !== "id");
  if (fkKeys.length !== 2) return null;
  const ownerFk = fkKeys.find((fk) => fkMatchesEntity(fk, ownerExport));
  if (!ownerFk) return null;
  const targetFk = fkKeys.find((fk) => fk !== ownerFk);
  if (!targetFk) return null;
  const targetPrefix = targetFk.slice(0, -2);
  const targetExport = Object.keys(tables).find(
    (k) => singularize(k) === targetPrefix || k === `${targetPrefix}s`,
  );
  if (!targetExport) return null;
  return { joinOwnerFk: ownerFk, joinTargetFk: targetFk, targetExport };
}

function relationFromOneSide(
  fieldName: string,
  entity: EntityModel,
  targetExport: string,
  targetEntity: EntityModel,
  relation: One,
  combined: Record<string, unknown>,
  tables: ReturnType<typeof extractTablesRelationalConfig>["tables"],
): RelationModel {
  const oneConfig = relation.config;
  if (oneConfig?.fields?.length) {
    const fkKey = columnDrizzleKey(entity.exportName, oneConfig.fields[0]!, tables);
    const isOneToOne = hasUniqueOnColumn(entity.exportName, fkKey, combined);
    return {
      fieldName,
      kind: isOneToOne ? "one-to-one" : "many-to-one",
      targetExportName: targetExport,
      targetGraphqlType: targetEntity.graphqlType,
      ownerFkDrizzleKey: fkKey,
      ownerFkGraphqlName: entity.columns.find((c) => c.drizzleKey === fkKey)?.graphqlName,
      filterable: true,
      navigationList: false,
      navigationNullable: !oneConfig.fields[0]!.notNull,
    };
  }
  const childFk = childFkReferencingParent(targetExport, entity.exportName, tables);
  return {
    fieldName,
    kind: "one-to-one",
    targetExportName: targetExport,
    targetGraphqlType: targetEntity.graphqlType,
    childFkDrizzleKey: childFk,
    filterable: true,
    navigationList: false,
    navigationNullable: true,
  };
}

function relationFromManySide(
  fieldName: string,
  entity: EntityModel,
  targetExport: string,
  targetEntity: EntityModel,
  entityByExport: Map<string, EntityModel>,
  tables: ReturnType<typeof extractTablesRelationalConfig>["tables"],
): RelationModel {
  const junctionBusinessCols = targetEntity.columns.filter(
    (c) => c.isBusiness && !(c.drizzleKey.endsWith("Id") && c.drizzleKey !== "id"),
  );
  const m2m =
    junctionBusinessCols.length === 0 ? inferManyToMany(targetExport, entity.exportName, tables) : null;
  if (m2m) {
    const finalTarget = entityByExport.get(m2m.targetExport);
    return {
      fieldName,
      kind: "many-to-many",
      targetExportName: m2m.targetExport,
      targetGraphqlType: finalTarget?.graphqlType ?? toGraphqlTypeName(m2m.targetExport),
      joinTableExportName: targetExport,
      joinOwnerFkDrizzleKey: m2m.joinOwnerFk,
      joinTargetFkDrizzleKey: m2m.joinTargetFk,
      filterable: true,
      navigationList: true,
      navigationNullable: false,
    };
  }
  const childFk = childFkReferencingParent(targetExport, entity.exportName, tables);
  return {
    fieldName,
    kind: "one-to-many",
    targetExportName: targetExport,
    targetGraphqlType: targetEntity.graphqlType,
    childFkDrizzleKey: childFk,
    filterable: true,
    navigationList: true,
    navigationNullable: false,
  };
}

export function attachRelations(entities: EntityModel[], schemaModules: Record<string, unknown>[]): void {
  const combined: Record<string, unknown> = {};
  for (const mod of schemaModules) Object.assign(combined, mod);

  const { tables, tableNamesMap } = extractTablesRelationalConfig(
    combined,
    createTableRelationsHelpers,
  );

  const entityByExport = new Map(entities.map((e) => [e.exportName, e]));

  for (const entity of entities) {
    entity.relations = [];
    const tableConfig = tables[entity.exportName];
    if (!tableConfig) continue;

    for (const [fieldName, relation] of Object.entries(tableConfig.relations)) {
      const targetExport = resolveTableExport(relation, tables, tableNamesMap);
      if (!targetExport || !entityByExport.has(targetExport)) continue;

      const targetEntity = entityByExport.get(targetExport)!;
      if (is(relation, One)) {
        entity.relations.push(
          relationFromOneSide(fieldName, entity, targetExport, targetEntity, relation as One, combined, tables),
        );
      } else if (is(relation, Many)) {
        entity.relations.push(
          relationFromManySide(fieldName, entity, targetExport, targetEntity, entityByExport, tables),
        );
      }
    }
  }

  for (const entity of entities) {
    for (const col of entity.columns) {
      const isOwnerFk = entity.relations.some((r) => r.ownerFkDrizzleKey === col.drizzleKey);
      col.omitFromOutput = isOwnerFk || (col.drizzleKey.endsWith("Id") && col.drizzleKey !== "id");
    }
  }
}
