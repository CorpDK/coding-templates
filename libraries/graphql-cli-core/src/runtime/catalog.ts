import { toJSONSchema } from "zod";
import type { ArgDescriptor, CommandDescriptor } from "../codegen/types.js";
import { displayFlag } from "./arg-meta.js";
import type { SdkValidationBindings } from "./types.js";

export type Catalog = Record<string, CommandDescriptor>;

function sortedCommands(catalog: Catalog): CommandDescriptor[] {
  return Object.values(catalog).sort((a, b) =>
    a.command.localeCompare(b.command),
  );
}

function commandLineSuffix(description: string | undefined): string {
  return description ? `  ${description}` : "";
}

/** `<bin> commands --json`: the machine-readable command list (doc 14 §4.8). */
export function commandsJson(catalog: Catalog): unknown[] {
  return sortedCommands(catalog).map((cmd) => ({
    command: cmd.command,
    kind: cmd.kind,
    field: cmd.field,
    description: cmd.description,
    deprecated: cmd.deprecated,
    destructive: cmd.destructive,
    paginated: cmd.paginated,
    args: cmd.args.map((arg) => ({
      flag: displayFlag(arg),
      graphqlType: arg.graphqlType,
      required: arg.required,
      enumValues: arg.enumValues,
    })),
  }));
}

/** JSON Schema (draft 2020-12) for an input-object argument, from the SDK's L3 schema. */
function inputJsonSchema(
  arg: ArgDescriptor,
  validation: SdkValidationBindings,
): unknown {
  if (arg.kind !== "input" || !arg.inputZodSchemaName) return undefined;
  const schema = validation.inputZodSchemas[arg.inputZodSchemaName];
  if (!schema) return undefined;
  const element = toJSONSchema(schema, {
    target: "draft-2020-12",
    io: "input",
    unrepresentable: "any",
  });
  return arg.list ? { type: "array", items: element } : element;
}

/**
 * `<bin> describe <cmd> --json`: the descriptor (without the selection tree),
 * its follow-up commands, and a JSON Schema for every input-object argument.
 */
export function describeJson(
  cmd: CommandDescriptor,
  validation: SdkValidationBindings,
): unknown {
  const { selection: _selection, args, ...rest } = cmd;
  return {
    ...rest,
    args: args.map((arg) => {
      const jsonSchema = inputJsonSchema(arg, validation);
      return {
        ...arg,
        flag: displayFlag(arg),
        ...(jsonSchema === undefined ? {} : { jsonSchema }),
      };
    }),
  };
}

function flagUsage(arg: ArgDescriptor): string {
  const flag = `${displayFlag(arg)} <${arg.graphqlType}>`;
  return arg.required ? flag : `[${flag}]`;
}

const GLOBAL_FLAG_HELP = [
  "--vars-file <path>   read variables from a JSON file",
  "--endpoint <url>     override the endpoint environment variable",
  "--timeout-ms <n>     HTTP timeout; stops subscriptions and --all walks (exit 0)",
  "--max-events <n>     subscriptions: stop after N events",
  "--all                paginated queries: fetch every page as NDJSON",
  "--max-pages <n>      with --all: stop after N pages",
  "--confirm            required for destructive mutations",
  "--interactive        prompt for the command (TTY only)",
  "--pretty             indent JSON output",
  "--raw                print the full GraphQL response",
  "-h, --help           show help",
];

export function globalHelp(bin: string, catalog: Catalog): string {
  const lines = [
    `Usage: ${bin} <command> [flags]`,
    "",
    "Meta commands:",
    "  commands [--json]        list commands",
    "  describe <cmd> [--json]  describe one command",
    "  interactive              prompt for a command (TTY only)",
    "  help, version",
    "",
  ];
  for (const kind of ["query", "mutation", "subscription"] as const) {
    const group = sortedCommands(catalog).filter((cmd) => cmd.kind === kind);
    if (group.length === 0) continue;
    lines.push(`${kind[0]!.toUpperCase()}${kind.slice(1)}s:`);
    for (const cmd of group) {
      lines.push(`  ${cmd.command}${commandLineSuffix(cmd.description)}`);
    }
    lines.push("");
  }
  lines.push("Global flags:", ...GLOBAL_FLAG_HELP.map((line) => `  ${line}`));
  return `${lines.join("\n")}\n`;
}

export function commandHelp(bin: string, cmd: CommandDescriptor): string {
  const lines = [
    `Usage: ${bin} ${cmd.command} ${cmd.args.map(flagUsage).join(" ")}`.trimEnd(),
  ];
  if (cmd.description) lines.push("", cmd.description);
  if (cmd.deprecated) lines.push("", `Deprecated: ${cmd.deprecated}`);
  if (cmd.destructive) lines.push("", "Destructive: requires --confirm.");
  if (cmd.args.length > 0) {
    lines.push("", "Arguments:");
    for (const arg of cmd.args) {
      const values = arg.enumValues ? ` (${arg.enumValues.join(" | ")})` : "";
      const head = `  ${displayFlag(arg)} <${arg.graphqlType}>${values}`;
      lines.push(`${head}${commandLineSuffix(arg.description)}`);
    }
  }
  lines.push(
    "",
    "Global flags:",
    ...GLOBAL_FLAG_HELP.map((line) => `  ${line}`),
  );
  return `${lines.join("\n")}\n`;
}

export function commandsText(catalog: Catalog): string {
  return `${sortedCommands(catalog)
    .map((cmd) => `${cmd.kind.padEnd(12)}${cmd.command}`)
    .join("\n")}\n`;
}
