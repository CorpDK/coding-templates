import fs from "node:fs/promises";
import path from "node:path";
import { pathExists } from "@corpdk/engine-kit";
import { BOOTSTRAP_STATIC_SRC_RELATIVE } from "./constants.js";
import { execAsync } from "./exec.js";

export async function copyBootstrapStaticSrc(
  templateDir: string,
  packageDir: string,
): Promise<void> {
  for (const rel of BOOTSTRAP_STATIC_SRC_RELATIVE) {
    const templatePath = path.join(templateDir, rel);
    if (!(await pathExists(templatePath))) continue;
    const destPath = path.join(packageDir, rel);
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.copyFile(templatePath, destPath);
  }
}

export async function runDalBootstrap(
  repoRoot: string,
  targetDir: string,
  templateDir: string,
): Promise<void> {
  const dalCodegenCli = path.join(
    repoRoot,
    "libraries/dal-codegen/dist/cli.js",
  );

  if (await pathExists(dalCodegenCli)) {
    await execAsync(`node "${dalCodegenCli}" --mode=bootstrap`, {
      cwd: targetDir,
    });
    return;
  }

  for (const rel of ["src/schema.ts", "src/index.ts", "src/db/index.ts"]) {
    await fs.copyFile(path.join(templateDir, rel), path.join(targetDir, rel));
  }
}
