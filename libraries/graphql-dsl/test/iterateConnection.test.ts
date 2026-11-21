import { parse, validate } from "graphql";
import { describe, expect, it } from "vitest";
import { iterateConnection } from "../src/runtime/iterateConnection.js";
import { generateGraphqlOperation } from "../src/runtime/generateGraphqlOperation.js";
import { minimalSchema, minimalTypeMap } from "./fixtures/minimalTypeMap.js";

describe("iterateConnection", () => {
  it("issues a built query for each page", async () => {
    const queries: string[] = [];
    const exec = async (op: { query: string }) => {
      queries.push(op.query);
      return {
        itemConnection: {
          nodes: [{ id: "1" }],
          pageInfo: { hasNextPage: false, endCursor: "c1" },
        },
      };
    };

    const build = (variables: Record<string, unknown>) =>
      generateGraphqlOperation("query", minimalTypeMap.Query!, {
        itemConnection: {
          __args: variables,
          nodes: { id: true },
          pageInfo: { hasNextPage: true, endCursor: true },
        },
      } as import("../src/runtime/generateGraphqlOperation.js").Fields);

    const pages: unknown[] = [];
    for await (const node of iterateConnection(exec, {
      field: "itemConnection",
      args: {},
      select: { id: true },
      pageSize: 10,
      build,
    })) {
      pages.push(node);
    }

    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatch(/itemConnection/);
    const doc = parse(queries[0]!);
    expect(validate(minimalSchema, doc)).toEqual([]);
    expect(pages).toEqual([{ id: "1" }]);
  });
});
