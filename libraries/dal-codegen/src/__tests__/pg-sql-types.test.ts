import { describe, expect, it } from "vitest";
import { customType, pgTable } from "drizzle-orm/pg-core";
import { getTableColumns } from "drizzle-orm";
import { columnKindFromPgSqlType } from "../pg-sql-types.js";

describe("pg-sql-types", () => {
  it("maps supported custom SQL types", () => {
    expect(columnKindFromPgSqlType("citext")).toBe("citext");
    expect(columnKindFromPgSqlType("inet")).toBe("inet");
  });

  it("marks deferred geometric and PostGIS types as banned", () => {
    expect(columnKindFromPgSqlType("point")).toBe("banned");
    expect(columnKindFromPgSqlType("geometry")).toBe("banned");
    expect(columnKindFromPgSqlType("macaddr8")).toBe("banned");
  });
});

describe("inferColumnKind banned custom columns", () => {
  it("fails schema load for banned PG custom types", async () => {
    const point = customType({ dataType: () => "point" });
    const t = pgTable("geo_probe", { p: point() });
    const col = getTableColumns(t).p;
    expect(col.columnType).toBe("PgCustomColumn");
    expect(col.getSQLType()).toBe("point");
    expect(columnKindFromPgSqlType(col.getSQLType())).toBe("banned");
  });
});
