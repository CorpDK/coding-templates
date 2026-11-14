import {
  guildParseIP,
  guildParseMAC,
  guildSerializeIP,
  guildSerializeMAC,
} from "./guild-scalars.js";
import {
  isAsciiDigit,
  isDecimalString,
  isDigitsOnly,
  isHexString,
  isSignedIntegerString,
} from "./parse-helpers.js";
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
export { intervalMsToPgInterval, pgIntervalTextToMs } from "./pg-interval.js";
import { pgIntervalTextToMs } from "./pg-interval.js";

/** Serialize timestamptz Date to ISO-8601 UTC with milliseconds and Z suffix. */
export function serializeDateTime(
  value: Date | string | null | undefined,
): string | null {
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

function isGraphqlDateString(value: string): boolean {
  if (value.length !== 10) return false;
  if (value[4] !== "-" || value[7] !== "-") return false;
  for (let i = 0; i < value.length; i++) {
    if (i === 4 || i === 7) continue;
    if (!isAsciiDigit(value[i]!)) return false;
  }
  const y = Number(value.slice(0, 4));
  const m = Number(value.slice(5, 7));
  const d = Number(value.slice(8, 10));
  return y >= 1 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

export function serializeDate(
  value: Date | string | null | undefined,
): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return value.toISOString().slice(0, 10);
}

export function parseDate(value: unknown): string {
  if (typeof value !== "string" || !isGraphqlDateString(value)) {
    throw new TypeError("Date must be YYYY-MM-DD");
  }
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new TypeError("Invalid Date");
  }
  return value;
}

function isTimeTzWire(value: string): boolean {
  let offsetStart = -1;
  if (value.endsWith("Z")) {
    offsetStart = value.length - 1;
  } else {
    const plus = value.lastIndexOf("+");
    const minus = value.lastIndexOf("-");
    const candidate = Math.max(plus, minus);
    if (candidate > 0) offsetStart = candidate;
  }
  if (offsetStart < 0) return false;
  const timePart = value.slice(0, offsetStart);
  const offsetPart = value.slice(offsetStart);
  if (offsetPart !== "Z" && (offsetPart.length !== 6 || offsetPart[3] !== ":")) {
    return false;
  }
  if (offsetPart !== "Z") {
    const offH = offsetPart.slice(1, 3);
    const offM = offsetPart.slice(4, 6);
    if (!isAsciiDigit(offH[0]!) || !isAsciiDigit(offH[1]!)) return false;
    if (!isAsciiDigit(offM[0]!) || !isAsciiDigit(offM[1]!)) return false;
  }
  const segments = timePart.split(":");
  if (segments.length < 2 || segments.length > 3) return false;
  for (const seg of segments) {
    if (seg.length !== 2 || !isAsciiDigit(seg[0]!) || !isAsciiDigit(seg[1]!)) {
      return false;
    }
  }
  if (segments.length === 3) {
    const sec = segments[2]!;
    const dot = sec.indexOf(".");
    if (dot >= 0) {
      const whole = sec.slice(0, dot);
      const frac = sec.slice(dot + 1);
      if (whole.length !== 2 || frac.length === 0 || frac.length > 3) return false;
      if (!isDigitsOnly(frac)) return false;
    }
  }
  return true;
}

export function serializeTimeTz(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  return value;
}

export function parseTimeTz(value: unknown): string {
  if (typeof value !== "string" || !isTimeTzWire(value)) {
    throw new TypeError("TimeTz must be ISO-8601 time with offset");
  }
  return value;
}
const BIGINT_MIN = BigInt("-9223372036854775808");
const BIGINT_MAX = BigInt("9223372036854775807");

type IntegralSerializeInput = bigint | number | string | null | undefined;

function serializeIntegralString(value: IntegralSerializeInput): string | null {
  if (value == null) return null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") return Math.trunc(value).toString();
  return value;
}

export function serializeBigInt(
  value: bigint | number | string | null | undefined,
): string | null {
  return serializeIntegralString(value);
}

export function parseBigInt(value: unknown): string {
  if (typeof value !== "string" || !isSignedIntegerString(value)) {
    throw new TypeError("BigInt must be a decimal integer string");
  }
  const bi = BigInt(value);
  if (bi < BIGINT_MIN || bi > BIGINT_MAX) {
    throw new TypeError("BigInt out of range");
  }
  return value;
}

export function serializeDecimal(
  value: string | number | null | undefined,
): string | null {
  if (value == null) return null;
  if (typeof value === "number") return value.toString();
  return value;
}

export function parseDecimal(value: unknown): string {
  if (typeof value !== "string" || !isDecimalString(value)) {
    throw new TypeError("Decimal must be a decimal string");
  }
  return value;
}

