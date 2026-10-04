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
    const tableJsdoc = extractTrailingBlockComment(preface);
    if (tableJsdoc) {
      tableComments.set(exportName, tableJsdoc);
    }
    const blockStart = tableMatch.index;
    const blockEnd = findMatchingBrace(source, source.indexOf("{", blockStart));
    const block = source.slice(blockStart, blockEnd);
    columnComments.set(exportName, new Map());

    const tableCommentMatch = /comment\s*\(\s*['"]([^'"]+)['"]\s*\)/.exec(block);
    if (tableCommentMatch) {
      tableComments.set(exportName, tableCommentMatch[1]!);
    }

    parseColumnBlockComments(block, columnComments.get(exportName)!);
  }

  return { tableComments, columnComments };
}

function extractTrailingBlockComment(text: string): string | undefined {
  const close = text.lastIndexOf("*/");
  if (close < 0) return undefined;
  const open = text.lastIndexOf("/**", close);
  if (open < 0) return undefined;
  const body = text
    .slice(open + 3, close)
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trim())
    .join(" ")
    .trim();
  return body || undefined;
}

function parseColumnBlockComments(block: string, out: Map<string, string>): void {
  const lines = block.split("\n");
  let lineIndex = 0;
  while (lineIndex < lines.length) {
    const line = lines[lineIndex]!;
    if (line.includes("/**")) {
      lineIndex = parseLeadingColumnComment(lines, lineIndex, out);
      continue;
    }
    const inline = parseInlineColumnComment(line);
    if (inline) out.set(inline[0], inline[1]);
    lineIndex += 1;
  }
}

function parseLeadingColumnComment(
  lines: string[],
  start: number,
  out: Map<string, string>,
): number {
  const commentLines: string[] = [];
  let lineIndex = start;
  while (lineIndex < lines.length) {
    const current = lines[lineIndex]!;
    if (current.includes("/**")) {
      commentLines.push(stripBlockCommentStart(current));
      if (current.includes("*/")) break;
    } else if (current.includes("*/")) {
      commentLines.push(stripBlockCommentEnd(current));
      break;
    } else {
      commentLines.push(current.replace(/^\s*\*\s?/, ""));
    }
    lineIndex += 1;
  }
  const nextLine = lines[lineIndex + 1];
  if (nextLine) {
    const colMatch = /^\s*(\w+)\s*:/.exec(nextLine);
    if (colMatch) {
      const text = commentLines.join(" ").trim();
      if (text) out.set(colMatch[1]!, text);
    }
  }
  return lineIndex + 1;
}

function stripBlockCommentStart(line: string): string {
  const start = line.indexOf("/**");
  const end = line.indexOf("*/", start + 3);
  if (end >= 0) return line.slice(start + 3, end).trim();
  return line.slice(start + 3).trim();
}

function stripBlockCommentEnd(line: string): string {
  const end = line.indexOf("*/");
  return line.slice(0, end).replace(/^\s*\*\s?/, "").trim();
}

function parseInlineColumnComment(line: string): [string, string] | null {
  const commentIdx = line.indexOf(".comment(");
  if (commentIdx < 0) return null;
  const nameMatch = /^(\w+)\s*:/.exec(line);
  if (!nameMatch) return null;
  const valueMatch = /\.comment\s*\(\s*['"]([^'"]+)['"]\s*\)/.exec(line.slice(commentIdx));
  if (!valueMatch) return null;
  return [nameMatch[1]!, valueMatch[1]!];
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
