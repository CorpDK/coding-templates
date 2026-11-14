import { parseArgs as nodeParseArgs } from "node:util";
import { EXIT_USAGE } from "@corpdk/engine-kit";

export const CREATE_DS_HELP = `@corpdk/create-ds — scaffold and upgrade DAL-automated DS packages

Usage:
  create-ds init [directory] [options]
  create-ds upgrade [directory] [options]

Commands:
  init      Scaffold a minimal DS package (Drizzle schema + dal.config + scripts)
  upgrade   Merge canonical template deltas; never overwrites src/db/schema/**

Options (init):
  --name <pkg>       npm package name (default: @corpdk/ds)
  --demo-schema      Copy full demo commerce schema + seed from canonical
  --dry-run          Print planned writes only
  --no-install       Omit pnpm install from printed next steps (init never installs)

Options (upgrade):
  --dry-run          Print planned writes only

Global:
  --version          Show create-ds version
  -h, --help         Show this help

Examples:
  create-ds init ./packages/my-ds --name @myorg/my-ds
  create-ds upgrade ./packages/my-ds
  create-ds upgrade   # upgrades current working directory
`;

export type ParsedCli =
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "usage"; message: string }
  | {
      kind: "init";
      dir: string;
      name: string;
      demoSchema: boolean;
      dryRun: boolean;
      noInstall: boolean;
    }
  | { kind: "upgrade"; dir: string; dryRun: boolean };

export function printHelp(): void {
  console.log(CREATE_DS_HELP);
}

export function parseCli(argv: string[]): ParsedCli {
  const args = argv.slice(2);

  if (args.length === 0) {
    return {
      kind: "usage",
      message: `Missing command (exit ${EXIT_USAGE}).`,
    };
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

  const rest = args.slice(1);
  let dir = process.cwd();
  const positionals: string[] = [];
  const tokens: string[] = [];

  for (const token of rest) {
    if (!token.startsWith("-") && positionals.length === 0) {
      positionals.push(token);
    } else {
      tokens.push(token);
    }
  }
  if (positionals[0]) {
    dir = positionals[0];
  }

  const initOptions = {
    name: { type: "string" },
    "demo-schema": { type: "boolean" },
    "dry-run": { type: "boolean" },
    "no-install": { type: "boolean" },
    help: { type: "boolean", short: "h" },
    version: { type: "boolean" },
  } as const;

  const upgradeOptions = {
    "dry-run": { type: "boolean" },
    help: { type: "boolean", short: "h" },
    version: { type: "boolean" },
  } as const;

  try {
    if (first === "init") {
      const { values } = nodeParseArgs({
        args: tokens,
        options: initOptions,
        strict: true,
        allowPositionals: false,
      });

      if (values.help) return { kind: "help" };
      if (values.version) return { kind: "version" };

      const name = values.name;
      if (typeof name === "string" && name.length === 0) {
        return { kind: "usage", message: "--name requires a value" };
      }
      return {
        kind: "init",
        dir,
        name: typeof name === "string" ? name : "@corpdk/ds",
        demoSchema: values["demo-schema"] === true,
        dryRun: values["dry-run"] === true,
        noInstall: values["no-install"] === true,
      };
    }

    const { values } = nodeParseArgs({
      args: tokens,
      options: upgradeOptions,
      strict: true,
      allowPositionals: false,
    });

    if (values.help) return { kind: "help" };
    if (values.version) return { kind: "version" };

    return {
      kind: "upgrade",
      dir,
      dryRun: values["dry-run"] === true,
    };
  } catch (err: unknown) {
    return {
      kind: "usage",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
