import { describe, expect, it } from "vitest";
import { boolean, date, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  buildBigIntFilter,
  buildBooleanFilter,
  buildDateFilter,
  buildDateTimeFilter,
  buildDecimalFilter,
  buildEnumFilter,
  buildFloatFilter,
  buildIdFilter,
  buildIntervalMsFilter,
  buildStringFilter,
  buildTimeTzFilter,
  combineLogical,
  validateFilterBudget,
} from "../filters.js";
import { ValidationError } from "../errors.js";
import type { SQL } from "drizzle-orm";

const dialect = new PgDialect();

function sqlText(fragment: SQL | undefined): string {
  if (!fragment) return "";
  return dialect.sqlToQuery(fragment).sql;
}

const table = pgTable("widgets", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  active: boolean("active").notNull(),
  qty: integer("qty").notNull(),
  effectiveOn: date("effective_on").notNull(),
  createdAt: timestamp("created_at").notNull(),
});

describe("buildStringFilter", () => {
  it("compiles eq, neq, like, in, notIn, and isNull operators", () => {
    expect(sqlText(buildStringFilter(table.name, { eq: "a" }))).toContain("=");
    expect(sqlText(buildStringFilter(table.name, { neq: "a" }))).toContain("<>");
    expect(sqlText(buildStringFilter(table.name, { like: "%a%" }))).toContain("like");
    expect(sqlText(buildStringFilter(table.name, { in: ["a", "b"] }))).toContain("in");
    expect(sqlText(buildStringFilter(table.name, { notIn: ["a"] }))).not.toContain("undefined");
    expect(sqlText(buildStringFilter(table.name, { isNull: true }))).toContain("is null");
    expect(sqlText(buildStringFilter(table.name, { isNull: false }))).toContain("is not null");
  });

  it("uses case-insensitive comparisons when requested", () => {
    const ci = buildStringFilter(table.name, { eq: "Ab", isCaseInsensitive: true });
    expect(sqlText(ci).toLowerCase()).toContain("lower");
  });

  it("returns undefined for empty filters", () => {
    expect(buildStringFilter(table.name, null)).toBeUndefined();
    expect(buildStringFilter(table.name, {})).toBeUndefined();
  });
});

describe("buildBooleanFilter", () => {
  it("compiles boolean equality", () => {
    expect(sqlText(buildBooleanFilter(table.active, { eq: true }))).toContain("=");
    expect(buildBooleanFilter(table.active, {})).toBeUndefined();
  });
});

describe("buildDateTimeFilter", () => {
  it("compiles range and set operators", () => {
    expect(sqlText(buildDateTimeFilter(table.createdAt, { gte: "2026-01-01T00:00:00.000Z" }))).toContain(
      ">=",
    );
    expect(sqlText(buildDateTimeFilter(table.createdAt, { lt: "2026-12-31T23:59:59.999Z" }))).toContain(
      "<",
    );
    expect(sqlText(buildDateTimeFilter(table.createdAt, { in: ["2026-01-01T00:00:00.000Z"] }))).toContain(
      "in",
    );
  });
});

describe("buildIdFilter and buildEnumFilter", () => {
  it("compiles id and enum predicates", () => {
    expect(sqlText(buildIdFilter(table.id, { eq: "00000000-0000-4000-8000-000000000001" }))).toContain(
      "=",
    );
    expect(sqlText(buildEnumFilter(table.name, { in: ["DRAFT", "ACTIVE"] }))).toContain("in");
  });
});

describe("numeric and scalar string filters", () => {
  it("compiles int, float, bigint, decimal, date, time, and interval filters", () => {
    expect(sqlText(buildFloatFilter(table.qty, { gt: 1, lt: 10 }))).toContain(">");
    expect(sqlText(buildBigIntFilter(table.qty, { eq: "42" }))).toContain("=");
    expect(sqlText(buildDecimalFilter(table.qty, { neq: "1.5" }))).toContain("<>");
    expect(sqlText(buildDateFilter(table.effectiveOn, { eq: "2026-09-21" }))).toContain("=");
    expect(sqlText(buildTimeTzFilter(table.name, { gte: "12:00:00Z" }))).toContain(">=");
    expect(sqlText(buildIntervalMsFilter(table.qty, { lte: "5000" }))).toContain("<=");
  });
});

describe("combineLogical", () => {
  it("combines and, or, not, and leaf predicates", () => {
    type Leaf = { eq?: number };
    const leaf = (node: Leaf) => buildFloatFilter(table.qty, node);
    const andSql = combineLogical({ and: [{ eq: 1 }, { eq: 2 }] }, leaf);
    const orSql = combineLogical({ or: [{ eq: 3 }] }, leaf);
    const notSql = combineLogical({ not: { eq: 4 } }, leaf);
    expect(sqlText(andSql)).toContain("and");
    expect(sqlText(orSql)).toContain("=");
    expect(sqlText(notSql)).toContain("not");
    expect(combineLogical(null, leaf)).toBeUndefined();
  });
});

describe("validateFilterBudget node counting", () => {
  it("counts nested relation nodes against maxNodes", () => {
    const filter = {
      category: { items: { some: { name: { eq: "Hammer" } } } },
      name: { eq: "Widget" },
    };
    expect(() => validateFilterBudget(filter, { maxDepth: 5, maxNodes: 2 })).toThrow(ValidationError);
    expect(() => validateFilterBudget(filter, { maxDepth: 5, maxNodes: 10 })).not.toThrow();
  });
});
