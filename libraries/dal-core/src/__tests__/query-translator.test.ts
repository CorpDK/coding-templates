import { describe, expect, it } from "vitest";
import type { SQL } from "drizzle-orm";
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { PgDialect } from "drizzle-orm/pg-core";
import { QueryTranslator, type RelationDescriptor } from "../query-translator.js";

const dialect = new PgDialect();

function sqlText(fragment: SQL | undefined): string {
  if (!fragment) return "";
  return dialect.sqlToQuery(fragment).sql;
}

const items = pgTable("items", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
});

const itemDetails = pgTable("item_details", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => items.id),
  specifications: text("specifications"),
});

describe("QueryTranslator inverse one-to-one filters", () => {
  it("compiles nested filters on child-owned one-to-one relations", () => {
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
      table: items,
      columns: [{ graphqlName: "name", drizzleKey: "name", kind: "text", column: items.name }],
      relations: [
        {
          fieldName: "detail",
          kind: "one-to-one",
          childFkDrizzleKey: "itemId",
          targetTable: itemDetails,
          targetColumns: [
            {
              graphqlName: "specifications",
              drizzleKey: "specifications",
              kind: "text",
              column: itemDetails.specifications,
            },
          ],
          filterable: true,
        },
      ],
      softDelete: false,
      filterBudget: { maxDepth: 2, maxNodes: 50 },
    });

    const sql = translator.translateFilter({
      detail: { specifications: { like: "%foo%" } },
    });
    expect(sql).toBeDefined();
  });

  it("compiles empty nested filters as existence predicates", () => {
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
      table: items,
      columns: [{ graphqlName: "name", drizzleKey: "name", kind: "text", column: items.name }],
      relations: [
        {
          fieldName: "detail",
          kind: "one-to-one",
          childFkDrizzleKey: "itemId",
          targetTable: itemDetails,
          targetColumns: [
            {
              graphqlName: "specifications",
              drizzleKey: "specifications",
              kind: "text",
              column: itemDetails.specifications,
            },
          ],
          filterable: true,
        },
      ],
      softDelete: false,
      filterBudget: { maxDepth: 2, maxNodes: 50 },
    });

    expect(translator.translateFilter({ detail: {} })).toBeDefined();
    expect(translator.translateFilter({ detail: { specifications: {} } })).toBeDefined();
  });
});

const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
});

const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id").references(() => categories.id),
});

const orderLines = pgTable("order_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id),
  quantity: integer("quantity").notNull(),
});

const mockDb = {
  select: () => ({
    from: () => ({
      where: () => ({}),
      innerJoin: () => ({ where: () => ({}) }),
    }),
  }),
};

describe("QueryTranslator nested empty scalar filters", () => {
  it("compiles M:1 nested empty scalar filters as existence predicates", () => {
    const translator = new QueryTranslator({
      db: mockDb as never,
      table: orders,
      columns: [],
      relations: [
        {
          fieldName: "category",
          kind: "many-to-one",
          ownerFkDrizzleKey: "categoryId",
          targetTable: categories,
          targetColumns: [
            { graphqlName: "name", drizzleKey: "name", kind: "text", column: categories.name },
          ],
          filterable: true,
        },
      ],
      softDelete: false,
      filterBudget: { maxDepth: 2, maxNodes: 50 },
    });

    expect(translator.translateFilter({ category: { name: {} } })).toBeDefined();
  });

  it("compiles 1:M some nested empty scalar filters as existence predicates", () => {
    const translator = new QueryTranslator({
      db: mockDb as never,
      table: orders,
      columns: [],
      relations: [
        {
          fieldName: "lines",
          kind: "one-to-many",
          childFkDrizzleKey: "orderId",
          targetTable: orderLines,
          childTable: orderLines,
          childColumns: [
            {
              graphqlName: "quantity",
              drizzleKey: "quantity",
              kind: "integer",
              column: orderLines.quantity,
            },
          ],
          targetColumns: [],
          filterable: true,
        },
      ],
      softDelete: false,
      filterBudget: { maxDepth: 2, maxNodes: 50 },
    });

    expect(translator.translateFilter({ lines: { some: { quantity: {} } } })).toBeDefined();
  });
});

