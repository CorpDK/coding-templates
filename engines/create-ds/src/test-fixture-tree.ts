import fs from "node:fs/promises";
import path from "node:path";

type WalkFrame = { dir: string; prefix: string };

async function expandWalkLevel(
  level: WalkFrame[],
  options: { exclude?: (rel: string) => boolean } | undefined,
  files: string[],
): Promise<WalkFrame[]> {
  const next: WalkFrame[] = [];

  await Promise.all(
    level.map(async (frame) => {
      const entries = await fs.readdir(frame.dir, { withFileTypes: true });
      for (const entry of entries) {
        const rel = frame.prefix ? `${frame.prefix}/${entry.name}` : entry.name;
        if (options?.exclude?.(rel)) continue;
        const full = path.join(frame.dir, entry.name);
        if (entry.isDirectory()) {
          next.push({ dir: full, prefix: rel });
        } else if (entry.isFile()) {
          files.push(rel);
        }
      }
    }),
  );

  return next;
}

export async function listRelativeFiles(
  root: string,
  options?: { exclude?: (rel: string) => boolean },
): Promise<string[]> {
  const out: string[] = [];
  let level: WalkFrame[] = [{ dir: root, prefix: "" }];

  while (level.length > 0) {
    level = await expandWalkLevel(level, options, out);
  }

  return out.sort((a, b) => a.localeCompare(b));
}