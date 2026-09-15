import { describe, expect, it } from "vitest";
import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import {
  ASSOCIATION_FILTER_KEYS,
  extractAssociationFilter,
  isEmptyFilter,
  QueryTranslator,
  resolveBulkAtomic,
  type FilterAST,
} from "@corpdk/dal-core";
import { loadEntities } from "../../model.js";
import { generateRepository } from "../repository.js";
import { buildDalGraphQLSchema } from "../schema-builder.js";
import { join } from "node:path";

const statusEnum = pgEnum("order_status", ["PENDING", "ACTIVE"]);

const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: text("created_by").notNull(),
  updatedBy: text("updated_by").notNull(),
});

const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: statusEnum("status").notNull().default("PENDING"),
  customerName: text("customer_name").notNull(),
  categoryId: uuid("category_id").references(() => categories.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: text("created_by").notNull(),
  updatedBy: text("updated_by").notNull(),
});

const orderLines = pgTable("order_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id),
  sku: text("sku").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: text("created_by").notNull(),
  updatedBy: text("updated_by").notNull(),
});

const categoriesRelations = relations(categories, ({ many }) => ({
  orders: many(orders),
}));

const ordersRelations = relations(orders, ({ one, many }) => ({
  category: one(categories, { fields: [orders.categoryId], references: [categories.id] }),
  lines: many(orderLines),
}));

const orderLinesRelations = relations(orderLines, ({ one }) => ({
  order: one(orders, { fields: [orderLines.orderId], references: [orders.id] }),
}));

describe("Phase 2 dal-core", () => {
  it("extractAssociationFilter reads some/every/none", () => {
    const filter: FilterAST = { some: { sku: { eq: "ABC" } } };
    expect(extractAssociationFilter(filter)?.some).toEqual({ sku: { eq: "ABC" } });
    expect(ASSOCIATION_FILTER_KEYS).toContain("some");
  });

  it("resolveBulkAtomic defaults to true for <=100 items", () => {
    expect(resolveBulkAtomic(50, undefined)).toBe(true);
    expect(resolveBulkAtomic(101, undefined)).toBe(false);
    expect(resolveBulkAtomic(200, true)).toBe(true);
  });

  it("isEmptyFilter detects empty filters", () => {
    expect(isEmptyFilter(null)).toBe(true);
    expect(isEmptyFilter({})).toBe(true);
    expect(isEmptyFilter({ status: { eq: "PENDING" } })).toBe(false);
  });

  it("QueryTranslator compiles scalar filters", () => {
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({}),
          innerJoin: () => ({ where: () => ({}) }),
        }),
      }),
    };
    const translator = new QueryTranslator({
      db: mockDb as never,
      table: orders,
      columns: [
        { graphqlName: "status", drizzleKey: "status", kind: "enum", column: orders.status },
        { graphqlName: "customerName", drizzleKey: "customerName", kind: "text", column: orders.customerName },
      ],
      relations: [],
      softDelete: false,
      filterBudget: { maxDepth: 2, maxNodes: 50 },
    });
    const sql = translator.translateFilter({ status: { eq: "PENDING" } });
    expect(sql).toBeDefined();
  });
});

describe("Phase 2 relation inference", () => {
  it("loads relations from Drizzle schema fixture", async () => {
    const schemaPath = join(process.cwd(), "../../templates/ds/src/db/schema");
    const entities = await loadEntities(schemaPath, false);
    const items = entities.find((e) => e.exportName === "items");
    const categories = entities.find((e) => e.exportName === "categories");
    expect(items?.relations.some((r) => r.fieldName === "category" && r.kind === "many-to-one")).toBe(true);
    expect(items?.relations.some((r) => r.fieldName === "detail" && r.kind === "one-to-one")).toBe(true);
    expect(items?.columns.find((c) => c.drizzleKey === "categoryId")?.omitFromOutput).toBe(true);
    const categoryItems = categories?.relations.find((r) => r.fieldName === "items");
    expect(categoryItems?.childFkDrizzleKey).toBe("categoryId");
  });
});

describe("Phase 2 codegen output", () => {
  it("generates QueryEngine-backed repository", async () => {
    const schemaPath = join(process.cwd(), "../../templates/ds/src/db/schema");
    const entities = await loadEntities(schemaPath, false);
    const order = entities.find((e) => e.exportName === "orders");
    expect(order).toBeDefined();
    const code = generateRepository(order!, entities, {
      strict: false,
      filterMaxDepth: 2,
      filterMaxNodes: 50,
    });
    expect(code).toContain("QueryEngine");
    expect(code).toContain("bulkCreate");
    expect(code).toContain("bulkDeleteByFilter");
    expect(code).not.toContain("buildStringFilter");
  });

  it("parent batch loaders use child FK column, not table.id", async () => {
    const schemaPath = join(process.cwd(), "../../templates/ds/src/db/schema");
    const entities = await loadEntities(schemaPath, false);
    const items = entities.find((e) => e.exportName === "items");
    expect(items).toBeDefined();
    const code = generateRepository(items!, entities, {
      strict: false,
      filterMaxDepth: 2,
      filterMaxNodes: 50,
    });
    expect(code).toContain("findByCategoryIds");
    expect(code).toContain("inArray(table.categoryId, unique)");
    expect(code).toContain("const key = row.categoryId as string");
    expect(code).not.toMatch(/findByCategoryIds[\s\S]*inArray\(table\.id,/);
  });

  it("builds schema with association filters and bulk mutations", async () => {
    const schemaPath = join(process.cwd(), "../../templates/ds/src/db/schema");
    const entities = await loadEntities(schemaPath, false);
    const schema = buildDalGraphQLSchema(entities);
    const mutationNames = Object.keys(schema.getMutationType()?.getFields() ?? {});
    expect(mutationNames).toContain("bulkCreateOrder");
    expect(mutationNames).toContain("bulkDeleteOrderByFilter");
    const orderType = schema.getType("Order");
    const orderFields = orderType && "getFields" in orderType ? Object.keys(orderType.getFields()) : [];
    expect(orderFields).toContain("lines");
    expect(orderFields).not.toContain("categoryId");
  });
});
