import {
  and,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  ne,
  not,
  notInArray,
  or,
  sql,
  type Column,
  type SQL,
} from "drizzle-orm";
import { ValidationError } from "./errors.js";
import { extractAssociationFilter, scalarFilterKeys } from "./filter-ast.js";

export interface StringFilter {
  eq?: string | null;
  neq?: string | null;
  like?: string | null;
  in?: string[] | null;
  notIn?: string[] | null;
  isNull?: boolean | null;
  isCaseInsensitive?: boolean | null;
}

export interface BooleanFilter {
  eq?: boolean | null;
}

export interface DateTimeFilter {
  eq?: string | null;
  neq?: string | null;
  gt?: string | null;
  gte?: string | null;
  lt?: string | null;
  lte?: string | null;
  in?: string[] | null;
  notIn?: string[] | null;
  isNull?: boolean | null;
}

export interface IdFilter {
  eq?: string | null;
  neq?: string | null;
  in?: string[] | null;
  notIn?: string[] | null;
}

export interface EnumFilter<T extends string = string> {
  eq?: T | null;
  neq?: T | null;
  in?: T[] | null;
  notIn?: T[] | null;
}

export interface IntFilter {
  eq?: number | null;
  neq?: number | null;
  gt?: number | null;
  gte?: number | null;
  lt?: number | null;
  lte?: number | null;
  in?: number[] | null;
  notIn?: number[] | null;
  isNull?: boolean | null;
}

export interface FloatFilter {
  eq?: number | null;
  neq?: number | null;
  gt?: number | null;
  gte?: number | null;
  lt?: number | null;
  lte?: number | null;
  in?: number[] | null;
  notIn?: number[] | null;
  isNull?: boolean | null;
}

export interface BigIntFilter {
  eq?: string | null;
  neq?: string | null;
  gt?: string | null;
  gte?: string | null;
  lt?: string | null;
  lte?: string | null;
  in?: string[] | null;
  notIn?: string[] | null;
}

export interface DecimalFilter {
  eq?: string | null;
  neq?: string | null;
  gt?: string | null;
  gte?: string | null;
  lt?: string | null;
  lte?: string | null;
  in?: string[] | null;
  notIn?: string[] | null;
}

export interface DateFilter {
  eq?: string | null;
  neq?: string | null;
  gt?: string | null;
  gte?: string | null;
  lt?: string | null;
  lte?: string | null;
  in?: string[] | null;
  notIn?: string[] | null;
  isNull?: boolean | null;
}

export interface TimeTzFilter {
  eq?: string | null;
  neq?: string | null;
  gt?: string | null;
  gte?: string | null;
  lt?: string | null;
  lte?: string | null;
  in?: string[] | null;
  notIn?: string[] | null;
  isNull?: boolean | null;
}

export interface IntervalMsFilter {
  eq?: string | null;
  neq?: string | null;
  gt?: string | null;
  gte?: string | null;
  lt?: string | null;
  lte?: string | null;
  in?: string[] | null;
  notIn?: string[] | null;
}

export interface FilterBudgetLimits {
  maxDepth: number;
  maxNodes: number;
}

export interface LogicalFilter<T> {
  and?: T[] | null;
  or?: T[] | null;
  not?: T | null;
}

function combineFilterParts(parts: SQL[]): SQL | undefined {
  if (parts.length === 0) return undefined;
  return parts.length === 1 ? parts[0] : and(...parts);
}

function pushStringFilterEqualityParts(
  column: Column,
  filter: StringFilter,
  ci: boolean,
  parts: SQL[],
): void {
  if (filter.eq != null) {
    parts.push(ci ? ciEq(column, filter.eq) : eq(column, filter.eq));
  }
  if (filter.neq != null) {
    parts.push(ci ? ciNeq(column, filter.neq) : ne(column, filter.neq));
  }
  if (filter.like != null) {
    parts.push(ci ? ilike(column, filter.like) : like(column, filter.like));
  }
  if (filter.in?.length) {
    parts.push(ci ? ciIn(column, filter.in) : inArray(column, filter.in));
  }
  if (filter.notIn?.length) {
    parts.push(ci ? ciNotIn(column, filter.notIn) : notInArray(column, filter.notIn));
  }
}

