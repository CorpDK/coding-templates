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

export type DalCodegenMode = "schema" | "impl" | "all";

export interface CodegenOptions {
  /** Absolute path to package root (templates/ds). */
  packageRoot: string;
  /** Relative path to Drizzle schema dir or file from package root. */
  schemaPath: string;
  /** Relative output dir from package root (wiped and regenerated each impl run). */
  outputDir: string;
  /** Relative path to merged GraphQL SDL module from package root (outside outputDir). */
  schemaOutputPath: string;
  /** Relative path to standalone entity *Record types from package root. */
  entityRecordsOutputPath?: string;
  /** Relative path to graphql-codegen mappers module from package root. */
  mappersOutputPath?: string;
  /** Relative path to dal.config.yaml from package root. */
  configPath: string;
  /** schema = phase 1 only; impl = phase 3 only; all = schema then impl. */
  mode?: DalCodegenMode;
}
