import fs from "node:fs/promises";
import path from "node:path";
import { cancel, spinner } from "@clack/prompts";
import type { ScaffoldConfig } from "./types.js";
import { PACKAGE_DEFS } from "./packages.js";
import {
  appendToFile,
  copyDir,
  execAsync,
  mergeDir,
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

/** Resolve the source directory for a package based on its sourceBase */
function getSrcDir(pkgId: string, templateRoot: string): string {
  const def = PACKAGE_DEFS[pkgId as keyof typeof PACKAGE_DEFS];
  const base = def.sourceBase === "packages"
    ? path.join(templateRoot, "packages")
    : path.join(templateRoot, "templates");
  return path.join(base, def.dirName);
}

export async function scaffold(
  config: ScaffoldConfig,
  templateRoot: string
): Promise<void> {
  const s = spinner();
  const outDir = config.outputDir;

  // 0. Validate all template directories exist before starting
  for (const pkgId of config.selectedPackages) {
    const { label } = PACKAGE_DEFS[pkgId];
    const srcDir = getSrcDir(pkgId, templateRoot);
    if (!(await pathExists(srcDir))) {
      cancel(`The '${label}' template directory was not found at: ${srcDir}`);
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
    await scaffoldMonorepo(config, templateRoot, s);
  } else {
    await scaffoldStandalone(config, templateRoot, s);
  }

  // 6. Git init
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

async function copyPackage(
  pkgId: string,
  srcDir: string,
  destDir: string,
  config: ScaffoldConfig
): Promise<void> {
  const ctx: TransformContext = {
    orgScope: config.orgScope,
    ds: config.ds,
    ui: config.ui,
    db: config.db,
    externalSdk: null,
    isRootPackageJson: false,
    projectName: config.projectName,
  };

  // For ui-auth, exclude scaffold/ directory (it gets merged separately)
  const excludeScaffold = pkgId === "ui-auth";

  await copyDir(srcDir, destDir, (content, relPath) => {
    if (excludeScaffold && relPath.startsWith("scaffold")) return "";
    return transformFileContent(content, relPath, ctx);
  });

  // Remove any empty scaffold stub written above
  if (excludeScaffold) {
    const scaffoldDest = path.join(destDir, "scaffold");
    if (await pathExists(scaffoldDest)) {
      await fs.rm(scaffoldDest, { recursive: true, force: true });
    }
  }

  // Post-copy: Drizzle driver swap
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

async function scaffoldMonorepo(
  config: ScaffoldConfig,
  templateRoot: string,
  s: ReturnType<typeof spinner>
): Promise<void> {
  const outDir = config.outputDir;

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
  await fs.writeFile(path.join(outDir, "pnpm-workspace.yaml"), workspaceYaml, "utf8");
  s.stop("Workspace files generated");

  // 4. Copy selected packages
  s.start(`Copying ${config.selectedPackages.size} packages`);

  let uiDestDir: string | null = null;

  for (const pkgId of config.selectedPackages) {
    const { dirName } = PACKAGE_DEFS[pkgId];
    const srcDir = getSrcDir(pkgId, templateRoot);
    const destDir = path.join(outDir, "packages", dirName);

    await copyPackage(pkgId, srcDir, destDir, config);

    if (pkgId === "ui" || pkgId === "ui-hprt") {
      uiDestDir = destDir;
    }
  }
  s.stop("Packages copied");

  // 4b. Merge BFF scaffold into UI app dir if ui-auth is selected
  if (config.selectedPackages.has("ui-auth") && uiDestDir) {
    s.start("Merging Auth.js BFF scaffold into UI app");
    const authScaffoldDir = path.join(templateRoot, "packages", "ui-auth", "scaffold");
    await mergeDir(authScaffoldDir, uiDestDir, [".env.example.append"]);
    await appendToFile(
      path.join(authScaffoldDir, ".env.example.append"),
      path.join(uiDestDir, ".env.example")
    );
    s.stop("BFF scaffold merged");
  }

  // 5. Copy Dockerfiles into package directories
  s.start("Copying Dockerfiles");
  const dockerTemplateDir = path.join(templateRoot, "templates", "docker");
  const dockerCtx: TransformContext = {
    orgScope: config.orgScope,
    ds: config.ds,
    ui: config.ui,
    db: config.db,
    externalSdk: null,
    isRootPackageJson: false,
    projectName: config.projectName,
  };

  if (config.ds !== "none") {
    const dir = config.ds === "standard" ? "ds" : `ds-${config.ds}`;
    const src = path.join(dockerTemplateDir, "Dockerfile.ds");
    const content = await fs.readFile(src, "utf8");
    await fs.writeFile(
      path.join(outDir, "packages", dir, "Dockerfile"),
      transformFileContent(content, "Dockerfile.ds", dockerCtx),
      "utf8"
    );
  }

  if (config.ui !== "none") {
    const dir = config.ui === "standard" ? "ui" : `ui-${config.ui}`;
    const src = path.join(dockerTemplateDir, "Dockerfile.ui");
    const content = await fs.readFile(src, "utf8");
    await fs.writeFile(
      path.join(outDir, "packages", dir, "Dockerfile"),
      transformFileContent(content, "Dockerfile.ui", dockerCtx),
      "utf8"
    );
  }
  s.stop("Dockerfiles copied");
}

async function scaffoldStandalone(
  config: ScaffoldConfig,
  templateRoot: string,
  s: ReturnType<typeof spinner>
): Promise<void> {
  const outDir = config.outputDir;

  // 3. Generate root workspace files (standalone = UI-only monorepo)
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
  await fs.writeFile(path.join(outDir, "pnpm-workspace.yaml"), workspaceYaml, "utf8");
  s.stop("Workspace files generated");

  // 4. Copy selected packages into packages/
  s.start(`Copying ${config.selectedPackages.size} packages`);

  const oldSdkPkg = "@corpdk/ds-sdk";
  let uiDestDir: string | null = null;

  for (const pkgId of config.selectedPackages) {
    const { dirName } = PACKAGE_DEFS[pkgId];
    const srcDir = getSrcDir(pkgId, templateRoot);
    const destDir = path.join(outDir, "packages", dirName);

    const ctx: TransformContext = {
      orgScope: config.orgScope,
      ds: config.ds,
      ui: config.ui,
      db: null,
      externalSdk: config.externalSdkPackage
        ? { oldPkg: oldSdkPkg, externalPkg: config.externalSdkPackage, version: "latest" }
        : null,
      isRootPackageJson: false,
      projectName: config.projectName,
    };

    const excludeScaffold = pkgId === "ui-auth";

    await copyDir(srcDir, destDir, (content, relPath) => {
      if (excludeScaffold && relPath.startsWith("scaffold")) return "";
      return transformFileContent(content, relPath, ctx);
    });

    if (excludeScaffold) {
      const scaffoldDest = path.join(destDir, "scaffold");
      if (await pathExists(scaffoldDest)) {
        await fs.rm(scaffoldDest, { recursive: true, force: true });
      }
    }

    if (config.generateEnv) {
      const envExamplePath = path.join(destDir, ".env.example");
      const envPath = path.join(destDir, ".env");
      if (await pathExists(envExamplePath)) {
        await fs.copyFile(envExamplePath, envPath);
      }
    }

    if (pkgId === "ui" || pkgId === "ui-hprt") {
      uiDestDir = destDir;
    }
  }
  s.stop("Packages copied");

  // 4b. Merge BFF scaffold if ui-auth is selected
  if (config.selectedPackages.has("ui-auth") && uiDestDir) {
    s.start("Merging Auth.js BFF scaffold into UI app");
    const authScaffoldDir = path.join(templateRoot, "packages", "ui-auth", "scaffold");
    await mergeDir(authScaffoldDir, uiDestDir, [".env.example.append"]);
    await appendToFile(
      path.join(authScaffoldDir, ".env.example.append"),
      path.join(uiDestDir, ".env.example")
    );
    s.stop("BFF scaffold merged");
  }

  // 5. Copy Dockerfile.ui into the UI package directory
  if (config.ui !== "none" && uiDestDir) {
    s.start("Copying Dockerfile");
    const dockerTemplateDir = path.join(templateRoot, "templates", "docker");
    const dockerCtx: TransformContext = {
      orgScope: config.orgScope,
      ds: config.ds,
      ui: config.ui,
      db: null,
      externalSdk: null,
      isRootPackageJson: false,
      projectName: config.projectName,
    };
    const src = path.join(dockerTemplateDir, "Dockerfile.ui");
    if (await pathExists(src)) {
      const content = await fs.readFile(src, "utf8");
      await fs.writeFile(
        path.join(uiDestDir, "Dockerfile"),
        transformFileContent(content, "Dockerfile.ui", dockerCtx),
        "utf8"
      );
    }
    s.stop("Dockerfile copied");
  }
}
