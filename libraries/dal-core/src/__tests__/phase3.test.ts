import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  buildColumnProjection,
  buildProjectedSelectShape,
  collectEntityFieldSelection,
  CURSOR_VERSION,
  decodeCursor,
  encodeCursor,
  resetCursorSigningSecretCache,
  resolveColumnProjectionFromInfo,
} from "@corpdk/dal-core";
import { GraphQLObjectType, GraphQLSchema, GraphQLString, parse } from "graphql";
import type { GraphQLResolveInfo } from "graphql";
import { pgTable, text, uuid } from "drizzle-orm/pg-core";

describe("HMAC cursor signing", () => {
  const payload = {
    version: CURSOR_VERSION,
    entity: "Item",
    sort: [{ field: "ID", direction: "ASC" as const }],
    values: ["00000000-0000-4000-8000-000000000001"],
  };

  beforeEach(() => {
    resetCursorSigningSecretCache();
  });

  afterEach(() => {
    delete process.env.DAL_CURSOR_SECRET;
    resetCursorSigningSecretCache();
  });

  it("round-trips unsigned when secret unset", () => {
    const cursor = encodeCursor(payload);
    expect(cursor.includes(".")).toBe(false);
    expect(decodeCursor(cursor, "Item", "after")).toEqual(payload);
  });

  it("signs and verifies when DAL_CURSOR_SECRET is set", () => {
    process.env.DAL_CURSOR_SECRET = "test-secret";
    resetCursorSigningSecretCache();
    const cursor = encodeCursor(payload);
    expect(cursor.includes(".")).toBe(true);
    expect(decodeCursor(cursor, "Item", "after")).toEqual(payload);
  });

  it("rejects tampered signature", () => {
    process.env.DAL_CURSOR_SECRET = "test-secret";
    resetCursorSigningSecretCache();
    const cursor = encodeCursor(payload);
    const tampered = `${cursor.slice(0, -1)}x`;
    expect(() => decodeCursor(tampered, "Item", "after")).toThrow(/signature/i);
  });

  it("requires signature when secret is set", () => {
    process.env.DAL_CURSOR_SECRET = "test-secret";
    resetCursorSigningSecretCache();
    const unsigned = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
    expect(() => decodeCursor(unsigned, "Item", "after")).toThrow(/signature required/i);
  });
});

