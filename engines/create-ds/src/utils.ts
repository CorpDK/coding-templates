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

const COPY_EXCLUDE_SEGMENTS = new Set([
  "node_modules",
  ".turbo",
  "dist",
  ".next",
  "generated",
  "drizzle",
  "src",
]);

const COPY_EXCLUDE_GLOB = ["*.tsbuildinfo", ".env"];

function matchGlob(pattern: string, name: string): boolean {
  if (pattern.startsWith("*")) return name.endsWith(pattern.slice(1));
  if (pattern.endsWith("*")) return name.startsWith(pattern.slice(0, -1));
  return name === pattern;
}

function isExcluded(relPath: string, extraExclude: string[]): boolean {
  const segments = relPath.split(path.sep);
  const allSegments = new Set([...COPY_EXCLUDE_SEGMENTS, ...extraExclude]);
  for (const seg of segments) {
    if (allSegments.has(seg)) return true;
    for (const pattern of COPY_EXCLUDE_GLOB) {
      if (matchGlob(pattern, seg)) return true;
    }
  }
  return false;
}

export async function copyDir(
  src: string,
  dest: string,
  options: {
    extraExclude?: string[];
    transform?: (content: string, relPath: string) => string;
    skipIfExists?: boolean;
  } = {},
): Promise<void> {
  const { extraExclude = [], transform, skipIfExists = false } = options;
  if (!(await pathExists(src))) return;
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const relPath = entry.name;
    if (isExcluded(relPath, extraExclude)) continue;

    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath, relPath, {
        extraExclude,
        transform,
        skipIfExists,
      });
    } else if (entry.isFile()) {
      if (skipIfExists && (await pathExists(destPath))) continue;
      const raw = await fs.readFile(srcPath, "utf8");
      const content = transform ? transform(raw, relPath) : raw;
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.writeFile(destPath, content, "utf8");
    }
  }
}

async function copyDirRecursive(
  src: string,
  dest: string,
  relPrefix: string,
  options: {
    extraExclude: string[];
    transform?: (content: string, relPath: string) => string;
    skipIfExists: boolean;
  },
): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const relPath = path.join(relPrefix, entry.name);
    if (isExcluded(relPath, options.extraExclude)) continue;

    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath, relPath, options);
    } else if (entry.isFile()) {
      if (options.skipIfExists && (await pathExists(destPath))) continue;
      const raw = await fs.readFile(srcPath, "utf8");
      const content = options.transform
        ? options.transform(raw, relPath)
        : raw;
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.writeFile(destPath, content, "utf8");
    }
  }
}
