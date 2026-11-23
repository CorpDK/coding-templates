import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { pathExists } from "@corpdk/engine-kit";

export type SchemaSource =
  | { kind: "graphqls"; paths: string[]; exclude?: string[] }
  | { kind: "typeDefs"; path: string };

export interface SdkConfig {
  apiVersion?: string;
  package?: string;
  schema: {
    sources: SchemaSource[];
    snapshot?: string;
  };
  scalars?: Record<string, ScalarConfigEntry>;
  dsl?: { engine?: string };
  validation?: {
    enabled?: boolean;
    strictObjects?: boolean;
    builtinScalars?: Record<string, string>;
  };
}

export type ScalarZodConfig =
  | string
  | { from: string; name: string };

export interface ScalarConfigEntry {
  type: string;
  zod: ScalarZodConfig;
  wire?: "string" | "json";
}

export function defaultSdkConfig(packageName: string): SdkConfig {
  return {
    apiVersion: "corpdk.dev/graphql-sdk/v1",
    package: packageName,
    schema: {
      sources: [],
      snapshot: "schema/schema.graphqls",
    },
    scalars: {},
    dsl: { engine: "corpdk-graphql-dsl" },
    validation: { enabled: true, strictObjects: false, builtinScalars: {} },
  };
}

export function sdkConfigPath(packageDir: string): string {
  return path.join(packageDir, "sdk.config.yaml");
}

export async function readSdkConfig(packageDir: string): Promise<SdkConfig> {
  const configPath = sdkConfigPath(packageDir);
  if (!(await pathExists(configPath))) {
    throw new Error(`Missing sdk.config.yaml under ${packageDir}`);
  }
  const raw = await fs.readFile(configPath, "utf8");
  const doc = parseYaml(raw) as SdkConfig | null;
  if (!doc?.schema?.sources) {
    throw new SyntaxError(`Invalid sdk.config.yaml under ${packageDir}`);
  }
  return doc;
}

export async function writeSdkConfig(
  packageDir: string,
  config: SdkConfig,
): Promise<void> {
  const configPath = sdkConfigPath(packageDir);
  await fs.writeFile(configPath, stringifyYaml(config), "utf8");
}

export function snapshotPath(packageDir: string, config: SdkConfig): string {
  const rel = config.schema.snapshot ?? "schema/schema.graphqls";
  return path.join(packageDir, rel);
}