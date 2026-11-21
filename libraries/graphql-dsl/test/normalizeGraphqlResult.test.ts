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

  it("returns success for ordinary query data", () => {
    const result = normalizeGraphqlResult({
      data: { hello: "ok" },
    });
    expect(result).toEqual({ ok: true, data: { hello: "ok" } });
    expect(unwrapGraphqlResult({ data: { hello: "ok" } })).toEqual({
      hello: "ok",
    });
  });

  it("maps null data to a transport error", () => {
    const result = normalizeGraphqlResult({ data: null });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("transport");
    }
  });

  it("parses graphql errors and preserves extension codes", () => {
    const result = normalizeGraphqlResult({
      data: { createItem: { id: "1" } },
      errors: [
        {
          message: "bad",
          path: ["createItem", "id"],
          extensions: { code: "FORBIDDEN" },
        },
        "plain",
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === "graphql") {
      expect(result.error.errors[0]?.code).toBe("FORBIDDEN");
      expect(result.error.errors[1]?.message).toBe("plain");
    }
  });

  it("rethrows an existing GraphqlRequestError unchanged", () => {
    const original = toGraphqlRequestError(new Error("nope"));
    expect(toGraphqlRequestError(original)).toBe(original);
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
