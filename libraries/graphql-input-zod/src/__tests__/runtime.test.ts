import { GraphQLObjectType, GraphQLSchema, GraphQLString } from "graphql";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import { createInputParsers, createScalarParsers, GraphqlInputValidationError } from "../index.js";

describe("createInputParsers", () => {
  const registry = {
    ItemCreateInput: z.object({ name: z.string() }),
  } as const;

  const parsers = createInputParsers(registry);

  it("parses valid input", () => {
    const result = parsers.safeParseGraphqlInput("ItemCreateInput", { name: "a" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.name).toBe("a");
  });

  it("returns issues on invalid input", () => {
    const result = parsers.safeParseGraphqlInput("ItemCreateInput", { name: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]?.code).toBeDefined();
  });

  it("throws GraphqlInputValidationError from parseGraphqlInput", () => {
    expect(() => parsers.parseGraphqlInput("ItemCreateInput", { name: 1 })).toThrow(
      GraphqlInputValidationError,
    );
  });
});

describe("createScalarParsers", () => {
  const registry = { ID: z.string() } as const;
  const parsers = createScalarParsers(registry);

  it("validates scalar wire values", () => {
    expect(parsers.safeParseGraphqlScalar("ID", "not-a-uuid").ok).toBe(true);
  });
});