describe("ColumnProjection", () => {
  const table = pgTable("items", {
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    sku: text("sku").notNull(),
  });

  const columns = [
    { graphqlName: "id", drizzleKey: "id", kind: "uuid" as const, column: table.id },
    { graphqlName: "name", drizzleKey: "name", kind: "text" as const, column: table.name },
    { graphqlName: "sku", drizzleKey: "sku", kind: "text" as const, column: table.sku },
  ];

  it("includes id, soft-delete, sort keys, and selected scalars", () => {
    const projection = buildColumnProjection({
      columns,
      softDelete: true,
      relations: [],
      selectedGraphqlFields: new Set(["name"]),
      sortDrizzleKeys: ["createdAt"],
    });
    expect(projection?.drizzleKeys.has("id")).toBe(true);
    expect(projection?.drizzleKeys.has("name")).toBe(true);
    expect(projection?.drizzleKeys.has("sku")).toBe(false);
    expect(projection?.drizzleKeys.has("deletedAt")).toBe(true);
    expect(projection?.drizzleKeys.has("createdAt")).toBe(true);
  });

  it("includes FK when navigation field is selected", () => {
    const projection = buildColumnProjection({
      columns,
      softDelete: false,
      relations: [{ fieldName: "category", ownerFkDrizzleKey: "categoryId" }],
      selectedGraphqlFields: new Set(["category"]),
    });
    expect(projection?.drizzleKeys.has("categoryId")).toBe(true);
  });

  it("collectEntityFieldSelection reads list query fields", () => {
    const ItemType = new GraphQLObjectType({
      name: "Item",
      fields: {
        id: { type: GraphQLString },
        name: { type: GraphQLString },
      },
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: "Query",
        fields: {
          items: {
            type: ItemType,
            resolve: () => ({}),
          },
        },
      }),
    });
    const doc = parse(`{ items { id name } }`);
    const info = {} as GraphQLResolveInfo;
    const op = doc.definitions[0];
    if (op.kind !== "OperationDefinition" || !op.selectionSet) throw new Error("bad doc");
    const itemsField = op.selectionSet.selections[0];
    if (itemsField.kind !== "Field") throw new Error("bad field");
    Object.assign(info, {
      fieldNodes: [itemsField],
      schema,
    });
    const selected = collectEntityFieldSelection(info, "Item");
    expect(selected).toEqual(new Set(["id", "name"]));
  });

  it("collectEntityFieldSelection unwraps connection edges.node selections", () => {
    const ItemType = new GraphQLObjectType({
      name: "Item",
      fields: {
        id: { type: GraphQLString },
        name: { type: GraphQLString },
      },
    });
    const EdgeType = new GraphQLObjectType({
      name: "ItemEdge",
      fields: {
        node: { type: ItemType },
      },
    });
    const ConnectionType = new GraphQLObjectType({
      name: "ItemConnection",
      fields: {
        edges: { type: EdgeType },
        pageInfo: { type: GraphQLString },
      },
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: "Query",
        fields: {
          items: { type: ConnectionType, resolve: () => ({}) },
        },
      }),
    });
    const doc = parse(`{ items { edges { node { id name } } pageInfo } }`);
    const info = {} as GraphQLResolveInfo;
    const op = doc.definitions[0];
    if (op.kind !== "OperationDefinition" || !op.selectionSet) throw new Error("bad doc");
    const itemsField = op.selectionSet.selections[0];
    if (itemsField.kind !== "Field") throw new Error("bad field");
    Object.assign(info, { fieldNodes: [itemsField], schema });
    expect(collectEntityFieldSelection(info, "Item")).toEqual(new Set(["id", "name"]));
  });

  it("defaults to id when only pageInfo is selected on a connection", () => {
    const ConnectionType = new GraphQLObjectType({
      name: "ItemConnection",
      fields: {
        pageInfo: { type: GraphQLString },
      },
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: "Query",
        fields: {
          items: { type: ConnectionType, resolve: () => ({}) },
        },
      }),
    });
    const doc = parse(`{ items { pageInfo } }`);
    const info = {} as GraphQLResolveInfo;
    const op = doc.definitions[0];
    if (op.kind !== "OperationDefinition" || !op.selectionSet) throw new Error("bad doc");
    const itemsField = op.selectionSet.selections[0];
    if (itemsField.kind !== "Field") throw new Error("bad field");
    Object.assign(info, { fieldNodes: [itemsField], schema });
    expect(collectEntityFieldSelection(info, "Item")).toEqual(new Set(["id"]));
  });

  it("buildProjectedSelectShape maps drizzle keys to table columns", () => {
    const projection = buildColumnProjection({
      columns,
      softDelete: false,
      relations: [],
      selectedGraphqlFields: new Set(["name"]),
    });
    const shape = buildProjectedSelectShape(table, projection);
    expect(shape).toEqual({ id: table.id, name: table.name });
  });

  it("resolveColumnProjectionFromInfo combines selection and projection", () => {
    const ItemType = new GraphQLObjectType({
      name: "Item",
      fields: {
        id: { type: GraphQLString },
        sku: { type: GraphQLString },
      },
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: "Query",
        fields: {
          items: { type: ItemType, resolve: () => ({}) },
        },
      }),
    });
    const doc = parse(`{ items { sku } }`);
    const info = {} as GraphQLResolveInfo;
    const op = doc.definitions[0];
    if (op.kind !== "OperationDefinition" || !op.selectionSet) throw new Error("bad doc");
    const itemsField = op.selectionSet.selections[0];
    if (itemsField.kind !== "Field") throw new Error("bad field");
    Object.assign(info, { fieldNodes: [itemsField], schema });
    const projection = resolveColumnProjectionFromInfo(info, "Item", columns, false, []);
    expect(projection?.drizzleKeys).toEqual(new Set(["id", "sku"]));
  });
});
