import { describe, expect, it, vi } from "vitest";
import { integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { QueryEngine } from "../query-engine.js";
import { ValidationError } from "../errors.js";

const widgets = pgTable("widgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  qty: integer("qty").notNull(),
});

type WidgetRow = typeof widgets.$inferSelect;

function mockDb(rows: WidgetRow[]) {
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => Promise.resolve(rows),
  };
  return {
    select: vi.fn(() => chain),
  };
}

const filterBudget = { maxDepth: 2, maxNodes: 50 };

function engine(db: ReturnType<typeof mockDb>) {
  return new QueryEngine<WidgetRow>(
    {
      db: db as never,
      table: widgets,
      columns: [
        { graphqlName: "name", drizzleKey: "name", kind: "text", column: widgets.name },
        { graphqlName: "qty", drizzleKey: "qty", kind: "integer", column: widgets.qty },
      ],
      relations: [],
      softDelete: false,
      filterBudget,
      entityGraphqlName: "Widget",
      cursorVersion: 1,
    },
    db as never,
    { NAME: "name", QTY: "qty" },
  );
}

describe("QueryEngine", () => {
  it("buildWhere delegates to the query translator", () => {
    const db = mockDb([]);
    const qe = engine(db);
    const where = qe.buildWhere({ name: { eq: "hammer" } });
    expect(where).toBeDefined();
  });

  it("resolveSort adds the id tie-breaker", () => {
    const qe = engine(mockDb([]));
    expect(qe.resolveSort([{ field: "NAME", direction: "ASC" }])).toEqual([
      { field: "NAME", direction: "ASC", drizzleKey: "name" },
      { field: "ID", direction: "ASC", drizzleKey: "id" },
    ]);
  });

  it("clampLimit rejects negative and oversized limits", () => {
    const qe = engine(mockDb([]));
    expect(qe.clampLimit(10, "limit")).toBe(10);
    expect(() => qe.clampLimit(-1, "limit")).toThrow(ValidationError);
    expect(() => qe.clampLimit(10_000, "limit")).toThrow(ValidationError);
  });

  it("list maps rows from the database", async () => {
    const row = {
      id: "00000000-0000-4000-8000-000000000001",
      name: "hammer",
      qty: 3,
    } satisfies WidgetRow;
    const db = mockDb([row]);
    const qe = engine(db);
    const result = await qe.list({ limit: 5 }, (r) => r.name);
    expect(result).toEqual(["hammer"]);
    expect(db.select).toHaveBeenCalled();
  });

  it("count returns the aggregate value", async () => {
    const db = {
      select: vi.fn((_shape?: unknown) => ({
        from: () => Promise.resolve([{ value: 7 }]),
      })),
    };
    const qe = engine(db as never);
    await expect(qe.count({})).resolves.toBe(7);
  });

  it("listConnection returns an empty page when first is zero", async () => {
    const qe = engine(mockDb([]));
    const page = await qe.listConnection(
      { first: 0 },
      (row) => row,
      () => [],
      () => [],
    );
    expect(page.edges).toEqual([]);
    expect(page.pageInfo.hasNextPage).toBe(false);
  });

  it("listConnection returns edges when rows exist", async () => {
    const row = {
      id: "00000000-0000-4000-8000-000000000002",
      name: "nail",
      qty: 1,
    } satisfies WidgetRow;
    const qe = engine(mockDb([row]));
    const page = await qe.listConnection(
      { first: 5 },
      (r) => r.name,
      (_r, sort) => sort.map((s) => (s.drizzleKey === "name" ? "nail" : row.id)),
      (values) => values,
    );
    expect(page.nodes).toEqual(["nail"]);
    expect(page.pageInfo.endCursor).toBeTruthy();
  });

  it("listConnection paginates backwards when last is set", async () => {
    const rows = [
      {
        id: "00000000-0000-4000-8000-000000000004",
        name: "a",
        qty: 1,
      },
      {
        id: "00000000-0000-4000-8000-000000000005",
        name: "b",
        qty: 2,
      },
    ] satisfies WidgetRow[];
    const qe = engine(mockDb(rows));
    const page = await qe.listConnection(
      { last: 1 },
      (r) => r.name,
      (r) => [r.name, r.id],
      (values) => values,
    );
    expect(page.nodes).toHaveLength(1);
    expect(page.pageInfo.hasPreviousPage).toBe(true);
  });

  it("findByIds returns rows for unique ids", async () => {
    const row = {
      id: "00000000-0000-4000-8000-000000000003",
      name: "bolt",
      qty: 2,
    } satisfies WidgetRow;
    const db = {
      select: vi.fn(() => ({
        from: () => ({
          where: () => Promise.resolve([row]),
        }),
      })),
    };
    const qe = engine(db as never);
    const rows = await qe.findByIds([row.id, row.id]);
    expect(rows).toEqual([row]);
  });
});
