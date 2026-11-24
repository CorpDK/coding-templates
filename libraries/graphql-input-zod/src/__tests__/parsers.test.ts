import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  GraphqlInputValidationError,
  createInputParsers,
  createScalarParsers,
} from "../index.js";

const inputZodSchemas = {
  ItemCreateInput: z.object({ name: z.string().min(2) }),
  TagFilter: z.object({ active: z.boolean().optional() }),
} as const;

const scalarZodSchemas = {
  DateTime: z.string(),
} as const;

describe("createInputParsers", () => {
  const {
    safeParseGraphqlInput,
    safeParseOptionalGraphqlInput,
    safeParseGraphqlInputList,
    safeParseOptionalGraphqlInputList,
    parseGraphqlInput,
    parseOptionalGraphqlInput,
  } = createInputParsers(inputZodSchemas);

  it("parses valid input", () => {
    const result = safeParseGraphqlInput("ItemCreateInput", { name: "ab" });
    expect(result).toEqual({ ok: true, data: { name: "ab" } });
  });

  it("rejects invalid input with issues", () => {
    const result = safeParseGraphqlInput("ItemCreateInput", { name: "x" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0]?.code).toBeTruthy();
    }
  });

  it("optional accepts null and undefined", () => {
    expect(safeParseOptionalGraphqlInput("ItemCreateInput", null)).toEqual({
      ok: true,
      data: undefined,
    });
    expect(safeParseOptionalGraphqlInput("ItemCreateInput", undefined)).toEqual(
      { ok: true, data: undefined },
    );
  });

  it("parses input lists", () => {
    const result = safeParseGraphqlInputList("ItemCreateInput", [
      { name: "ab" },
      { name: "cd" },
    ]);
    expect(result.ok).toBe(true);
  });

  it("optional list accepts null", () => {
    expect(safeParseOptionalGraphqlInputList("ItemCreateInput", null)).toEqual({
      ok: true,
      data: undefined,
    });
  });

  it("parseGraphqlInput throws GraphqlInputValidationError", () => {
    expect(() => parseGraphqlInput("ItemCreateInput", { name: 1 })).toThrow(
      GraphqlInputValidationError,
    );
  });

  it("parseOptional returns undefined for omitted values", () => {
    expect(parseOptionalGraphqlInput("ItemCreateInput", null)).toBeUndefined();
    expect(parseOptionalGraphqlInput("TagFilter", undefined)).toBeUndefined();
  });

  it("keeps per-name typing after destructuring", () => {
    const name: "ItemCreateInput" = "ItemCreateInput";
    const data = parseGraphqlInput(name, { name: "ok" });
    expect(data.name).toBe("ok");
  });
});

describe("createScalarParsers", () => {
  const { safeParseGraphqlScalar, parseGraphqlScalar } =
    createScalarParsers(scalarZodSchemas);

  it("parses scalar wire values", () => {
    expect(safeParseGraphqlScalar("DateTime", "2026-01-01")).toEqual({
      ok: true,
      data: "2026-01-01",
    });
  });

  it("parseGraphqlScalar throws on invalid values", () => {
    expect(() => parseGraphqlScalar("DateTime", 42)).toThrow(
      GraphqlInputValidationError,
    );
  });
});
