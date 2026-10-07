import { describe, expect, it } from "vitest";
import { dalScalarZod, zPgInt32, zPgReal } from "../scalar-zod.js";

describe("dalScalarZod", () => {
  it("DateTime rejects invalid ISO and accepts valid wire", () => {
    expect(dalScalarZod.DateTime.safeParse("not-a-date").success).toBe(false);
    expect(dalScalarZod.DateTime.safeParse("2026-09-21T12:00:00.000Z").success).toBe(true);
  });

  it("Date enforces YYYY-MM-DD", () => {
    expect(dalScalarZod.Date.safeParse("2026-09-21").success).toBe(true);
    expect(dalScalarZod.Date.safeParse("09-21-2026").success).toBe(false);
  });

  it("BigInt accepts int64 string wire and coerced numbers", () => {
    expect(dalScalarZod.BigInt.safeParse("42").success).toBe(true);
    expect(dalScalarZod.BigInt.safeParse(42).success).toBe(true);
    expect(dalScalarZod.BigInt.safeParse("9223372036854775808").success).toBe(false);
    expect(dalScalarZod.BigInt.safeParse("not-a-number").success).toBe(false);
  });

  it("Decimal, TimeTz, and IntervalMs match dal-core parse rules", () => {
    expect(dalScalarZod.Decimal.safeParse("12.5").success).toBe(true);
    expect(dalScalarZod.Decimal.safeParse("1.2.3").success).toBe(false);
    expect(dalScalarZod.TimeTz.safeParse("12:30:00+05:30").success).toBe(true);
    expect(dalScalarZod.TimeTz.safeParse("not-a-time").success).toBe(false);
    expect(dalScalarZod.IntervalMs.safeParse("3600000").success).toBe(true);
    expect(dalScalarZod.IntervalMs.safeParse(1500).success).toBe(true);
    expect(dalScalarZod.IntervalMs.safeParse("1.5").success).toBe(false);
    expect(dalScalarZod.IntervalMs.safeParse("9223372036854775808").success).toBe(false);
  });

  it("IP and MAC use graphql-scalars via parseInet / parseMacAddr", () => {
    expect(dalScalarZod.IP.safeParse("192.0.2.1").success).toBe(true);
    expect(dalScalarZod.IP.safeParse("bad").success).toBe(false);
    expect(dalScalarZod.MAC.safeParse("08:00:2B:01:02:03").success).toBe(true);
    expect(dalScalarZod.MAC.safeParse("not-mac").success).toBe(false);
  });

  it("SmallInt, Double, and zPgInt32 / zPgReal enforce PG ranges", () => {
    expect(dalScalarZod.SmallInt.safeParse(32_767).success).toBe(true);
    expect(dalScalarZod.SmallInt.safeParse(50_000).success).toBe(false);
    expect(dalScalarZod.Double.safeParse(1.5).success).toBe(true);
    expect(dalScalarZod.InsensitiveString.safeParse("abc").success).toBe(true);
    expect(dalScalarZod.InsensitiveString.safeParse(1).success).toBe(false);
    expect(zPgInt32.safeParse(2_147_483_647).success).toBe(true);
    expect(zPgInt32.safeParse(2_147_483_648).success).toBe(false);
    expect(zPgReal.safeParse(1.0).success).toBe(true);
  });
});
