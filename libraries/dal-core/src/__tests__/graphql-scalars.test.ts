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

  it("BigInt enforces int64 decimal string wire", () => {
    const bi = dalGraphQLScalar("BigInt");
    expect(() => bi.parseValue("9223372036854775808")).toThrow(/out of range/i);
    expect(bi.parseValue("42")).toBe("42");
  });

  it("TimeTz and Decimal use dal-core regex rules", () => {
    expect(dalGraphQLScalar("TimeTz").parseValue("12:30:00+05:30")).toBe("12:30:00+05:30");
    expect(() => dalGraphQLScalar("TimeTz").parseValue("not-a-time")).toThrow();
    expect(dalGraphQLScalar("Decimal").parseValue("12.5")).toBe("12.5");
    expect(() => dalGraphQLScalar("Decimal").parseValue("1.2.3")).toThrow();
  });
});
