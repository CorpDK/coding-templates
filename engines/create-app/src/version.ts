import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageJsonPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "package.json",
);

/** CLI release version from engines/create-app/package.json (CalVer). */
export function readCreateAppVersion(): string {
  const raw = readFileSync(packageJsonPath, "utf8");
  const pkg = JSON.parse(raw) as { version?: string };
  if (!pkg.version) {
    throw new Error("create-app package.json missing version");
  }
  return pkg.version;
}
