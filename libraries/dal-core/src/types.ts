/** Audit profile inferred from Drizzle column presence. */
export type AuditProfile = "full" | "append-only";

/** Delete strategy inferred from Drizzle column presence. */
export type DeleteStrategy = "soft" | "hard";

/** Canonical mutation error codes (GraphQL exposes as String). */
export type MutationUserErrorCode =
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "UNIQUE_VIOLATION"
  | "FK_VIOLATION"
  | "CONSTRAINT_VIOLATION"
  | "UNKNOWN";

export interface MutationUserError {
  code: MutationUserErrorCode | null;
  message: string;
  field: string[] | null;
  id: string | null;
}

export interface RepositoryContext {
  /** Resolved actor id; null falls back to "system". */
  actorId: string | null;
}

export type SortDirection = "ASC" | "DESC";

export interface SortInput<TField extends string = string> {
  field: TField;
  direction?: SortDirection;
}

/** Shared subscription change operations. */
export type ChangeOperation = "CREATED" | "UPDATED" | "DELETED";

export interface EntityChangeEventPayload {
  operation: ChangeOperation;
  ids: string[];
  isTruncated: boolean;
  count: number;
}

export const DEFAULT_LIST_LIMIT = 100;
export const MAX_LIST_LIMIT = 1000;
export const CHANGE_EVENT_ID_CAP = 100;
