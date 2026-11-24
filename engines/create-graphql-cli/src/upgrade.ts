import path from "node:path";
import fs from "node:fs/promises";
import {
  mergePackageJson,
  mergeYamlConfig,
  pathExists,
  readEngineRelease,
  runUpgradePlan,
  writeEngineVersion,
  type EngineResult,
  EXIT_SUCCESS,
  EXIT_USAGE,
} from "@corpdk/engine-kit";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  CREATE_GRAPHQL_CLI_ENGINE_ROOT,
  ENGINE_VERSION_FILE,
} from "./constants.js";
import { CLI_CONFIG_FILE } from "./cli-config.js";
import { engineResult } from "./engine-result.js";

const OVERWRITE = ["src/cli.ts", "tsconfig.json", ".env.example"];

export type UpgradeOptions = {
  packageDir: string;
  dryRun?: boolean;
};

export async function runUpgrade(
  options: UpgradeOptions,
): Promise<EngineResult> {
  const { packageDir, dryRun } = options;
  if (!(await pathExists(path.join(packageDir, CLI_CONFIG_FILE)))) {
    return engineResult({
      exitCode: EXIT_USAGE,
      message: `Not a GraphQL CLI package: missing ${CLI_CONFIG_FILE}`,
    });
  }

  const templateDir = path.join(CREATE_GRAPHQL_CLI_ENGINE_ROOT, "canonical");
  const releaseVersion = await readEngineRelease(
    CREATE_GRAPHQL_CLI_ENGINE_ROOT,
  );

  const consumerPkgPath = path.join(packageDir, "package.json");
  const templatePkgPath = path.join(templateDir, "package.json");
  const consumerPkg = JSON.parse(await fs.readFile(consumerPkgPath, "utf8"));
  const templatePkg = JSON.parse(await fs.readFile(templatePkgPath, "utf8"));

  const mergedPkg = mergePackageJson(consumerPkg, templatePkg, {
    owned: new Set(["devDependencies", "scripts"]),
    preserveKeys: ["name", "version", "bin", "man", "private", "publishConfig"],
    releaseVersion,
  });

  const templateYaml = parseYaml(
    await fs.readFile(path.join(templateDir, "cli.config.yaml"), "utf8"),
  ) as Record<string, unknown>;
  const consumerYaml = parseYaml(
    await fs.readFile(path.join(packageDir, CLI_CONFIG_FILE), "utf8"),
  ) as Record<string, unknown>;
  const mergedYaml = mergeYamlConfig(templateYaml, consumerYaml);

  if (dryRun) {
    console.log(`Would upgrade ${packageDir}`);
    return engineResult({ exitCode: EXIT_SUCCESS });
  }

  const plan = await runUpgradePlan({
    templateDir,
    packageDir,
    overwrite: OVERWRITE,
    merge: [],
    dryRun: false,
    requireOverwriteSources: true,
  });

  await fs.writeFile(
    consumerPkgPath,
    JSON.stringify(mergedPkg, null, 2) + "\n",
  );
  // Consumer-owned cli.config.yaml is merged, not replaced blindly.
  const existingYaml = await fs.readFile(
    path.join(packageDir, CLI_CONFIG_FILE),
    "utf8",
  );
  if (existingYaml !== stringifyYaml(mergedYaml)) {
    await fs.writeFile(
      path.join(packageDir, CLI_CONFIG_FILE),
      stringifyYaml(mergedYaml),
    );
  }
  await writeEngineVersion(packageDir, ENGINE_VERSION_FILE, releaseVersion);

  return engineResult({
    exitCode: EXIT_SUCCESS,
    changedFiles: plan.changedFiles,
  });
}
