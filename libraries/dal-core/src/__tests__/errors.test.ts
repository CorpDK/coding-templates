import { describe, expect, it } from "vitest";
import {
  assertValidUuid,
  createUserError,
  errorPayload,
  NotFoundError,
  successPayload,
  ValidationError,
} from "../errors.js";

describe("mutation error helpers", () => {
  it("builds user errors and payloads", () => {
    expect(createUserError("VALIDATION_FAILED", "bad", { field: ["name"] })).toEqual({
      code: "VALIDATION_FAILED",
      message: "bad",
      field: ["name"],
      id: null,
    });
    expect(successPayload({ ok: true })).toEqual({ ok: true, userErrors: [] });
    expect(errorPayload({ ok: false }, [{ code: "NOT_FOUND", message: "missing", field: null, id: "1" }])).toEqual({
      ok: false,
      userErrors: [{ code: "NOT_FOUND", message: "missing", field: null, id: "1" }],
    });
  });

  it("validates UUID shape and exposes typed errors", () => {
    expect(() => assertValidUuid("not-a-uuid")).toThrow(ValidationError);
    expect(() => assertValidUuid("00000000-0000-4000-8000-000000000001")).not.toThrow();
    expect(new NotFoundError().name).toBe("NotFoundError");
  });
});