function assertExclusiveIsNull(filter: { isNull?: boolean | null }, keys: string[]): void {
  if (filter.isNull == null) return;
  const others = keys.filter((k) => k !== "isNull" && (filter as Record<string, unknown>)[k] != null);
  if (others.length > 0) {
    throw new ValidationError("isNull is mutually exclusive with other filter operators", others);
  }
}

function ciEq(column: Column, value: string): SQL {
  return sql`lower(${column}) = lower(${value})`;
}

function ciNeq(column: Column, value: string): SQL {
  return sql`lower(${column}) <> lower(${value})`;
}

function ciIn(column: Column, values: string[]): SQL {
  return inArray(
    sql`lower(${column})`,
    values.map((v) => v.toLowerCase()),
  );
}

function ciNotIn(column: Column, values: string[]): SQL {
  return notInArray(
    sql`lower(${column})`,
    values.map((v) => v.toLowerCase()),
  );
}

export function buildStringFilter(column: Column, filter: StringFilter | null | undefined): SQL | undefined {
  if (!filter) return undefined;
  assertExclusiveIsNull(filter, ["eq", "neq", "like", "in", "notIn"]);
  if (filter.isNull === true) return isNull(column);
  if (filter.isNull === false) return isNotNull(column);

  const ci = filter.isCaseInsensitive === true;
  const parts: SQL[] = [];
  pushStringFilterEqualityParts(column, filter, ci, parts);
  return combineFilterParts(parts);
}

export function buildBooleanFilter(
  column: Column,
  filter: BooleanFilter | null | undefined,
): SQL | undefined {
  if (filter?.eq == null) return undefined;
  return eq(column, filter.eq);
}

export function buildDateTimeFilter(
  column: Column,
  filter: DateTimeFilter | null | undefined,
): SQL | undefined {
  if (!filter) return undefined;
  assertExclusiveIsNull(filter, ["eq", "neq", "gt", "gte", "lt", "lte", "in", "notIn"]);
  if (filter.isNull === true) return isNull(column);
  if (filter.isNull === false) return isNotNull(column);
  const parts: SQL[] = [];
  if (filter.eq != null) parts.push(eq(column, new Date(filter.eq)));
  if (filter.neq != null) parts.push(ne(column, new Date(filter.neq)));
  if (filter.gt != null) parts.push(gt(column, new Date(filter.gt)));
  if (filter.gte != null) parts.push(gte(column, new Date(filter.gte)));
  if (filter.lt != null) parts.push(lt(column, new Date(filter.lt)));
  if (filter.lte != null) parts.push(lte(column, new Date(filter.lte)));
  if (filter.in?.length) parts.push(inArray(column, filter.in.map((v) => new Date(v))));
  if (filter.notIn?.length) parts.push(notInArray(column, filter.notIn.map((v) => new Date(v))));
  if (parts.length === 0) return undefined;
  return parts.length === 1 ? parts[0] : and(...parts);
}

export function buildIdFilter(column: Column, filter: IdFilter | null | undefined): SQL | undefined {
  if (!filter) return undefined;
  const parts: SQL[] = [];
  if (filter.eq != null) parts.push(eq(column, filter.eq));
  if (filter.neq != null) parts.push(ne(column, filter.neq));
  if (filter.in?.length) parts.push(inArray(column, filter.in));
  if (filter.notIn?.length) parts.push(notInArray(column, filter.notIn));
  if (parts.length === 0) return undefined;
  return parts.length === 1 ? parts[0] : and(...parts);
}

export function buildEnumFilter<T extends string>(
  column: Column,
  filter: EnumFilter<T> | null | undefined,
): SQL | undefined {
  return buildIdFilter(column, filter);
}

function buildComparableNumberFilter(
  column: Column,
  filter:
    | IntFilter
    | FloatFilter
    | null
    | undefined,
  keys: string[],
): SQL | undefined {
  if (!filter) return undefined;
  assertExclusiveIsNull(filter, keys);
  if (filter.isNull === true) return isNull(column);
  if (filter.isNull === false) return isNotNull(column);
  const parts: SQL[] = [];
  if (filter.eq != null) parts.push(eq(column, filter.eq));
  if (filter.neq != null) parts.push(ne(column, filter.neq));
  if (filter.gt != null) parts.push(gt(column, filter.gt));
  if (filter.gte != null) parts.push(gte(column, filter.gte));
  if (filter.lt != null) parts.push(lt(column, filter.lt));
  if (filter.lte != null) parts.push(lte(column, filter.lte));
  if (filter.in?.length) parts.push(inArray(column, filter.in));
  if (filter.notIn?.length) parts.push(notInArray(column, filter.notIn));
  if (parts.length === 0) return undefined;
  return parts.length === 1 ? parts[0] : and(...parts);
}

