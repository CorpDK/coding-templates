import fs from "node:fs/promises";
import path from "node:path";
import { cancel, spinner } from "@clack/prompts";
import type { ScaffoldConfig } from "./types.js";
import { PACKAGE_DEFS, resolveUiSdkDep } from "./packages.js";
import {
  copyDir,
  execAsync,
  pathExists,
  readJson,
} from "./utils.js";
import {
  transformFileContent,
  transformDrizzlePackageJson,
  type TransformContext,
} from "./transform.js";
import {
  generateRootPackageJson,
  generateWorkspaceYaml,
} from "./generate.js";

const ROOT_FILES_TO_COPY = [
  "turbo.json",
  ".prettierrc",
  ".prettierignore",
  ".editorconfig",
  ".gitignore",
  "CODING_GUIDELINES.md",
  "README.md",
];

export async function scaffold(
  config: ScaffoldConfig,
  templateRoot: string
): Promise<void> {
  const s = spinner();
  const templatesDir = path.join(templateRoot, "templates");
  const outDir = config.outputDir;

  // 0. Validate all template directories exist before starting
  for (const pkgId of config.selectedPackages) {
    const { dirName, label } = PACKAGE_DEFS[pkgId];
    const srcDir = path.join(templateRoot, "templates", dirName);
    if (!(await pathExists(srcDir))) {
      cancel(
        `The '${label}' template is not yet available.\n` +
          `It will be added in a future release.\n` +
          `Currently available: Relational DB (Prisma/Drizzle), Couchbase.`
      );
      process.exit(1);
    }
  }

  // 1. Create output directory
  s.start("Creating output directory");
  await fs.mkdir(outDir, { recursive: true });
  s.stop("Output directory created");

  // 2. Copy root config files
  s.start("Copying root configuration files");
  for (const file of ROOT_FILES_TO_COPY) {
    const src = path.join(templateRoot, file);
    if (await pathExists(src)) {
      await fs.copyFile(src, path.join(outDir, file));
    }
  }
  s.stop("Root config files copied");

  if (config.projectType === "monorepo") {
    await scaffoldMonorepo(config, templateRoot, templatesDir, s);
  } else {
    await scaffoldStandalone(config, templatesDir, s);
  }

  // 5. Git init
  if (config.initGit) {
    s.start("Initialising git repository");
    await execAsync("git init", { cwd: outDir });
    await execAsync("git add .", { cwd: outDir });
    await execAsync(
      `git commit -m "chore: initial scaffold from coding-templates"`,
      { cwd: outDir }
    );
    s.stop("Git repository initialised");
  }
}

async function scaffoldMonorepo(
  config: ScaffoldConfig,
  templateRoot: string,
  templatesDir: string,
  s: ReturnType<typeof spinner>
): Promise<void> {
  const outDir = config.outputDir;
  const sdkRemap = resolveUiSdkDep(config.ds, config.ui);

  // 3. Generate root workspace files
  s.start("Generating workspace files");
  const sourceRootPkg = await readJson<{
    devDependencies: Record<string, string>;
    packageManager: string;
  }>(path.join(templateRoot, "package.json"));
  const rootPkgContent = generateRootPackageJson(
    config.projectName,
    config.orgScope,
    sourceRootPkg
  );
  await fs.writeFile(path.join(outDir, "package.json"), rootPkgContent, "utf8");
  const workspaceYaml = generateWorkspaceYaml(config.selectedPackages);
  await fs.writeFile(
    path.join(outDir, "pnpm-workspace.yaml"),
    workspaceYaml,
    "utf8"
  );
  s.stop("Workspace files generated");

  // 4. Copy selected packages
  s.start(`Copying ${config.selectedPackages.size} packages`);
  for (const pkgId of config.selectedPackages) {
    const { dirName } = PACKAGE_DEFS[pkgId];
    const srcDir = path.join(templatesDir, dirName);
    const destDir = path.join(outDir, "packages", dirName);

    const ctx: TransformContext = {
      orgScope: config.orgScope,
      ds: config.ds,
      ui: config.ui,
      db: config.db,
      sdkRemap:
        sdkRemap && (pkgId === "ui" || pkgId === "ui-hprt")
          ? { oldPkg: sdkRemap.oldPkg, newPkg: sdkRemap.newPkg }
          : null,
      externalSdk: null,
      isRootPackageJson: false,
      projectName: config.projectName,
    };

    await copyDir(srcDir, destDir, (content, relPath) =>
      transformFileContent(content, relPath, ctx)
    );

    // Post-copy: Drizzle driver swap (applied to already-transformed package.json)
    if (pkgId === "ds-hprt" && config.db && config.db !== "postgresql" && config.db !== "cockroachdb") {
      const pkgJsonPath = path.join(destDir, "package.json");
      const pkgJsonContent = await fs.readFile(pkgJsonPath, "utf8");
      const updated = transformDrizzlePackageJson(pkgJsonContent, config.db);
      await fs.writeFile(pkgJsonPath, updated, "utf8");
    }

    // Copy .env.example → .env if requested
    if (config.generateEnv) {
      const envExamplePath = path.join(destDir, ".env.example");
      const envPath = path.join(destDir, ".env");
      if (await pathExists(envExamplePath)) {
        await fs.copyFile(envExamplePath, envPath);
      }
    }
  }
  s.stop("Packages copied");
}

async function scaffoldStandalone(
  config: ScaffoldConfig,
  templatesDir: string,
  s: ReturnType<typeof spinner>
): Promise<void> {
  const outDir = config.outputDir;
  const uiDirName = config.ui === "standard" ? "ui" : "ui-hprt";
  const oldSdkPkg =
    config.ui === "standard" ? "@corpdk/ds-sdk" : "@corpdk/ds-sdk-hprt";

  s.start("Scaffolding standalone Next.js project");
  const srcDir = path.join(templatesDir, uiDirName);

  const ctx: TransformContext = {
    orgScope: config.orgScope,
    ds: config.ds,
    ui: config.ui,
    db: null,
    sdkRemap: null,
    externalSdk: config.externalSdkPackage
      ? {
          oldPkg: oldSdkPkg,
          externalPkg: config.externalSdkPackage,
          version: "latest",
        }
      : null,
    isRootPackageJson: false,
    projectName: config.projectName,
  };

  // Copy UI files directly into outDir (not inside packages/)
  await copyDir(srcDir, outDir, (content, relPath) =>
    transformFileContent(content, relPath, ctx)
  );

  // Override package.json name + remove workspaces field
  const pkgJsonPath = path.join(outDir, "package.json");
  const pkgJson = await readJson<Record<string, unknown>>(pkgJsonPath);
  pkgJson["name"] = `@${config.orgScope}/${config.projectName}`;
  delete pkgJson["workspaces"];
  await fs.writeFile(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + "\n", "utf8");

  s.stop("Standalone project scaffolded");

  if (config.generateEnv) {
    s.start("Generating .env file");
    const envExamplePath = path.join(outDir, ".env.example");
    const envPath = path.join(outDir, ".env");
    if (await pathExists(envExamplePath)) {
      await fs.copyFile(envExamplePath, envPath);
    }
    s.stop(".env file generated");
  }
}
