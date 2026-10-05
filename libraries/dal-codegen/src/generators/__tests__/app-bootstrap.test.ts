import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { runDalCodegenBootstrap } from "../../generate.js";
import { generateAppBootstrapFiles } from "../app-bootstrap.js";

describe("runDalCodegenBootstrap", () => {
  it("writes Yoga entry files under package root", async () => {
    const packageRoot = mkdtempSync(join(tmpdir(), "dal-bootstrap-"));
    await runDalCodegenBootstrap({
      packageRoot,
      schemaPath: "src/db/schema",
      outputDir: "src/generated/dal",
      schemaOutputPath: "src/generated/generated-schema.ts",
      configPath: "dal/dal.config.yaml",
      mode: "bootstrap",
    });

    const expected = generateAppBootstrapFiles();
    expect(readFileSync(join(packageRoot, "src/schema.ts"), "utf8")).toBe(
      expected.schemaTs,
    );
    expect(readFileSync(join(packageRoot, "src/index.ts"), "utf8")).toBe(
      expected.indexTs,
    );
    expect(readFileSync(join(packageRoot, "src/db/index.ts"), "utf8")).toBe(
      expected.dbIndexTs,
    );
  });
});
