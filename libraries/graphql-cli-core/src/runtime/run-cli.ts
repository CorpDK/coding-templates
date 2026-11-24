import { toGraphqlRequestError } from "@corpdk/graphql-dsl";
import type { CommandDescriptor } from "../codegen/types.js";
import {
  commandHelp,
  commandsJson,
  commandsText,
  describeJson,
  globalHelp,
} from "./catalog.js";
import {
  reportRequestError,
  reportUsageError,
  UsageError,
  writeCliError,
} from "./errors.js";
import { EXIT_OK, EXIT_VALIDATION } from "./exit-codes.js";
import { executeCommand } from "./execute.js";
import { defaultGlobals, parseFlags } from "./flags.js";
import { assertConfirmed } from "./guard.js";
import { resolveEndpoint } from "./headers.js";
import { runInteractive } from "./interactive.js";
import { writeJson } from "./output.js";
import { createTransport } from "./transport.js";
import type {
  ArgVariables,
  GlobalFlags,
  PromptsModule,
  RunCliOptions,
  RuntimeIo,
} from "./types.js";
import { validateVariables } from "./validate.js";
import { collectVariables } from "./variables.js";

const DEFAULT_TIMEOUT_MS = 30_000;

function resolveIo(options: RunCliOptions): RuntimeIo {
  return {
    env: options.env ?? process.env,
    fetchImpl: options.fetchImpl ?? fetch,
    stdin: options.stdin ?? process.stdin,
    stdout: options.stdout ?? process.stdout,
    stderr: options.stderr ?? process.stderr,
    isTTY: options.isTTY ?? {
      stdin: process.stdin.isTTY === true,
      stdout: process.stdout.isTTY === true,
    },
  };
}

/** Interactive mode needs both streams on a TTY and no `CI` (doc 14 §5). */
function canPrompt(io: RuntimeIo): boolean {
  return io.isTTY.stdin && io.isTTY.stdout && !io.env.CI;
}

function reportFailure(thrown: unknown, io: RuntimeIo): number {
  if (thrown instanceof UsageError) {
    return reportUsageError(io.stderr, thrown.message);
  }
  return reportRequestError(io.stderr, toGraphqlRequestError(thrown), (t) => t);
}

/** Sends already-validated variables through the shared transport. */
async function send(
  options: RunCliOptions,
  io: RuntimeIo,
  op: CommandDescriptor,
  variables: ArgVariables,
  globals: GlobalFlags,
): Promise<number> {
  const { config } = options;
  const endpoint = resolveEndpoint(config, io.env, globals.endpoint);
  if (!endpoint) {
    throw new UsageError(
      `No GraphQL endpoint: set ${config.transport.httpUrlEnv} or pass --endpoint`,
    );
  }
  const transport = createTransport({
    config,
    env: io.env,
    endpoint,
    fetchImpl: io.fetchImpl,
    timeoutMs:
      globals.timeoutMs ?? config.transport.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    extensions: options.extensions,
  });
  return executeCommand(op, variables, {
    config,
    sdk: options.sdk,
    transport,
    streams: { stdout: io.stdout, stderr: io.stderr },
    globals,
  });
}

async function startInteractive(
  options: RunCliOptions,
  io: RuntimeIo,
  globals: GlobalFlags,
  preset?: CommandDescriptor,
): Promise<number> {
  if (!canPrompt(io)) {
    return reportUsageError(
      io.stderr,
      "Interactive mode needs a TTY on stdin and stdout, and CI must be unset",
    );
  }
  const prompts: PromptsModule = await (
    options.loadPrompts ?? (() => import("@clack/prompts"))
  )();
  return runInteractive(
    {
      bin: options.config.bin,
      catalog: options.catalog,
      config: options.config,
      validation: options.sdk.validation,
      prompts,
      run: async (op, variables) => {
        try {
          return await send(options, io, op, variables, globals);
        } catch (error_) {
          return reportFailure(error_, io);
        }
      },
    },
    preset,
  );
}

