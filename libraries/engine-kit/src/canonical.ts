import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { copyDir, pathExists } from "./fs.js";

export type CanonicalSyncOptions = {
  from: string;
  to: string;
  exclude?: string[];
};

const DEFAULT_EXCLUDE = [
  "node_modules",
  "dist",
  ".turbo",
  ".next",
  "drizzle",
  "src/generated",
] as const;

export async function syncCanonical(
  options: CanonicalSyncOptions,
): Promise<void> {
  const exclude = options.exclude ?? [...DEFAULT_EXCLUDE];
  await fs.rm(options.to, { recursive: true, force: true });
  await copyDir(options.from, options.to, {
    exclude,
    requireSource: true,
  });
}

export type CanonicalCheckOptions = {
  from: string;
  to: string;
  exclude?: string[];
};

export type CanonicalCheckResult = {
  ok: boolean;
  mismatches: string[];
};

async function fileSha256(filePath: string): Promise<string> {
  const buf = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function walkFiles(
  root: string,
  relPrefix: string,
  exclude: Set<string>,
): Promise<string[]> {
  const abs = relPrefix ? path.join(root, relPrefix) : root;
  if (!(await pathExists(abs))) return [];
  const entries = await fs.readdir(abs, { withFileTypes: true });
  const childLists = await Promise.all(
    entries.map(async (entry) => {
      const rel = relPrefix ? path.join(relPrefix, entry.name) : entry.name;
      const segments = rel.split(path.sep);
      if (segments.some((seg) => exclude.has(seg))) {
        return [] as string[];
      }

      if (entry.isDirectory()) {
        return walkFiles(root, rel, exclude);
      }
      if (entry.isFile()) {
        return [rel];
      }
      return [] as string[];
    }),
  );

  return childLists.flat();
}

export async function checkCanonical(
  options: CanonicalCheckOptions,
): Promise<CanonicalCheckResult> {
  const exclude = new Set(options.exclude ?? [...DEFAULT_EXCLUDE]);
  const fromFiles = await walkFiles(options.from, "", exclude);
  const toFiles = await walkFiles(options.to, "", exclude);
  const allRels = new Set([...fromFiles, ...toFiles]);

  const mismatches: string[] = [];

  const sortedRels = [...allRels].sort((a, b) => a.localeCompare(b));
  const compareResults = await Promise.all(
    sortedRels.map(async (rel) => {
      const fromPath = path.join(options.from, rel);
      const toPath = path.join(options.to, rel);
      const [fromOk, toOk] = await Promise.all([
        pathExists(fromPath),
        pathExists(toPath),
      ]);

      if (!fromOk) return `extra in to: ${rel}`;
      if (!toOk) return `missing in to: ${rel}`;

      const [fromHash, toHash] = await Promise.all([
        fileSha256(fromPath),
        fileSha256(toPath),
      ]);
      if (fromHash !== toHash) {
        return `content differs: ${rel}`;
      }
      return null;
    }),
  );
  for (const row of compareResults) {
    if (row) mismatches.push(row);
  }

  return { ok: mismatches.length === 0, mismatches };
}
