import {
  buildSchema,
  isObjectType,
  parse,
  validate,
  type GraphQLSchema,
  type GraphQLObjectType,
} from "graphql";
import { describe, expect, it } from "vitest";
import { emitDslModules } from "../src/codegen/emitDslModules.js";
import { generateGraphqlOperation } from "../src/runtime/generateGraphqlOperation.js";
import { linkTypeMap } from "../src/runtime/linkTypeMap.js";
import { minimalSchema } from "./fixtures/minimalTypeMap.fixture.js";
import {
  connectionNodeShapesFromIndex,
  exportedConstNames,
  workspaceValueImportsFrom,
} from "./helpers/parseEmittedTs.js";

function unwrapNamedObject(type: {
  ofType?: unknown;
}): GraphQLObjectType | undefined {
  let current: unknown = type;
  while (
    current &&
    typeof current === "object" &&
    "ofType" in current &&
    (current as { ofType?: unknown }).ofType
  ) {
    current = (current as { ofType: unknown }).ofType;
  }
  return isObjectType(current) ? current : undefined;
}

function connectionNodeShapeFromSchema(
  schema: GraphQLSchema,
  fieldName: string,
): "nodes" | "edges" {
  const query = schema.getQueryType();
  if (!query) return "nodes";
  const field = query.getFields()[fieldName];
  if (!field) return "nodes";
  const named = unwrapNamedObject(field.type as { ofType?: unknown });
  if (!named) return "nodes";
  const fields = named.getFields();
  return fields.nodes ? "nodes" : "edges";
}

function connectionPagingSelection(
  shape: "nodes" | "edges",
  nodeSel: Record<string, boolean>,
) {
  const pageInfo = { hasNextPage: true, endCursor: true };
  return shape === "nodes"
    ? { nodes: nodeSel, pageInfo }
    : { edges: { node: nodeSel, cursor: true }, pageInfo };
}

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
      typesImport: "./schema-types.js",
      customScalars: [],
    });

    expect(connectionNodeShapeFromSchema(schema, "books")).toBe("edges");

    const shapes = connectionNodeShapesFromIndex(out.index);
    expect(shapes.books).toBe("edges");

    const linked = linkTypeMap(
      JSON.parse(out.typeMap.replace(/^export default /, "")),
    );
    const op = generateGraphqlOperation("query", linked.Query!, {
      books: {
        __args: { first: 10 },
        ...connectionPagingSelection(shapes.books, { id: true }),
      },
    });
    const doc = parse(op.query);
    expect(validate(schema, doc)).toEqual([]);
    expect(op.query).toContain("edges");
    expect(op.query).not.toContain("nodes");
  });

  it("emits query-only index without mutation or subscription builders", () => {
    const schema = buildSchema(/* GraphQL */ `
      type Query {
        ping: String!
      }
    `);
    const out = emitDslModules(schema, {
      typesImport: "./schema-types.js",
      customScalars: [],
    });

    const linked = linkTypeMap(
      JSON.parse(out.typeMap.replace(/^export default /, "")),
    );
    expect(linked.Mutation).toBeUndefined();
    expect(linked.Subscription).toBeUndefined();

    const op = generateGraphqlOperation("query", linked.Query!, {
      ping: true,
    });
    const doc = parse(op.query);
    expect(validate(schema, doc)).toEqual([]);

    const exports = exportedConstNames(out.index);
    expect(exports).toContain("buildQuery");
    expect(exports).not.toContain("buildMutation");
    expect(exports).not.toContain("buildSubscription");
  });

  it("emits selections with only a type import for ExactlyOneField", () => {
    const out = emitDslModules(minimalSchema, {
      typesImport: "./schema-types.js",
      customScalars: [],
    });

    const valueImports = workspaceValueImportsFrom(
      out.selections,
      "@corpdk/graphql-dsl",
    );
    expect(valueImports).not.toContain("ExactlyOneField");
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
