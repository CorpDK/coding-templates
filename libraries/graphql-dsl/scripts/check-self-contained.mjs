#!/usr/bin/env node
/**
 * R-42: fail on real TypeScript imports from other @corpdk/* workspace packages.
 * Emitted template strings may mention @corpdk/graphql-dsl; only AST import/export declarations count.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const srcRoot = join(fileURLToPath(new URL(".", import.meta.url)), "../src");
const WORKSPACE_PREFIX = "@corpdk/";

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

function moduleSpecifierText(node) {
  const spec = node.moduleSpecifier;
  return spec && ts.isStringLiteral(spec) ? spec.text : null;
}

function collectWorkspaceImports(source, fileName) {
  const sf = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const specs = [];

  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      const text = moduleSpecifierText(node);
      if (text?.startsWith(WORKSPACE_PREFIX)) specs.push(text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const text = moduleSpecifierText(node);
      if (text?.startsWith(WORKSPACE_PREFIX)) specs.push(text);
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return specs;
}

let failed = false;
for (const file of walk(srcRoot)) {
  const rel = file.slice(srcRoot.length + 1);
  const source = readFileSync(file, "utf8");
  for (const spec of collectWorkspaceImports(source, rel)) {
    const pkg = spec.slice(WORKSPACE_PREFIX.length);
    console.error(
      `Forbidden @corpdk/${pkg} import in libraries/graphql-dsl/src/${rel}`,
    );
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("graphql-dsl self-containment: no workspace @corpdk/* imports in src");