#!/usr/bin/env node
/**
 * R-42: fail on forbidden @corpdk/* workspace specifiers in src (see doc 13 §11).
 * AST visit: import/export declarations, import(), require(), import = require().
 * Template-literal emitted SDK source inside .ts files is not scanned.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const srcRoot = join(fileURLToPath(new URL(".", import.meta.url)), "../src");
const WORKSPACE_PREFIX = "@corpdk/";
const ALLOWED_PKG = "graphql-dsl";

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

function isForbiddenWorkspaceSpecifier(spec) {
  if (!spec.startsWith(WORKSPACE_PREFIX)) return false;
  const pkg = spec.slice(WORKSPACE_PREFIX.length).split("/")[0];
  return pkg !== ALLOWED_PKG;
}

function stringLiteralArg(node) {
  return ts.isStringLiteral(node) ? node.text : null;
}

function collectForbiddenSpecs(source, fileName) {
  const sf = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const specs = [];

  function record(spec) {
    if (spec && isForbiddenWorkspaceSpecifier(spec)) specs.push(spec);
  }

  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      record(moduleSpecifierText(node));
    } else if (ts.isExportDeclaration(node)) {
      record(moduleSpecifierText(node));
    } else if (ts.isImportEqualsDeclaration(node) && node.moduleReference) {
      const ref = node.moduleReference;
      if (ts.isExternalModuleReference(ref)) {
        record(stringLiteralArg(ref.expression));
      }
    } else if (ts.isCallExpression(node)) {
      if (
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length === 1
      ) {
        record(stringLiteralArg(node.arguments[0]));
      } else if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === "require" &&
        node.arguments.length === 1
      ) {
        record(stringLiteralArg(node.arguments[0]));
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return specs;
}

function moduleSpecifierText(node) {
  const spec = node.moduleSpecifier;
  return spec && ts.isStringLiteral(spec) ? spec.text : null;
}

let failed = false;
for (const file of walk(srcRoot)) {
  const rel = file.slice(srcRoot.length + 1);
  const source = readFileSync(file, "utf8");
  for (const spec of collectForbiddenSpecs(source, rel)) {
    console.error(
      `Forbidden workspace import ${spec} in libraries/graphql-dsl/src/${rel}`,
    );
    failed = true;
  }
}

if (failed) process.exit(1);
console.log(
  "graphql-dsl self-containment: no forbidden @corpdk/* imports in src",
);
