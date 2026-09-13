import { readFileSync } from "node:fs";

/** Extract table/column comments from Drizzle schema source (`.comment('…')` chains). */
export function parseCommentsFromSource(sourcePath: string): {
  tableComments: Map<string, string>;
  columnComments: Map<string, Map<string, string>>;
} {
  const source = readFileSync(sourcePath, "utf-8");
  const tableComments = new Map<string, string>();
  const columnComments = new Map<string, Map<string, string>>();

  const tableRe = /export\s+const\s+(\w+)\s*=\s*pgTable\s*\(\s*['"]([^'"]+)['"]/g;
  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = tableRe.exec(source)) !== null) {
    const exportName = tableMatch[1];
    const preface = source.slice(Math.max(0, tableMatch.index - 300), tableMatch.index);
    const tableJsdoc = preface.match(/\/\*\*\s*([^*]+?)\s*\*\/\s*$/);
    if (tableJsdoc) {
      tableComments.set(exportName, tableJsdoc[1].trim());
    }
    const blockStart = tableMatch.index;
    const blockEnd = findMatchingBrace(source, source.indexOf("{", blockStart));
    const block = source.slice(blockStart, blockEnd);
    columnComments.set(exportName, new Map());

    const tableCommentRe = /comment\s*\(\s*['"]([^'"]+)['"]\s*\)/;
    const tableCommentMatch = block.match(tableCommentRe);
    if (tableCommentMatch) {
      tableComments.set(exportName, tableCommentMatch[1]);
    }

    const jsdocColRe = /\/\*\*\s*([^*]+?)\s*\*\/\s*\n\s*(\w+)\s*:/g;
    let jsdocMatch: RegExpExecArray | null;
    while ((jsdocMatch = jsdocColRe.exec(block)) !== null) {
      columnComments.get(exportName)!.set(jsdocMatch[2], jsdocMatch[1].trim());
    }

    const inlineColRe = /(\w+)\s*:\s*[\w.]+\([^)]*\)[^,\n]*\.comment\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let colMatch: RegExpExecArray | null;
    while ((colMatch = inlineColRe.exec(block)) !== null) {
      columnComments.get(exportName)!.set(colMatch[1], colMatch[2]);
    }
  }

  return { tableComments, columnComments };
}

function findMatchingBrace(source: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return source.length;
}
