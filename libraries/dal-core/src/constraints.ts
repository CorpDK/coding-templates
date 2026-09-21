import { ValidationError } from "./errors.js";

export interface ColumnConstraintMeta {
  graphqlName: string;
  drizzleKey: string;
  maxLength?: number;
  /** Column value must be > minExclusive (e.g. 0 for strictly positive). */
  minExclusive?: number;
  /** Column value must be >= minInclusive. */
  minInclusive?: number;
}

function fieldPath(graphqlName: string): string[] {
  return [graphqlName];
}

function assertStringLength(
  value: unknown,
  meta: ColumnConstraintMeta,
  path: string[],
): void {
  if (typeof value !== "string") return;
  if (meta.maxLength != null && value.length > meta.maxLength) {
    throw new ValidationError(
      `${meta.graphqlName} must be at most ${meta.maxLength} characters`,
      path,
    );
  }
}

function assertNumericBounds(
  value: unknown,
  meta: ColumnConstraintMeta,
  path: string[],
): void {
  if (value == null) return;
  let num: number;
  if (typeof value === "number") {
    num = value;
  } else if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value)) {
    num = Number(value);
  } else {
    return;
  }
  if (meta.minExclusive != null && !(num > meta.minExclusive)) {
    throw new ValidationError(`${meta.graphqlName} must be greater than ${meta.minExclusive}`, path);
  }
  if (meta.minInclusive != null && !(num >= meta.minInclusive)) {
    throw new ValidationError(
      `${meta.graphqlName} must be at least ${meta.minInclusive}`,
      path,
    );
  }
}

/** Pre-write validation for inferred Drizzle column constraints (length, simple checks). */
export function validateColumnConstraints(
  input: Record<string, unknown>,
  constraints: ColumnConstraintMeta[],
  mode: "create" | "update",
): void {
  for (const meta of constraints) {
    const raw = input[meta.graphqlName];
    if (raw === undefined) {
      if (mode === "create") continue;
      continue;
    }
    if (raw === null) continue;
    const path = fieldPath(meta.graphqlName);
    assertStringLength(raw, meta, path);
    assertNumericBounds(raw, meta, path);
  }
}
