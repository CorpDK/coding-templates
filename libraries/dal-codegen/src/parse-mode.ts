import type { DalCodegenMode } from "./config.js";

const MODES = new Set<DalCodegenMode>(["schema", "impl", "all", "bootstrap"]);

function isDalCodegenMode(value: string): value is DalCodegenMode {
  return MODES.has(value as DalCodegenMode);
}

/** Resolve dal-codegen phase from CLI flags or DAL_CODEGEN_MODE. */
export function parseDalCodegenMode(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): DalCodegenMode {
  const flag = argv.find((a) => a.startsWith("--mode="));
  if (flag) {
    const value = flag.slice("--mode=".length);
    if (isDalCodegenMode(value)) {
      return value;
    }
    throw new Error(
      `Invalid --mode=${value} (expected schema | impl | all | bootstrap)`,
    );
  }
  const envMode = env.DAL_CODEGEN_MODE;
  if (envMode && isDalCodegenMode(envMode)) {
    return envMode;
  }
  return "all";
}
