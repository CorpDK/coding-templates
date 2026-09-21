import { describe, expect, it } from "vitest";
import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { QueryTranslator } from "../query-translator.js";

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
  });
});
