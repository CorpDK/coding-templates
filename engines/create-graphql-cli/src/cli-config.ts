import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { EmitCliModulesOptions } from "@corpdk/graphql-cli-core/codegen";

export const CLI_CONFIG_FILE = "cli.config.yaml";

export type CliConfigYaml = {
  apiVersion: string;
  package: string;
  bin: string;
  sdk: { package: string; path: string };
  transport?: EmitCliModulesOptions["transport"];
  selection?: EmitCliModulesOptions["selection"];
  pagination?: EmitCliModulesOptions["pagination"];
  include?: EmitCliModulesOptions["include"];
  exclude?: EmitCliModulesOptions["exclude"];
  commands?: EmitCliModulesOptions["commands"];
  guard?: EmitCliModulesOptions["guard"];
  output?: EmitCliModulesOptions["output"];
  man?: EmitCliModulesOptions["man"];
};

export async function readCliConfig(
  packageDir: string,
): Promise<CliConfigYaml> {
  const filePath = path.join(packageDir, CLI_CONFIG_FILE);
  const raw = await fs.readFile(filePath, "utf8");
  return parseYaml(raw) as CliConfigYaml;
}

export async function writeCliConfig(
  packageDir: string,
  config: CliConfigYaml,
): Promise<void> {
  const filePath = path.join(packageDir, CLI_CONFIG_FILE);
  await fs.writeFile(filePath, stringifyYaml(config), "utf8");
}

export function configToEmitOptions(
  config: CliConfigYaml,
  packageVersion?: string,
): EmitCliModulesOptions {
  return {
    bin: config.bin,
    packageName: config.package,
    packageVersion,
    transport: config.transport,
    selection: config.selection,
    pagination: config.pagination,
    include: config.include,
    exclude: config.exclude,
    commands: config.commands,
    guard: config.guard,
    output: config.output,
    man: config.man,
  };
}
