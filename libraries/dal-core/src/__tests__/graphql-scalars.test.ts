import { Kind } from "graphql";
import { describe, expect, it } from "vitest";
import { dalGraphQLScalar } from "../graphql-scalars.js";

describe("dal GraphQL scalars", () => {
  it("DateTime rejects invalid literals via graphql-scalars + dal-core", () => {
    const dt = dalGraphQLScalar("DateTime");
    expect(() =>
      dt.parseLiteral({ kind: Kind.INT, value: "1" }, {}),
    ).toThrow();
    const iso = dt.parseLiteral({ kind: Kind.STRING, value: "2026-09-21T12:00:00.000Z" }, {});
    expect(iso).toBe("2026-09-21T12:00:00.000Z");
  });

  it("BigInt uses graphql-scalars validation + dal-core int64 wire string", () => {
    const bi = dalGraphQLScalar("BigInt");
    expect(() => bi.parseValue("9223372036854775808")).toThrow(/out of range/i);
    expect(() => bi.parseValue("not-a-number")).toThrow();
    expect(bi.parseValue("42")).toBe("42");
    expect(bi.parseValue(42)).toBe("42");
    expect(bi.parseLiteral({ kind: Kind.STRING, value: "9223372036854775807" }, {})).toBe(
      "9223372036854775807",
    );
    expect(bi.parseLiteral({ kind: Kind.INT, value: "99" }, {})).toBe("99");
    expect(() => bi.parseLiteral({ kind: Kind.FLOAT, value: "1.5" }, {})).toThrow();
    expect(bi.serialize("42")).toBe("42");
    expect(bi.serialize(42n)).toBe("42");
    const wire = bi.parseValue("-9223372036854775808");
    expect(wire).toBe("-9223372036854775808");
    expect(bi.serialize(wire)).toBe("-9223372036854775808");
  });

  it("TimeTz and Decimal use dal-core regex rules", () => {
    expect(dalGraphQLScalar("TimeTz").parseValue("12:30:00+05:30")).toBe("12:30:00+05:30");
    expect(() => dalGraphQLScalar("TimeTz").parseValue("not-a-time")).toThrow();
    expect(dalGraphQLScalar("Decimal").parseValue("12.5")).toBe("12.5");
    expect(() => dalGraphQLScalar("Decimal").parseValue("1.2.3")).toThrow();
  });

  it("SmallInt enforces PG 16-bit range", () => {
    const si = dalGraphQLScalar("SmallInt");
    expect(si.parseValue(100)).toBe(100);
    expect(() => si.parseValue(40_000)).toThrow(/out of range/i);
  });

  it("Inet and MacAddr are graphql-scalars IP/MAC under DAL SDL names", () => {
    expect(dalGraphQLScalar("Inet").name).toBe("Inet");
    expect(dalGraphQLScalar("Inet").parseValue("192.0.2.1")).toBe("192.0.2.1");
    expect(() => dalGraphQLScalar("Inet").parseValue("not-an-ip")).toThrow();
    expect(dalGraphQLScalar("MacAddr").name).toBe("MacAddr");
    expect(dalGraphQLScalar("MacAddr").parseValue("08:00:2B:01:02:03")).toBe(
      "08:00:2B:01:02:03",
    );
  });

  it("Cidr uses dal-core parse (no graphql-scalars CIDR export)", () => {
    expect(dalGraphQLScalar("Cidr").parseValue("192.0.2.0/24")).toBe("192.0.2.0/24");
    expect(() => dalGraphQLScalar("Cidr").parseValue("192.0.2.1")).toThrow();
  });
});
