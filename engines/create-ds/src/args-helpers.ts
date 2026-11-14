import { parseArgs as nodeParseArgs } from "node:util";
import { EXIT_USAGE } from "@corpdk/engine-kit";
import type { ParsedCli } from "./args.js";

const INIT_OPTIONS = {
  name: { type: "string" },
  "demo-schema": { type: "boolean" },
  "dry-run": { type: "boolean" },
  "no-install": { type: "boolean" },
  help: { type: "boolean", short: "h" },
  version: { type: "boolean" },
} as const;

const UPGRADE_OPTIONS = {
  "dry-run": { type: "boolean" },
  help: { type: "boolean", short: "h" },
  version: { type: "boolean" },
} as const;

export function resolveTargetDir(rest: string[]): {
  dir: string;
  tokens: string[];
} {
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

  return { dir, tokens };
}

function parseGlobalIntent(
  values: Record<string, string | boolean | undefined>,
): ParsedCli | null {
  if (values.help) return { kind: "help" };
  if (values.version) return { kind: "version" };
  return null;
}

export function parseInitTokens(dir: string, tokens: string[]): ParsedCli {
  const { values } = nodeParseArgs({
    args: tokens,
    options: INIT_OPTIONS,
    strict: true,
    allowPositionals: false,
  });

  const globalIntent = parseGlobalIntent(values);
  if (globalIntent) return globalIntent;

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

export function parseUpgradeTokens(dir: string, tokens: string[]): ParsedCli {
  const { values } = nodeParseArgs({
    args: tokens,
    options: UPGRADE_OPTIONS,
    strict: true,
    allowPositionals: false,
  });

  const globalIntent = parseGlobalIntent(values);
  if (globalIntent) return globalIntent;

  return {
    kind: "upgrade",
    dir,
    dryRun: values["dry-run"] === true,
  };
}

export function missingCommandUsage(): ParsedCli {
  return {
    kind: "usage",
    message: `Missing command (exit ${EXIT_USAGE}).`,
  };
}
