import fs from "node:fs/promises";
import path from "node:path";

type WalkFrame = { dir: string; prefix: string };

type WalkExpandResult = {
  next: WalkFrame[];
  files: string[];
};

async function expandWalkLevel(
  level: WalkFrame[],
  options: { exclude?: (rel: string) => boolean } | undefined,
): Promise<WalkExpandResult> {
  const parts = await Promise.all(
    level.map(async (frame) => {
      const frameNext: WalkFrame[] = [];
      const frameFiles: string[] = [];
      const entries = await fs.readdir(frame.dir, { withFileTypes: true });
      for (const entry of entries) {
        const rel = frame.prefix ? `${frame.prefix}/${entry.name}` : entry.name;
        if (options?.exclude?.(rel)) continue;
        const full = path.join(frame.dir, entry.name);
        if (entry.isDirectory()) {
          frameNext.push({ dir: full, prefix: rel });
        } else if (entry.isFile()) {
          frameFiles.push(rel);
        }
      }
      return { frameNext, frameFiles };
    }),
  );

  return {
    next: parts.flatMap((part) => part.frameNext),
    files: parts.flatMap((part) => part.frameFiles),
  };
}

async function walkAllLevels(
  level: WalkFrame[],
  options: { exclude?: (rel: string) => boolean } | undefined,
  out: string[],
): Promise<void> {
  if (level.length === 0) return;
  const expanded = await expandWalkLevel(level, options);
  out.push(...expanded.files);
  await walkAllLevels(expanded.next, options, out);
}

export async function listRelativeFiles(
  root: string,
  options?: { exclude?: (rel: string) => boolean },
): Promise<string[]> {
  const out: string[] = [];
  await walkAllLevels([{ dir: root, prefix: "" }], options, out);
  return out.sort((a, b) => a.localeCompare(b));
}