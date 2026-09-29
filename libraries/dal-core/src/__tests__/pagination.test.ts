import { describe, expect, it } from "vitest";
import { asc, desc } from "drizzle-orm";
import { integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  assertCursorIncludeDeletedMatches,
  assertCursorSortMatches,
  buildKeysetSeek,
  buildOrderClauses,
  CURSOR_VERSION,
  decodeCursor,
  encodeCursor,
  resolveSortWithTieBreaker,
  reverseOrderClauses,
  validateConnectionPagingArgs,
  type CursorPayload,
} from "../pagination.js";
import { ValidationError } from "../errors.js";

const items = pgTable("pagination_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  qty: integer("qty").notNull(),
});

const fieldMap = { ID: "id", NAME: "name", QTY: "qty" };

describe("resolveSortWithTieBreaker", () => {
  it("uses default sort when client sort is empty", () => {
    expect(resolveSortWithTieBreaker(undefined, fieldMap)).toEqual([
      { field: "ID", direction: "ASC", drizzleKey: "id" },
    ]);
  });

  it("appends id tie-breaker when missing from resolved sort", () => {
    expect(resolveSortWithTieBreaker([{ field: "NAME", direction: "DESC" }], fieldMap)).toEqual([
      { field: "NAME", direction: "DESC", drizzleKey: "name" },
      { field: "ID", direction: "ASC", drizzleKey: "id" },
    ]);
  });

  it("rejects unknown sort fields", () => {
    expect(() =>
      resolveSortWithTieBreaker([{ field: "UNKNOWN" as "NAME", direction: "ASC" }], fieldMap),
    ).toThrow(ValidationError);
  });
});

describe("validateConnectionPagingArgs", () => {
  it("rejects conflicting forward and backward paging", () => {
    expect(() => validateConnectionPagingArgs({ first: 5, last: 5 })).toThrow(/first and last/i);
    expect(() => validateConnectionPagingArgs({ after: "a", before: "b" })).toThrow(/after and before/i);
  });

  it("rejects negative limits", () => {
    expect(() => validateConnectionPagingArgs({ first: -1 })).toThrow(/first must be >= 0/i);
    expect(() => validateConnectionPagingArgs({ last: -1 })).toThrow(/last must be >= 0/i);
  });
});

describe("assertCursorSortMatches", () => {
  const resolved = [
    { field: "NAME", direction: "ASC" as const, drizzleKey: "name" },
    { field: "ID", direction: "ASC" as const, drizzleKey: "id" },
  ];

  it("accepts matching cursor sort contracts", () => {
    const cursor: CursorPayload = {
      version: CURSOR_VERSION,
      entity: "Item",
      sort: [
        { field: "NAME", direction: "ASC" },
        { field: "ID", direction: "ASC" },
      ],
      values: ["hammer", "00000000-0000-4000-8000-000000000001"],
    };
    expect(() => assertCursorSortMatches(cursor, resolved, "after")).not.toThrow();
  });

  it("rejects length or field mismatches", () => {
    const cursor: CursorPayload = {
      version: CURSOR_VERSION,
      entity: "Item",
      sort: [{ field: "NAME", direction: "DESC" }],
      values: ["hammer"],
    };
    expect(() => assertCursorSortMatches(cursor, resolved, "after")).toThrow(/sort contract mismatch/i);
  });
});

describe("assertCursorIncludeDeletedMatches", () => {
  const cursor: CursorPayload = {
    version: CURSOR_VERSION,
    entity: "Item",
    sort: [{ field: "ID", direction: "ASC" }],
    values: ["00000000-0000-4000-8000-000000000001"],
    includeDeleted: true,
  };

  it("accepts matching includeDeleted contracts", () => {
    expect(() => assertCursorIncludeDeletedMatches(cursor, true, "after")).not.toThrow();
    expect(() => assertCursorIncludeDeletedMatches({ ...cursor, includeDeleted: false }, false, "after")).not.toThrow();
  });

  it("rejects mismatched includeDeleted contracts", () => {
    expect(() => assertCursorIncludeDeletedMatches(cursor, false, "after")).toThrow(
      /includeDeleted contract mismatch/i,
    );
    expect(() => assertCursorIncludeDeletedMatches({ ...cursor, includeDeleted: false }, true, "before")).toThrow(
      /includeDeleted contract mismatch/i,
    );
  });
});

describe("decodeCursor validation", () => {
  const payload: CursorPayload = {
    version: CURSOR_VERSION,
    entity: "Item",
    sort: [{ field: "ID", direction: "ASC" }],
    values: ["00000000-0000-4000-8000-000000000001"],
  };

  it("rejects wrong entity or version", () => {
    const cursor = encodeCursor(payload);
    expect(() => decodeCursor(cursor, "Category", "after")).toThrow(/Invalid or stale cursor/i);
    expect(() =>
      decodeCursor(cursor, "Item", "after", payload.version + 1),
    ).toThrow(/Invalid or stale cursor/i);
  });

  it("rejects malformed cursor payloads", () => {
    const badPayload = Buffer.from(JSON.stringify({ version: 1, entity: "Item" }), "utf-8").toString(
      "base64url",
    );
    expect(() => decodeCursor(badPayload, "Item", "after")).toThrow(/Malformed cursor/i);
    expect(() => decodeCursor("not-valid-base64!!!", "Item", "before")).toThrow(/Malformed cursor/i);
  });
});

describe("buildKeysetSeek and order clauses", () => {
  const dialect = new PgDialect();

  it("builds after and before seek predicates for composite keys", () => {
    const columns = [items.name, items.qty, items.id];
    const values = ["hammer", 3, "00000000-0000-4000-8000-000000000001"];
    const afterSql = dialect.sqlToQuery(
      buildKeysetSeek(columns, ["ASC", "DESC", "ASC"], values, "after"),
    ).sql;
    const beforeSql = dialect.sqlToQuery(
      buildKeysetSeek(columns, ["ASC", "DESC", "ASC"], values, "before"),
    ).sql;
    expect(afterSql).toMatch(/name/);
    expect(beforeSql).toMatch(/name/);
    expect(afterSql).not.toEqual(beforeSql);
  });

  it("builds ascending and reversed order clauses", () => {
    const resolved = [
      { field: "NAME", direction: "ASC" as const, drizzleKey: "name" },
      { field: "QTY", direction: "DESC" as const, drizzleKey: "qty" },
    ];
    const table = items as unknown as Record<string, unknown>;
    const order = buildOrderClauses(table, resolved);
    const reversed = reverseOrderClauses(table, resolved);
    expect(order).toHaveLength(2);
    expect(reversed).toHaveLength(2);
    expect(order[0]).toEqual(asc(items.name));
    expect(order[1]).toEqual(desc(items.qty));
    expect(reversed[0]).toEqual(desc(items.name));
    expect(reversed[1]).toEqual(asc(items.qty));
  });

  it("rejects invalid sort columns on the table", () => {
    expect(() =>
      buildOrderClauses({ id: items.id }, [{ field: "NAME", direction: "ASC", drizzleKey: "name" }]),
    ).toThrow(/Invalid sort field/i);
  });
});
