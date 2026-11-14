import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EXIT_USAGE, readJson } from "@corpdk/engine-kit";
import { initialCalVer } from "@corpdk/engine-kit";
import { runInit } from "./init.js";
import {
  isBundledCanonicalTemplate,
  readCreateDsReleaseVersion,
  repoRootFromEngine,
  resolveCanonicalDsTemplateDir,
} from "./template.js";
import { listRelativeFiles } from "./test-fixture-tree.js";

describe("runInit fixture", () => {
  let tmp: string;

  afterEach(async () => {
    vi.useRealTimers();
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

  it("lists install in next steps by default and omits it with --no-install", async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "create-ds-init-"));
    const base = path.join(tmp, "steps");
    await fs.mkdir(base, { recursive: true });

    const withInstall = await runInit({
      dir: path.join(base, "with-install"),
      name: "@test/with-install",
      repoRoot: repoRootFromEngine(),
    });
    expect(withInstall.nextSteps).toEqual([
      "pnpm install",
      "pnpm --filter @test/with-install dal:codegen",
    ]);

    const withoutInstall = await runInit({
      dir: path.join(base, "no-install"),
      name: "@test/no-install",
      noInstall: true,
      repoRoot: repoRootFromEngine(),
    });
    expect(withoutInstall.nextSteps).toEqual([
      "pnpm --filter @test/no-install dal:codegen",
    ]);
  });

  it("scaffolds demo commerce schema and seed when --demo-schema", async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "create-ds-init-"));
    const target = path.join(tmp, "demo");
    const result = await runInit({
      dir: target,
      name: "@test/demo",
      demoSchema: true,
      repoRoot: repoRootFromEngine(),
    });
    expect(result.exitCode).toBe(0);
    await expect(
      fs.stat(path.join(target, "src/db/schema/items.ts")),
    ).resolves.toBeDefined();
    await expect(fs.stat(path.join(target, "src/db/seed.ts"))).resolves.toBeDefined();
  });

  it("stamps initial CalVer from UTC clock", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00Z"));
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "create-ds-init-"));
    const target = path.join(tmp, "calver");
    const expected = initialCalVer(new Date("2026-03-15T12:00:00Z"));
    const result = await runInit({
      dir: target,
      name: "@test/calver",
      repoRoot: repoRootFromEngine(),
    });
    expect(result.exitCode).toBe(0);
    const pkg = await readJson<{ version: string }>(path.join(target, "package.json"));
    expect(pkg.version).toBe(expected);
  });

  it("keeps workspace:* deps in monorepo mode", async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "create-ds-init-"));
    const target = path.join(tmp, "mono");
    const templateDir = await resolveCanonicalDsTemplateDir(repoRootFromEngine());
    expect(isBundledCanonicalTemplate(templateDir)).toBe(false);

    const result = await runInit({
      dir: target,
      name: "@test/mono",
      repoRoot: repoRootFromEngine(),
    });
    expect(result.exitCode).toBe(0);
    const pkg = await readJson<{
      dependencies?: Record<string, string>;
    }>(path.join(target, "package.json"));
    const dalCore = pkg.dependencies?.["@corpdk/dal-core"];
    expect(dalCore).toMatch(/^workspace:/);
  });

  it("rewrites @corpdk workspace deps when using bundled canonical", async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "create-ds-init-"));
    const target = path.join(tmp, "bundled");
    const fakeRepo = path.join(tmp, "not-monorepo");
    await fs.mkdir(fakeRepo, { recursive: true });

    const templateDir = await resolveCanonicalDsTemplateDir(fakeRepo);
    expect(isBundledCanonicalTemplate(templateDir)).toBe(true);

    const result = await runInit({
      dir: target,
      name: "@test/bundled",
      repoRoot: fakeRepo,
    });
    expect(result.exitCode).toBe(0);
    const release = await readCreateDsReleaseVersion();
    const pkg = await readJson<{
      dependencies?: Record<string, string>;
    }>(path.join(target, "package.json"));
    expect(pkg.dependencies?.["@corpdk/dal-core"]).toBe(`^${release}`);
  });

  it("emits a stable starter file tree", async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "create-ds-init-"));
    const target = path.join(tmp, "tree");
    const result = await runInit({
      dir: target,
      name: "@test/tree",
      repoRoot: repoRootFromEngine(),
    });
    expect(result.exitCode).toBe(0);
    const files = await listRelativeFiles(target);
    const expectedSubset = [
      "dal/dal.config.yaml",
      "package.json",
      "src/db/schema/index.ts",
      "src/db/schema/tags.ts",
      "src/schema.ts",
    ];
    for (const rel of expectedSubset) {
      expect(files, `missing ${rel}`).toContain(rel);
    }
  });

  it("rejects a non-empty target with usage exit", async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "create-ds-init-"));
    const target = path.join(tmp, "occupied");
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(path.join(target, "keep.txt"), "x", "utf8");
    const result = await runInit({
      dir: target,
      name: "@test/occupied",
      repoRoot: repoRootFromEngine(),
    });
    expect(result.exitCode).toBe(EXIT_USAGE);
    expect(result.message).toMatch(/not empty/i);
  });

  it("dry-run returns planned next steps without writing files", async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "create-ds-init-"));
    const target = path.join(tmp, "dry");
    const result = await runInit({
      dir: target,
      name: "@test/dry",
      dryRun: true,
      repoRoot: repoRootFromEngine(),
    });
    expect(result.exitCode).toBe(0);
    expect(result.nextSteps).toEqual([
      "pnpm install",
      "pnpm --filter @test/dry dal:codegen",
    ]);
    await expect(fs.stat(target)).rejects.toThrow();
  });

});