export function buildIntFilter(column: Column, filter: IntFilter | null | undefined): SQL | undefined {
  return buildComparableNumberFilter(column, filter, [
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "in",
    "notIn",
    "isNull",
  ]);
}

export function buildFloatFilter(
  column: Column,
  filter: FloatFilter | null | undefined,
): SQL | undefined {
  return buildComparableNumberFilter(column, filter, [
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "in",
    "notIn",
    "isNull",
  ]);
}

function comparableFilterIsNullClause(
  column: Column,
  filter: DateFilter,
): SQL | undefined {
  assertExclusiveIsNull(filter, [
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "in",
    "notIn",
    "isNull",
  ]);
  if (filter.isNull === true) return isNull(column);
  if (filter.isNull === false) return isNotNull(column);
  return undefined;
}

function pushComparableFilterParts(
  column: Column,
  filter: BigIntFilter | DecimalFilter | DateFilter | TimeTzFilter | IntervalMsFilter,
  parts: SQL[],
): void {
  if (filter.eq != null) parts.push(eq(column, filter.eq));
  if (filter.neq != null) parts.push(ne(column, filter.neq));
  if (filter.gt != null) parts.push(gt(column, filter.gt));
  if (filter.gte != null) parts.push(gte(column, filter.gte));
  if (filter.lt != null) parts.push(lt(column, filter.lt));
  if (filter.lte != null) parts.push(lte(column, filter.lte));
  if (filter.in?.length) parts.push(inArray(column, filter.in));
  if (filter.notIn?.length) parts.push(notInArray(column, filter.notIn));
}

function buildStringComparableFilter(
  column: Column,
  filter:
    | BigIntFilter
    | DecimalFilter
    | DateFilter
    | TimeTzFilter
    | IntervalMsFilter
    | null
    | undefined,
  withIsNull: boolean,
): SQL | undefined {
  if (!filter) return undefined;
  if (withIsNull) {
    const isNullClause = comparableFilterIsNullClause(column, filter as DateFilter);
    if (isNullClause) return isNullClause;
  }
  const parts: SQL[] = [];
  pushComparableFilterParts(column, filter, parts);
  return combineFilterParts(parts);
}

export function buildBigIntFilter(
  column: Column,
  filter: BigIntFilter | null | undefined,
): SQL | undefined {
  return buildStringComparableFilter(column, filter, false);
}

export function buildDecimalFilter(
  column: Column,
  filter: DecimalFilter | null | undefined,
): SQL | undefined {
  return buildStringComparableFilter(column, filter, false);
}

export function buildDateFilter(column: Column, filter: DateFilter | null | undefined): SQL | undefined {
  return buildStringComparableFilter(column, filter, true);
}

export function buildTimeTzFilter(
  column: Column,
  filter: TimeTzFilter | null | undefined,
): SQL | undefined {
  return buildStringComparableFilter(column, filter, true);
}

export function buildIntervalMsFilter(
  column: Column,
  filter: IntervalMsFilter | null | undefined,
): SQL | undefined {
  return buildStringComparableFilter(column, filter, false);
}

function isScalarPredicateNode(value: Record<string, unknown>): boolean {
  const keys = scalarFilterKeys(value);
  if (keys.length === 0) return false;
  return keys.every((key) => {
    const entry = value[key];
    return entry == null || typeof entry !== "object";
  });
}

function measureAssociationDepth(value: Record<string, unknown>): number {
  const assoc = extractAssociationFilter(value);
  if (!assoc) return 0;
  let payloadDepth = 0;
  for (const payload of [assoc.some, assoc.every, assoc.none]) {
    if (payload) {
      payloadDepth = Math.max(payloadDepth, measureFilterDepth(payload));
    }
  }
  return 1 + payloadDepth;
}

