import fs from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export { execAsync };

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function isDirEmpty(p: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(p);
    return entries.length === 0;
  } catch {
    return true;
  }
}

export async function readJson<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}

export async function writeJson(
  filePath: string,
  data: unknown,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".webp",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
  ".pdf",
  ".zip",
]);

export function isBinaryFile(filePath: string): boolean {
  return BINARY_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/** Patterns to exclude from copy (matched against filename or any path segment) */
const DEFAULT_EXCLUDE = [
  "node_modules",
  ".turbo",
  ".env",
  "dist",
  ".next",
  "generated",
];

const EXCLUDE_EXACT = new Set(DEFAULT_EXCLUDE);
const EXCLUDE_GLOB = ["*.tsbuildinfo", "resolvers.generated.ts"];

function isExcluded(relPath: string): boolean {
  const segments = relPath.split(path.sep);
  for (const seg of segments) {
    if (EXCLUDE_EXACT.has(seg)) return true;
    for (const pattern of EXCLUDE_GLOB) {
      if (matchGlob(pattern, seg)) return true;
    }
  }
  return false;
}

function matchGlob(pattern: string, name: string): boolean {
  if (pattern.startsWith("*")) {
    return name.endsWith(pattern.slice(1));
  }
  if (pattern.endsWith("*")) {
    return name.startsWith(pattern.slice(0, -1));
  }
  return name === pattern;
}

/**
 * Merge src into dest — copies only files that don't already exist in dest.
 * @param skipFiles - filenames to skip entirely (e.g. ".env.example.append")
 */
export async function mergeDir(
  src: string,
  dest: string,
  skipFiles: string[] = [],
): Promise<void> {
  if (!(await pathExists(src))) return;
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  const skipSet = new Set(skipFiles);

  for (const entry of entries) {
    if (skipSet.has(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await mergeDirRecursive(srcPath, destPath, skipSet);
    } else if (entry.isFile() && !(await pathExists(destPath))) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function mergeDirRecursive(
  src: string,
  dest: string,
  skipSet: Set<string>,
): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    if (skipSet.has(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await mergeDirRecursive(srcPath, destPath, skipSet);
    } else if (entry.isFile() && !(await pathExists(destPath))) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/** Append the contents of srcFile to destFile (creates destFile if it doesn't exist) */
export async function appendToFile(
  srcFile: string,
  destFile: string,
): Promise<void> {
  if (!(await pathExists(srcFile))) return;
  const content = await fs.readFile(srcFile, "utf8");
  await fs.appendFile(destFile, content, "utf8");
}

export async function copyDir(
  src: string,
  dest: string,
  transform?: (content: string, relPath: string) => string,
): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    const relPath = entry.name;

    if (isExcluded(relPath)) continue;

    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath, entry.name, transform);
    } else if (entry.isFile()) {
      await copyFile(srcPath, destPath, relPath, transform);
    }
  }
}

async function copyDirRecursive(
  src: string,
  dest: string,
  relBase: string,
  transform?: (content: string, relPath: string) => string,
): Promise<void> {
  if (isExcluded(relBase)) return;

  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    const relPath = path.join(relBase, entry.name);

    if (isExcluded(relPath)) continue;

    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath, relPath, transform);
    } else if (entry.isFile()) {
      await copyFile(srcPath, destPath, relPath, transform);
    }
  }
}

async function copyFile(
  src: string,
  dest: string,
  relPath: string,
  transform?: (content: string, relPath: string) => string,
): Promise<void> {
  if (isBinaryFile(src)) {
    await fs.copyFile(src, dest);
    return;
  }

  const content = await fs.readFile(src, "utf8");
  const transformed = transform ? transform(content, relPath) : content;
  await fs.writeFile(dest, transformed, "utf8");
}