function isIntervalMsDecimalWire(value: string): boolean {
  return isSignedIntegerString(value);
}

export function serializeIntervalMs(
  value: string | number | bigint | null | undefined,
): string | null {
  if (value == null) return null;
  if (typeof value === "bigint")
    return assertInt64WireDecimal(value.toString());
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError(
        "IntervalMs number input must be a safe integer; use a decimal string for larger values",
      );
    }
    return assertInt64WireDecimal(value.toString());
  }
  if (isIntervalMsDecimalWire(value)) {
    return assertInt64WireDecimal(value);
  }
  return pgIntervalTextToMs(value);
}

function assertInt64WireDecimal(decimal: string): string {
  const bi = BigInt(decimal);
  if (bi < PG_INT64_MIN || bi > PG_INT64_MAX) {
    throw new TypeError("Value out of signed 64-bit range");
  }
  return decimal;
}

/** Parse GraphQL IntervalMs wire value (milliseconds) to decimal ms string. */
export function parseIntervalMs(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError(
        "IntervalMs number input must be a safe integer; use a decimal string for larger values",
      );
    }
    return assertInt64WireDecimal(value.toString());
  }
  if (typeof value !== "string" || !isSignedIntegerString(value)) {
    throw new TypeError(
      "IntervalMs must be a signed integer string of milliseconds",
    );
  }
  return assertInt64WireDecimal(value);
}

function parseBoundedInt(
  value: unknown,
  min: number,
  max: number,
  label: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value)
  ) {
    throw new TypeError(`${label} must be a finite integer`);
  }
  if (value < min || value > max) {
    throw new TypeError(`${label} out of range`);
  }
  return value;
}

export function serializeSmallInt(
  value: number | null | undefined,
): number | null {
  if (value == null) return null;
  return parseBoundedInt(value, PG_SMALLINT_MIN, PG_SMALLINT_MAX, "SmallInt");
}

export function parseSmallInt(value: unknown): number {
  return parseBoundedInt(value, PG_SMALLINT_MIN, PG_SMALLINT_MAX, "SmallInt");
}

export function serializeDouble(
  value: number | null | undefined,
): number | null {
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

export function serializeCitext(
  value: string | null | undefined,
): string | null {
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
function isDottedIpv4Host(dotted: string): boolean {
  const parts = dotted.split(".");
  if (parts.length !== 4) return false;
  for (const octet of parts) {
    if (octet.length === 0 || octet.length > 3 || !isDigitsOnly(octet)) return false;
    const n = Number(octet);
    if (n > 255) return false;
  }
  return true;
}

function assertIpv4Octets(dotted: string): void {
  if (!isDottedIpv4Host(dotted)) {
    throw new TypeError("CIDR must be valid CIDR notation");
  }
}

function assertIpv4CidrHost(host: string): void {
  assertIpv4Octets(host);
}

function expandEmbeddedIpv4Groups(parts: string[]): string[] {
  const expanded: string[] = [];
  for (const part of parts) {
    if (part.includes(".")) {
      assertIpv4Octets(part);
      const octets = part.split(".").map(Number);
      const hi = (octets[0]! << 8) | octets[1]!;
      const lo = (octets[2]! << 8) | octets[3]!;
      expanded.push(hi.toString(16), lo.toString(16));
    } else {
      expanded.push(part);
    }
  }
  return expanded;
}

function assertIpv4CidrNetwork(host: string, prefix: number): void {
  const parts = host.split(".").map(Number);
  const addr =
    ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>>
    0;
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
    const head = expandEmbeddedIpv4Groups(before ? before.split(":") : []);
    const tail = expandEmbeddedIpv4Groups(after ? after.split(":") : []);
    const missing = 8 - head.length - tail.length;
    if (missing < 0) {
      throw new TypeError("CIDR must be valid CIDR notation");
    }
    parts = [...head, ...new Array<string>(missing).fill("0"), ...tail];
  } else {
    parts = expandEmbeddedIpv4Groups(lowered.split(":"));
    if (parts.length !== 8) {
      throw new TypeError("CIDR must be valid CIDR notation");
    }
  }
  let addr = 0n;
  for (const part of parts) {
    if (part.length === 0 || part.length > 4 || !isHexString(part)) {
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
  const hostBits = 128 - prefix;
  const addr = ipv6HostToBigInt(host);
  if (hostBits <= 0) {
    return;
  }
  if (hostBits >= 128) {
    if (addr !== 0n) {
      throw new TypeError("CIDR must be valid CIDR notation");
    }
    return;
  }
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
  if (isDottedIpv4Host(host)) {
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

export function serializeMacAddr(
  value: string | null | undefined,
): string | null {
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
