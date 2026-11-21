import { buildSchema, parse, validate } from "graphql";
import { describe, expect, it } from "vitest";
import { emitDslModules } from "../src/codegen/emitDslModules.js";
import { generateGraphqlOperation } from "../src/runtime/generateGraphqlOperation.js";
import { linkTypeMap } from "../src/runtime/linkTypeMap.js";
import { minimalSchema } from "./fixtures/minimalTypeMap.js";

describe("emitDslModules", () => {
  it("emits edges-shaped connection selections when the connection has no nodes field", () => {
    const schema = buildSchema(/* GraphQL */ `
      type Query {
        books(first: Int, after: String): BookConnection!
      }
      type Book {
        id: ID!
      }
      type BookConnection {
        edges: [BookEdge!]!
        pageInfo: PageInfo!
      }
      type BookEdge {
        node: Book!
        cursor: String!
      }
      type PageInfo {
        hasNextPage: Boolean!
        endCursor: String
      }
    `);
    const out = emitDslModules(schema, {
      typesImport: "../schema-types.js",
      customScalars: [],
    });
    expect(out.index).toContain('"books":"edges"');
    expect(out.index).toContain("edges: { node: options.select");
  });

  it("emits query-only index without mutation or subscription builders", () => {
    const schema = buildSchema(/* GraphQL */ `
      type Query { ping: String! }
    `);
    const out = emitDslModules(schema, {
      typesImport: "../schema-types.js",
      customScalars: [],
    });
    expect(out.index).toContain("buildQuery");
    expect(out.index).not.toContain("buildMutation");
    expect(out.index).not.toContain("buildSubscription");
    expect(out.index).not.toContain("MutationSelection");
  });

  it("emits a type map that can print a valid operation", () => {
    const out = emitDslModules(minimalSchema, {
      typesImport: "../schema-types.js",
      customScalars: ["JSON"],
    });
    const linked = linkTypeMap(
      JSON.parse(out.typeMap.replace(/^export default /, "")),
    );
    expect(linked.JSON?.name).toBe("JSON");

    const op = generateGraphqlOperation("query", linked.Query!, {
      hello: { __args: { name: "world" } },
    });
    const doc = parse(op.query);
    expect(validate(minimalSchema, doc)).toEqual([]);
  });
});
