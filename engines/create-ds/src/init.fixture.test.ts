import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runInit } from "./init.js";
import { repoRootFromEngine } from "./template.js";

describe("runInit fixture", () => {
  let tmp: string;

  afterEach(async () => {
    if (tmp) await fs.rm(tmp, { recursive: true, force: true });
  });

  it("scaffolds minimal schema in monorepo mode", async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "create-ds-init-"));
    const target = path.join(tmp, "my-ds");
    const result = await runInit({
      dir: target,
      name: "@test/my-ds",
      repoRoot: repoRootFromEngine(),
    });
    expect(result.exitCode).toBe(0);
    await expect(
      fs.stat(path.join(target, "src/db/schema/tags.ts")),
    ).resolves.toBeDefined();
    await expect(
      fs.stat(path.join(target, "dal/dal.config.yaml")),
    ).resolves.toBeDefined();
  });
});