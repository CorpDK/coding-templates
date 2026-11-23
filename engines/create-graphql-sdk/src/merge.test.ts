import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mergeSdlUnits, parseSdlUnits } from "./merge.js";
import { collectSdlUnits } from "./schema-load.js";
import type { SdlUnit } from "./schema-load.js";

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "test-fixtures",
  "merge",
);

async function loadFixtureUnits(names: string[]): Promise<SdlUnit[]> {
  const units: SdlUnit[] = [];
  for (const name of names) {
    const body = await fs.readFile(path.join(fixturesDir, name), "utf8");
    units.push({ body, label: name });
  }
  return units;
}

describe("mergeSdlUnits", () => {
  it("merges duplicate type fields across files", async () => {
    const units = await loadFixtureUnits(["a.graphqls", "b.graphqls"]);
    const merged = mergeSdlUnits(units);
    expect(merged).toContain("items");
    expect(merged).toContain("hello");
  });

  it("merges enums by unioning values", async () => {
    const units = await loadFixtureUnits([
      "enum-a.graphqls",
      "enum-b.graphqls",
    ]);
    const merged = mergeSdlUnits(units);
    expect(merged).toContain("ACTIVE");
    expect(merged).toContain("DRAFT");
  });

  it("throws on field type conflict", async () => {
    const units = await loadFixtureUnits([
      "conflict-a.graphqls",
      "conflict-b.graphqls",
    ]);
    expect(() => mergeSdlUnits(units)).toThrow(/Field .* already defined/);
  });

  it("rejects invalid SDL units at parse time", async () => {
    const units = [{ body: "type Query {", label: "broken.graphqls" }];
    expect(() => mergeSdlUnits(units)).toThrow(/broken\.graphqls/);
  });

  it("produces deterministic output for sorted file order", async () => {
    const units = await loadFixtureUnits(["a.graphqls", "b.graphqls"]);
    const first = mergeSdlUnits(units);
    const shuffled = await loadFixtureUnits(["b.graphqls", "a.graphqls"]);
    const second = mergeSdlUnits(shuffled);
    expect(second).toBe(first);
  });
});

describe("collectSdlUnits glob", () => {
  it("collects starter demo schema files", async () => {
    const starter = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "starter",
      "schema",
    );
    const units = await collectSdlUnits(
      [{ kind: "graphqls", paths: ["."] }],
      starter,
    );
    expect(units.length).toBeGreaterThanOrEqual(2);
    const merged = mergeSdlUnits(units);
    expect(merged).toContain("type Item");
    expect(parseSdlUnits(units).length).toBe(units.length);
  });
});
