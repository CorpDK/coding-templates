import { guildParseIP, guildParseMAC, guildSerializeIP, guildSerializeMAC } from "./guild-scalars.js";
import {
  PG_INT64_MAX,
  PG_INT64_MIN,
  PG_INT32_MAX,
  PG_INT32_MIN,
  PG_REAL_MAX,
  PG_REAL_MIN,
  PG_SMALLINT_MAX,
  PG_SMALLINT_MIN,
} from "./pg-bounds.js";

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

function serializeIntegralString(
  value: bigint | number | string | null | undefined,
): string | null {
  if (value == null) return null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") return Math.trunc(value).toString();
  return value;
}

export function serializeBigInt(value: bigint | number | string | null | undefined): string | null {
  return serializeIntegralString(value);
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
  return serializeIntegralString(value);
}

function assertInt64WireDecimal(decimal: string): string {
  const bi = BigInt(decimal);
  if (bi < PG_INT64_MIN || bi > PG_INT64_MAX) {
    throw new TypeError("Value out of signed 64-bit range");
  }
  return decimal;
}

/** Parse PG interval or milliseconds wire value to total milliseconds string. */
export function parseIntervalMs(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return assertInt64WireDecimal(Math.trunc(value).toString());
  }
  if (typeof value !== "string" || !INTERVAL_MS_RE.test(value)) {
    throw new TypeError("IntervalMs must be a signed integer string of milliseconds");
  }
  return assertInt64WireDecimal(value);
}

function parseBoundedInt(
  value: unknown,
  min: number,
  max: number,
  label: string,
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new TypeError(`${label} must be a finite integer`);
  }
  if (value < min || value > max) {
    throw new TypeError(`${label} out of range`);
  }
  return value;
}

export function serializeSmallInt(value: number | null | undefined): number | null {
  if (value == null) return null;
  return parseBoundedInt(value, PG_SMALLINT_MIN, PG_SMALLINT_MAX, "SmallInt");
}

export function parseSmallInt(value: unknown): number {
  return parseBoundedInt(value, PG_SMALLINT_MIN, PG_SMALLINT_MAX, "SmallInt");
}

export function serializeDouble(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError("Double must be a finite number");
  }
  return value;
}

export function parseDouble(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError("Double must be a finite number");
  }
  return value;
}

export function parseReal(value: unknown): number {
  const n = parseDouble(value);
  if (n < PG_REAL_MIN || n > PG_REAL_MAX) {
    throw new TypeError("Real out of IEEE binary32 range");
  }
  return n;
}

export function serializeCitext(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new TypeError("InsensitiveString must be a string");
  }
  return value;
}

export function parseCitext(value: unknown): string {
  if (typeof value !== "string") {
    throw new TypeError("InsensitiveString must be a string");
  }
  return value;
}

export function serializeInet(value: string | null | undefined): string | null {
  if (value == null) return null;
  return guildSerializeIP(value);
}

/** PostgreSQL inet — validation via graphql-scalars `GraphQLIP`. */
export function parseInet(value: unknown): string {
  return guildParseIP(value);
}

export function serializeCidr(value: string | null | undefined): string | null {
  if (value == null) return null;
  return parseCidr(value);
}

/**
 * PostgreSQL cidr — graphql-scalars has no CIDR scalar (v1.26); minimal prefix check only.
 * Host portion is not fully validated like Guild `IP` (CIDR allows network bits in host).
 */
const CIDR_RE =
  /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d?\d)){3}|(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4})\/\d{1,3}$/;

export function parseCidr(value: unknown): string {
  if (typeof value !== "string" || !CIDR_RE.test(value)) {
    throw new TypeError("CIDR must be valid CIDR notation");
  }
  return value;
}

export function serializeMacAddr(value: string | null | undefined): string | null {
  if (value == null) return null;
  return guildSerializeMAC(value);
}

/** PostgreSQL macaddr — validation via graphql-scalars `GraphQLMAC` (colon, dash, or dot separators). */
export function parseMacAddr(value: unknown): string {
  return guildParseMAC(value);
}

export function parsePgInt32(value: unknown): number {
  return parseBoundedInt(value, PG_INT32_MIN, PG_INT32_MAX, "Int");
}

/** Resolve actor id from context; never returns null — uses "system" fallback. */
export function resolveActorId(actorId: string | null | undefined): string {
  return actorId?.trim() || "system";
}
