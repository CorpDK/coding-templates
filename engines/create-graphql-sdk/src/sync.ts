import fs from "node:fs/promises";
import path from "node:path";
import { pathExists } from "@corpdk/engine-kit";
import { compareSnapshots } from "./diff.js";
import {
  buildSchemaFromSnapshot,
  ensureQueryRoot,
  mergeSdlUnits,
} from "./merge.js";
import { collectSdlUnits } from "./schema-load.js";
import { listCustomScalars, mergeScalarStubs } from "./scalars.js";
import { readSdkConfig, snapshotPath, writeSdkConfig } from "./sdk-config.js";

export interface SyncOptions {
  packageDir: string;
  check?: boolean;
  failOnBreaking?: boolean;
  writeStubs?: boolean;
}

export interface SyncResult {
  mergedSdl: string;
  changed: boolean;
  unmappedScalars: string[];
  breaking: string[];
  snapshotRel: string;
  configUpdated: boolean;
}

export async function runSyncPipeline(
  options: SyncOptions,
): Promise<SyncResult> {
  const packageDir = path.resolve(options.packageDir);
  let config = await readSdkConfig(packageDir);
  const configDir = packageDir;
  const units = await collectSdlUnits(config.schema.sources, configDir);
  const mergedSdl = mergeSdlUnits(units);
  const schema = buildSchemaFromSnapshot(mergedSdl);
  ensureQueryRoot(schema);

  const custom = listCustomScalars(schema);
  const configured = new Set(Object.keys(config.scalars ?? {}));
  const unmapped = custom.filter((n) => !configured.has(n));

  let configUpdated = false;
  if (options.writeStubs !== false && unmapped.length > 0) {
    config = mergeScalarStubs(config, unmapped);
    if (!options.check) {
      await writeSdkConfig(packageDir, config);
      configUpdated = true;
    }
  }

  const snapAbs = snapshotPath(packageDir, config);
  const snapRel = path.relative(packageDir, snapAbs);
  let previous: string | null = null;
  if (await pathExists(snapAbs)) {
    previous = await fs.readFile(snapAbs, "utf8");
  }

  const changed = previous !== mergedSdl;
  let breaking: string[] = [];
  if (previous && previous !== mergedSdl) {
    const changes = compareSnapshots(previous, mergedSdl);
    breaking = changes
      .filter((c) => c.type === "breaking")
      .map((c) => c.description);
    if (options.failOnBreaking && breaking.length > 0) {
      const lines = breaking.map((b) => `  - ${b}`).join("\n");
      throw new Error(`Breaking schema changes detected:\n${lines}`);
    }
  }

  if (!options.check && changed) {
    await fs.mkdir(path.dirname(snapAbs), { recursive: true });
    await fs.writeFile(snapAbs, mergedSdl, "utf8");
  }

  return {
    mergedSdl,
    changed,
    unmappedScalars: unmapped,
    breaking,
    snapshotRel: snapRel,
    configUpdated,
  };
}

export function formatUnmappedMessage(names: string[]): string {
  const lines = names.map((n) => `  - ${n}`).join("\n");
  return `Unmapped custom scalars (add entries to sdk.config.yaml scalars.*):\n${lines}`;
}