async function runOperation(
  options: RunCliOptions,
  io: RuntimeIo,
  op: CommandDescriptor,
  args: readonly string[],
): Promise<number> {
  const parsed = parseFlags(op, args);
  const { globals } = parsed;

  if (globals.help) {
    io.stdout.write(commandHelp(options.config.bin, op));
    return EXIT_OK;
  }
  if (globals.version) {
    io.stdout.write(`${options.packageVersion ?? "unknown"}\n`);
    return EXIT_OK;
  }
  if (globals.interactive) return startInteractive(options, io, globals, op);

  assertConfirmed(op, options.config, globals.confirm);
  const variables = await collectVariables(op, parsed, {
    stdin: io.stdin,
    stdinIsTTY: io.isTTY.stdin,
  });

  const endpoint = resolveEndpoint(options.config, io.env, globals.endpoint);
  if (!endpoint) {
    throw new UsageError(
      `No GraphQL endpoint: set ${options.config.transport.httpUrlEnv} or pass --endpoint`,
    );
  }

  const checked = validateVariables(op.args, variables, options.sdk.validation);
  if (!checked.ok) {
    writeCliError(io.stderr, { error: "validation", issues: checked.issues });
    return EXIT_VALIDATION;
  }
  return send(options, io, op, checked.variables, globals);
}

function runCatalogCommand(
  options: RunCliOptions,
  io: RuntimeIo,
  args: readonly string[],
): number {
  const [name, ...rest] = args;
  const json = rest.includes("--json");
  const positionals = rest.filter(
    (arg) => arg !== "--json" && arg !== "--pretty",
  );
  const pretty = rest.includes("--pretty");

  if (name === "commands") {
    if (args.slice(1).some((arg) => !["--json", "--pretty"].includes(arg))) {
      throw new UsageError(`Unknown argument for commands: ${args[1]}`);
    }
    if (json) writeJson(io.stdout, commandsJson(options.catalog), pretty);
    else io.stdout.write(commandsText(options.catalog));
    return EXIT_OK;
  }

  const [target, ...extra] = positionals;
  if (!target) throw new UsageError(`${name} requires a command name`);
  if (extra.length > 0)
    throw new UsageError(`Unexpected argument: ${extra[0]}`);
  const op = options.catalog[target];
  if (!op) throw new UsageError(`Unknown command: ${target}`);
  if (name === "describe" && json) {
    writeJson(io.stdout, describeJson(op, options.sdk.validation), pretty);
  } else {
    io.stdout.write(commandHelp(options.config.bin, op));
  }
  return EXIT_OK;
}

async function dispatch(
  options: RunCliOptions,
  io: RuntimeIo,
  args: readonly string[],
): Promise<number> {
  const bin = options.config.bin;
  const [first, ...rest] = args;

  if (first === undefined) {
    if (canPrompt(io)) {
      return startInteractive(options, io, defaultGlobals());
    }
    io.stdout.write(globalHelp(bin, options.catalog));
    return EXIT_OK;
  }

  switch (first) {
    case "-h":
    case "--help":
      io.stdout.write(globalHelp(bin, options.catalog));
      return EXIT_OK;
    case "help": {
      const op = rest[0] ? options.catalog[rest[0]] : undefined;
      if (rest[0] && !op) throw new UsageError(`Unknown command: ${rest[0]}`);
      io.stdout.write(
        op ? commandHelp(bin, op) : globalHelp(bin, options.catalog),
      );
      return EXIT_OK;
    }
    case "version":
    case "--version":
      io.stdout.write(`${options.packageVersion ?? "unknown"}\n`);
      return EXIT_OK;
    case "commands":
    case "describe":
      return runCatalogCommand(options, io, args);
    case "interactive":
    case "--interactive":
      return startInteractive(options, io, defaultGlobals());
  }

  const op = options.catalog[first];
  if (!op) throw new UsageError(`Unknown command: ${first}`);
  return runOperation(options, io, op, rest);
}

/**
 * Runs a generated CLI (doc 14 §3.2). Returns the process exit code instead of
 * exiting, so bindings can `process.exitCode = await runCli(...)`.
 *
 * Exit codes: 0 ok, 1 GraphQL errors, 2 usage, 3 validation, 4 transport,
 * 5 mutation user errors. stderr is always one JSON object per line.
 */
export async function runCli(options: RunCliOptions): Promise<number> {
  const io = resolveIo(options);
  const args = (options.argv ?? process.argv).slice(2);
  try {
    return await dispatch(options, io, args);
  } catch (error_) {
    return reportFailure(error_, io);
  }
}
