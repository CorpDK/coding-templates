import { and, asc, desc, eq, gt, lt, or, type SQL } from "drizzle-orm";
import type { Column } from "drizzle-orm";
import {
  decodeSignedCursorPayload,
  encodeSignedCursorPayload,
} from "./cursor-signing.js";
import { ValidationError } from "./errors.js";
import type { SortDirection, SortInput } from "./types.js";

export const CURSOR_VERSION = 1;

export interface CursorPayload {
  version: number;
  entity: string;
  sort: Array<{ field: string; direction: SortDirection }>;
  values: unknown[];
  includeDeleted?: boolean;
}

export interface ResolvedSortKey {
  field: string;
  direction: SortDirection;
  drizzleKey: string;
}

export interface ConnectionPagingArgs {
  first?: number | null;
  after?: string | null;
  last?: number | null;
  before?: string | null;
}

/** Resolve client sort with id tie-breaker when id is not already last. */
export function resolveSortWithTieBreaker<TField extends string>(
  sort: SortInput<TField>[] | null | undefined,
  fieldMap: Record<string, string>,
  defaultField: TField = "ID" as TField,
): ResolvedSortKey[] {
  const resolved: ResolvedSortKey[] =
    sort?.length ?
      sort.map((s) => {
        const drizzleKey = fieldMap[s.field];
        if (!drizzleKey) {
          throw new ValidationError(`Invalid sort field: ${s.field}`, ["sort"]);
        }
        return {
          field: s.field,
          direction: s.direction ?? "ASC",
          drizzleKey,
        };
      })
    : [{ field: defaultField, direction: "ASC", drizzleKey: fieldMap[defaultField] ?? "id" }];

  const last = resolved[resolved.length - 1];
  if (last?.drizzleKey !== "id") {
    resolved.push({ field: "ID", direction: "ASC", drizzleKey: "id" });
  }
  return resolved;
}

export function encodeCursor(payload: CursorPayload): string {
  const payloadBase64 = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  return encodeSignedCursorPayload(payloadBase64);
}

export function decodeCursor(
  cursor: string,
  entity: string,
  field: "after" | "before",
  expectedVersion: number = CURSOR_VERSION,
): CursorPayload {
  try {
    const payloadBase64 = decodeSignedCursorPayload(cursor);
    const payload = JSON.parse(
      Buffer.from(payloadBase64, "base64url").toString("utf-8"),
    ) as CursorPayload;
    if (payload.version !== expectedVersion || payload.entity !== entity) {
      throw new ValidationError("Invalid or stale cursor", [field]);
    }
    if (!Array.isArray(payload.sort) || !Array.isArray(payload.values)) {
      throw new ValidationError("Malformed cursor", [field]);
    }
    return payload;
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    if (err instanceof Error) {
      if (err.message === "CURSOR_INVALID_SIGNATURE") {
        throw new ValidationError("Invalid cursor signature", [field]);
      }
      if (err.message === "CURSOR_SIGNATURE_REQUIRED") {
        throw new ValidationError("Cursor signature required", [field]);
      }
    }
    throw new ValidationError("Malformed cursor", [field]);
  }
}

/** Verify cursor sort contract matches the active resolved sort keys. */
export function assertCursorSortMatches(
  cursor: CursorPayload,
  resolvedSort: ResolvedSortKey[],
  field: "after" | "before",
): void {
  if (cursor.sort.length !== resolvedSort.length) {
    throw new ValidationError("Cursor sort contract mismatch", [field]);
  }
  for (let i = 0; i < resolvedSort.length; i++) {
    const active = resolvedSort[i];
    const encoded = cursor.sort[i];
    if (active.field !== encoded.field || active.direction !== encoded.direction) {
      throw new ValidationError("Cursor sort contract mismatch", [field]);
    }
  }
}

/** Verify cursor includeDeleted contract matches the active request. */
export function assertCursorIncludeDeletedMatches(
  cursor: CursorPayload,
  includeDeleted: boolean | null | undefined,
  field: "after" | "before",
): void {
  const cursorIncludeDeleted = cursor.includeDeleted ?? false;
  const activeIncludeDeleted = includeDeleted ?? false;
  if (cursorIncludeDeleted !== activeIncludeDeleted) {
    throw new ValidationError("Cursor includeDeleted contract mismatch", [field]);
  }
}

export function validateConnectionPagingArgs(args: ConnectionPagingArgs): void {
  if (args.first != null && args.last != null) {
    throw new ValidationError("Cannot specify both first and last", ["first", "last"]);
  }
  if (args.after != null && args.before != null) {
    throw new ValidationError("Cannot specify both after and before", ["after", "before"]);
  }
  if (args.first != null && args.first < 0) {
    throw new ValidationError("first must be >= 0", ["first"]);
  }
  if (args.last != null && args.last < 0) {
    throw new ValidationError("last must be >= 0", ["last"]);
  }
}

function compareOp(direction: SortDirection, mode: "after" | "before"): typeof gt | typeof lt {
  if (mode === "after") {
    return direction === "ASC" ? gt : lt;
  }
  return direction === "ASC" ? lt : gt;
}

/** Build keyset seek predicate for forward (after) or backward (before) pagination. */
export function buildKeysetSeek(
  columns: Column[],
  directions: SortDirection[],
  values: unknown[],
  mode: "after" | "before",
): SQL {
  const branches: SQL[] = [];
  for (let i = 0; i < columns.length; i++) {
    const prefix: SQL[] = [];
    for (let j = 0; j < i; j++) {
      prefix.push(eq(columns[j], values[j]));
    }
    const op = compareOp(directions[i], mode);
    branches.push(prefix.length ? and(...prefix, op(columns[i], values[i]))! : op(columns[i], values[i]));
  }
  return or(...branches)!;
}

function columnFromTable(table: Record<string, unknown>, drizzleKey: string): Column {
  const col = table[drizzleKey];
  if (!col) {
    throw new ValidationError(`Invalid sort field: ${drizzleKey}`, ["sort"]);
  }
  return col as Column;
}

export function buildOrderClauses(
  table: Record<string, unknown>,
  resolvedSort: ResolvedSortKey[],
): SQL[] {
  return resolvedSort.map((s) => {
    const col = columnFromTable(table, s.drizzleKey);
    return s.direction === "DESC" ? desc(col) : asc(col);
  });
}

/** Reverse sort directions for backward page selection subquery. */
export function reverseOrderClauses(
  table: Record<string, unknown>,
  resolvedSort: ResolvedSortKey[],
): SQL[] {
  return resolvedSort.map((s) => {
    const col = columnFromTable(table, s.drizzleKey);
    return s.direction === "DESC" ? asc(col) : desc(col);
  });
}
