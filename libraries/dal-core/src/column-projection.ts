import type { Column, Table } from "drizzle-orm";
import {
  Kind,
  type FragmentDefinitionNode,
  type GraphQLResolveInfo,
  type SelectionNode,
  type SelectionSetNode,
} from "graphql";
import type { ColumnDescriptor } from "./query-translator.js";

export interface RelationProjectionHint {
  fieldName: string;
  ownerFkDrizzleKey?: string;
}

export interface ColumnProjection {
  drizzleKeys: Set<string>;
}

const CONNECTION_WRAPPER_FIELDS = new Set(["edges", "nodes", "pageInfo"]);

function fieldNamesFromSelectionSet(
  selectionSet: SelectionSetNode | undefined | null,
  info: GraphQLResolveInfo,
  typeCondition?: string | null,
): Set<string> | null {
  if (!selectionSet?.selections?.length) return null;
  const names = new Set<string>();
  for (const sel of selectionSet.selections) {
    collectFieldNames(sel, names, info, typeCondition);
  }
  return names.size > 0 ? names : null;
}

function resolveFragmentDefinition(
  info: GraphQLResolveInfo,
  name: string,
): FragmentDefinitionNode | undefined {
  return info.fragments?.[name];
}

function collectFieldNames(
  node: SelectionNode,
  names: Set<string>,
  info: GraphQLResolveInfo,
  typeCondition?: string | null,
): void {
  if (node.kind === Kind.FIELD) {
    if (node.name.value === "__typename") return;
    names.add(node.name.value);
    return;
  }
  if (node.kind === Kind.INLINE_FRAGMENT) {
    const fragmentType = node.typeCondition?.name.value ?? typeCondition ?? null;
    for (const inner of node.selectionSet.selections) {
      collectFieldNames(inner, names, info, fragmentType);
    }
    return;
  }
  if (node.kind === Kind.FRAGMENT_SPREAD) {
    const frag = resolveFragmentDefinition(info, node.name.value);
    if (!frag) return;
    const fragmentType = frag.typeCondition.name.value;
    if (typeCondition && fragmentType !== typeCondition) return;
    for (const inner of frag.selectionSet.selections) {
      collectFieldNames(inner, names, info, fragmentType);
    }
  }
}

function findNestedSelection(
  selectionSet: SelectionSetNode | undefined | null,
  targetNames: string[],
): SelectionSetNode | null {
  if (!selectionSet) return null;
  for (const sel of selectionSet.selections) {
    if (sel.kind !== Kind.FIELD) continue;
    const name = sel.name.value;
    if (targetNames.includes(name) && sel.selectionSet) {
      if (name === "edges") {
        for (const edgeSel of sel.selectionSet.selections) {
          if (edgeSel.kind === Kind.FIELD && edgeSel.name.value === "node" && edgeSel.selectionSet) {
            return edgeSel.selectionSet;
          }
        }
        return null;
      }
      return sel.selectionSet;
    }
  }
  return null;
}

/** Derive scalar GraphQL field names requested for an entity type from resolve info. */
export function collectEntityFieldSelection(
  info: GraphQLResolveInfo,
  entityGraphqlType: string,
): Set<string> | null {
  const rootField = info.fieldNodes[0];
  if (!rootField?.selectionSet) return null;

  let selectionSet: SelectionSetNode | null = rootField.selectionSet;

  const nested = findNestedSelection(selectionSet, ["edges", "nodes"]);
  if (nested) {
    selectionSet = nested;
  }

  const direct = fieldNamesFromSelectionSet(selectionSet, info, entityGraphqlType);
  if (!direct) return null;

  const filtered = new Set<string>();
  for (const name of direct) {
    if (!CONNECTION_WRAPPER_FIELDS.has(name)) {
      filtered.add(name);
    }
  }

  if (filtered.size === 0 && direct.has("pageInfo")) {
    return new Set(["id"]);
  }

  return filtered.size > 0 ? filtered : null;
}

export function buildColumnProjection(options: {
  columns: ColumnDescriptor[];
  softDelete: boolean;
  relations: RelationProjectionHint[];
  selectedGraphqlFields: Set<string> | null;
  sortDrizzleKeys?: string[];
}): ColumnProjection | null {
  if (!options.selectedGraphqlFields) return null;

  const keys = new Set<string>(["id"]);
  if (options.softDelete) {
    keys.add("deletedAt");
    keys.add("deletedBy");
  }

  for (const col of options.columns) {
    if (options.selectedGraphqlFields.has(col.graphqlName)) {
      keys.add(col.drizzleKey);
    }
  }

  for (const rel of options.relations) {
    if (rel.ownerFkDrizzleKey && options.selectedGraphqlFields.has(rel.fieldName)) {
      keys.add(rel.ownerFkDrizzleKey);
    }
  }

  for (const sk of options.sortDrizzleKeys ?? []) {
    keys.add(sk);
  }

  return { drizzleKeys: keys };
}

export function buildProjectedSelectShape(
  table: Table,
  projection: ColumnProjection | null,
): Record<string, Column> | null {
  if (!projection) return null;
  const record = table as unknown as Record<string, Column>;
  const shape: Record<string, Column> = {};
  for (const key of projection.drizzleKeys) {
    const col = record[key];
    if (col) shape[key] = col;
  }
  if (Object.keys(shape).length === 0) {
    const idCol = record.id;
    if (idCol) shape.id = idCol;
  }
  return shape;
}

export function resolveColumnProjectionFromInfo(
  info: GraphQLResolveInfo,
  entityGraphqlType: string,
  columns: ColumnDescriptor[],
  softDelete: boolean,
  relations: RelationProjectionHint[],
  sortDrizzleKeys?: string[],
): ColumnProjection | null {
  const selected = collectEntityFieldSelection(info, entityGraphqlType);
  return buildColumnProjection({
    columns,
    softDelete,
    relations,
    selectedGraphqlFields: selected,
    sortDrizzleKeys,
  });
}
