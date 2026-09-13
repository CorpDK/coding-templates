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
  type SQL,
} from "drizzle-orm";
import type { Column } from "drizzle-orm";
import { ValidationError } from "./errors.js";

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

export interface LogicalFilter<T> {
  and?: T[] | null;
  or?: T[] | null;
  not?: T | null;
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

  if (parts.length === 0) return undefined;
  return parts.length === 1 ? parts[0] : and(...parts);
}

export function buildBooleanFilter(
  column: Column,
  filter: BooleanFilter | null | undefined,
): SQL | undefined {
  if (!filter || filter.eq == null) return undefined;
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
