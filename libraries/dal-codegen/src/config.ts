import { readFileSync, existsSync } from "node:fs";
import { parse as parseYaml } from "yaml";

export interface DalConfig {
  strict?: boolean;
  filterMaxDepth?: number;
  filterMaxNodes?: number;
}

const DEFAULTS: Required<DalConfig> = {
  strict: false,
  filterMaxDepth: 2,
  filterMaxNodes: 50,
};

export function loadDalConfig(configPath: string): Required<DalConfig> {
  if (!existsSync(configPath)) return { ...DEFAULTS };
  const raw = parseYaml(readFileSync(configPath, "utf-8")) as DalConfig | null;
  return {
    strict: raw?.strict ?? DEFAULTS.strict,
    filterMaxDepth: raw?.filterMaxDepth ?? DEFAULTS.filterMaxDepth,
    filterMaxNodes: raw?.filterMaxNodes ?? DEFAULTS.filterMaxNodes,
  };
}

export interface CodegenOptions {
  /** Absolute path to package root (templates/ds). */
  packageRoot: string;
  /** Relative path to Drizzle schema dir or file from package root. */
  schemaPath: string;
  /** Relative output dir from package root. */
  outputDir: string;
  /** Relative path to dal.config.yaml from package root. */
  configPath: string;
}
