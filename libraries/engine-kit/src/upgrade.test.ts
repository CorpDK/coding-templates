import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runUpgradePlan } from "./upgrade.js";

describe("runUpgradePlan dryRun", () => {
  let tmp: string;

  afterEach(async () => {
    if (tmp) await fs.rm(tmp, { recursive: true, force: true });
  });

  it("lists planned files without writing", async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ek-upgrade-"));
    const templateDir = path.join(tmp, "template");
    const packageDir = path.join(tmp, "pkg");
    await fs.mkdir(templateDir, { recursive: true });
    await fs.mkdir(packageDir, { recursive: true });
    await fs.writeFile(path.join(templateDir, "README.md"), "tpl\n", "utf8");
    await fs.writeFile(path.join(packageDir, "README.md"), "old\n", "utf8");

    const result = await runUpgradePlan({
      overwrite: ["README.md"],
      merge: [],
      templateDir,
      packageDir,
      dryRun: true,
    });

    expect(result.changedFiles).toEqual(["README.md"]);
    const content = await fs.readFile(path.join(packageDir, "README.md"), "utf8");
    expect(content).toBe("old\n");
  });
});