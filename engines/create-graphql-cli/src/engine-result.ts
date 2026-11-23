import type { EngineResult } from "@corpdk/engine-kit";

export function engineResult(
  partial: Omit<EngineResult, "changedFiles"> & { changedFiles?: string[] },
): EngineResult {
  return {
    changedFiles: partial.changedFiles ?? [],
    ...partial,
  };
}