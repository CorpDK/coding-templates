import { CREATE_GRAPHQL_SDK_HELP, type ParsedCli } from "./args-types.js";
import {
  missingCommandUsage,
  parseCodegenTokens,
  parseGenerateTokens,
  parseInitTokens,
  parseSyncTokens,
  parseUpgradeTokens,
  resolveTargetDir,
} from "./args-helpers.js";

export { CREATE_GRAPHQL_SDK_HELP, type ParsedCli } from "./args-types.js";

export function printHelp(): void {
  console.log(CREATE_GRAPHQL_SDK_HELP);
}

export function parseCli(argv: string[]): ParsedCli {
  const args = argv.slice(2);

  if (args.length === 0) {
    return missingCommandUsage();
  }

  const first = args[0];
  if (first === "--help" || first === "-h") {
    return { kind: "help" };
  }
  if (first === "--version") {
    return { kind: "version" };
  }

  const commands = new Set([
    "init",
    "sync",
    "codegen",
    "generate",
    "upgrade",
  ]);
  if (!commands.has(first)) {
    return { kind: "usage", message: `Unknown command: ${first}` };
  }

  const { dir, tokens } = resolveTargetDir(args.slice(1));

  try {
    switch (first) {
      case "init":
        return parseInitTokens(dir, tokens);
      case "sync":
        return parseSyncTokens(dir, tokens);
      case "codegen":
        return parseCodegenTokens(dir, tokens);
      case "generate":
        return parseGenerateTokens(dir, tokens);
      default:
        return parseUpgradeTokens(dir, tokens);
    }
  } catch (err: unknown) {
    return {
      kind: "usage",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}