import { readFileSync } from "node:fs";
import type { ArgDescriptor } from "../codegen/types.js";
import { baseGraphqlType, displayFlag } from "./arg-meta.js";
import { UsageError } from "./errors.js";
import { parseBooleanText, type RawFlagValue } from "./flags.js";

export const INT32_MIN = -2_147_483_648;
export const INT32_MAX = 2_147_483_647;

function parseJsonText(text: string, label: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new UsageError(`Invalid JSON for ${label}`);
  }
}

/** Reads `@<path>` operands from disk, otherwise parses the text as JSON. */
function readJsonOperand(operand: string, label: string): unknown {
  if (!operand.startsWith("@")) return parseJsonText(operand, label);
  const path = operand.slice(1);
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new UsageError(`Cannot read ${label} file ${path}: ${reason}`);
  }
  return parseJsonText(text, `${label} (${path})`);
}

function coerceInt(text: string, label: string): number {
  if (!/^[+-]?\d+$/.test(text.trim())) {
    throw new UsageError(`Invalid Int for ${label}: ${text}`);
  }
  const value = Number(text);
  if (value < INT32_MIN || value > INT32_MAX) {
    throw new UsageError(
      `Int for ${label} is outside the 32-bit signed range: ${text}`,
    );
  }
  return value;
}

function coerceFloat(text: string, label: string): number {
  const value = text.trim() === "" ? Number.NaN : Number(text);
  if (!Number.isFinite(value)) {
    throw new UsageError(`Invalid Float for ${label}: ${text}`);
  }
  return value;
}

function coerceEnum(text: string, arg: ArgDescriptor, label: string): string {
  if (arg.enumValues && !arg.enumValues.includes(text)) {
    throw new UsageError(
      `Invalid value for ${label}: ${text} (allowed: ${arg.enumValues.join(", ")})`,
    );
  }
  return text;
}

function coerceScalarText(text: string, arg: ArgDescriptor): unknown {
  const label = displayFlag(arg);
  if (arg.kind === "enum") return coerceEnum(text, arg, label);
  if (arg.scalarWire === "json") return parseJsonText(text, label);
  switch (baseGraphqlType(arg.graphqlType)) {
    case "Int":
      return coerceInt(text, label);
    case "Float":
      return coerceFloat(text, label);
    case "Boolean":
      return parseBooleanText(text, label);
    default:
      return text;
  }
}

function coerceListElement(element: unknown, arg: ArgDescriptor): unknown {
  if (typeof element === "string") return coerceScalarText(element, arg);
  if (arg.scalarWire === "json") return element;
  if (typeof element === "number" || typeof element === "boolean") {
    return coerceScalarText(String(element), arg);
  }
  throw new UsageError(`Invalid list element for ${displayFlag(arg)}`);
}

function coerceInputObject(items: string[], arg: ArgDescriptor): unknown {
  const label = displayFlag(arg);
  if (!arg.list) return readJsonOperand(items.at(-1)!, label);
  if (items.length === 1) {
    const parsed = readJsonOperand(items[0]!, label);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  return items.map((item) => readJsonOperand(item, label));
}

function coerceList(items: string[], arg: ArgDescriptor): unknown[] {
  const single = items.length === 1 ? items[0]!.trim() : undefined;
  if (single?.startsWith("[")) {
    const parsed = parseJsonText(single, displayFlag(arg));
    if (!Array.isArray(parsed)) {
      throw new UsageError(`${displayFlag(arg)} expects a JSON array`);
    }
    return parsed.map((element) => coerceListElement(element, arg));
  }
  return items.map((item) => coerceScalarText(item, arg));
}

/**
 * Coerces one raw flag value to its GraphQL type (doc 14 §4.2). Throws
 * `UsageError` (exit 2) for malformed values, so nothing reaches the network.
 */
export function coerceFlagValue(
  raw: RawFlagValue,
  arg: ArgDescriptor,
): unknown {
  if (typeof raw === "boolean") {
    if (baseGraphqlType(arg.graphqlType) !== "Boolean") {
      throw new UsageError(`${displayFlag(arg)} requires a value`);
    }
    return raw;
  }
  const items = Array.isArray(raw) ? raw : [raw];
  if (arg.kind === "input") return coerceInputObject(items, arg);
  if (arg.list) return coerceList(items, arg);
  return coerceScalarText(items.at(-1)!, arg);
}
