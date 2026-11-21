import {
  type GraphQLOutputType,
  getNamedType,
  isEnumType,
  isScalarType,
} from "graphql";
import type { ArgDescriptor, OperationKind, SelectionTree } from "./types.js";

function toPascalCase(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function renderSelectionSet(tree: SelectionTree): string {
  const keys = Object.keys(tree);
  if (keys.length === 0) return "";

  const parts: string[] = [];
  for (const [key, value] of Object.entries(tree)) {
    if (value === true) {
      parts.push(key);
      continue;
    }
    if (key.startsWith("on_") && value && typeof value === "object") {
      const typeName = key.slice(3);
      const inner = renderSelectionSet(value as SelectionTree);
      parts.push(`... on ${typeName} ${inner}`);
      continue;
    }
    if (value && typeof value === "object") {
      const inner = renderSelectionSet(value as SelectionTree);
      parts.push(`${key} ${inner}`);
    }
  }

  return `{ ${parts.join(" ")} }`;
}

export function buildOperationDocument(
  kind: OperationKind,
  fieldName: string,
  args: ArgDescriptor[],
  selection: SelectionTree,
  returnType: GraphQLOutputType,
): string {
  const named = getNamedType(returnType);
  const isScalarRoot = isScalarType(named) || isEnumType(named);

  const varDecls = args.map((a) => `$${a.name}: ${a.graphqlType}`);
  const varStr = varDecls.length > 0 ? `(${varDecls.join(", ")})` : "";
  const fieldArgs = args.map((a) => `${a.name}: $${a.name}`);
  const fieldArgStr = fieldArgs.length > 0 ? `(${fieldArgs.join(", ")})` : "";

  const selectionStr = isScalarRoot ? "" : renderSelectionSet(selection);
  const fieldPart = selectionStr
    ? `${fieldName}${fieldArgStr} ${selectionStr}`
    : `${fieldName}${fieldArgStr}`;

  const opName = toPascalCase(fieldName);
  return `${kind} ${opName}${varStr} { ${fieldPart} }`;
}
