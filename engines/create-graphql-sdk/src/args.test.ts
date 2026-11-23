import { describe, expect, it } from "vitest";
import { parseCli } from "./args.js";

describe("parseCli", () => {
  it("returns usage when command missing", () => {
    expect(parseCli(["node", "create-graphql-sdk"]).kind).toBe("usage");
  });

  it("rejects unknown command", () => {
    expect(parseCli(["node", "create-graphql-sdk", "nope"]).kind).toBe("usage");
  });

  it("parses init with schema and scalar preset", () => {
    const parsed = parseCli([
      "node",
      "create-graphql-sdk",
      "init",
      "./pkg",
      "--name",
      "@acme/sdk",
      "--schema",
      "./schema.graphqls",
      "--scalar-preset",
      "dal",
    ]);
    if (parsed.kind !== "init") throw new Error("expected init");
    expect(parsed.name).toBe("@acme/sdk");
    expect(parsed.scalarPreset).toBe("dal");
    expect(parsed.schema).toEqual(["./schema.graphqls"]);
  });

  it("parses sync --check", () => {
    const parsed = parseCli([
      "node",
      "create-graphql-sdk",
      "sync",
      ".",
      "--check",
    ]);
    if (parsed.kind !== "sync") throw new Error("expected sync");
    expect(parsed.check).toBe(true);
  });
});
