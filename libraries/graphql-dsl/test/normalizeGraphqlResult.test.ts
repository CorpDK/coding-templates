import { describe, expect, it } from "vitest";
import {
  isGraphqlRequestError,
  normalizeGraphqlResult,
  toGraphqlRequestError,
  unwrapGraphqlResult,
} from "../src/runtime/normalizeGraphqlResult.js";

describe("normalizeGraphqlResult", () => {
  it("prefers graphql errors over userErrors in the payload", () => {
    const result = normalizeGraphqlResult({
      data: { createItem: { userErrors: [{ message: "bad" }] } },
      errors: [{ message: "server failed" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("graphql");
    }
  });

  it("maps validation-shaped throws and supports unwrap", () => {
    const err = { kind: "validation", issues: [{ path: ["x"] }] };
    const normalized = toGraphqlRequestError(err);
    expect(isGraphqlRequestError(normalized)).toBe(true);
    expect(normalized.kind).toBe("validation");

    expect(() =>
      unwrapGraphqlResult({ data: null, errors: [{ message: "nope" }] }),
    ).toThrow();
  });

  it("returns userErrors when only the payload reports failures", () => {
    const result = normalizeGraphqlResult({
      data: { createItem: { id: null, userErrors: [{ message: "bad" }] } },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("userErrors");
    }
  });

  it("ignores userErrors under __meta, not under operation root fields", () => {
    const result = normalizeGraphqlResult({
      data: {
        __meta: { userErrors: [{ message: "ignored" }] },
        createItem: { id: "1", userErrors: [] },
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        __meta: { userErrors: [{ message: "ignored" }] },
        createItem: { id: "1", userErrors: [] },
      });
    }
  });
});
