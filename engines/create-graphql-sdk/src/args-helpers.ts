import { parseArgs as nodeParseArgs } from "node:util";
import { EXIT_USAGE } from "@corpdk/engine-kit";
import type { ParsedCli } from "./args-types.js";

const INIT_OPTIONS = {
  name: { type: "string" },
  schema: { type: "string", multiple: true },
  "demo-schema": { type: "boolean" },
  "scalar-preset": { type: "string" },
  "defer-sync": { type: "boolean" },
  "dry-run": { type: "boolean" },
  "no-install": { type: "boolean" },
  help: { type: "boolean", short: "h" },
  version: { type: "boolean" },
} as const;

const SYNC_OPTIONS = {
  check: { type: "boolean" },
  "fail-on-breaking": { type: "boolean" },
  help: { type: "boolean", short: "h" },
  version: { type: "boolean" },
} as const;

const CODEGEN_OPTIONS = {
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
  values: Record<string, string | boolean | string[] | undefined>,
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

  const demoSchema = values["demo-schema"] === true;
  let name = typeof values.name === "string" ? values.name : "@corpdk/ds-sdk";
  if (!demoSchema && typeof values.name !== "string") {
    return {
      kind: "usage",
      message: "init requires --name unless --demo-schema is set",
    };
  }
  if (demoSchema && typeof values.name !== "string") {
    name = "@corpdk/ds-sdk";
  }

  const schema = Array.isArray(values.schema)
    ? values.schema
    : values.schema
      ? [values.schema]
      : [];

  const preset = values["scalar-preset"];
  if (typeof preset === "string" && preset !== "dal") {
    return { kind: "usage", message: `Unknown --scalar-preset: ${preset}` };
  }

  return {
    kind: "init",
    dir,
    name,
    schema,
    demoSchema,
    scalarPreset: preset === "dal" ? "dal" : undefined,
    deferSync: values["defer-sync"] === true,
    dryRun: values["dry-run"] === true,
    noInstall: values["no-install"] === true,
  };
}

export function parseSyncTokens(dir: string, tokens: string[]): ParsedCli {
  const { values } = nodeParseArgs({
    args: tokens,
    options: SYNC_OPTIONS,
    strict: true,
    allowPositionals: false,
  });
  const globalIntent = parseGlobalIntent(values);
  if (globalIntent) return globalIntent;
  return {
    kind: "sync",
    dir,
    check: values.check === true,
    failOnBreaking: values["fail-on-breaking"] === true,
  };
}

export function parseCodegenTokens(dir: string, tokens: string[]): ParsedCli {
  const { values } = nodeParseArgs({
    args: tokens,
    options: CODEGEN_OPTIONS,
    strict: true,
    allowPositionals: false,
  });
  const globalIntent = parseGlobalIntent(values);
  if (globalIntent) return globalIntent;
  return { kind: "codegen", dir };
}

export function parseGenerateTokens(dir: string, tokens: string[]): ParsedCli {
  const { values } = nodeParseArgs({
    args: tokens,
    options: SYNC_OPTIONS,
    strict: true,
    allowPositionals: false,
  });
  const globalIntent = parseGlobalIntent(values);
  if (globalIntent) return globalIntent;
  return {
    kind: "generate",
    dir,
    check: values.check === true,
    failOnBreaking: values["fail-on-breaking"] === true,
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
