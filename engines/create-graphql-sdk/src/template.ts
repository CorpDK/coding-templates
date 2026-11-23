import path from "node:path";
import {
  isBundledCanonical,
  readEngineRelease,
  resolveCanonical,
} from "@corpdk/engine-kit";
import { CREATE_GRAPHQL_SDK_ENGINE_ROOT } from "./constants.js";

export function repoRootFromEngine(): string {
  return path.resolve(CREATE_GRAPHQL_SDK_ENGINE_ROOT, "..", "..");
}

export function bundledCanonicalDir(): string {
  return path.join(CREATE_GRAPHQL_SDK_ENGINE_ROOT, "canonical");
}

export function engineStarterDir(): string {
  return path.join(CREATE_GRAPHQL_SDK_ENGINE_ROOT, "starter");
}

export function resolveCanonicalSdkTemplateDir(
  repoRoot: string,
): Promise<string> {
  const canonical = path.join(
    repoRoot,
    "engines",
    "create-graphql-sdk",
    "canonical",
  );
  return resolveCanonical({
    engineRoot: CREATE_GRAPHQL_SDK_ENGINE_ROOT,
    monorepoPath: canonical,
    bundledPath: bundledCanonicalDir(),
  });
}

export function isBundledCanonicalTemplate(templateDir: string): boolean {
  return isBundledCanonical(templateDir, bundledCanonicalDir());
}

export function readCreateGraphqlSdkReleaseVersion(): Promise<string> {
  return readEngineRelease(CREATE_GRAPHQL_SDK_ENGINE_ROOT);
}