import { afterEach, describe, expect, it } from "vitest";
import { resolveFilterBudget, validateFilterBudget, ValidationError } from "../filters.js";

describe("validateFilterBudget association depth", () => {
  it("counts one-to-many some as depth 1", () => {
    const filter = { lines: { some: { quantity: { gt: 10 } } } };
    expect(() => validateFilterBudget(filter, { maxDepth: 1, maxNodes: 50 })).not.toThrow();
    expect(() => validateFilterBudget(filter, { maxDepth: 0, maxNodes: 50 })).toThrow(
      ValidationError,
    );
  });

  it("counts every with nested M:1 as depth 2 at default limit", () => {
    const filter = {
      lines: { every: { product: { category: { eq: "ELECTRONICS" } } } },
    };
    expect(() => validateFilterBudget(filter, { maxDepth: 2, maxNodes: 50 })).not.toThrow();
    expect(() => validateFilterBudget(filter, { maxDepth: 1, maxNodes: 50 })).toThrow(
      ValidationError,
    );
  });

  it("rejects deeply nested association and M:1 chains beyond default maxDepth", () => {
    const filter = {
      category: {
        items: { some: { category: { name: { eq: "Tools" } } } },
      },
    };
    expect(() => validateFilterBudget(filter, { maxDepth: 2, maxNodes: 50 })).toThrow(
      ValidationError,
    );
    expect(() => validateFilterBudget(filter, { maxDepth: 3, maxNodes: 50 })).not.toThrow();
  });
});

describe("resolveFilterBudget env overrides", () => {
  const defaults = { maxDepth: 2, maxNodes: 50 };

  afterEach(() => {
    delete process.env.DAL_FILTER_MAX_DEPTH;
    delete process.env.DAL_FILTER_MAX_NODES;
  });

  it("falls back to config defaults when env values are non-numeric", () => {
    process.env.DAL_FILTER_MAX_DEPTH = "not-a-number";
    process.env.DAL_FILTER_MAX_NODES = "abc";
    expect(resolveFilterBudget(defaults)).toEqual(defaults);
  });

  it("falls back when env values are zero or negative", () => {
    process.env.DAL_FILTER_MAX_DEPTH = "0";
    process.env.DAL_FILTER_MAX_NODES = "-3";
    expect(resolveFilterBudget(defaults)).toEqual(defaults);
  });
});

describe("validateFilterBudget node counting", () => {
  it("counts association nodes and scalar leaves per §10.6.1 Example 1", () => {
    const filter = { lines: { some: { quantity: { gt: 10 } } } };
    expect(() => validateFilterBudget(filter, { maxDepth: 2, maxNodes: 2 })).not.toThrow();
    expect(() => validateFilterBudget(filter, { maxDepth: 2, maxNodes: 1 })).toThrow(
      ValidationError,
    );
  });

  it("counts nested M:1 nodes per §10.6.1 Example 2", () => {
    const filter = {
      lines: { every: { product: { category: { eq: "ELECTRONICS" } } } },
    };
    expect(() => validateFilterBudget(filter, { maxDepth: 2, maxNodes: 3 })).not.toThrow();
    expect(() => validateFilterBudget(filter, { maxDepth: 2, maxNodes: 2 })).toThrow(
      ValidationError,
    );
  });
});
