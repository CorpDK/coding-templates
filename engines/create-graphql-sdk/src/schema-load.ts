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

async function expandGraphqlPaths(
  paths: string[],
  configDir: string,
  exclude: string[] = [],
): Promise<string[]> {
  const found = new Set<string>();

  for (const raw of paths) {
    const resolved = path.resolve(configDir, raw);
    if (!(await pathExists(resolved))) {
      throw new Error(`Schema source not found: ${raw}`);
    }
    const stat = await fs.stat(resolved);
    if (stat.isFile()) {
      if (GRAPHQL_EXTS.has(path.extname(resolved).toLowerCase())) {
        found.add(resolved);
      }
      continue;
    }

    let pattern: string;
    if (raw.includes("*") || raw.includes("?")) {
      pattern = path.resolve(configDir, raw);
    } else {
      pattern = path.join(resolved, "**/*.{graphql,graphqls}");
    }

    for await (const entry of glob(pattern)) {
      const full = path.resolve(String(entry));
      if (!GRAPHQL_EXTS.has(path.extname(full).toLowerCase())) continue;
      const skip = exclude.some((ex) => {
        const norm = ex.replaceAll("**", "");
        return full.includes(norm);
      });
      if (skip) continue;
      found.add(full);
    }
  }

  const list = [...found].sort((a, b) => a.localeCompare(b));
  if (list.length === 0) {
    throw new Error("Schema source matched no GraphQL files");
  }
  return list;
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
  const push = (value: unknown) => {
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
  };

  if (Array.isArray(td)) {
    for (const part of td) push(part);
  } else {
    push(td);
  }
  if (units.length === 0) {
    throw new Error(`typeDefs export was empty: ${resolved}`);
  }
  return units;
}

export async function collectSdlUnits(
  sources: SchemaSource[],
  configDir: string,
): Promise<SdlUnit[]> {
  const units: SdlUnit[] = [];

  for (const source of sources) {
    if (source.kind === "graphqls") {
      const files = await expandGraphqlPaths(
        source.paths,
        configDir,
        source.exclude ?? [],
      );
      for (const file of files) {
        const body = await fs.readFile(file, "utf8");
        units.push({ body, label: file });
      }
      continue;
    }
    const strings = await loadTypeDefsStrings(source.path, configDir);
    for (let i = 0; i < strings.length; i++) {
      units.push({
        body: strings[i]!,
        label: `${path.resolve(configDir, source.path)}#${i}`,
      });
    }
  }

  return units;
}
