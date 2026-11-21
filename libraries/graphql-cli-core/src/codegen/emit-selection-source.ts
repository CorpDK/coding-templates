import type { SelectionTree, SelectionValue } from "./types.js";

function serializeValue(
  key: string,
  value: SelectionValue,
  indent: number,
): string {
  const pad = "  ".repeat(indent);
  if (value === true) {
    return `${pad}${key}: true,`;
  }
  if (typeof value === "object" && value !== null) {
    const lines = [`${pad}${key}: {`];
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      lines.push(serializeValue(k, v as SelectionValue, indent + 1));
    }
    lines.push(`${pad}},`);
    return lines.join("\n");
  }
  return `${pad}${key}: true,`;
}

export function emitSelectionSource(
  exportName: string,
  selection: SelectionTree,
): string {
  const lines = [
    "// @generated — do not edit manually",
    "",
    `export const ${exportName} = {`,
  ];

  for (const [key, value] of Object.entries(selection)) {
    if (value === undefined) continue;
    lines.push(serializeValue(key, value as SelectionValue, 1));
  }

  lines.push("};", "");
  return lines.join("\n");
}

export function selectionExportName(command: string): string {
  const camel = command.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  return `${camel}Selection`;
}
