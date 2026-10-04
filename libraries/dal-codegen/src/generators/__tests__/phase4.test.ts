import { describe, expect, it } from "vitest";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { join } from "node:path";
import {
  collectFilterIndexTargets,
  lintFilterIndexCoverage,
} from "../../filter-index-lint.js";
import { columnMatchesIndex, hasIndexCoverage } from "../../index-coverage.js";
import { lintExitCode, runEntityLint } from "../../entity-lint.js";
import { loadEntities } from "../../model.js";
import type { EntityModel } from "../../model.js";

const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: text("created_by").notNull(),
  updatedBy: text("updated_by").notNull(),
});

const itemsNoIndex = pgTable("items_no_index", {
  id: uuid("id").primaryKey().defaultRandom(),
  sku: text("sku").notNull(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: text("created_by").notNull(),
  updatedBy: text("updated_by").notNull(),
});

const itemsIndexed = pgTable(
  "items_indexed",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sku: text("sku").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by").notNull(),
    updatedBy: text("updated_by").notNull(),
  },
  (table) => [
    index("items_indexed_sku_idx").on(table.sku),
    index("items_indexed_category_id_idx").on(table.categoryId),
  ],
);

const itemsRelations = relations(itemsNoIndex, ({ one }) => ({
  category: one(categories, {
    fields: [itemsNoIndex.categoryId],
    references: [categories.id],
  }),
}));

void itemsRelations;

describe("index coverage", () => {
  const combined = { itemsNoIndex, itemsIndexed, categories };

  it("treats primary key id as covered", () => {
    expect(hasIndexCoverage("itemsNoIndex", "id", combined)).toBe(true);
  });

  it("leadingOnly requires first column in composite index", () => {
    const compositeOnly = pgTable(
      "composite_only",
      {
        id: uuid("id").primaryKey().defaultRandom(),
        status: text("status").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
      },
      (table) => [index("composite_only_status_created_idx").on(table.status, table.createdAt)],
    );
    const mod = { compositeOnly };
    expect(
      hasIndexCoverage("compositeOnly", "status", mod, { leadingOnly: true }),
    ).toBe(true);
    expect(
      hasIndexCoverage("compositeOnly", "createdAt", mod, { leadingOnly: true }),
    ).toBe(false);
    expect(
      hasIndexCoverage("compositeOnly", "createdAt", mod, { leadingOnly: false }),
    ).toBe(true);
  });

  it("columnMatchesIndex distinguishes leading vs any position", () => {
    const a = itemsNoIndex.sku;
    const b = itemsNoIndex.categoryId;
    expect(columnMatchesIndex([a, b], b, true)).toBe(false);
    expect(columnMatchesIndex([a, b], b, false)).toBe(true);
  });

  it("detects missing filter indexes on scalars and owner FKs", () => {
    const violations = lintFilterIndexCoverage(
      {
        exportName: "itemsNoIndex",
        tableName: "items_no_index",
        graphqlType: "ItemsNoIndex",
        fieldBasename: "itemsNoIndex",
        listField: "itemsNoIndexes",
        auditProfile: "full",
        deleteStrategy: "hard",
        tableComment: "t",
        sourceFile: "x.ts",
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
            drizzleKey: "sku",
            physicalName: "sku",
            graphqlName: "sku",
            kind: "text",
            notNull: true,
            hasDefault: false,
            comment: "sku",
            isServerManaged: false,
            isBusiness: true,
          },
          {
            drizzleKey: "categoryId",
            physicalName: "category_id",
            graphqlName: "categoryId",
            kind: "uuid",
            notNull: true,
            hasDefault: false,
            comment: "fk",
            isServerManaged: false,
            isBusiness: true,
            omitFromOutput: true,
          },
          {
            drizzleKey: "createdAt",
            physicalName: "created_at",
            graphqlName: "createdAt",
            kind: "timestamptz",
            notNull: true,
            hasDefault: true,
            comment: "c",
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
            comment: "u",
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
            comment: "cb",
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
            comment: "ub",
            isServerManaged: true,
            isBusiness: false,
          },
        ],
        relations: [
          {
            fieldName: "category",
            kind: "many-to-one",
            targetExportName: "categories",
            targetGraphqlType: "Category",
            ownerFkDrizzleKey: "categoryId",
            filterable: true,
            navigationList: false,
            navigationNullable: false,
          },
        ],
      } satisfies EntityModel,
      combined,
      false,
    );
    const codes = violations.map((v) => v.column);
    expect(codes).toContain("sku");
    expect(codes).toContain("categoryId");
    expect(violations.every((v) => v.code === "FILTER_INDEX" && v.severity === "warn")).toBe(true);
  });

  it("passes when scalar and owner FK indexes exist", () => {
    const entities = [
      {
        exportName: "itemsIndexed",
        relations: [
          {
            fieldName: "category",
            kind: "many-to-one",
            targetExportName: "categories",
            targetGraphqlType: "Category",
            ownerFkDrizzleKey: "categoryId",
            filterable: true,
            navigationList: false,
            navigationNullable: false,
          },
        ],
      },
    ] as Pick<EntityModel, "exportName" | "relations">[];
    const entity = entities[0]!;
    const full = {
      ...entity,
      tableName: "items_indexed",
      graphqlType: "ItemsIndexed",
      fieldBasename: "itemsIndexed",
      listField: "itemsIndexeds",
      auditProfile: "full" as const,
      deleteStrategy: "hard" as const,
      tableComment: "t",
      sourceFile: "x.ts",
      columns: [
        {
          drizzleKey: "sku",
          physicalName: "sku",
          graphqlName: "sku",
          kind: "text" as const,
          notNull: true,
          hasDefault: false,
          comment: "sku",
          isServerManaged: false,
          isBusiness: true,
        },
      ],
    } satisfies EntityModel;
    const violations = lintFilterIndexCoverage(full, combined, true);
    expect(violations.filter((v) => v.code === "FILTER_INDEX")).toHaveLength(0);
  });
});

describe("collectFilterIndexTargets", () => {
  it("includes association child FK for one-to-many", async () => {
    const schemaPath = join(process.cwd(), "../../templates/ds/src/db/schema");
    const entities = await loadEntities(schemaPath, false);
    const categories = entities.find((e) => e.exportName === "categories");
    expect(categories).toBeDefined();
    const targets = collectFilterIndexTargets(categories!);
    expect(targets.some((t) => t.tableExport === "items" && t.drizzleKey === "categoryId")).toBe(
      true,
    );
  });
});

describe("entity:lint on ds fixture schema", () => {
  it("emits FILTER_INDEX warnings in default mode", async () => {
    const dsRoot = join(process.cwd(), "../../templates/ds");
    const result = await runEntityLint({
      packageRoot: dsRoot,
      schemaPath: "src/db/schema",
      configPath: "dal/dal.config.yaml",
    });
    expect(result.entityCount).toBeGreaterThan(0);
    const filterWarnings = result.violations.filter(
      (v) => v.code === "FILTER_INDEX" && v.severity === "warn",
    );
    expect(filterWarnings.length).toBeGreaterThan(0);
    expect(lintExitCode(result.violations)).toBe(0);
  });
});
