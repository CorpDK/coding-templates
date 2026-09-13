/** Serialize timestamptz Date to ISO-8601 UTC with milliseconds and Z suffix. */
export function serializeDateTime(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return d.toISOString();
}

/** Parse GraphQL DateTime wire value to Date (UTC). */
export function parseDateTime(value: unknown): Date {
  if (typeof value !== "string") {
    throw new TypeError("DateTime must be an ISO-8601 string");
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new TypeError("Invalid DateTime");
  }
  return d;
}

/** Resolve actor id from context; never returns null — uses "system" fallback. */
export function resolveActorId(actorId: string | null | undefined): string {
  return actorId?.trim() || "system";
}
