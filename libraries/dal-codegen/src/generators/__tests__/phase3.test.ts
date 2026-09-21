import { describe, expect, it } from "vitest";
import {
  buildColumnProjection,
  collectEntityFieldSelection,
  resolveColumnProjectionFromInfo,
} from "@corpdk/dal-core";
import { GraphQLObjectType, GraphQLSchema, GraphQLString, parse } from "graphql";
import type { GraphQLResolveInfo } from "graphql";
import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { buildDalGraphQLSchema } from "../schema-builder.js";
import { lintExitCode, type LintViolation } from "../../entity-lint.js";
import type { EntityModel } from "../../model.js";

const orderEntity: EntityModel = {
  exportName: "orders",
  tableName: "orders",
  graphqlType: "Order",
  fieldBasename: "order",
  listField: "orders",
  auditProfile: "full",
  deleteStrategy: "soft",
  tableComment: "Orders",
  sourceFile: "orders.ts",
  columns: [
    {
      drizzleKey: "id",
      physicalName: "id",
      graphqlName: "id",
      kind: "uuid",
      notNull: true,
      hasDefault: true,
      comment: "id",
      isServerManaged: true,
      isBusiness: false,
    },
    {
      drizzleKey: "customerName",
      physicalName: "customer_name",
      graphqlName: "customerName",
      kind: "varchar",
      notNull: true,
      hasDefault: false,
      comment: "name",
      isServerManaged: false,
      isBusiness: true,
    },
    {
      drizzleKey: "createdAt",
      physicalName: "created_at",
      graphqlName: "createdAt",
      kind: "timestamptz",
      notNull: true,
      hasDefault: true,
      comment: "created",
      isServerManaged: true,
      isBusiness: false,
    },
    {
      drizzleKey: "updatedAt",
      physicalName: "updated_at",
      graphqlName: "updatedAt",
      kind: "timestamptz",
      notNull: true,
      hasDefault: true,
      comment: "updated",
      isServerManaged: true,
      isBusiness: false,
    },
    {
      drizzleKey: "createdBy",
      physicalName: "created_by",
      graphqlName: "createdBy",
      kind: "text",
      notNull: true,
      hasDefault: false,
      comment: "created by",
      isServerManaged: true,
      isBusiness: false,
    },
    {
      drizzleKey: "updatedBy",
      physicalName: "updated_by",
      graphqlName: "updatedBy",
      kind: "text",
      notNull: true,
      hasDefault: false,
      comment: "updated by",
      isServerManaged: true,
      isBusiness: false,
    },
    {
      drizzleKey: "deletedAt",
      physicalName: "deleted_at",
      graphqlName: "deletedAt",
      kind: "timestamptz",
      notNull: false,
      hasDefault: false,
      comment: "deleted",
      isServerManaged: true,
      isBusiness: false,
    },
    {
      drizzleKey: "deletedBy",
      physicalName: "deleted_by",
      graphqlName: "deletedBy",
      kind: "text",
      notNull: false,
      hasDefault: false,
      comment: "deleted by",
      isServerManaged: true,
      isBusiness: false,
    },
  ],
  relations: [],
};

describe("Phase 3 codegen output", () => {
  it("column projection narrows list selections to requested scalars", () => {
    const table = pgTable("orders", {
      id: uuid("id").primaryKey(),
      customerName: text("customer_name").notNull(),
      status: text("status").notNull(),
    });
    const columns = [
      { graphqlName: "id", drizzleKey: "id", kind: "uuid" as const, column: table.id },
      {
        graphqlName: "customerName",
        drizzleKey: "customerName",
        kind: "text" as const,
        column: table.customerName,
      },
      { graphqlName: "status", drizzleKey: "status", kind: "text" as const, column: table.status },
    ];
    const projection = buildColumnProjection({
      columns,
      softDelete: true,
      relations: [],
      selectedGraphqlFields: new Set(["customerName"]),
      sortDrizzleKeys: ["createdAt"],
    });
    expect(projection?.drizzleKeys.has("customerName")).toBe(true);
    expect(projection?.drizzleKeys.has("status")).toBe(false);
    expect(projection?.drizzleKeys.has("id")).toBe(true);
    expect(projection?.drizzleKeys.has("deletedAt")).toBe(true);
  });

  it("resolveColumnProjectionFromInfo reads nested entity selections", () => {
    const OrderType = new GraphQLObjectType({
      name: "Order",
      fields: {
        id: { type: GraphQLString },
        customerName: { type: GraphQLString },
      },
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: "Query",
        fields: {
          orders: {
            type: OrderType,
            resolve: () => ({}),
          },
        },
      }),
    });
    const doc = parse(`{ orders { id customerName } }`);
    const info = {} as GraphQLResolveInfo;
    const op = doc.definitions[0];
    if (op.kind !== "OperationDefinition" || !op.selectionSet) throw new Error("bad doc");
    const ordersField = op.selectionSet.selections[0];
    if (ordersField.kind !== "Field") throw new Error("bad field");
    Object.assign(info, {
      fieldNodes: [ordersField],
      schema,
    });
    const selected = collectEntityFieldSelection(info, "Order");
    const projection = resolveColumnProjectionFromInfo(
      info,
      "Order",
      [
        { graphqlName: "id", drizzleKey: "id", kind: "uuid" },
        { graphqlName: "customerName", drizzleKey: "customerName", kind: "text" },
      ],
      true,
      [],
    );
    expect(selected).toEqual(new Set(["id", "customerName"]));
    expect(projection?.drizzleKeys.has("customerName")).toBe(true);
  });

  it("schema query fields expose includeDeleted for get-by-id reads", () => {
    const schema = buildDalGraphQLSchema([orderEntity]);
    const orderField = schema.getQueryType()?.getFields()?.order;
    expect(orderField?.args.some((arg) => arg.name === "includeDeleted")).toBe(true);
    expect(schema.getQueryType()?.getFields()?.orders).toBeDefined();
  });
});

describe("entity lint exit code", () => {
  it("returns non-zero when errors present", () => {
    const violations: LintViolation[] = [
      { severity: "warn", code: "SORT_INDEX", message: "warn only" },
    ];
    expect(lintExitCode(violations)).toBe(0);
    violations.push({ severity: "error", code: "ENUM_CASING", message: "bad enum" });
    expect(lintExitCode(violations)).toBe(1);
  });
});
