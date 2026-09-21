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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function serializeDate(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return value.toISOString().slice(0, 10);
}

export function parseDate(value: unknown): string {
  if (typeof value !== "string" || !DATE_RE.test(value)) {
    throw new TypeError("Date must be YYYY-MM-DD");
  }
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new TypeError("Invalid Date");
  }
  return value;
}

const TIME_TZ_RE =
  /^(\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)(Z|[+-]\d{2}:\d{2})$/;

export function serializeTimeTz(value: string | null | undefined): string | null {
  if (value == null) return null;
  return value;
}

export function parseTimeTz(value: unknown): string {
  if (typeof value !== "string" || !TIME_TZ_RE.test(value)) {
    throw new TypeError("TimeTz must be ISO-8601 time with offset");
  }
  return value;
}

const BIGINT_RE = /^-?\d+$/;
const BIGINT_MIN = BigInt("-9223372036854775808");
const BIGINT_MAX = BigInt("9223372036854775807");

export function serializeBigInt(value: bigint | number | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") return Math.trunc(value).toString();
  return value;
}

export function parseBigInt(value: unknown): string {
  if (typeof value !== "string" || !BIGINT_RE.test(value)) {
    throw new TypeError("BigInt must be a decimal integer string");
  }
  const bi = BigInt(value);
  if (bi < BIGINT_MIN || bi > BIGINT_MAX) {
    throw new TypeError("BigInt out of range");
  }
  return value;
}

const DECIMAL_RE = /^-?\d+(\.\d+)?$/;

export function serializeDecimal(value: string | number | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "number") return value.toString();
  return value;
}

export function parseDecimal(value: unknown): string {
  if (typeof value !== "string" || !DECIMAL_RE.test(value)) {
    throw new TypeError("Decimal must be a decimal string");
  }
  return value;
}

const INTERVAL_MS_RE = /^-?\d+$/;

export function serializeIntervalMs(value: string | number | bigint | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") return Math.trunc(value).toString();
  return value;
}

/** Parse PG interval or milliseconds wire value to total milliseconds string. */
export function parseIntervalMs(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value).toString();
  }
  if (typeof value !== "string" || !INTERVAL_MS_RE.test(value)) {
    throw new TypeError("IntervalMs must be a signed integer string of milliseconds");
  }
  return value;
}

/** Resolve actor id from context; never returns null — uses "system" fallback. */
export function resolveActorId(actorId: string | null | undefined): string {
  return actorId?.trim() || "system";
}
