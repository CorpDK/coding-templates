import { parseArgs as nodeParseArgs } from "node:util";
import {
  EXIT_SUCCESS,
  EXIT_TOOL,
  EXIT_USAGE,
  type EngineResult,
} from "./types.js";

export type EngineCommandHandler = (
  positional: string[],
  values: Record<string, string | boolean | undefined>,
) => Promise<EngineResult>;

export type EngineCommandDef = {
  name: string;
  handler: EngineCommandHandler;
};

export type DefineEngineCliOptions = {
  name: string;
  version: string;
  help: string;
  commands: EngineCommandDef[];
  argv?: string[];
};

export type ParsedEngineCli =
  | { kind: "help"; exitCode: typeof EXIT_SUCCESS }
  | { kind: "usage"; exitCode: typeof EXIT_USAGE; message: string }
  | {
      kind: "run";
      command: EngineCommandDef;
      positional: string[];
      values: Record<string, string | boolean | undefined>;
    };

const GLOBAL_OPTIONS = {
  help: { type: "boolean", short: "h" },
  version: { type: "boolean" },
} as const;

export function parseEngineCli(
  options: DefineEngineCliOptions,
): ParsedEngineCli {
  const argv = options.argv ?? process.argv;
  const args = argv.slice(2);

  if (args.length === 0) {
    return {
      kind: "usage",
      exitCode: EXIT_USAGE,
      message: `Missing command. Run ${options.name} --help.`,
    };
  }

  const first = args[0];
  if (first === "--help" || first === "-h") {
    return { kind: "help", exitCode: EXIT_SUCCESS };
  }
  if (first === "--version") {
    console.log(options.version);
    return { kind: "help", exitCode: EXIT_SUCCESS };
  }

  const command = options.commands.find((c) => c.name === first);
  if (!command) {
    return {
      kind: "usage",
      exitCode: EXIT_USAGE,
      message: `Unknown command: ${first}`,
    };
  }

  const rest = args.slice(1);
  const positional: string[] = [];
  const tokens: string[] = [];

  for (const token of rest) {
    if (token.startsWith("-")) {
      tokens.push(token);
    } else if (positional.length === 0) {
      positional.push(token);
    } else {
      tokens.push(token);
    }
  }

  try {
    const { values, positionals } = nodeParseArgs({
      args: tokens,
      options: GLOBAL_OPTIONS,
      strict: true,
      allowPositionals: true,
    });
    if (values.help) {
      return { kind: "help", exitCode: EXIT_SUCCESS };
    }
    if (values.version) {
      console.log(options.version);
      return { kind: "help", exitCode: EXIT_SUCCESS };
    }
    return {
      kind: "run",
      command,
      positional: [...positional, ...positionals],
      values: values as Record<string, string | boolean | undefined>,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { kind: "usage", exitCode: EXIT_USAGE, message };
  }
}

export async function runEngineCli(
  options: DefineEngineCliOptions,
  hooks?: {
    onHelp?: () => void;
    onResult?: (result: EngineResult) => void;
  },
): Promise<number> {
  const parsed = parseEngineCli(options);

  if (parsed.kind === "help") {
    hooks?.onHelp?.() ?? console.log(options.help);
    return parsed.exitCode;
  }
  if (parsed.kind === "usage") {
    console.error(parsed.message);
    console.error(options.help);
    return parsed.exitCode;
  }

  try {
    const result = await parsed.command.handler(
      parsed.positional,
      parsed.values,
    );
    hooks?.onResult?.(result);
    if (result.nextSteps?.length) {
      console.log(
        "\nNext steps:\n" + result.nextSteps.map((s) => `  ${s}`).join("\n"),
      );
    }
    return result.exitCode;
  } catch (err: unknown) {
    console.error(err instanceof Error ? err.message : err);
    return EXIT_TOOL;
  }
}
