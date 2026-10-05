import { execFile } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runDalCodegen, runDalCodegenBootstrap } from "../../generate.js";
import { generateAppBootstrapFiles } from "../app-bootstrap.js";

const execFileAsync = promisify(execFile);
const dalCodegenRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const tsxBin = join(dalCodegenRoot, "node_modules/.bin/tsx");
const cliEntry = join(dalCodegenRoot, "src/cli.ts");

describe("dal-codegen bootstrap", () => {
  it("generateAppBootstrapFiles returns three non-empty module bodies", () => {
    const files = generateAppBootstrapFiles();
    expect(Object.keys(files).sort()).toEqual([
      "dbIndexTs",
      "indexTs",
      "schemaTs",
    ]);
    for (const body of Object.values(files)) {
      expect(body.trim().length).toBeGreaterThan(20);
    }
  });

  const bootstrapOptions = (packageRoot: string) => ({
    packageRoot,
    schemaPath: "src/db/schema",
    outputDir: "src/generated/dal",
    schemaOutputPath: "src/generated/generated-schema.ts",
    configPath: "dal/dal.config.yaml",
  });

  it("runDalCodegenBootstrap writes Yoga entry files under package root", async () => {
    const packageRoot = mkdtempSync(join(tmpdir(), "dal-bootstrap-api-"));

    await runDalCodegenBootstrap(bootstrapOptions(packageRoot));

    for (const rel of ["src/schema.ts", "src/index.ts", "src/db/index.ts"]) {
      expect(existsSync(join(packageRoot, rel))).toBe(true);
    }
  });

  it("runDalCodegen with mode bootstrap writes entry files only", async () => {
    const packageRoot = mkdtempSync(join(tmpdir(), "dal-bootstrap-run-"));

    await runDalCodegen({ ...bootstrapOptions(packageRoot), mode: "bootstrap" });

    expect(existsSync(join(packageRoot, "src/schema.ts"))).toBe(true);
    expect(existsSync(join(packageRoot, "src/generated"))).toBe(false);
  });

  it("bootstrap CLI writes Yoga entry files under package root", async () => {
    const packageRoot = mkdtempSync(join(tmpdir(), "dal-bootstrap-cli-"));

    await execFileAsync(tsxBin, [cliEntry, "--mode=bootstrap"], {
      cwd: packageRoot,
    });

    for (const rel of ["src/schema.ts", "src/index.ts", "src/db/index.ts"]) {
      expect(existsSync(join(packageRoot, rel))).toBe(true);
    }
  });
});
