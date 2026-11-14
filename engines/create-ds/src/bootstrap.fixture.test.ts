import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as engineKit from "@corpdk/engine-kit";
import { runDalBootstrap } from "./bootstrap.js";
import { repoRootFromEngine, resolveCanonicalDsTemplateDir } from "./template.js";

describe("runDalBootstrap fixture", () => {
  let tmp: string;
  let pathExistsSpy: ReturnType<typeof vi.spyOn> | undefined;
  let execSpy: ReturnType<typeof vi.spyOn> | undefined;

  afterEach(async () => {
    pathExistsSpy?.mockRestore();
    execSpy?.mockRestore();
    if (tmp) await fs.rm(tmp, { recursive: true, force: true });
  });

  it("copies bootstrap entry files when dal-codegen CLI is absent", async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "create-ds-boot-"));
    const target = path.join(tmp, "pkg");
    await fs.mkdir(path.join(target, "src", "db"), { recursive: true });
    const fakeRepo = path.join(tmp, "no-dal-codegen");
    await fs.mkdir(fakeRepo, { recursive: true });
    const templateDir = await resolveCanonicalDsTemplateDir(repoRootFromEngine());

    await runDalBootstrap(fakeRepo, target, templateDir);

    for (const rel of ["src/schema.ts", "src/index.ts", "src/db/index.ts"]) {
      const expected = await fs.readFile(path.join(templateDir, rel), "utf8");
      const actual = await fs.readFile(path.join(target, rel), "utf8");
      expect(actual, rel).toBe(expected);
    }
  });

  it("invokes dal-codegen bootstrap when the monorepo CLI is built", async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "create-ds-boot-"));
    const target = path.join(tmp, "pkg");
    await fs.mkdir(target, { recursive: true });
    const repoRoot = repoRootFromEngine();
    const templateDir = await resolveCanonicalDsTemplateDir(repoRoot);
    const cliPath = path.join(repoRoot, "libraries/dal-codegen/dist/cli.js");

    const execMod = await import("./exec.js");
    execSpy = vi.spyOn(execMod, "execAsync").mockResolvedValue({
      stdout: "",
      stderr: "",
    } as never);

    pathExistsSpy = vi.spyOn(engineKit, "pathExists").mockImplementation(
      async (p) => {
        if (p === cliPath) return true;
        return fs.stat(p).then(() => true).catch(() => false);
      },
    );

    await runDalBootstrap(repoRoot, target, templateDir);

    expect(execSpy).toHaveBeenCalledOnce();
    expect(execSpy).toHaveBeenCalledWith(
      `node "${cliPath}" --mode=bootstrap`,
      { cwd: target },
    );
  });
});