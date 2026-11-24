import type { ArgDescriptor, CommandDescriptor } from "../codegen/types.js";
import { flagName, isBooleanArg, kebabToCamel } from "./arg-meta.js";
import { UsageError } from "./errors.js";
import type { GlobalFlags } from "./types.js";

/** Raw (uncoerced) flag value as it appeared on the command line. */
export type RawFlagValue = string | boolean | string[];

export interface ParsedFlags {
  globals: GlobalFlags;
  /** Raw argument values keyed by GraphQL argument name. */
  argValues: Record<string, RawFlagValue>;
}

type GlobalKey = keyof GlobalFlags;

interface GlobalSpec {
  target: "global";
  key: GlobalKey;
  boolean: boolean;
}

interface ArgSpec {
  target: "arg";
  arg: ArgDescriptor;
  boolean: boolean;
}

type FlagSpec = GlobalSpec | ArgSpec;

const GLOBAL_SPECS: Record<string, GlobalSpec> = {
  "vars-file": { target: "global", key: "varsFile", boolean: false },
  endpoint: { target: "global", key: "endpoint", boolean: false },
  "timeout-ms": { target: "global", key: "timeoutMs", boolean: false },
  "max-events": { target: "global", key: "maxEvents", boolean: false },
  all: { target: "global", key: "all", boolean: true },
  "max-pages": { target: "global", key: "maxPages", boolean: false },
  confirm: { target: "global", key: "confirm", boolean: true },
  interactive: { target: "global", key: "interactive", boolean: true },
  pretty: { target: "global", key: "pretty", boolean: true },
  raw: { target: "global", key: "raw", boolean: true },
  help: { target: "global", key: "help", boolean: true },
  version: { target: "global", key: "version", boolean: true },
};

export function defaultGlobals(): GlobalFlags {
  return {
    all: false,
    confirm: false,
    interactive: false,
    pretty: false,
    raw: false,
    help: false,
    version: false,
  };
}

export function parseBooleanText(text: string, label: string): boolean {
  const lower = text.toLowerCase();
  if (["true", "1", "yes"].includes(lower)) return true;
  if (["false", "0", "no"].includes(lower)) return false;
  throw new UsageError(`Invalid boolean for ${label}: ${text}`);
}

function parsePositiveInt(text: string, label: string): number {
  if (!/^\d+$/.test(text) || Number(text) < 1) {
    throw new UsageError(`${label} must be a positive integer`);
  }
  return Number(text);
}

function buildFlagTable(args: readonly ArgDescriptor[]): Map<string, FlagSpec> {
  const table = new Map<string, FlagSpec>(Object.entries(GLOBAL_SPECS));
  for (const arg of args) {
    const spec: ArgSpec = { target: "arg", arg, boolean: isBooleanArg(arg) };
    const kebab = flagName(arg);
    table.set(kebab, spec);
    const camel = kebabToCamel(kebab);
    if (camel !== kebab && !table.has(camel)) table.set(camel, spec);
    if (arg.name !== kebab && !table.has(arg.name)) table.set(arg.name, spec);
  }
  return table;
}

function resolveSpec(
  table: Map<string, FlagSpec>,
  name: string,
  hasInlineValue: boolean,
): { spec: FlagSpec; negated: boolean } {
  const direct = table.get(name);
  if (direct) return { spec: direct, negated: false };
  if (name.startsWith("no-") && !hasInlineValue) {
    const base = table.get(name.slice(3));
    if (base?.boolean && base.target === "arg") {
      return { spec: base, negated: true };
    }
  }
  throw new UsageError(`Unknown flag: --${name}`);
}

function applyGlobal(
  globals: GlobalFlags,
  spec: GlobalSpec,
  value: string | boolean,
  label: string,
): void {
  const text = String(value);
  switch (spec.key) {
    case "varsFile":
    case "endpoint":
      globals[spec.key] = text;
      break;
    case "timeoutMs":
    case "maxEvents":
    case "maxPages":
      globals[spec.key] = parsePositiveInt(text, label);
      break;
    default:
      globals[spec.key] =
        typeof value === "boolean" ? value : parseBooleanText(value, label);
  }
}

function applyArg(
  argValues: Record<string, RawFlagValue>,
  arg: ArgDescriptor,
  value: string | boolean,
): void {
  if (arg.list) {
    const existing = argValues[arg.name];
    argValues[arg.name] = [
      ...(Array.isArray(existing) ? existing : []),
      String(value),
    ];
    return;
  }
  argValues[arg.name] = value;
}

function readFlagValue(
  argv: readonly string[],
  name: string,
  inline: string | undefined,
  spec: FlagSpec,
  negated: boolean,
  index: number,
): { value: string | boolean; nextIndex: number } {
  if (negated) return { value: false, nextIndex: index };
  if (spec.boolean) return { value: inline ?? true, nextIndex: index };
  if (inline !== undefined) return { value: inline, nextIndex: index };
  const next = index + 1;
  if (next >= argv.length) {
    throw new UsageError(`Flag --${name} requires a value`);
  }
  return { value: argv[next]!, nextIndex: next };
}

function applyParsedFlag(
  globals: GlobalFlags,
  argValues: Record<string, RawFlagValue>,
  spec: FlagSpec,
  value: string | boolean,
  name: string,
): void {
  if (spec.target === "global") {
    applyGlobal(globals, spec, value, `--${name}`);
    return;
  }
  const boolValue =
    spec.boolean && typeof value === "string"
      ? parseBooleanText(value, `--${name}`)
      : value;
  applyArg(argValues, spec.arg, boolValue);
}

/**
 * Parses `argv` (everything after the command name) into global flags and raw
 * argument values. Supports `--flag value`, `--flag=value`, `--no-flag`,
 * repeatable list flags, and the camelCase alias of every argument flag.
 */
export function parseFlags(
  op: Pick<CommandDescriptor, "args">,
  argv: readonly string[],
): ParsedFlags {
  const table = buildFlagTable(op.args);
  const globals = defaultGlobals();
  const argValues: Record<string, RawFlagValue> = {};

  let index = 0;
  while (index < argv.length) {
    const token = argv[index]!;
    if (token === "-h") {
      globals.help = true;
      index += 1;
      continue;
    }
    if (!token.startsWith("--") || token === "--") {
      throw new UsageError(`Unexpected argument: ${token}`);
    }

    const body = token.slice(2);
    const eq = body.indexOf("=");
    const name = eq === -1 ? body : body.slice(0, eq);
    const inline = eq === -1 ? undefined : body.slice(eq + 1);
    const { spec, negated } = resolveSpec(table, name, inline !== undefined);
    const read = readFlagValue(argv, name, inline, spec, negated, index);
    applyParsedFlag(globals, argValues, spec, read.value, name);
    index = read.nextIndex === index ? index + 1 : read.nextIndex + 1;
  }

  return { globals, argValues };
}
