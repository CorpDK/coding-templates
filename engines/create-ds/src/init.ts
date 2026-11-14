import fs from "node:fs/promises";
import path from "node:path";
import {
  copyDir,
  pathExists,
  readJson,
  writeJson,
  mergePackageJson,
  type EngineResult,
  EXIT_SUCCESS,
  EXIT_TOOL,
  EXIT_USAGE,
} from "@corpdk/engine-kit";
import { exitCodeForEngineError } from "./engine-errors.js";
import { spinner } from "@clack/prompts";
import { copyBootstrapStaticSrc, runDalBootstrap } from "./bootstrap.js";
import {
  COPY_TEMPLATE_EXCLUDE,
  CORP_DK_OWNED,
  CREATE_DS_ENGINE_ROOT,
  initialScaffoldCalVer,
  normalizeDalScripts,
} from "./constants.js";
import {
  engineStarterDir,
  isBundledCanonicalTemplate,
  readCreateDsReleaseVersion,
  resolveCanonicalDsTemplateDir,
} from "./template.js";

export interface InitOptions {
  dir: string;
  name: string;
  demoSchema?: boolean;
  noInstall?: boolean;
  dryRun?: boolean;
  repoRoot?: string;
}

function initNextSteps(packageName: string, noInstall?: boolean): string[] {
  const steps: string[] = [];
  if (!noInstall) steps.push("pnpm install");
  steps.push(`pnpm --filter ${packageName} dal:codegen`);
  return steps;
}

export async function runInit(options: InitOptions): Promise<EngineResult> {
  const repoRoot =
    options.repoRoot ?? path.resolve(CREATE_DS_ENGINE_ROOT, "..", "..");
  const targetDir = path.resolve(options.dir);

  let templateDir: string;
  try {
    templateDir = await resolveCanonicalDsTemplateDir(repoRoot);
  } catch (err: unknown) {
    return {
      exitCode: EXIT_TOOL,
      changedFiles: [],
      message: err instanceof Error ? err.message : String(err),
    };
  }

  if (!(await pathExists(templateDir))) {
    return {
      exitCode: EXIT_USAGE,
      changedFiles: [],
      message: `Canonical DS template not found (looked under ${templateDir}).`,
    };
  }

  if (await pathExists(targetDir)) {
    const entries = await fs.readdir(targetDir);
    if (entries.length > 0) {
      return {
        exitCode: EXIT_USAGE,
        changedFiles: [],
        message: `Init target is not empty: ${targetDir}`,
      };
    }
  }

  if (options.dryRun) {
    return {
      exitCode: EXIT_SUCCESS,
      changedFiles: ["<scaffold layout>"],
      nextSteps: initNextSteps(options.name, options.noInstall),
    };
  }

  const s = spinner();
  s.start("Scaffolding DS package layout");

  try {
    await fs.mkdir(targetDir, { recursive: true });

    await copyDir(templateDir, targetDir, {
      exclude: [...COPY_TEMPLATE_EXCLUDE],
    });

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
    } else {
      const starterDal = path.join(engineStarterDir(), "dal", "dal.config.yaml");
      if (await pathExists(starterDal)) {
        await fs.copyFile(
          starterDal,
          path.join(targetDir, "dal", "dal.config.yaml"),
        );
      }
    }

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

    await runDalBootstrap(repoRoot, targetDir, templateDir);
    await copyBootstrapStaticSrc(templateDir, targetDir);

    s.stop("DS package scaffolded");

    return {
      exitCode: EXIT_SUCCESS,
      changedFiles: [],
      nextSteps: initNextSteps(options.name, options.noInstall),
    };
  } catch (err: unknown) {
    s.stop("Scaffold failed");
    return {
      exitCode: exitCodeForEngineError(err),
      changedFiles: [],
      message: err instanceof Error ? err.message : String(err),
    };
  }
}