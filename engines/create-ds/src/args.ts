import { CREATE_DS_HELP, type ParsedCli } from "./args-types.js";
import {
  missingCommandUsage,
  parseInitTokens,
  parseUpgradeTokens,
  resolveTargetDir,
} from "./args-helpers.js";

export { CREATE_DS_HELP, type ParsedCli } from "./args-types.js";

export function printHelp(): void {
  console.log(CREATE_DS_HELP);
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

  if (first !== "init" && first !== "upgrade") {
    return { kind: "usage", message: `Unknown command: ${first}` };
  }

  const { dir, tokens } = resolveTargetDir(args.slice(1));

  try {
    return first === "init"
      ? parseInitTokens(dir, tokens)
      : parseUpgradeTokens(dir, tokens);
  } catch (err: unknown) {
    return {
      kind: "usage",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
