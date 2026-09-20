import { describe, expect, it } from "vitest";
import { generateRepository } from "../repository.js";
import { generateResolvers } from "../resolvers.js";
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
  const config = { strict: false, filterMaxDepth: 2, filterMaxNodes: 50 };

  it("repository generator wires column projection and GraphQL resolve info", () => {
    const source = generateRepository(orderEntity, [orderEntity], config);
    expect(source).toContain("resolveColumnProjectionFromInfo");
    expect(source).toContain("columnProjectionFromInfo");
    expect(source).toContain("GraphQLResolveInfo");
    expect(source).toContain("queryEngine.list(args, mapRow, projection)");
  });

  it("resolver generator passes resolve info to list/get/connection", () => {
    const source = generateResolvers([orderEntity]);
    expect(source).toContain("info: GraphQLResolveInfo");
    expect(source).toContain("findById(args.id, { includeDeleted: args.includeDeleted }, info)");
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
