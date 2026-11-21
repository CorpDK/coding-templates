import ts from "typescript";

export function exportedConstNames(source: string): string[] {
  const sf = ts.createSourceFile(
    "module.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const names: string[] = [];

  sf.forEachChild((node) => {
    if (
      !ts.isVariableStatement(node) ||
      !node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      return;
    }
    for (const decl of node.declarationList.declarations) {
      if (ts.isIdentifier(decl.name)) {
        names.push(decl.name.text);
      }
    }
  });

  return names;
}

export function workspaceValueImportsFrom(
  source: string,
  moduleSpecifier: string,
): string[] {
  const sf = ts.createSourceFile(
    "module.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const valueImports: string[] = [];

  sf.forEachChild((node) => {
    if (!ts.isImportDeclaration(node) || node.importClause?.isTypeOnly) {
      return;
    }
    const spec = node.moduleSpecifier;
    if (!ts.isStringLiteral(spec) || spec.text !== moduleSpecifier) {
      return;
    }
    const clause = node.importClause;
    if (!clause?.namedBindings || !ts.isNamedImports(clause.namedBindings)) {
      return;
    }
    for (const el of clause.namedBindings.elements) {
      valueImports.push(el.name.text);
    }
  });

  return valueImports;
}

export function connectionNodeShapesFromIndex(
  source: string,
): Record<string, "nodes" | "edges"> {
  const sf = ts.createSourceFile(
    "index.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  let shapes: Record<string, "nodes" | "edges"> | undefined;

  sf.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const decl of node.declarationList.declarations) {
      if (
        !ts.isIdentifier(decl.name) ||
        decl.name.text !== "connectionNodeShapes"
      ) {
        continue;
      }
      let init = decl.initializer;
      if (init && ts.isAsExpression(init)) {
        init = init.expression;
      }
      if (!init || !ts.isObjectLiteralExpression(init)) {
        continue;
      }
      const parsed: Record<string, "nodes" | "edges"> = {};
      for (const prop of init.properties) {
        if (!ts.isPropertyAssignment(prop)) {
          continue;
        }
        const fieldKey = ts.isIdentifier(prop.name)
          ? prop.name.text
          : ts.isStringLiteral(prop.name)
            ? prop.name.text
            : null;
        if (fieldKey === null) {
          continue;
        }
        const val = prop.initializer;
        if (
          ts.isStringLiteral(val) &&
          (val.text === "nodes" || val.text === "edges")
        ) {
          parsed[fieldKey] = val.text;
        }
      }
      shapes = parsed;
    }
  });

  if (!shapes) {
    throw new Error("connectionNodeShapes const not found in emitted index");
  }
  return shapes;
}
