import { describe, expect, it } from "vitest";
import {
  extractAssociationFilter,
  extractLogicalFilter,
  scalarFilterKeys,
} from "../filter-ast.js";
import {
  assertFilterBulkCap,
  assertFilterBulkConfirm,
  DEFAULT_BULK_FILTER_MAX,
  isEmptyFilter,
  isExistenceOnlyFilter,
  resolveBulkAtomic,
  resolveBulkFilterMax,
} from "../bulk.js";
import { ValidationError } from "../errors.js";

describe("FilterAST", () => {
  it("extracts logical nodes", () => {
    const filter = { and: [{ status: { eq: "PENDING" } }] };
    expect(extractLogicalFilter(filter)?.and).toHaveLength(1);
    expect(scalarFilterKeys(filter)).toEqual([]);
  });

  it("extracts association nodes", () => {
    const filter = { some: { quantity: { gt: 1 } } };
    expect(extractAssociationFilter(filter)?.some).toEqual({ quantity: { gt: 1 } });
  });
});

describe("bulk helpers", () => {
  it("resolveBulkAtomic respects threshold", () => {
    expect(resolveBulkAtomic(100, null)).toBe(true);
    expect(resolveBulkAtomic(101, null)).toBe(false);
  });

  it("assertFilterBulkConfirm requires confirm flag on empty filter", () => {
    expect(() => assertFilterBulkConfirm({}, false, "confirmDeleteAll")).toThrow(ValidationError);
    expect(() => assertFilterBulkConfirm({}, true, "confirmDeleteAll")).not.toThrow();
  });

  it("isEmptyFilter is consistent", () => {
    expect(isEmptyFilter({})).toBe(true);
    expect(isEmptyFilter({ id: { eq: "x" } })).toBe(false);
  });

  it("isExistenceOnlyFilter treats empty scalar leaves as existence-only", () => {
    expect(isExistenceOnlyFilter({ lines: { some: { name: {} } } })).toBe(true);
    expect(isExistenceOnlyFilter({ lines: { some: { name: { eq: "x" } } } })).toBe(false);
    expect(isExistenceOnlyFilter({ or: [{ name: {} }, { sku: { eq: "a" } }] })).toBe(false);
  });

  it("assertFilterBulkCap rejects matches above the cap", () => {
    expect(() => assertFilterBulkCap(1001, 1000)).toThrow(ValidationError);
    expect(() => assertFilterBulkCap(10, 1000)).not.toThrow();
  });

  it("resolveBulkFilterMax reads DAL_BULK_FILTER_MAX when valid", () => {
    const previous = process.env.DAL_BULK_FILTER_MAX;
    process.env.DAL_BULK_FILTER_MAX = "250";
    expect(resolveBulkFilterMax()).toBe(250);
    process.env.DAL_BULK_FILTER_MAX = "nope";
    expect(resolveBulkFilterMax()).toBe(DEFAULT_BULK_FILTER_MAX);
    if (previous === undefined) delete process.env.DAL_BULK_FILTER_MAX;
    else process.env.DAL_BULK_FILTER_MAX = previous;
  });
});
