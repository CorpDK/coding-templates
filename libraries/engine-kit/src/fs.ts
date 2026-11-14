import fs from "node:fs/promises";
import path from "node:path";

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

export type CopyDirOptions = {
  exclude?: string[];
  transform?: (content: string, relPath: string) => string;
  skipIfExists?: boolean;
  requireSource?: boolean;
};

function matchExcludePattern(pattern: string, name: string): boolean {
  if (pattern.startsWith("*")) return name.endsWith(pattern.slice(1));
  if (pattern.endsWith("*")) return name.startsWith(pattern.slice(0, -1));
  return name === pattern;
}

function segmentExcluded(
  relPath: string,
  exclude: Set<string>,
): boolean {
  const segments = relPath.split(path.sep);
  for (const seg of segments) {
    if (exclude.has(seg)) return true;
    for (const pattern of exclude) {
      if (pattern.includes("*") && matchExcludePattern(pattern, seg)) {
        return true;
      }
    }
  }
  return false;
}

export async function copyDir(
  src: string,
  dest: string,
  options: CopyDirOptions = {},
): Promise<void> {
  const {
    exclude = [],
    transform,
    skipIfExists = false,
    requireSource = true,
  } = options;
  const excludeSet = new Set(exclude);

  if (!(await pathExists(src))) {
    if (requireSource) {
      throw new Error(`Copy source not found: ${src}`);
    }
    return;
  }

  await fs.mkdir(dest, { recursive: true });
  await copyDirRecursive(src, dest, "", {
    excludeSet,
    transform,
    skipIfExists,
  });
}

async function copyDirRecursive(
  src: string,
  dest: string,
  relPrefix: string,
  options: {
    excludeSet: Set<string>;
    transform?: (content: string, relPath: string) => string;
    skipIfExists: boolean;
  },
): Promise<void> {
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const relPath = relPrefix ? path.join(relPrefix, entry.name) : entry.name;
    if (segmentExcluded(relPath, options.excludeSet)) continue;

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await fs.mkdir(destPath, { recursive: true });
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