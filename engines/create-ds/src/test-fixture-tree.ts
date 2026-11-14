import fs from "node:fs/promises";
import path from "node:path";

export async function listRelativeFiles(
  root: string,
  options?: { exclude?: (rel: string) => boolean },
): Promise<string[]> {
  const out: string[] = [];

  async function walk(dir: string, prefix: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (options?.exclude?.(rel)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, rel);
      } else if (entry.isFile()) {
        out.push(rel);
      }
    }
  }

  await walk(root, "");
  return out.sort((a, b) => a.localeCompare(b));
}