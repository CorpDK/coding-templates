import { describe, expect, it } from "vitest";
import { validateFilterBudget, ValidationError } from "../filters.js";

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
