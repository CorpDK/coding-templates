import fs from "node:fs/promises";
import path from "node:path";
import { spinner } from "@clack/prompts";
import {
  engineStarterDir,
  isBundledCanonicalTemplate,
  initialScaffoldCalVer,
  readCreateDsReleaseVersion,
  resolveCanonicalDsTemplateDir,
} from "./template.js";
import {
  copyDir,
  execAsync,
  pathExists,
  readJson,
  writeJson,
} from "./utils.js";
import { mergePackageJson } from "./package-merge.js";

export interface InitOptions {
  targetDir: string;
  repoRoot: string;
  packageName: string;
  withDemoSchema: boolean;
}

export async function runInit(options: InitOptions): Promise<void> {
  const s = spinner();
  const templateDir = await resolveCanonicalDsTemplateDir(options.repoRoot);
  const targetDir = path.resolve(options.targetDir);
  const dalCodegenCli = path.join(
    options.repoRoot,
    "libraries/dal-codegen/dist/cli.js",
  );

  if (!(await pathExists(templateDir))) {
    throw new Error(`Canonical DS template not found: ${templateDir}`);
  }

  if (await pathExists(targetDir)) {
    const entries = await fs.readdir(targetDir);
    if (entries.length > 0) {
      throw new Error(`Target directory is not empty: ${targetDir}`);
    }
  }

  s.start("Scaffolding DS package layout");
  await fs.mkdir(targetDir, { recursive: true });

  await copyDir(templateDir, targetDir, {
    extraExclude: ["src", "drizzle"],
  });

  const schemaSrc = options.withDemoSchema
    ? path.join(templateDir, "src", "db", "schema")
    : path.join(engineStarterDir(), "db", "schema");

  await copyDir(schemaSrc, path.join(targetDir, "src", "db", "schema"));

  if (options.withDemoSchema) {
    const seedSrc = path.join(templateDir, "src", "db", "seed.ts");
    if (await pathExists(seedSrc)) {
      await fs.copyFile(seedSrc, path.join(targetDir, "src", "db", "seed.ts"));
    }
  }

  const starterDal = path.join(engineStarterDir(), "dal", "dal.config.yaml");
  if (!options.withDemoSchema && (await pathExists(starterDal))) {
    await fs.copyFile(
      starterDal,
      path.join(targetDir, "dal", "dal.config.yaml"),
    );
  }

  const templatePkg = await readJson<Record<string, unknown>>(
    path.join(templateDir, "package.json"),
  );
  const mergeOptions = isBundledCanonicalTemplate(templateDir)
    ? { publishedCorpdkVersions: await readCreateDsReleaseVersion() }
    : undefined;
  const merged = mergePackageJson(
    {
      name: options.packageName,
      version: initialScaffoldCalVer(),
      license: "MIT",
    },
    templatePkg as Parameters<typeof mergePackageJson>[1],
    mergeOptions,
  );
  await writeJson(path.join(targetDir, "package.json"), merged);

  if (await pathExists(dalCodegenCli)) {
    await execAsync(`node "${dalCodegenCli}" --mode=bootstrap`, {
      cwd: targetDir,
    });
  } else {
    for (const rel of ["src/schema.ts", "src/index.ts", "src/db/index.ts"]) {
      await fs.copyFile(path.join(templateDir, rel), path.join(targetDir, rel));
    }
  }

  s.stop("DS package scaffolded");
}
