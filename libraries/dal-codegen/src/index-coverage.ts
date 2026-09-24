import { getTableColumns, isTable } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import type { Column } from "drizzle-orm";

export interface IndexCoverageOptions {
  /** When true, column must be the leading key of a composite index (filter-field v2 heuristic). */
  leadingOnly?: boolean;
  /** Primary key on `id` is treated as covered when true (default). */
  treatIdAsCovered?: boolean;
}

function samePhysicalColumn(a: Column, b: Column): boolean {
  return a.name === b.name;
}

export function columnMatchesIndex(
  indexColumns: readonly Column[],
  targetCol: Column,
  leadingOnly: boolean,
): boolean {
  if (indexColumns.length === 0) return false;
  if (leadingOnly) return samePhysicalColumn(indexColumns[0]!, targetCol);
  return indexColumns.some((c) => samePhysicalColumn(c, targetCol));
}

/** Whether Drizzle declares an index (or unique index) covering `drizzleKey` on `tableExport`. */
export function hasIndexCoverage(
  tableExport: string,
  drizzleKey: string,
  combined: Record<string, unknown>,
  options: IndexCoverageOptions = {},
): boolean {
  const { leadingOnly = false, treatIdAsCovered = true } = options;
  if (treatIdAsCovered && drizzleKey === "id") return true;

  const table = combined[tableExport];
  if (!isTable(table)) return false;

  const config = getTableConfig(table);
  const cols = getTableColumns(table) as Record<string, Column>;
  const targetCol = cols[drizzleKey];
  if (!targetCol) return false;

  for (const idx of config.indexes) {
    if (columnMatchesIndex(idx.config.columns as Column[], targetCol, leadingOnly)) {
      return true;
    }
  }

  for (const pk of config.primaryKeys) {
    if (columnMatchesIndex(pk.columns as Column[], targetCol, leadingOnly)) {
      return true;
    }
  }

  return false;
}
