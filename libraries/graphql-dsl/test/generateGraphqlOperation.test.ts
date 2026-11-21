import { parse, validate } from "graphql";
import { describe, expect, it } from "vitest";
import { generateGraphqlOperation } from "../src/runtime/generateGraphqlOperation.js";
import { minimalSchema, minimalTypeMap } from "./fixtures/minimalTypeMap.js";

describe("generateGraphqlOperation", () => {
  it("prints scalar-root field args and validates against schema", () => {
    const op = generateGraphqlOperation("query", minimalTypeMap.Query!, {
      hello: { __args: { name: "world" } },
    });
    expect(op.query).toMatch(/hello\(name:\$v1\)/);
    expect(op.variables?.v1).toBe("world");

    const doc = parse(op.query);
    expect(validate(minimalSchema, doc)).toEqual([]);
  });

  it("prints aliases with distinct argument variables", () => {
    const op = generateGraphqlOperation("query", minimalTypeMap.Query!, {
      __aliases: {
        archived: {
          items: {
            __args: { filter: { status: "ARCHIVED" } },
            id: true,
          },
        },
      },
      items: {
        __args: { filter: { name: "x" } },
        id: true,
        name: true,
      },
    });
    expect(op.query).toMatch(/archived:items\(/);
    expect(op.query).toMatch(/items\(/);

    const doc = parse(op.query);
    expect(validate(minimalSchema, doc)).toEqual([]);
  });

  it("rejects aliases that select more than one field", () => {
    expect(() =>
      generateGraphqlOperation("query", minimalTypeMap.Query!, {
        __aliases: {
          bad: {
            items: { id: true },
            hello: true,
          },
        },
      }),
    ).toThrow(/exactly one field/);
  });

  it("prints @include and @skip with hoisted boolean variables", () => {
    const op = generateGraphqlOperation("query", minimalTypeMap.Query!, {
      items: {
        __args: { filter: { name: "a" } },
        id: true,
        tags: { __include: true },
        name: { __skip: false },
      },
    });
    expect(op.query).toMatch(/@include\(if:\$v/);
    expect(op.query).toMatch(/@skip\(if:\$v/);
    const doc = parse(op.query);
    expect(validate(minimalSchema, doc)).toEqual([]);
  });

  it("prints union inline fragments", () => {
    const op = generateGraphqlOperation("query", minimalTypeMap.Query!, {
      search: {
        __args: { term: "z" },
        __typename: true,
        on_Item: { id: true },
        on_Label: { text: true },
      },
    });
    expect(op.query).toMatch(/fragment f\d+ on Item/);
    expect(op.query).toMatch(/fragment f\d+ on Label/);
    const doc = parse(op.query);
    expect(validate(minimalSchema, doc)).toEqual([]);
  });
});