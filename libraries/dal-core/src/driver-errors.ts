import { createUserError } from "./errors.js";
import type { MutationUserError } from "./types.js";

export type SqlDialect = "postgresql" | "cockroachdb" | "mysql" | "sqlite";

export interface DriverErrorDetails {
  code?: string;
  message: string;
  constraint?: string;
  column?: string;
}

const SAFE_UNIQUE = "A record with this value already exists";
const SAFE_FK = "Referenced record does not exist";
const SAFE_CHECK = "Constraint violation";
const SAFE_UNKNOWN = "Operation failed";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function readString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Unknown error";
}

interface DriverFieldState {
  code?: string;
  constraint?: string;
  column?: string;
}

function mergeDriverFields(rec: Record<string, unknown>, state: DriverFieldState): void {
  state.code = readString(rec, "code") ?? readString(rec, "errno") ?? state.code;
  state.constraint = readString(rec, "constraint") ?? state.constraint;
  state.column = readString(rec, "column") ?? state.column;
  if (!state.code) {
    const sqlState = readString(rec, "sqlState");
    if (sqlState) state.code = sqlState;
  }
}

function nextErrorCause(current: unknown): unknown | null {
  if (current instanceof Error && current.cause != null && current.cause !== current) {
    return current.cause;
  }
  return null;
}

/** Walk error.cause chain and collect driver fields (Postgres, MySQL, libsql, etc.). */
export function extractDriverErrorDetails(err: unknown): DriverErrorDetails {
  const message = errorMessage(err);
  let current: unknown = err;
  const state: DriverFieldState = {};

  for (let depth = 0; depth < 8 && current != null; depth += 1) {
    const rec = asRecord(current);
    if (rec) mergeDriverFields(rec, state);
    const next = nextErrorCause(current);
    if (next == null) break;
    current = next;
  }

  return { code: state.code, message, constraint: state.constraint, column: state.column };
}

function mapPostgresCode(code: string): MutationUserError | null {
  switch (code) {
    case "23505":
      return createUserError("UNIQUE_VIOLATION", SAFE_UNIQUE);
    case "23503":
      return createUserError("FK_VIOLATION", SAFE_FK);
    case "23514":
    case "23513":
    case "23502":
      return createUserError("CONSTRAINT_VIOLATION", SAFE_CHECK);
    case "23P01":
      return createUserError("CONSTRAINT_VIOLATION", SAFE_CHECK);
    default:
      if (code.startsWith("23")) {
        return createUserError("CONSTRAINT_VIOLATION", SAFE_CHECK);
      }
      return null;
  }
}

function mapCockroachCode(code: string): MutationUserError | null {
  return mapPostgresCode(code);
}

function mapMysqlCode(code: string): MutationUserError | null {
  switch (code) {
    case "ER_DUP_ENTRY":
    case "1062":
      return createUserError("UNIQUE_VIOLATION", SAFE_UNIQUE);
    case "ER_NO_REFERENCED_ROW_2":
    case "1452":
    case "ER_ROW_IS_REFERENCED_2":
    case "1451":
      return createUserError("FK_VIOLATION", SAFE_FK);
    case "3819":
    case "4025":
    case "1048":
      return createUserError("CONSTRAINT_VIOLATION", SAFE_CHECK);
    default:
      return null;
  }
}

function mapSqliteCode(code: string): MutationUserError | null {
  const upper = code.toUpperCase();
  if (upper.includes("UNIQUE") || upper === "SQLITE_CONSTRAINT_UNIQUE") {
    return createUserError("UNIQUE_VIOLATION", SAFE_UNIQUE);
  }
  if (upper.includes("FOREIGN") || upper === "SQLITE_CONSTRAINT_FOREIGNKEY") {
    return createUserError("FK_VIOLATION", SAFE_FK);
  }
  if (upper.includes("CHECK") || upper === "SQLITE_CONSTRAINT_CHECK") {
    return createUserError("CONSTRAINT_VIOLATION", SAFE_CHECK);
  }
  return null;
}

function mapByDialect(details: DriverErrorDetails, dialect: SqlDialect): MutationUserError | null {
  if (!details.code) return null;
  switch (dialect) {
    case "postgresql":
      return mapPostgresCode(details.code);
    case "cockroachdb":
      return mapCockroachCode(details.code);
    case "mysql":
      return mapMysqlCode(details.code);
    case "sqlite":
      return mapSqliteCode(details.code);
    default:
      return null;
  }
}

function mapByMessageHeuristic(message: string): MutationUserError {
  const lower = message.toLowerCase();
  if (lower.includes("unique") || lower.includes("duplicate")) {
    return createUserError("UNIQUE_VIOLATION", SAFE_UNIQUE);
  }
  if (lower.includes("foreign key") || lower.includes("fk_") || lower.includes("referential")) {
    return createUserError("FK_VIOLATION", SAFE_FK);
  }
  if (lower.includes("check constraint") || lower.includes("violates check")) {
    return createUserError("CONSTRAINT_VIOLATION", SAFE_CHECK);
  }
  return createUserError("UNKNOWN", SAFE_UNKNOWN);
}

/** Map driver/SQL errors to safe MutationUserError payloads (Appendix B). */
export function mapDriverError(
  err: unknown,
  dialect: SqlDialect = "postgresql",
): MutationUserError {
  const details = extractDriverErrorDetails(err);
  const mapped = mapByDialect(details, dialect);
  if (mapped) return mapped;
  return mapByMessageHeuristic(details.message);
}
