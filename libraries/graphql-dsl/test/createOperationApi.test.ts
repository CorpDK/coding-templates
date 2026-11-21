import { parse, validate } from "graphql";
import { describe, expect, it } from "vitest";
import { createOperationApi } from "../src/runtime/createOperationApi.js";
import { v } from "../src/runtime/variableRef.js";
import { minimalSchema, minimalTypeMap } from "./fixtures/minimalTypeMap.fixture.js";

import { everything } from "../src/runtime/builtOperation.js";

describe("createOperationApi define", () => {
  it("exposes the everything scalar marker", () => {
    expect(everything).toEqual({ __scalar: true });
  });

  it("builds ad-hoc operations through build()", () => {
    const api = createOperationApi("query", minimalTypeMap.Query!, (op) => op);
    const op = api.build({
      hello: { __args: { name: "ada" } },
    } as import("../src/runtime/generateGraphqlOperation.js").Fields);
    expect(op.query).toMatch(/hello\(name:\$v1\)/);
    const doc = parse(op.query);
    expect(validate(minimalSchema, doc)).toEqual([]);
  });

  it("declares variables from type-map use sites", () => {
    const api = createOperationApi("query", minimalTypeMap.Query!, (op) => op);
    const built = api.define({
      name: "ItemsByFilter",
      variables: { filter: v<{ name?: string | null }>() },
      select: ($) =>
        ({
          items: {
            __args: { filter: $.filter },
            id: true,
          },
        }) as unknown as import("../src/runtime/generateGraphqlOperation.js").Fields,
    });
    expect(built.query).toMatch(/\$filter:ItemFilter/);
    const doc = parse(built.query);
    expect(validate(minimalSchema, doc)).toEqual([]);
  });
});
