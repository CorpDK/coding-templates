import { describe, expect, it } from "vitest";
import type { ColumnModel } from "../../model.js";
import { filterForColumn, scalarForColumn } from "../schema-utils.js";

function col(kind: ColumnModel["kind"], extra: Partial<ColumnModel> = {}): ColumnModel {
  return {
    drizzleKey: "x",
    physicalName: "x",
    graphqlName: "x",
    kind,
    notNull: true,
    hasDefault: false,
    isServerManaged: false,
    isBusiness: true,
    ...extra,
  };
}

describe("schema-utils DAL scalar mapping", () => {
  it("maps column kinds to GraphQL scalar names", () => {
    expect(scalarForColumn(col("inet"))).toBe("IP");
    expect(scalarForColumn(col("cidr"))).toBe("CIDR");
    expect(scalarForColumn(col("macaddr"))).toBe("MAC");
    expect(scalarForColumn(col("citext"))).toBe("InsensitiveString");
    expect(scalarForColumn(col("bigint"))).toBe("BigInt");
    expect(scalarForColumn(col("decimal"))).toBe("Decimal");
    expect(scalarForColumn(col("date"))).toBe("Date");
    expect(scalarForColumn(col("timetz"))).toBe("TimeTz");
    expect(scalarForColumn(col("interval"))).toBe("IntervalMs");
    expect(scalarForColumn(col("smallint"))).toBe("SmallInt");
    expect(scalarForColumn(col("double"))).toBe("Double");
    expect(scalarForColumn(col("enum", { enumName: "Status" }))).toBe("Status");
    expect(scalarForColumn(col("text"))).toBe("String");
  });

  it("maps column kinds to filter input types", () => {
    expect(filterForColumn(col("inet"))).toBe("IPFilter");
    expect(filterForColumn(col("cidr"))).toBe("CIDRFilter");
    expect(filterForColumn(col("macaddr"))).toBe("MACFilter");
    expect(filterForColumn(col("citext"))).toBe("InsensitiveStringFilter");
    expect(filterForColumn(col("bigint"))).toBe("BigIntFilter");
    expect(filterForColumn(col("decimal"))).toBe("DecimalFilter");
    expect(filterForColumn(col("date"))).toBe("DateFilter");
    expect(filterForColumn(col("timetz"))).toBe("TimeTzFilter");
    expect(filterForColumn(col("interval"))).toBe("IntervalMsFilter");
    expect(filterForColumn(col("smallint"))).toBe("SmallIntFilter");
    expect(filterForColumn(col("double"))).toBe("DoubleFilter");
    expect(filterForColumn(col("enum", { enumName: "Status" }))).toBe("StatusFilter");
  });
});
