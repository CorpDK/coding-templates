import { ValidationError } from "./errors.js";
import type { FilterAST } from "./filter-ast.js";
import {
  extractAssociationFilter,
  extractLogicalFilter,
  scalarFilterKeys,
} from "./filter-ast.js";

export const BULK_ATOMIC_THRESHOLD = 100;
export const DEFAULT_BULK_FILTER_MAX = 1000;

export interface BulkMutationResult {
  successCount: number;
  failureCount: number;
  userErrors: import("./types.js").MutationUserError[];
}

export function resolveBulkFilterMax(): number {
  const env = process.env.DAL_BULK_FILTER_MAX;
  if (env != null && env !== "") {
    const parsed = Number.parseInt(env, 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_BULK_FILTER_MAX;
}

/** Returns true when filter is empty (no scalar, logical, or association predicates). */
export function isEmptyFilter(filter: FilterAST | null | undefined): boolean {
  if (filter == null || typeof filter !== "object") return true;
  if (filter.and != null || filter.or != null || filter.not != null) return false;
  for (const key of scalarFilterKeys(filter)) {
    if (filter[key] != null) return false;
  }
  return true;
}

/** True when the filter carries no translatable predicates (empty or nested empty scalar leaves). */
export function isExistenceOnlyFilter(filter: FilterAST | null | undefined): boolean {
  if (filter == null || typeof filter !== "object") return true;
  const logical = extractLogicalFilter(filter);
  if (logical?.and?.length) return logical.and.every(isExistenceOnlyFilter);
  if (logical?.or?.length) return logical.or.every(isExistenceOnlyFilter);
  if (logical?.not) return false;
  const assoc = extractAssociationFilter(filter);
  if (assoc?.some != null) return isExistenceOnlyFilter(assoc.some);
  if (assoc?.none != null) return isExistenceOnlyFilter(assoc.none);
  if (assoc?.every != null) return false;
  for (const key of scalarFilterKeys(filter)) {
    const val = filter[key];
    if (val == null) continue;
    if (typeof val === "object" && isExistenceOnlyFilter(val as FilterAST)) continue;
    return false;
  }
  return true;
}

export function resolveBulkAtomic(itemCount: number, atomic?: boolean | null): boolean {
  if (atomic != null) return atomic;
  return itemCount <= BULK_ATOMIC_THRESHOLD;
}

export function assertFilterBulkConfirm(
  filter: FilterAST | null | undefined,
  confirmFlag: boolean | null | undefined,
  confirmField: string,
): void {
  if (isEmptyFilter(filter) && !confirmFlag) {
    throw new ValidationError(
      `Empty filter requires ${confirmField}: true`,
      [confirmField],
    );
  }
}

export function assertFilterBulkCap(matchedCount: number, cap: number): void {
  if (matchedCount > cap) {
    throw new ValidationError(
      `Filter matches ${matchedCount} rows, exceeding cap of ${cap}`,
      ["filter"],
    );
  }
}
