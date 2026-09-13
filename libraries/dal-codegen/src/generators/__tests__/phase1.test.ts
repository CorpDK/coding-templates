import { describe, expect, it } from "vitest";
import {
  buildEnumFilter,
  encodeCursor,
  decodeCursor,
  resolveSortWithTieBreaker,
  validateConnectionPagingArgs,
  validateFilterBudget,
  ValidationError,
  CURSOR_VERSION,
} from "@corpdk/dal-core";
import { pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { generateRepository } from "../repository.js";
import { generateResolvers } from "../resolvers.js";
import type { EntityModel } from "../../model.js";

const statusEnum = pgEnum("order_status", ["PENDING", "ACTIVE"]);

const ordersTable = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: statusEnum("status").notNull().default("PENDING"),
  customerName: text("customer_name").notNull(),
});

describe("Phase 1 dal-core runtime", () => {
  it("buildEnumFilter supports eq, neq, in, notIn", () => {
    const col = ordersTable.status;
    expect(buildEnumFilter(col, { eq: "PENDING" })).toBeDefined();
    expect(buildEnumFilter(col, { neq: "ACTIVE" })).toBeDefined();
    expect(buildEnumFilter(col, { in: ["PENDING", "ACTIVE"] })).toBeDefined();
    expect(buildEnumFilter(col, { notIn: ["ACTIVE"] })).toBeDefined();
    expect(buildEnumFilter(col, {})).toBeUndefined();
  });

  it("validateFilterBudget rejects deep filters", () => {
    const deep = {
      and: [{ or: [{ and: [{ status: { eq: "PENDING" } }] }] }],
    };
    expect(() => validateFilterBudget(deep, { maxDepth: 2, maxNodes: 50 })).toThrow(ValidationError);
    expect(() => validateFilterBudget(deep, { maxDepth: 3, maxNodes: 50 })).not.toThrow();
  });

  it("validateFilterBudget rejects too many nodes", () => {
    const wide = {
      and: [
        { status: { eq: "PENDING" } },
        { customerName: { eq: "a" } },
        { customerName: { eq: "b" } },
      ],
    };
    expect(() => validateFilterBudget(wide, { maxDepth: 2, maxNodes: 2 })).toThrow(ValidationError);
  });

  it("resolveSortWithTieBreaker appends id when missing", () => {
    const resolved = resolveSortWithTieBreaker(
      [{ field: "CREATED_AT", direction: "DESC" }],
      { CREATED_AT: "createdAt", ID: "id" },
    );
    expect(resolved.map((s) => s.drizzleKey)).toEqual(["createdAt", "id"]);
  });

  it("encode/decode cursor round-trips", () => {
    const payload = {
      version: CURSOR_VERSION,
      entity: "Order",
      sort: [{ field: "ID", direction: "ASC" as const }],
      values: ["00000000-0000-4000-8000-000000000001"],
    };
    const cursor = encodeCursor(payload);
    const decoded = decodeCursor(cursor, "Order", "after");
    expect(decoded).toEqual(payload);
  });

  it("validateConnectionPagingArgs rejects first+last together", () => {
    expect(() =>
      validateConnectionPagingArgs({ first: 10, last: 10 }),
    ).toThrow(ValidationError);
  });
});

describe("Phase 1 codegen output", () => {
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
        drizzleKey: "status",
        physicalName: "status",
        graphqlName: "status",
        kind: "enum",
        notNull: true,
        hasDefault: true,
        defaultValue: "PENDING",
        enumName: "OrderStatus",
        enumValues: ["PENDING", "ACTIVE"],
        comment: "status",
        isServerManaged: false,
        isBusiness: true,
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
  };

  const config = { strict: false, filterMaxDepth: 2, filterMaxNodes: 50 };

  it("repository generator uses buildEnumFilter and enum create default", () => {
    const source = generateRepository(orderEntity, config);
    expect(source).toContain("buildEnumFilter");
    expect(source).toContain('input.status ?? "PENDING"');
    expect(source).toContain("validateFilterBudget");
    expect(source).toContain("resolveSortWithTieBreaker");
    expect(source).toContain("encodeCursor");
    expect(source).toContain("args.last != null");
  });

  it("resolver generator filters subscribeTo and accepts actorId", () => {
    const source = generateResolvers([orderEntity]);
    expect(source).toContain("allowed.has(event.operation)");
    expect(source).toContain("CreateDalContextOptions");
    expect(source).toContain("last: args.last");
    expect(source).toContain("before: args.before");
  });
});
