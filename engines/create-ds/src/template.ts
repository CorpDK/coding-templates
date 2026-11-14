import path from "node:path";
import {
  isBundledCanonical,
  readEngineRelease,
  resolveCanonical,
} from "@corpdk/engine-kit";
import { CREATE_DS_ENGINE_ROOT } from "./constants.js";

export function repoRootFromEngine(): string {
  return path.resolve(CREATE_DS_ENGINE_ROOT, "..", "..");
}

export function bundledCanonicalDir(): string {
  return path.join(CREATE_DS_ENGINE_ROOT, "canonical");
}

export function engineStarterDir(): string {
  return path.join(CREATE_DS_ENGINE_ROOT, "starter");
}

export async function resolveCanonicalDsTemplateDir(
  repoRoot: string,
): Promise<string> {
  return resolveCanonical({
    engineRoot: CREATE_DS_ENGINE_ROOT,
    monorepoPath: path.join(repoRoot, "templates", "ds"),
    bundledPath: bundledCanonicalDir(),
  });
}

export function isBundledCanonicalTemplate(templateDir: string): boolean {
  return isBundledCanonical(templateDir, bundledCanonicalDir());
}

export async function readCreateDsReleaseVersion(): Promise<string> {
  return readEngineRelease(CREATE_DS_ENGINE_ROOT);
}

export { BOOTSTRAP_STATIC_SRC_RELATIVE, UPGRADE_RELATIVE_FILES } from "./constants.js";