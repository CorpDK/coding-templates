import { describe, expect, it } from "vitest";
import { parseDalCodegenMode } from "../parse-mode.js";

describe("parseDalCodegenMode", () => {
  it("reads --mode= bootstrap from argv", () => {
    expect(parseDalCodegenMode(["--mode=bootstrap"], {})).toBe("bootstrap");
  });

  it("defaults to all when no flag or env", () => {
    expect(parseDalCodegenMode([], {})).toBe("all");
  });

  it("reads DAL_CODEGEN_MODE from env when argv has no mode flag", () => {
    expect(parseDalCodegenMode([], { DAL_CODEGEN_MODE: "schema" })).toBe(
      "schema",
    );
  });

  it("prefers argv over env", () => {
    expect(
      parseDalCodegenMode(["--mode=impl"], { DAL_CODEGEN_MODE: "schema" }),
    ).toBe("impl");
  });

  it("rejects unknown --mode values", () => {
    expect(() => parseDalCodegenMode(["--mode=nope"], {})).toThrow(
      /Invalid --mode=nope/,
    );
  });
});
