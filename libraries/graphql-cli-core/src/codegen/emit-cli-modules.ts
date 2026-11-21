import type { GraphQLSchema } from "graphql";
import type {
  EmitCliModulesOptions,
  EmitCliModulesResult,
  RuntimeConfig,
} from "./types.js";
import {
  buildCommandNameMap,
  buildLookupIndex,
  validateLookupConfig,
} from "./lookup-index.js";
import { extractOperations } from "./extract-operations.js";
import { emitCommandsModule, toCommandDescriptors } from "./emit-catalog.js";
import {
  emitSelectionSource,
  selectionExportName,
} from "./emit-selection-source.js";
import { emitMan } from "./emit-man.js";
import { emitTexi } from "./emit-texi.js";

const DEFAULT_DESTRUCTIVE = ["delete*", "bulkDelete*", "bulkUpdate*ByFilter"];

function buildRuntimeConfig(options: EmitCliModulesOptions): RuntimeConfig {
  return {
    bin: options.bin ?? "graphql-cli",
    packageName: options.packageName,
    transport: {
      httpUrlEnv: options.transport?.httpUrlEnv ?? "GRAPHQL_HTTP_URL",
      defaultUrl: options.transport?.defaultUrl,
      tokenEnv: options.transport?.tokenEnv ?? "GRAPHQL_TOKEN",
      headersEnv: options.transport?.headersEnv ?? "GRAPHQL_HEADERS_JSON",
      timeoutMs: options.transport?.timeoutMs ?? 30_000,
    },
    guard: {
      destructive: options.guard?.destructive ?? DEFAULT_DESTRUCTIVE,
    },
    output: {
      userErrorsFields: options.output?.userErrorsFields ?? ["userErrors"],
      failOnUserErrors: options.output?.failOnUserErrors ?? true,
    },
    pagination: {
      defaultPageSize: options.pagination?.defaultPageSize ?? 50,
    },
  };
}

export function emitCliModules(
  schema: GraphQLSchema,
  options: EmitCliModulesOptions = {},
): EmitCliModulesResult {
  const warnings: string[] = [];
  const selection = {
    policy: "relation-ids" as const,
    connection: options.selection?.connection ?? "nodes",
    maxWrapperDepth: options.selection?.maxWrapperDepth ?? 4,
    lookup: options.selection?.lookup ?? {},
    overrides: options.selection?.overrides ?? {},
  };

  validateLookupConfig(schema, selection.lookup);

  const commandNames = buildCommandNameMap(schema, warnings);
  const lookupIndex = buildLookupIndex(schema, commandNames, selection.lookup);

  const extracted = extractOperations(schema, lookupIndex, commandNames, {
    selection,
    include: options.include,
    exclude: options.exclude,
    guard: options.guard,
  });

  for (const op of extracted) {
    warnings.push(...op.warnings);
  }

  const warnAbove = options.commands?.warnAbove ?? 200;
  if (extracted.length > warnAbove) {
    warnings.push(
      `Generated ${extracted.length} commands, exceeding warnAbove threshold (${warnAbove})`,
    );
  }

  const commands = toCommandDescriptors(extracted);

  const selections: Record<string, string> = {};
  for (const cmd of commands) {
    const exportName = selectionExportName(cmd.command);
    selections[cmd.command] = emitSelectionSource(exportName, cmd.selection);
  }

  const runtimeConfig = buildRuntimeConfig(options);

  const result: EmitCliModulesResult = {
    commands,
    commandsSource: emitCommandsModule(commands),
    runtimeConfig,
    selections,
    warnings,
  };

  if (options.man?.enabled !== false) {
    result.man = emitMan(commands, {
      bin: runtimeConfig.bin,
      version: options.packageVersion,
      httpUrlEnv: runtimeConfig.transport.httpUrlEnv,
      defaultUrl: runtimeConfig.transport.defaultUrl,
    });
    result.texi = emitTexi(commands, {
      bin: runtimeConfig.bin,
      httpUrlEnv: runtimeConfig.transport.httpUrlEnv,
      defaultUrl: runtimeConfig.transport.defaultUrl,
    });
  }

  return result;
}
