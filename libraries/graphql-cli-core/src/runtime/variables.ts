import { readFileSync } from "node:fs";
import type { CommandDescriptor } from "../codegen/types.js";
import { displayFlag } from "./arg-meta.js";
import { coerceFlagValue } from "./coerce.js";
import { UsageError } from "./errors.js";
import type { ParsedFlags } from "./flags.js";
import type { ArgVariables, GlobalFlags } from "./types.js";

export interface VariableSources {
  stdin: NodeJS.ReadableStream;
  stdinIsTTY: boolean;
}

async function readAll(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseVariableObject(
  text: string,
  origin: string,
  op: CommandDescriptor,
): ArgVariables {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new UsageError(`Invalid JSON in ${origin}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new UsageError(`${origin} must contain a JSON object`);
  }
  const known = new Set(op.args.map((arg) => arg.name));
  const unknown = Object.keys(parsed).filter((key) => !known.has(key));
  if (unknown.length > 0) {
    throw new UsageError(
      `Unknown variable in ${origin}: ${unknown.join(", ")} (command ${op.command})`,
    );
  }
  return parsed as ArgVariables;
}

function readVarsFile(path: string, op: CommandDescriptor): ArgVariables {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new UsageError(`Cannot read --vars-file ${path}: ${reason}`);
  }
  return parseVariableObject(text, `--vars-file ${path}`, op);
}

async function readStdinVariables(
  op: CommandDescriptor,
  sources: VariableSources,
): Promise<ArgVariables> {
  if (sources.stdinIsTTY || op.args.length === 0) return {};
  const text = (await readAll(sources.stdin)).trim();
  return text === "" ? {} : parseVariableObject(text, "stdin", op);
}

function coerceFlagVariables(
  op: CommandDescriptor,
  parsed: ParsedFlags,
): ArgVariables {
  const variables: ArgVariables = {};
  for (const arg of op.args) {
    const raw = parsed.argValues[arg.name];
    if (raw !== undefined) variables[arg.name] = coerceFlagValue(raw, arg);
  }
  return variables;
}

/** Merges sources with the documented precedence `--vars-file` < stdin < flags. */
export function mergeVariables(
  fileVariables: ArgVariables,
  stdinVariables: ArgVariables,
  flagVariables: ArgVariables,
): ArgVariables {
  return { ...fileVariables, ...stdinVariables, ...flagVariables };
}

export function assertRequiredArguments(
  op: CommandDescriptor,
  variables: ArgVariables,
): void {
  for (const arg of op.args) {
    if (arg.required && variables[arg.name] === undefined) {
      throw new UsageError(`Missing required argument: ${displayFlag(arg)}`);
    }
  }
}

/** Rejects global-flag combinations that make no sense for the command. */
export function assertFlagCompatibility(
  op: CommandDescriptor,
  globals: GlobalFlags,
  variables: ArgVariables,
): void {
  if (globals.all && !op.paginated) {
    throw new UsageError(
      `--all is only valid for paginated connection commands, not ${op.command}`,
    );
  }
  if (globals.maxPages !== undefined && !globals.all) {
    throw new UsageError("--max-pages requires --all");
  }
  if (globals.maxEvents !== undefined && op.kind !== "subscription") {
    throw new UsageError("--max-events is only valid for subscriptions");
  }
  if (variables.first !== undefined && variables.last !== undefined) {
    throw new UsageError("--first and --last cannot be used together");
  }
}

/** Collects, coerces and merges variables from file, stdin and flags. */
export async function collectVariables(
  op: CommandDescriptor,
  parsed: ParsedFlags,
  sources: VariableSources,
): Promise<ArgVariables> {
  const fileVariables = parsed.globals.varsFile
    ? readVarsFile(parsed.globals.varsFile, op)
    : {};
  const stdinVariables = await readStdinVariables(op, sources);
  const flagVariables = coerceFlagVariables(op, parsed);
  const variables = mergeVariables(
    fileVariables,
    stdinVariables,
    flagVariables,
  );
  assertRequiredArguments(op, variables);
  assertFlagCompatibility(op, parsed.globals, variables);
  return variables;
}
