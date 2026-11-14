import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EXIT_USAGE, EXIT_VALIDATION, readJson } from "@corpdk/engine-kit";
import { runInit } from "./init.js";
import { runUpgrade } from "./upgrade.js";
import { readCreateDsReleaseVersion, repoRootFromEngine } from "./template.js";

describe("runUpgrade fixture", () => {
  let tmp: string;

  afterEach(async () => {
    if (tmp) await fs.rm(tmp, { recursive: true, force: true });
  });

  /** Bundled-canonical mode without monorepo dal-codegen lint (no node_modules in temp dir). */
  async function fakeRepoRoot(): Promise<string> {
    return fs.mkdtemp(path.join(os.tmpdir(), "create-ds-fake-repo-"));
  }

  async function scaffoldConsumer(): Promise<{
    target: string;
    repoRoot: string;
  }> {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "create-ds-up-"));
    const target = path.join(tmp, "consumer");
    const repoRoot = await fakeRepoRoot();
    const init = await runInit({
      dir: target,
      name: "@test/consumer",
      repoRoot,
    });
    expect(init.exitCode).toBe(0);
    return { target, repoRoot };
  }

  it("returns usage when dal.config.yaml is missing", async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "create-ds-up-"));
    const pkgDir = path.join(tmp, "empty");
    await fs.mkdir(pkgDir, { recursive: true });
    const result = await runUpgrade({
      dir: pkgDir,
      repoRoot: repoRootFromEngine(),
    });
    expect(result.exitCode).toBe(EXIT_USAGE);
    expect(result.message).toMatch(/dal\/dal\.config\.yaml/);
  });

  it("preserves consumer-only dependencies on merge", async () => {
    const { target, repoRoot } = await scaffoldConsumer();
    const pkgPath = path.join(target, "package.json");
    const pkg = await readJson<{
      dependencies?: Record<string, string>;
    }>(pkgPath);
    pkg.dependencies = { ...pkg.dependencies, "@extra/only-in-consumer": "1.0.0" };
    await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");

    const result = await runUpgrade({
      dir: target,
      repoRoot,
    });
    expect(result.exitCode).toBe(0);
    const upgraded = await readJson<{ dependencies?: Record<string, string> }>(
      pkgPath,
    );
    expect(upgraded.dependencies?.["@extra/only-in-consumer"]).toBe("1.0.0");
  });

  it("writes .create-ds-version on success", async () => {
    const { target, repoRoot } = await scaffoldConsumer();
    const result = await runUpgrade({
      dir: target,
      repoRoot,
    });
    expect(result.exitCode).toBe(0);
    const version = await readCreateDsReleaseVersion();
    const onDisk = await fs.readFile(
      path.join(target, ".create-ds-version"),
      "utf8",
    );
    expect(onDisk.trim()).toBe(version);
  });

  it("maps corrupt package.json to validation exit", async () => {
    const { target, repoRoot } = await scaffoldConsumer();
    await fs.writeFile(path.join(target, "package.json"), "{ not-json", "utf8");
    const result = await runUpgrade({
      dir: target,
      repoRoot,
    });
    expect(result.exitCode).toBe(EXIT_VALIDATION);
  });

  it("deep-merges consumer dal.config.yaml overrides", async () => {
    const { target, repoRoot } = await scaffoldConsumer();
    const dalPath = path.join(target, "dal/dal.config.yaml");
    const raw = await fs.readFile(dalPath, "utf8");
    await fs.writeFile(
      dalPath,
      `${raw.trimEnd()}\nconsumerMarker: true\n`,
      "utf8",
    );
    const result = await runUpgrade({
      dir: target,
      repoRoot,
    });
    expect(result.exitCode).toBe(0);
    const merged = await fs.readFile(dalPath, "utf8");
    expect(merged).toContain("consumerMarker: true");
  });

  it("maps invalid dal.config.yaml to validation exit", async () => {
    const { target, repoRoot } = await scaffoldConsumer();
    await fs.writeFile(
      path.join(target, "dal/dal.config.yaml"),
      "not: valid: yaml: [[",
      "utf8",
    );
    const result = await runUpgrade({
      dir: target,
      repoRoot,
    });
    expect(result.exitCode).toBe(EXIT_VALIDATION);
  });

  it("dry-run lists planned files without writing consumer package.json", async () => {
    const { target, repoRoot } = await scaffoldConsumer();
    const pkgPath = path.join(target, "package.json");
    const before = await fs.readFile(pkgPath, "utf8");
    const result = await runUpgrade({
      dir: target,
      dryRun: true,
      repoRoot,
    });
    expect(result.exitCode).toBe(0);
    expect(result.changedFiles.length).toBeGreaterThan(0);
    const after = await fs.readFile(pkgPath, "utf8");
    expect(after).toBe(before);
  });
});