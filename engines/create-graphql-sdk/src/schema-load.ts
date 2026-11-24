import fs, { glob } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { pathExists } from "@corpdk/engine-kit";
import type { DocumentNode } from "graphql";
import type { SchemaSource } from "./sdk-config.js";

const GRAPHQL_EXTS = new Set([".graphql", ".graphqls"]);
const TYPEDEFS_EXTS = new Set([".ts", ".mts", ".js", ".mjs"]);

export type SdlUnit = { body: string; label: string };

export function inferSchemaKind(schemaPath: string): "typeDefs" | "graphqls" {
  const ext = path.extname(schemaPath).toLowerCase();
  if (TYPEDEFS_EXTS.has(ext)) return "typeDefs";
  return "graphqls";
}

function isExcluded(full: string, exclude: string[]): boolean {
  return exclude.some((ex) => full.includes(ex.replaceAll("**", "")));
}

function isGraphqlFile(filePath: string): boolean {
  return GRAPHQL_EXTS.has(path.extname(filePath).toLowerCase());
}

function globPatternForSource(
  raw: string,
  configDir: string,
  resolvedDir: string,
): string {
  return raw.includes("*") || raw.includes("?")
    ? path.resolve(configDir, raw)
    : path.join(resolvedDir, "**/*.{graphql,graphqls}");
}

async function matchedGraphqlPaths(
  pattern: string,
  exclude: string[],
): Promise<string[]> {
  const entries = await Array.fromAsync(glob(pattern), (entry) =>
    path.resolve(String(entry)),
  );
  return entries.filter(
    (full) => isGraphqlFile(full) && !isExcluded(full, exclude),
  );
}

async function graphqlFilesAtPath(
  raw: string,
  configDir: string,
  exclude: string[],
): Promise<string[]> {
  const resolved = path.resolve(configDir, raw);
  if (!(await pathExists(resolved))) {
    throw new Error(`Schema source not found: ${raw}`);
  }
  const stat = await fs.stat(resolved);
  if (stat.isFile()) {
    return isGraphqlFile(resolved) ? [resolved] : [];
  }
  const pattern = globPatternForSource(raw, configDir, resolved);
  return matchedGraphqlPaths(pattern, exclude);
}

async function expandGraphqlPaths(
  paths: string[],
  configDir: string,
  exclude: string[] = [],
): Promise<string[]> {
  const nested = await Promise.all(
    paths.map((raw) => graphqlFilesAtPath(raw, configDir, exclude)),
  );
  const list = [...new Set(nested.flat())].sort((a, b) => a.localeCompare(b));
  if (list.length === 0) {
    throw new Error("Schema source matched no GraphQL files");
  }
  return list;
}

function pushTypeDef(
  units: string[],
  value: unknown,
  print: (doc: DocumentNode) => string,
) {
  if (typeof value === "string") {
    units.push(value);
    return;
  }
  if (
    value &&
    typeof value === "object" &&
    "kind" in value &&
    (value as DocumentNode).kind === "Document"
  ) {
    units.push(print(value as DocumentNode));
  }
}

async function loadTypeDefsStrings(
  modulePath: string,
  configDir: string,
): Promise<string[]> {
  const resolved = path.resolve(configDir, modulePath);
  if (!(await pathExists(resolved))) {
    throw new Error(`typeDefs module not found: ${modulePath}`);
  }
  console.error(`Loading typeDefs: ${resolved}`);
  const { print } = await import("graphql");
  const mod = (await import(pathToFileURL(resolved).href)) as {
    typeDefs?: unknown;
    default?: unknown;
  };
  const td = mod.typeDefs ?? mod.default;
  if (td == null) {
    throw new Error(`Module exports no typeDefs: ${resolved}`);
  }

  const units: string[] = [];
  if (Array.isArray(td)) {
    for (const part of td) pushTypeDef(units, part, print);
  } else {
    pushTypeDef(units, td, print);
  }
  if (units.length === 0) {
    throw new Error(`typeDefs export was empty: ${resolved}`);
  }
  return units;
}

async function unitsFromGraphqlsSource(
  source: Extract<SchemaSource, { kind: "graphqls" }>,
  configDir: string,
): Promise<SdlUnit[]> {
  const files = await expandGraphqlPaths(
    source.paths,
    configDir,
    source.exclude ?? [],
  );
  const bodies = await Promise.all(files.map((file) => fs.readFile(file, "utf8")));
  return files.map((file, index) => ({
    body: bodies[index]!,
    label: file,
  }));
}

async function unitsFromTypeDefsSource(
  source: Extract<SchemaSource, { kind: "typeDefs" }>,
  configDir: string,
): Promise<SdlUnit[]> {
  const strings = await loadTypeDefsStrings(source.path, configDir);
  const resolved = path.resolve(configDir, source.path);
  return strings.map((body, i) => ({
    body,
    label: `${resolved}#${i}`,
  }));
}

async function unitsForSource(
  source: SchemaSource,
  configDir: string,
): Promise<SdlUnit[]> {
  if (source.kind === "graphqls") {
    return unitsFromGraphqlsSource(source, configDir);
  }
  return unitsFromTypeDefsSource(source, configDir);
}

export async function collectSdlUnits(
  sources: SchemaSource[],
  configDir: string,
): Promise<SdlUnit[]> {
  const groups = await Promise.all(
    sources.map((source) => unitsForSource(source, configDir)),
  );
  return groups.flat();
}