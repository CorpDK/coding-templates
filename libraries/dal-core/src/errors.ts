import type { MutationUserError, MutationUserErrorCode } from "./types.js";

export function createUserError(
  code: MutationUserErrorCode,
  message: string,
  options?: { field?: string[]; id?: string | null },
): MutationUserError {
  return {
    code,
    message,
    field: options?.field ?? null,
    id: options?.id ?? null,
  };
}

export function successPayload<T extends Record<string, unknown>>(
  data: T,
): T & { userErrors: MutationUserError[] } {
  return { ...data, userErrors: [] };
}

export function errorPayload<T extends Record<string, unknown>>(
  data: T,
  userErrors: MutationUserError[],
): T & { userErrors: MutationUserError[] } {
  return { ...data, userErrors };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertValidUuid(id: string, field = "id"): void {
  if (!UUID_RE.test(id)) {
    throw new ValidationError(`Invalid UUID for ${field}`, [field]);
  }
}

export class ValidationError extends Error {
  readonly field: string[];

  constructor(message: string, field: string[] = []) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export function mapDriverError(err: unknown): MutationUserError {
  const message = err instanceof Error ? err.message : "Unknown error";
  const lower = message.toLowerCase();
  if (lower.includes("unique") || lower.includes("duplicate")) {
    return createUserError("UNIQUE_VIOLATION", "A record with this value already exists");
  }
  if (lower.includes("foreign key") || lower.includes("fk_")) {
    return createUserError("FK_VIOLATION", "Referenced record does not exist");
  }
  if (lower.includes("check constraint")) {
    return createUserError("CONSTRAINT_VIOLATION", "Constraint violation");
  }
  return createUserError("UNKNOWN", "Operation failed");
}
