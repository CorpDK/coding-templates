import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { pathExists } from "@corpdk/engine-kit";
import { runInit } from "./init.js";
import { repoRootFromEngine } from "./template.js";

describe("runInit demo fixture", () => {
  let tmp: string;

  afterEach(async () => {
    if (tmp) await fs.rm(tmp, { recursive: true, force: true });
  });

  it("scaffolds demo schema with defer-sync", async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "create-graphql-sdk-init-"));
    const target = path.join(tmp, "sdk");
    const result = await runInit({
      dir: target,
      name: "@test/demo-sdk",
      schema: [],
      demoSchema: true,
      deferSync: true,
      noInstall: true,
      repoRoot: repoRootFromEngine(),
    });
    expect(result.exitCode).toBe(0);
    await expect(
      pathExists(path.join(target, "schema/sources/base.graphqls")),
    ).resolves.toBe(true);
    await expect(
      pathExists(path.join(target, "sdk.config.yaml")),
    ).resolves.toBe(true);
  });
});