function measureFilterDepth(filter: Record<string, unknown>): number {
  let maxChild = 0;
  if (Array.isArray(filter.and)) {
    const childDepths = filter.and.map((node) =>
      measureFilterDepth(node as Record<string, unknown>),
    );
    maxChild = Math.max(maxChild, 1 + Math.max(0, ...childDepths));
  }
  if (Array.isArray(filter.or)) {
    const childDepths = filter.or.map((node) =>
      measureFilterDepth(node as Record<string, unknown>),
    );
    maxChild = Math.max(maxChild, 1 + Math.max(0, ...childDepths));
  }
  if (filter.not && typeof filter.not === "object") {
    maxChild = Math.max(maxChild, 1 + measureFilterDepth(filter.not as Record<string, unknown>));
  }
  for (const key of scalarFilterKeys(filter)) {
    const value = filter[key];
    if (value == null || typeof value !== "object") continue;
    const obj = value as Record<string, unknown>;
    if (isScalarPredicateNode(obj)) continue;
    if (extractAssociationFilter(obj)) {
      maxChild = Math.max(maxChild, measureAssociationDepth(obj));
    } else {
      maxChild = Math.max(maxChild, 1 + measureFilterDepth(obj));
    }
  }
  return maxChild;
}

function countRelationNodes(value: Record<string, unknown>): number {
  const assoc = extractAssociationFilter(value);
  if (assoc) {
    let count = 1;
    for (const payload of [assoc.some, assoc.every, assoc.none]) {
      if (payload) count += countFilterNodes(payload);
    }
    return count;
  }
  if (isScalarPredicateNode(value)) return 1;
  return 1 + countFilterNodes(value);
}

function countFilterNodes(filter: Record<string, unknown>): number {
  let count = 0;
  for (const key of scalarFilterKeys(filter)) {
    const value = filter[key];
    if (value == null || typeof value !== "object") continue;
    count += countRelationNodes(value as Record<string, unknown>);
  }
  if (Array.isArray(filter.and)) {
    for (const child of filter.and) {
      count += countFilterNodes(child as Record<string, unknown>);
    }
  }
  if (Array.isArray(filter.or)) {
    for (const child of filter.or) {
      count += countFilterNodes(child as Record<string, unknown>);
    }
  }
  if (filter.not && typeof filter.not === "object") {
    count += countFilterNodes(filter.not as Record<string, unknown>);
  }
  return count;
}

function parsePositiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  return fallback;
}

/** Resolve filter budget limits from config with optional env overrides. */
export function resolveFilterBudget(config: FilterBudgetLimits): FilterBudgetLimits {
  const depthEnv = process.env.DAL_FILTER_MAX_DEPTH;
  const nodesEnv = process.env.DAL_FILTER_MAX_NODES;
  return {
    maxDepth:
      depthEnv != null && depthEnv !== "" ?
        parsePositiveInt(depthEnv, config.maxDepth)
      : config.maxDepth,
    maxNodes:
      nodesEnv != null && nodesEnv !== "" ?
        parsePositiveInt(nodesEnv, config.maxNodes)
      : config.maxNodes,
  };
}

/** Enforce filterMaxDepth / filterMaxNodes before SQL compilation. */
export function validateFilterBudget(
  filter: unknown,
  limits: FilterBudgetLimits,
): void {
  if (filter == null || typeof filter !== "object") return;
  const depth = measureFilterDepth(filter as Record<string, unknown>);
  const nodes = countFilterNodes(filter as Record<string, unknown>);
  if (depth > limits.maxDepth) {
    throw new ValidationError(
      `Filter exceeds maximum depth of ${limits.maxDepth}`,
      ["filter"],
    );
  }
  if (nodes > limits.maxNodes) {
    throw new ValidationError(
      `Filter exceeds maximum node count of ${limits.maxNodes}`,
      ["filter"],
    );
  }
}

export function combineLogical<T>(
  filter: LogicalFilter<T> | null | undefined,
  leaf: (node: T) => SQL | undefined,
): SQL | undefined {
  if (!filter) return undefined;
  const parts: SQL[] = [];
  if (filter.and?.length) {
    const andParts = filter.and.map(leaf).filter((p): p is SQL => p != null);
    if (andParts.length) parts.push(and(...andParts)!);
  }
  if (filter.or?.length) {
    const orParts = filter.or.map(leaf).filter((p): p is SQL => p != null);
    if (orParts.length) parts.push(or(...orParts)!);
  }
  if (filter.not) {
    const inner = leaf(filter.not);
    if (inner) parts.push(not(inner));
  }
  const leafOnly = leaf(filter as T);
  if (leafOnly) parts.push(leafOnly);
  if (parts.length === 0) return undefined;
  return parts.length === 1 ? parts[0] : and(...parts);
}
