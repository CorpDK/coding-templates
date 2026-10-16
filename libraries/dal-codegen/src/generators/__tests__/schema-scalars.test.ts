import { describe, expect, it } from "vitest";
import type { ColumnModel, EntityModel } from "../../model.js";
import { buildSchemaRegistry, collectUsedDalScalars } from "../schema-registry.js";
import { itemFixture } from "./sdl.fixture.js";

function businessCol(
  drizzleKey: string,
  kind: ColumnModel["kind"],
  graphqlName = drizzleKey,
): ColumnModel {
  return {
    drizzleKey,
    physicalName: drizzleKey,
    graphqlName,
    kind,
    notNull: true,
    hasDefault: false,
    comment: `${kind} column for scalar registry coverage.`,
    isServerManaged: false,
    isBusiness: true,
  };
}

const dalScalarFixture: EntityModel = {
  ...itemFixture,
  exportName: "networkHosts",
  tableName: "network_hosts",
  graphqlType: "NetworkHost",
  fieldBasename: "networkHost",
  listField: "networkHosts",
  columns: [
    ...itemFixture.columns,
    businessCol("hostIp", "inet", "hostIp"),
    businessCol("network", "cidr", "network"),
    businessCol("nicMac", "macaddr", "nicMac"),
    businessCol("label", "citext", "label"),
    businessCol("token", "bigint", "token"),
    businessCol("amount", "decimal", "amount"),
    businessCol("effectiveOn", "date", "effectiveOn"),
    businessCol("opensAt", "timetz", "opensAt"),
    businessCol("durationMs", "interval", "durationMs"),
    businessCol("priority", "smallint", "priority"),
    businessCol("weight", "double", "weight"),
  ],
};

describe("schema registry DAL scalars", () => {
  it("collects referenced custom scalars and filter inputs from entity columns", () => {
    const scalars = collectUsedDalScalars([dalScalarFixture]);
    expect(scalars).toEqual(
      expect.arrayContaining([
        "DateTime",
        "IP",
        "CIDR",
        "MAC",
        "InsensitiveString",
        "BigInt",
        "Decimal",
        "Date",
        "TimeTz",
        "IntervalMs",
        "SmallInt",
        "Double",
      ]),
    );

    const registry = buildSchemaRegistry([dalScalarFixture]);
    for (const name of [
      "IP",
      "CIDR",
      "MAC",
      "InsensitiveString",
      "BigInt",
      "Decimal",
      "Date",
      "TimeTz",
      "IntervalMs",
      "SmallInt",
      "Double",
      "IPFilter",
      "CIDRFilter",
      "MACFilter",
      "InsensitiveStringFilter",
      "BigIntFilter",
      "DecimalFilter",
      "DateFilter",
      "TimeTzFilter",
      "IntervalMsFilter",
      "SmallIntFilter",
      "DoubleFilter",
    ]) {
      expect(registry.types.has(name)).toBe(true);
    }
  });
});
