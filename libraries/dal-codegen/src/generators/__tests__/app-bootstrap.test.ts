import { execFile } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const dalCodegenRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const tsxBin = join(dalCodegenRoot, "node_modules/.bin/tsx");
const cliEntry = join(dalCodegenRoot, "src/cli.ts");

describe("dal-codegen bootstrap CLI", () => {
  it("writes Yoga entry files under package root", async () => {
    const packageRoot = mkdtempSync(join(tmpdir(), "dal-bootstrap-"));

    await execFileAsync(tsxBin, [cliEntry, "--mode=bootstrap"], {
      cwd: packageRoot,
    });

    for (const rel of ["src/schema.ts", "src/index.ts", "src/db/index.ts"]) {
      expect(existsSync(join(packageRoot, rel))).toBe(true);
    }
  });
});
