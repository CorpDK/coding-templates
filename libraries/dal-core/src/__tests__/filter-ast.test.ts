import { describe, expect, it } from "vitest";
import {
  extractAssociationFilter,
  extractLogicalFilter,
  scalarFilterKeys,
} from "../filter-ast.js";
import {
  assertFilterBulkConfirm,
  isEmptyFilter,
  resolveBulkAtomic,
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
});
