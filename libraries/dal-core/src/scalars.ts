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
    if (!Number.isSafeInteger(value)) {
      throw new TypeError(
        "IntervalMs number input must be a safe integer; use a decimal string for larger values",
      );
    }
    return assertInt64WireDecimal(value.toString());
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

/** PostgreSQL cidr — graphql-scalars has no CIDR scalar (v1.26); prefix + network-bit checks. */
const CIDR_IPV4_HOST_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;

function assertIpv4CidrHost(host: string): void {
  if (!CIDR_IPV4_HOST_RE.test(host)) {
    throw new TypeError("CIDR must be valid CIDR notation");
  }
  for (const octet of host.split(".")) {
    if (octet.length === 0 || !/^\d{1,3}$/.test(octet)) {
      throw new TypeError("CIDR must be valid CIDR notation");
    }
    const n = Number(octet);
    if (n > 255) {
      throw new TypeError("CIDR must be valid CIDR notation");
    }
  }
}

function assertIpv4CidrNetwork(host: string, prefix: number): void {
  const parts = host.split(".").map(Number);
  const addr =
    ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
  const hostBits = 32 - prefix;
  if (hostBits <= 0) {
    return;
  }
  if (hostBits >= 32) {
    if (addr !== 0) {
      throw new TypeError("CIDR must be valid CIDR notation");
    }
    return;
  }
  const hostMask = (1 << hostBits) - 1;
  if ((addr & hostMask) !== 0) {
    throw new TypeError("CIDR must be valid CIDR notation");
  }
}

function assertIpv6CidrHost(host: string): void {
  try {
    guildParseIP(host);
  } catch {
    throw new TypeError("CIDR must be valid CIDR notation");
  }
}

function ipv6HostToBigInt(host: string): bigint {
  const lowered = host.toLowerCase();
  const doubleColon = lowered.indexOf("::");
  let parts: string[];
  if (doubleColon >= 0) {
    const before = lowered.slice(0, doubleColon);
    const after = lowered.slice(doubleColon + 2);
    const head = before ? before.split(":") : [];
    const tail = after ? after.split(":") : [];
    const missing = 8 - head.length - tail.length;
    if (missing < 0) {
      throw new TypeError("CIDR must be valid CIDR notation");
    }
    parts = [...head, ...Array<string>(missing).fill("0"), ...tail];
  } else {
    parts = lowered.split(":");
    if (parts.length !== 8) {
      throw new TypeError("CIDR must be valid CIDR notation");
    }
  }
  let addr = 0n;
  for (const part of parts) {
    if (part.length === 0 || part.length > 4 || !/^[0-9a-f]+$/i.test(part)) {
      throw new TypeError("CIDR must be valid CIDR notation");
    }
    const group = BigInt(`0x${part}`);
    if (group > 0xffffn) {
      throw new TypeError("CIDR must be valid CIDR notation");
    }
    addr = (addr << 16n) | group;
  }
  return addr;
}

function assertIpv6CidrNetwork(host: string, prefix: number): void {
  if (prefix <= 0) {
    return;
  }
  const hostBits = 128 - prefix;
  if (hostBits <= 0) {
    return;
  }
  const addr = ipv6HostToBigInt(host);
  const hostMask = (1n << BigInt(hostBits)) - 1n;
  if ((addr & hostMask) !== 0n) {
    throw new TypeError("CIDR must be valid CIDR notation");
  }
}

export function parseCidr(value: unknown): string {
  if (typeof value !== "string") {
    throw new TypeError("CIDR must be valid CIDR notation");
  }
  const slash = value.lastIndexOf("/");
  if (slash <= 0 || slash === value.length - 1) {
    throw new TypeError("CIDR must be valid CIDR notation");
  }
  const host = value.slice(0, slash);
  const prefix = Number(value.slice(slash + 1));
  if (host.includes(".")) {
    assertIpv4CidrHost(host);
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
      throw new TypeError("CIDR must be valid CIDR notation");
    }
    assertIpv4CidrNetwork(host, prefix);
  } else {
    assertIpv6CidrHost(host);
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 128) {
      throw new TypeError("CIDR must be valid CIDR notation");
    }
    assertIpv6CidrNetwork(host, prefix);
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
