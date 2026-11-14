import fs from "node:fs/promises";
import path from "node:path";
import {
  copyDir,
  pathExists,
  readJson,
  writeJson,
  mergePackageJson,
} from "@corpdk/engine-kit";
import { copyBootstrapStaticSrc, runDalBootstrap } from "./bootstrap.js";
import {
  COPY_TEMPLATE_EXCLUDE,
  CORP_DK_OWNED,
  normalizeDalScripts,
  initialScaffoldCalVer,
} from "./constants.js";
import {
  engineStarterDir,
  isBundledCanonicalTemplate,
  readCreateDsReleaseVersion,
} from "./template.js";
import type { InitOptions } from "./init.js";

export async function ensureEmptyTarget(
  targetDir: string,
): Promise<string | null> {
  if (!(await pathExists(targetDir))) {
    return null;
  }
  const entries = await fs.readdir(targetDir);
  if (entries.length > 0) {
    return `Init target is not empty: ${targetDir}`;
  }
  return null;
}

async function copyInitSchemaLayout(
  options: InitOptions,
  templateDir: string,
  targetDir: string,
): Promise<void> {
  const schemaSrc = options.demoSchema
    ? path.join(templateDir, "src", "db", "schema")
    : path.join(engineStarterDir(), "db", "schema");

  await copyDir(schemaSrc, path.join(targetDir, "src", "db", "schema"), {
    requireSource: Boolean(options.demoSchema),
  });

  if (options.demoSchema) {
    const seedSrc = path.join(templateDir, "src", "db", "seed.ts");
    if (await pathExists(seedSrc)) {
      await fs.copyFile(seedSrc, path.join(targetDir, "src", "db", "seed.ts"));
    } else {
      throw new Error(`Demo seed missing in canonical: ${seedSrc}`);
    }
    return;
  }

  const starterDal = path.join(engineStarterDir(), "dal", "dal.config.yaml");
  if (await pathExists(starterDal)) {
    await fs.copyFile(starterDal, path.join(targetDir, "dal", "dal.config.yaml"));
  }
}

export async function writeScaffoldPackageJson(
  options: InitOptions,
  templateDir: string,
  targetDir: string,
): Promise<void> {
  const templatePkg = await readJson<Record<string, unknown>>(
    path.join(templateDir, "package.json"),
  );
  const releaseVersion = isBundledCanonicalTemplate(templateDir)
    ? await readCreateDsReleaseVersion()
    : undefined;
  const merged = mergePackageJson(
    {
      name: options.name,
      version: initialScaffoldCalVer(),
      license: "MIT",
    },
    templatePkg as Parameters<typeof mergePackageJson>[1],
    {
      owned: CORP_DK_OWNED,
      scriptsTransform: normalizeDalScripts,
      releaseVersion,
    },
  );
  await writeJson(path.join(targetDir, "package.json"), merged);
}

export async function applyScaffoldLayout(
  options: InitOptions,
  repoRoot: string,
  templateDir: string,
  targetDir: string,
): Promise<void> {
  await fs.mkdir(targetDir, { recursive: true });

  await copyDir(templateDir, targetDir, {
    exclude: [...COPY_TEMPLATE_EXCLUDE],
  });

  await copyInitSchemaLayout(options, templateDir, targetDir);
  await writeScaffoldPackageJson(options, templateDir, targetDir);
  await runDalBootstrap(repoRoot, targetDir, templateDir);
  await copyBootstrapStaticSrc(templateDir, targetDir);
}