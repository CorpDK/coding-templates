import path from "node:path";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import {
  copyDir,
  pathExists,
  readEngineRelease,
  readJson,
  writeJson,
  type EngineResult,
  EXIT_SUCCESS,
  EXIT_TOOL,
  EXIT_USAGE,
} from "@corpdk/engine-kit";
import { CREATE_GRAPHQL_CLI_ENGINE_ROOT } from "./constants.js";
import { engineResult } from "./engine-result.js";
import { writeCliConfig } from "./cli-config.js";
import { defaultCliConfig, runGenerate } from "./generate.js";

export type InitOptions = {
  targetDir: string;
  sdkPath: string;
  name: string;
  bin?: string;
  noInstall?: boolean;
  deferGenerate?: boolean;
  dryRun?: boolean;
};

function binFromName(name: string): string {
  const segment = name.split("/").pop() ?? name;
  return segment;
}

async function pnpmInstall(cwd: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("pnpm", ["install"], {
      cwd,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pnpm install exited ${code ?? "unknown"}`));
    });
  });
}

export async function runInit(options: InitOptions): Promise<EngineResult> {
  const {
    targetDir,
    sdkPath,
    name,
    bin = binFromName(name),
    noInstall,
    deferGenerate,
    dryRun,
  } = options;

  if (await pathExists(path.join(targetDir, "package.json"))) {
    return engineResult({
      exitCode: EXIT_USAGE,
      message: `Target is not empty: ${targetDir}`,
    });
  }

  const sdkAbs = path.resolve(sdkPath);
  const sdkPkg = await readJson<{ name: string }>(
    path.join(sdkAbs, "package.json"),
  );

  const relSdk = path.relative(targetDir, sdkAbs) || ".";
  const config = defaultCliConfig({
    name,
    bin,
    sdkPackage: sdkPkg.name,
    sdkPath: relSdk,
  });

  const canonical = path.join(CREATE_GRAPHQL_CLI_ENGINE_ROOT, "canonical");
  void (await readEngineRelease(CREATE_GRAPHQL_CLI_ENGINE_ROOT));

  const pkgTemplate = await readJson<Record<string, unknown>>(
    path.join(canonical, "package.json"),
  );

  const mergedPkg = {
    ...pkgTemplate,
    name,
    version: "0.1.0",
    bin: { [bin]: "./dist/cli.js" },
    dependencies: {
      ...(pkgTemplate.dependencies as Record<string, string>),
      [sdkPkg.name]: "workspace:*",
    },
    devDependencies: {
      ...((pkgTemplate.devDependencies as Record<string, string>) ?? {}),
      "@corpdk/create-graphql-cli": "workspace:^",
    },
  };

  if (dryRun) {
    console.log(`Would scaffold ${targetDir}`);
    return engineResult({ exitCode: EXIT_SUCCESS });
  }

  await fs.mkdir(targetDir, { recursive: true });
  await copyDir(canonical, targetDir, {
    exclude: ["README.md"],
    requireSource: true,
  });

  await writeCliConfig(targetDir, config);
  await writeJson(path.join(targetDir, "package.json"), mergedPkg);

  const cliPath = path.join(targetDir, "src/cli.ts");
  let cliSrc = await fs.readFile(cliPath, "utf8");
  cliSrc = cliSrc.replaceAll("@corpdk/ds-sdk", sdkPkg.name);
  await fs.writeFile(cliPath, cliSrc, "utf8");

  if (!deferGenerate) {
    const gen = await runGenerate({ packageDir: targetDir });
    if (gen.exitCode !== 0) return gen;
    if (!noInstall) {
      try {
        await pnpmInstall(targetDir);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return engineResult({ exitCode: EXIT_TOOL, message });
      }
    }
  }

  return engineResult({ exitCode: EXIT_SUCCESS, changedFiles: [targetDir] });
}