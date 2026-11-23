import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { buildSchema } from "graphql";
import type { GraphQLSchema } from "graphql";

export class SdkResolveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SdkResolveError";
  }
}

export async function resolveSdkSnapshot(
  sdkPath: string,
): Promise<{ schema: GraphQLSchema; snapshotPath: string; sha256: string }> {
  const snapshotPath = path.join(sdkPath, "schema", "schema.graphqls");
  let raw: string;
  try {
    raw = await fs.readFile(snapshotPath, "utf8");
  } catch {
    throw new SdkResolveError(
      `SDK snapshot missing at ${snapshotPath}. Run sdk sync first.`,
    );
  }
  const sha256 = createHash("sha256").update(raw).digest("hex");
  const schema = buildSchema(raw);
  return { schema, snapshotPath, sha256 };
}

export async function assertSdkValidationExport(sdkPath: string): Promise<void> {
  const pkgPath = path.join(sdkPath, "package.json");
  const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8")) as {
    exports?: Record<string, unknown>;
  };
  const hasValidation = pkg.exports && Object.hasOwn(pkg.exports, "./validation");
  if (!hasValidation) {
    throw new SdkResolveError(
      "SDK package.json must export ./validation (validation.enabled: true in sdk.config.yaml)",
    );
  }
}