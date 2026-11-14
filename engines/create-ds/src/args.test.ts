import { describe, expect, it } from "vitest";
import { parseCli } from "./args.js";

describe("parseCli", () => {
  it("returns usage when command missing", () => {
    expect(parseCli(["node", "create-ds"]).kind).toBe("usage");
  });

  it("rejects unknown flags on init", () => {
    const parsed = parseCli(["node", "create-ds", "init", "--nope"]);
    expect(parsed.kind).toBe("usage");
  });

  it("parses init directory and demo schema", () => {
    const parsed = parseCli([
      "node",
      "create-ds",
      "init",
      "./pkg",
      "--name",
      "@acme/ds",
      "--demo-schema",
    ]);
    if (parsed.kind !== "init") throw new Error("expected init");
    expect(parsed.dir).toBe("./pkg");
    expect(parsed.name).toBe("@acme/ds");
    expect(parsed.demoSchema).toBe(true);
  });
});