describe("QueryTranslator nested relation filters", () => {
  const nestedCategories = pgTable("nested_categories", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
  });

  const nestedItems = pgTable("nested_items", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    categoryId: uuid("category_id").references(() => nestedCategories.id),
  });

  const categoryColumns = [
    { graphqlName: "name", drizzleKey: "name", kind: "text" as const, column: nestedCategories.name },
  ];
  const itemColumns = [
    { graphqlName: "name", drizzleKey: "name", kind: "text" as const, column: nestedItems.name },
  ];

  const categoriesRelations: RelationDescriptor[] = [
    {
      fieldName: "items",
      kind: "one-to-many" as const,
      childFkDrizzleKey: "categoryId",
      targetTable: nestedItems,
      childTable: nestedItems,
      childColumns: itemColumns,
      targetColumns: [],
      filterable: true,
    },
  ];

  const itemsRelations: RelationDescriptor[] = [
    {
      fieldName: "category",
      kind: "many-to-one" as const,
      ownerFkDrizzleKey: "categoryId",
      targetTable: nestedCategories,
      targetColumns: categoryColumns,
      filterable: true,
      targetRelations: categoriesRelations,
    },
  ];

  categoriesRelations[0]!.childRelations = itemsRelations;

  it("compiles nested M:1 filters on association sub-filters", () => {
    const translator = new QueryTranslator({
      db: mockDb as never,
      table: nestedItems,
      columns: itemColumns,
      relations: itemsRelations,
      softDelete: false,
      filterBudget: { maxDepth: 3, maxNodes: 50 },
    });

    const sql = translator.translateFilter({
      category: { items: { some: { name: { eq: "Hammer" } } } },
    });
    expect(sql).toBeDefined();
  });

  it("compiles nested M:1 filters from parent one-to-many association", () => {
    const translator = new QueryTranslator({
      db: mockDb as never,
      table: nestedCategories,
      columns: categoryColumns,
      relations: categoriesRelations,
      softDelete: false,
      filterBudget: { maxDepth: 3, maxNodes: 50 },
    });

    const sql = translator.translateFilter({
      items: { some: { category: { name: { eq: "Tools" } } } },
    });
    expect(sql).toBeDefined();
  });
});

