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