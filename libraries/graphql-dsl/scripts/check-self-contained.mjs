#!/usr/bin/env node
/**
 * R-42: fail on real TypeScript imports from other @corpdk/* workspace packages.
 * Emitted template strings may mention @corpdk/graphql-dsl; only line-start imports count.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const srcRoot = join(fileURLToPath(new URL(".", import.meta.url)), "../src");
const IMPORT_LINE =
  /^\s*import\s+(?:type\s+)?(?:[^"';\n]+)\s+from\s+["']@corpdk\/([^"']+)["']/gm;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) out.push(...walk(path));
    else if (name.endsWith(".ts")) out.push(path);
  }
  return out;
}

let failed = false;
for (const file of walk(srcRoot)) {
  const rel = file.slice(srcRoot.length + 1);
  const source = readFileSync(file, "utf8");
  IMPORT_LINE.lastIndex = 0;
  let match;
  while ((match = IMPORT_LINE.exec(source)) !== null) {
    const pkg = match[1];
    console.error(
      `Forbidden @corpdk/${pkg} import in libraries/graphql-dsl/src/${rel}`,
    );
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("graphql-dsl self-containment: no workspace @corpdk/* imports in src");