describe("QueryTranslator association soft-delete filters", () => {
  const softOrders = pgTable("soft_orders", {
    id: uuid("id").primaryKey().defaultRandom(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  });

  const softOrderLines = pgTable("soft_order_lines", {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => softOrders.id),
    quantity: integer("quantity").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  });

  it("excludes soft-deleted children in one-to-many some filters", () => {
    let capturedWhere: SQL | undefined;
    const db = {
      select: () => ({
        from: () => ({
          where: (where: SQL) => {
            capturedWhere = where;
            return {};
          },
        }),
      }),
    };

    const translator = new QueryTranslator({
      db: db as never,
      table: softOrders,
      columns: [],
      relations: [
        {
          fieldName: "lines",
          kind: "one-to-many",
          childFkDrizzleKey: "orderId",
          targetTable: softOrderLines,
          childTable: softOrderLines,
          childColumns: [
            {
              graphqlName: "quantity",
              drizzleKey: "quantity",
              kind: "integer",
              column: softOrderLines.quantity,
            },
            {
              graphqlName: "deletedAt",
              drizzleKey: "deletedAt",
              kind: "timestamptz",
              column: softOrderLines.deletedAt,
            },
          ],
          targetColumns: [],
          filterable: true,
        },
      ],
      softDelete: true,
      filterBudget: { maxDepth: 2, maxNodes: 50 },
    });

    translator.translateFilter({ lines: { some: { quantity: { gt: 10 } } } }, false);
    expect(sqlText(capturedWhere)).toMatch(/deleted_at" IS NULL/i);
  });

  it("excludes soft-deleted targets in many-to-one filters", () => {
    const softCategories = pgTable("soft_categories", {
      id: uuid("id").primaryKey().defaultRandom(),
      name: text("name").notNull(),
      deletedAt: timestamp("deleted_at", { withTimezone: true }),
    });

    const softItems = pgTable("soft_items", {
      id: uuid("id").primaryKey().defaultRandom(),
      categoryId: uuid("category_id").references(() => softCategories.id),
    });

    let capturedWhere: SQL | undefined;
    const db = {
      select: () => ({
        from: () => ({
          where: (where: SQL) => {
            capturedWhere = where;
            return {};
          },
        }),
      }),
    };

    const translator = new QueryTranslator({
      db: db as never,
      table: softItems,
      columns: [],
      relations: [
        {
          fieldName: "category",
          kind: "many-to-one",
          ownerFkDrizzleKey: "categoryId",
          targetTable: softCategories,
          targetColumns: [
            { graphqlName: "name", drizzleKey: "name", kind: "text", column: softCategories.name },
            {
              graphqlName: "deletedAt",
              drizzleKey: "deletedAt",
              kind: "timestamptz",
              column: softCategories.deletedAt,
            },
          ],
          filterable: true,
        },
      ],
      softDelete: false,
      filterBudget: { maxDepth: 2, maxNodes: 50 },
    });

    translator.translateFilter({ category: { name: { eq: "Tools" } } }, false);
    expect(sqlText(capturedWhere)).toMatch(/deleted_at" IS NULL/i);
  });

  it("honors childSoftDelete flag when deletedAt is omitted from childColumns", () => {
    let capturedWhere: SQL | undefined;
    const db = {
      select: () => ({
        from: () => ({
          where: (where: SQL) => {
            capturedWhere = where;
            return {};
          },
        }),
      }),
    };

    const translator = new QueryTranslator({
      db: db as never,
      table: softOrders,
      columns: [],
      relations: [
        {
          fieldName: "lines",
          kind: "one-to-many",
          childFkDrizzleKey: "orderId",
          targetTable: softOrderLines,
          childTable: softOrderLines,
          childColumns: [
            {
              graphqlName: "quantity",
              drizzleKey: "quantity",
              kind: "integer",
              column: softOrderLines.quantity,
            },
          ],
          targetColumns: [],
          childSoftDelete: true,
          filterable: true,
        },
      ],
      softDelete: true,
      filterBudget: { maxDepth: 2, maxNodes: 50 },
    });

    translator.translateFilter({ lines: { some: { quantity: { gt: 10 } } } }, false);
    expect(sqlText(capturedWhere)).toMatch(/deleted_at" IS NULL/i);
  });

  it("honors targetSoftDelete flag when deletedAt is omitted from targetColumns", () => {
    const softCategories = pgTable("soft_categories_flag", {
      id: uuid("id").primaryKey().defaultRandom(),
      name: text("name").notNull(),
      deletedAt: timestamp("deleted_at", { withTimezone: true }),
    });

    const softItems = pgTable("soft_items_flag", {
      id: uuid("id").primaryKey().defaultRandom(),
      categoryId: uuid("category_id").references(() => softCategories.id),
    });

    let capturedWhere: SQL | undefined;
    const db = {
      select: () => ({
        from: () => ({
          where: (where: SQL) => {
            capturedWhere = where;
            return {};
          },
        }),
      }),
    };

    const translator = new QueryTranslator({
      db: db as never,
      table: softItems,
      columns: [],
      relations: [
        {
          fieldName: "category",
          kind: "many-to-one",
          ownerFkDrizzleKey: "categoryId",
          targetTable: softCategories,
          targetColumns: [
            { graphqlName: "name", drizzleKey: "name", kind: "text", column: softCategories.name },
          ],
          targetSoftDelete: true,
          filterable: true,
        },
      ],
      softDelete: false,
      filterBudget: { maxDepth: 2, maxNodes: 50 },
    });

    translator.translateFilter({ category: { name: { eq: "Tools" } } }, false);
    expect(sqlText(capturedWhere)).toMatch(/deleted_at" IS NULL/i);
  });
});

describe("QueryTranslator one-to-many none and every filters", () => {
  it("compiles none association filters", () => {
    const translator = new QueryTranslator({
      db: mockDb as never,
      table: orders,
      columns: [],
      relations: [
        {
          fieldName: "lines",
          kind: "one-to-many",
          childFkDrizzleKey: "orderId",
          targetTable: orderLines,
          childTable: orderLines,
          childColumns: [
            {
              graphqlName: "quantity",
              drizzleKey: "quantity",
              kind: "integer",
              column: orderLines.quantity,
            },
          ],
          targetColumns: [],
          filterable: true,
        },
      ],
      softDelete: false,
      filterBudget: { maxDepth: 2, maxNodes: 50 },
    });

    expect(translator.translateFilter({ lines: { none: { quantity: { gt: 10 } } } })).toBeDefined();
  });

  it("compiles every association filters with scalar predicates", () => {
    const translator = new QueryTranslator({
      db: mockDb as never,
      table: orders,
      columns: [],
      relations: [
        {
          fieldName: "lines",
          kind: "one-to-many",
          childFkDrizzleKey: "orderId",
          targetTable: orderLines,
          childTable: orderLines,
          childColumns: [
            {
              graphqlName: "quantity",
              drizzleKey: "quantity",
              kind: "integer",
              column: orderLines.quantity,
            },
          ],
          targetColumns: [],
          filterable: true,
        },
      ],
      softDelete: false,
      filterBudget: { maxDepth: 2, maxNodes: 50 },
    });

    expect(translator.translateFilter({ lines: { every: { quantity: { gt: 0 } } } })).toBeDefined();
  });
});

const mnItemColumns = [
  { graphqlName: "name", drizzleKey: "name", kind: "text" as const, column: items.name },
];

const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull(),
});

const itemTags = pgTable("item_tags", {
  itemId: uuid("item_id")
    .notNull()
    .references(() => items.id),
  tagId: uuid("tag_id")
    .notNull()
    .references(() => tags.id),
});

describe("QueryTranslator many-to-many filters", () => {
  it("compiles some, none, and every M:N association filters", () => {
    const translator = new QueryTranslator({
      db: mockDb as never,
      table: items,
      columns: mnItemColumns,
      relations: [
        {
          fieldName: "tags",
          kind: "many-to-many",
          joinTable: itemTags,
          joinOwnerFkDrizzleKey: "itemId",
          joinTargetFkDrizzleKey: "tagId",
          targetTable: tags,
          targetColumns: [
            { graphqlName: "label", drizzleKey: "label", kind: "text", column: tags.label },
          ],
          filterable: true,
        },
      ],
      softDelete: false,
      filterBudget: { maxDepth: 2, maxNodes: 50 },
    });

    expect(translator.translateFilter({ tags: { some: { label: { eq: "sale" } } } })).toBeDefined();
    expect(translator.translateFilter({ tags: { none: { label: { eq: "sale" } } } })).toBeDefined();
    expect(translator.translateFilter({ tags: { every: { label: { eq: "sale" } } } })).toBeDefined();
    expect(translator.translateFilter({ tags: { every: { label: {} } } })).toBeDefined();
  });
});

describe("QueryTranslator every existence-only filters", () => {
  it("compiles every nested empty scalar filters as tautologies", () => {
    const translator = new QueryTranslator({
      db: mockDb as never,
      table: orders,
      columns: [],
      relations: [
        {
          fieldName: "lines",
          kind: "one-to-many",
          childFkDrizzleKey: "orderId",
          targetTable: orderLines,
          childTable: orderLines,
          childColumns: [
            {
              graphqlName: "quantity",
              drizzleKey: "quantity",
              kind: "integer",
              column: orderLines.quantity,
            },
          ],
          targetColumns: [],
          filterable: true,
        },
      ],
      softDelete: false,
      filterBudget: { maxDepth: 2, maxNodes: 50 },
    });

    expect(translator.translateFilter({ lines: { every: { quantity: {} } } })).toBeDefined();
  });
});
