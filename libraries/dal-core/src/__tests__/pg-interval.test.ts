import { describe, expect, it } from "vitest";
import { PG_INT64_MAX } from "../pg-bounds.js";
import { intervalMsToPgInterval, pgIntervalTextToMs } from "../pg-interval.js";

describe("pgIntervalTextToMs", () => {
  it("parses PostgreSQL backend interval fields (year, mon, day, time)", () => {
    expect(pgIntervalTextToMs("1 year")).toBe("31557600000");
    expect(pgIntervalTextToMs("2 mons")).toBe("5184000000");
    expect(pgIntervalTextToMs("3 days")).toBe("259200000");
    expect(pgIntervalTextToMs("04:05:06")).toBe("14706000");
    expect(pgIntervalTextToMs("04:05:06.789")).toBe("14706789");
    expect(pgIntervalTextToMs("1 year 1 mon 1 day 01:02:03.004")).toBe(
      String(
        31557600000n +
          2592000000n +
          86400000n +
          3723004n,
      ),
    );
  });

  it("parses backend intervals with negative time-of-day components", () => {
    expect(pgIntervalTextToMs("1 day -02:30:00")).toBe(String(86400000n - 9000000n));
  });

  it("parses day-plus-time and time-only wire forms", () => {
    expect(pgIntervalTextToMs("2 03:04:05")).toBe(String(2n * 86400000n + 11045000n));
    expect(pgIntervalTextToMs("-01:02:03")).toBe("-3723000");
    expect(pgIntervalTextToMs("00:00:01.500")).toBe("1500");
  });

  it("parses verbose human-readable intervals and fractional units", () => {
    expect(pgIntervalTextToMs("1.5 seconds")).toBe("1500");
    expect(pgIntervalTextToMs("1500.5 milliseconds")).toBe("1500");
    expect(pgIntervalTextToMs("2 weeks")).toBe(String(14n * 86400000n));
  });

  it("rejects unknown verbose units and out-of-range totals", () => {
    expect(() => pgIntervalTextToMs("3 fortnights")).toThrow(/Invalid PostgreSQL interval/);
    expect(() => pgIntervalTextToMs("not an interval")).toThrow(/Invalid PostgreSQL interval/);
    const overMaxMs = (BigInt(PG_INT64_MAX) + 1n).toString() + " milliseconds";
    expect(() => pgIntervalTextToMs(overMaxMs)).toThrow(/signed 64-bit range/);
  });
});

describe("intervalMsToPgInterval", () => {
  it("formats non-zero and negative millisecond wires for PostgreSQL", () => {
    expect(intervalMsToPgInterval("5400000")).toBe("5400000 milliseconds");
    expect(intervalMsToPgInterval("-5000")).toBe("-5000 milliseconds");
  });
});
