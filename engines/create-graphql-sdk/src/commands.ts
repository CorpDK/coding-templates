import path from "node:path";
import { spinner } from "@clack/prompts";
import {
  EXIT_SUCCESS,
  EXIT_TOOL,
  EXIT_USAGE,
  EXIT_VALIDATION,
  type EngineResult,
} from "@corpdk/engine-kit";
import { runCodegen } from "./codegen.js";
import { formatUnmappedMessage, runSyncPipeline } from "./sync.js";

export interface SyncCommandOptions {
  dir: string;
  check?: boolean;
  failOnBreaking?: boolean;
}

export async function runSync(
  options: SyncCommandOptions,
): Promise<EngineResult> {
  const packageDir = path.resolve(options.dir);
  const s = spinner();
  s.start(
    options.check ? "Checking schema snapshot" : "Syncing schema snapshot",
  );
  try {
    const result = await runSyncPipeline({
      packageDir,
      check: options.check,
      failOnBreaking: options.failOnBreaking,
      writeStubs: !options.check,
    });

    if (options.check && result.changed) {
      s.stop("Snapshot drift detected");
      return {
        exitCode: EXIT_VALIDATION,
        changedFiles: [result.snapshotRel],
        message: `Snapshot differs from merged sources (${result.snapshotRel})`,
      };
    }

    if (result.unmappedScalars.length > 0) {
      s.stop("Unmapped custom scalars");
      return {
        exitCode: EXIT_VALIDATION,
        changedFiles: result.configUpdated ? ["sdk.config.yaml"] : [],
        message: formatUnmappedMessage(result.unmappedScalars),
      };
    }

    s.stop(options.check ? "Snapshot up to date" : "Snapshot updated");
    return {
      exitCode: EXIT_SUCCESS,
      changedFiles: result.changed ? [result.snapshotRel] : [],
    };
  } catch (err: unknown) {
    s.stop("Sync failed");
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("not found") || message.includes("matched no")) {
      return { exitCode: EXIT_USAGE, changedFiles: [], message };
    }
    if (
      message.includes("Conflict") ||
      message.includes("Cannot extend") ||
      message.includes("Breaking")
    ) {
      return { exitCode: EXIT_VALIDATION, changedFiles: [], message };
    }
    return { exitCode: EXIT_TOOL, changedFiles: [], message };
  }
}

export async function runCodegenCommand(dir: string): Promise<EngineResult> {
  const packageDir = path.resolve(dir);
  const s = spinner();
  s.start("Generating SDK (L1 + L2 + L3)");
  try {
    const files = await runCodegen(packageDir);
    s.stop("Codegen complete");
    return { exitCode: EXIT_SUCCESS, changedFiles: files };
  } catch (err: unknown) {
    s.stop("Codegen failed");
    return {
      exitCode: EXIT_TOOL,
      changedFiles: [],
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function runGenerate(
  options: SyncCommandOptions,
): Promise<EngineResult> {
  const sync = await runSync(options);
  if (sync.exitCode !== EXIT_SUCCESS) {
    return sync;
  }
  return runCodegenCommand(options.dir);
}
