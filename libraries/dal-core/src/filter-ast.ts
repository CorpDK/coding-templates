/** Backend-agnostic filter tree shared by list, count, aggregate, and filter-based bulk ops. */
export type FilterAST = Record<string, unknown>;

export interface LogicalFilterAST {
  and?: FilterAST[] | null;
  or?: FilterAST[] | null;
  not?: FilterAST | null;
}

export interface AssociationFilterAST {
  some?: FilterAST | null;
  every?: FilterAST | null;
  none?: FilterAST | null;
}

export const LOGICAL_FILTER_KEYS = ["and", "or", "not"] as const;
export const ASSOCIATION_FILTER_KEYS = ["some", "every", "none"] as const;

export function isLogicalFilterNode(filter: FilterAST): boolean {
  return LOGICAL_FILTER_KEYS.some((key) => filter[key] != null);
}

export function isAssociationFilterNode(filter: FilterAST): boolean {
  return ASSOCIATION_FILTER_KEYS.some((key) => filter[key] != null);
}

export function extractLogicalFilter(filter: FilterAST): LogicalFilterAST | null {
  const and = filter.and;
  const or = filter.or;
  const not = filter.not;
  if (and == null && or == null && not == null) return null;
  return {
    and: Array.isArray(and) ? and : undefined,
    or: Array.isArray(or) ? or : undefined,
    not: not != null && typeof not === "object" ? (not as FilterAST) : undefined,
  };
}

export function extractAssociationFilter(filter: FilterAST): AssociationFilterAST | null {
  const some = filter.some;
  const every = filter.every;
  const none = filter.none;
  if (some == null && every == null && none == null) return null;
  return {
    some: some != null && typeof some === "object" ? (some as FilterAST) : undefined,
    every: every != null && typeof every === "object" ? (every as FilterAST) : undefined,
    none: none != null && typeof none === "object" ? (none as FilterAST) : undefined,
  };
}

/** Scalar leaf keys excluding logical and association operators. */
export function scalarFilterKeys(filter: FilterAST): string[] {
  return Object.keys(filter).filter(
    (key) =>
      !LOGICAL_FILTER_KEYS.includes(key as (typeof LOGICAL_FILTER_KEYS)[number]) &&
      !ASSOCIATION_FILTER_KEYS.includes(key as (typeof ASSOCIATION_FILTER_KEYS)[number]),
  );
}
