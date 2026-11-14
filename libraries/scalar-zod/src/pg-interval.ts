import { PG_INT64_MAX, PG_INT64_MIN } from "./pg-bounds.js";
import {
  isAsciiDigit,
  isDigitsOnly,
  isSignedIntegerString,
} from "./parse-helpers.js";

const MS_PER_SECOND = 1000n;
const MS_PER_MILLISECOND = 1n;
const MS_PER_MINUTE = 60n * MS_PER_SECOND;
const MS_PER_HOUR = 60n * MS_PER_MINUTE;
const MS_PER_DAY = 24n * MS_PER_HOUR;
const MS_PER_MONTH = 30n * MS_PER_DAY;
const MS_PER_YEAR = 31557600000n;

const VERBOSE_UNIT_MS: Record<string, bigint> = {
  millisecond: MS_PER_MILLISECOND,
  milliseconds: MS_PER_MILLISECOND,
  ms: MS_PER_MILLISECOND,
  second: MS_PER_SECOND,
  seconds: MS_PER_SECOND,
  sec: MS_PER_SECOND,
  secs: MS_PER_SECOND,
  s: MS_PER_SECOND,
  minute: MS_PER_MINUTE,
  minutes: MS_PER_MINUTE,
  min: MS_PER_MINUTE,
  mins: MS_PER_MINUTE,
  hour: MS_PER_HOUR,
  hours: MS_PER_HOUR,
  hr: MS_PER_HOUR,
  hrs: MS_PER_HOUR,
  day: MS_PER_DAY,
  days: MS_PER_DAY,
  week: 7n * MS_PER_DAY,
  weeks: 7n * MS_PER_DAY,
  month: MS_PER_MONTH,
  months: MS_PER_MONTH,
  mon: MS_PER_MONTH,
  mons: MS_PER_MONTH,
  year: MS_PER_YEAR,
  years: MS_PER_YEAR,
  yr: MS_PER_YEAR,
  yrs: MS_PER_YEAR,
};

interface HmsTime {
  sign?: string;
  hours: string;
  minutes: string;
  seconds: string;
  fraction?: string;
}

function fractionToMs(fraction: string): bigint {
  return BigInt((fraction + "000").slice(0, 3));
}

function normalizeSpaces(text: string): string {
  let out = "";
  let pendingSpace = false;
  for (const ch of text.trim()) {
    if (ch === " " || ch === "\t") {
      pendingSpace = true;
    } else {
      if (pendingSpace && out.length > 0) out += " ";
      pendingSpace = false;
      out += ch;
    }
  }
  return out;
}

function parseOptionalUnsignedInt(s: string): boolean {
  return s.length === 0 || isDigitsOnly(s);
}

/** `HH:MM:SS` with optional leading sign on hours and optional `.ffffff` fraction (1–6 digits). */
function parseHmsSegment(segment: string): HmsTime | null {
  const trimmed = segment.trim();
  if (trimmed.length === 0) return null;

  let sign: string | undefined;
  let body = trimmed;
  if (body.startsWith("+") || body.startsWith("-")) {
    sign = body.slice(0, 1);
    body = body.slice(1);
  }

  const parts = body.split(":");
  if (parts.length !== 3) return null;
  const [hours, minutes, secPart] = parts;
  if (!parseOptionalUnsignedInt(hours!)) return null;
  if (
    minutes!.length !== 2 ||
    !isAsciiDigit(minutes![0]!) ||
    !isAsciiDigit(minutes![1]!)
  ) {
    return null;
  }

  let seconds = secPart!;
  let fraction: string | undefined;
  const dotInSec = secPart!.indexOf(".");
  if (dotInSec >= 0) {
    seconds = secPart!.slice(0, dotInSec);
    fraction = secPart!.slice(dotInSec + 1);
    if (
      fraction.length === 0 ||
      fraction.length > 6 ||
      !isDigitsOnly(fraction)
    ) {
      return null;
    }
  }
  if (
    seconds.length !== 2 ||
    !isAsciiDigit(seconds[0]!) ||
    !isAsciiDigit(seconds[1]!)
  ) {
    return null;
  }

  return { sign, hours: hours!, minutes: minutes!, seconds, fraction };
}

function hmsToMs(time: HmsTime): bigint {
  const negativeTime = time.sign === "-";
  let h = BigInt(time.hours || "0");
  let min = BigInt(time.minutes);
  let sec = BigInt(time.seconds);
  let ms = time.fraction ? fractionToMs(time.fraction) : 0n;
  if (negativeTime) {
    h = -h;
    min = -min;
    sec = -sec;
    ms = -ms;
  }
  return h * MS_PER_HOUR + min * MS_PER_MINUTE + sec * MS_PER_SECOND + ms;
}

function findLastSpace(text: string): number {
  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] === " ") return i;
  }
  return -1;
}

function readTrailingInteger(beforeUnit: string): string | null {
  const trimmed = beforeUnit.trimEnd();
  if (trimmed.length === 0) return null;
  let end = trimmed.length;
  let start = end;
  while (start > 0 && isAsciiDigit(trimmed[start - 1]!)) {
    start -= 1;
  }
  if (start === end) return null;
  const signIdx =
    start > 0 && (trimmed[start - 1] === "+" || trimmed[start - 1] === "-")
      ? start - 1
      : -1;
  const numStart = signIdx >= 0 ? signIdx : start;
  const num = trimmed.slice(numStart, end);
  if (!isSignedIntegerString(num)) return null;
  return num;
}

function indexOfWord(haystack: string, word: string, from = 0): number {
  const lower = haystack.toLowerCase();
  const w = word.toLowerCase();
  let idx = lower.indexOf(w, from);
  while (idx >= 0) {
    const before = idx === 0 || haystack[idx - 1] === " ";
    const after =
      idx + w.length === haystack.length || haystack[idx + w.length] === " ";
    if (before && after) return idx;
    idx = lower.indexOf(w, idx + 1);
  }
  return -1;
}

function stripCalendarUnit(
  source: string,
  unitVariants: readonly string[],
): [string, string | undefined] {
  for (const unit of unitVariants) {
    const idx = indexOfWord(source, unit);
    if (idx < 0) continue;
    const before = source.slice(0, idx);
    const after = source.slice(idx + unit.length);
    const value = readTrailingInteger(before);
    if (value == null) continue;
    const valueStart = before.trimEnd().length - value.length;
    const rest = normalizeSpaces((before.slice(0, valueStart) + after).trim());
    return [rest, value];
  }
  return [source, undefined];
}

function parseBackendInterval(text: string): bigint | null {
  const trimmed = normalizeSpaces(text.trim());
  let remainder = trimmed;
  let timeParts: HmsTime | undefined;

  const wholeTime = parseHmsSegment(trimmed);
  if (wholeTime) {
    timeParts = wholeTime;
    remainder = "";
  } else {
    const space = findLastSpace(trimmed);
    if (space > 0) {
      const suffix = trimmed.slice(space + 1);
      const parsed = parseHmsSegment(suffix);
      if (parsed) {
        timeParts = parsed;
        remainder = trimmed.slice(0, space).trim();
      }
    }
  }

  let years: string | undefined;
  let months: string | undefined;
  let days: string | undefined;
  [remainder, years] = stripCalendarUnit(remainder, ["years", "year"] as const);
  [remainder, months] = stripCalendarUnit(remainder, ["mons", "mon"] as const);
  [remainder, days] = stripCalendarUnit(remainder, ["days", "day"] as const);

  if (remainder.length > 0) return null;
  if (!years && !months && !days && !timeParts) return null;

  let total = 0n;
  if (years) total += BigInt(Number.parseInt(years, 10)) * MS_PER_YEAR;
  if (months) total += BigInt(Number.parseInt(months, 10)) * MS_PER_MONTH;
  if (days) total += BigInt(Number.parseInt(days, 10)) * MS_PER_DAY;
  if (timeParts) total += hmsToMs(timeParts);
  return total;
}

function parseTimeOnly(text: string): bigint | null {
  const time = parseHmsSegment(text);
  if (!time) return null;
  return hmsToMs(time);
}

function looksLikeDayPlusTime(text: string): boolean {
  const space = text.indexOf(" ");
  if (space <= 0) return false;
  const dayPart = text.slice(0, space).trim();
  const timePart = text.slice(space + 1);
  if (!isDigitsOnly(dayPart)) return false;
  return parseHmsSegment(timePart) !== null;
}

function parseDayTime(text: string): bigint | null {
  const trimmed = text.trim();
  if (!looksLikeDayPlusTime(trimmed)) return null;
  const space = trimmed.indexOf(" ");
  const days = trimmed.slice(0, space).trim();
  const time = parseHmsSegment(trimmed.slice(space + 1));
  if (!time) return null;
  const dayMs = BigInt(days) * MS_PER_DAY;
  const timeMs = hmsToMs(time);
  return dayMs + timeMs;
}

function looksLikeBareHms(text: string): boolean {
  return parseHmsSegment(text) !== null;
}

function parseAmountToMs(amount: string, unitMs: bigint): bigint {
  const sign = amount.startsWith("-") ? -1n : 1n;
  const unsigned =
    amount.startsWith("-") || amount.startsWith("+") ? amount.slice(1) : amount;
  if (unitMs === MS_PER_SECOND && unsigned.includes(".")) {
    const [whole, frac = ""] = unsigned.split(".");
    const wholeMs = BigInt(whole || "0") * MS_PER_SECOND;
    return sign * (wholeMs + fractionToMs(frac));
  }
  if (unitMs === MS_PER_MILLISECOND && unsigned.includes(".")) {
    const [whole, frac = ""] = unsigned.split(".");
    const wholeMs = BigInt(whole || "0");
    if (!frac) return sign * wholeMs;
    const fracMs = BigInt(frac) / 10n ** BigInt(frac.length);
    return sign * (wholeMs + fracMs);
  }
  const numeric = BigInt(unsigned.split(".")[0] || "0");
  return sign * numeric * unitMs;
}

function parseVerboseInterval(text: string): bigint | null {
  const trimmed = text.trim();
  if (!trimmed || looksLikeBareHms(trimmed) || looksLikeDayPlusTime(trimmed)) {
    return null;
  }
  const tokens = normalizeSpaces(trimmed).split(" ");
  if (tokens.length < 2 || tokens.length % 2 !== 0) return null;
  let total = 0n;
  for (let i = 0; i < tokens.length; i += 2) {
    const amount = tokens[i]!;
    const unitKey = tokens[i + 1]!.toLowerCase();
    const unitMs = VERBOSE_UNIT_MS[unitKey];
    if (unitMs === undefined) {
      throw new TypeError("Invalid PostgreSQL interval");
    }
    total += parseAmountToMs(amount, unitMs);
  }
  return total;
}

function assertInt64Ms(ms: bigint): string {
  if (ms < PG_INT64_MIN || ms > PG_INT64_MAX) {
    throw new TypeError("IntervalMs out of signed 64-bit range");
  }
  return ms.toString();
}

/** Convert PostgreSQL interval text to total milliseconds (PG epoch semantics). */
export function pgIntervalTextToMs(text: string): string {
  const backend = parseBackendInterval(text);
  if (backend !== null) return assertInt64Ms(backend);
  const dayTime = parseDayTime(text);
  if (dayTime !== null) return assertInt64Ms(dayTime);
  const timeOnly = parseTimeOnly(text);
  if (timeOnly !== null) return assertInt64Ms(timeOnly);
  const verbose = parseVerboseInterval(text);
  if (verbose !== null) return assertInt64Ms(verbose);
  throw new TypeError("Invalid PostgreSQL interval");
}

/** Convert validated IntervalMs wire string to a PostgreSQL interval literal for storage/filters. */
export function intervalMsToPgInterval(msWire: string): string {
  const ms = BigInt(msWire);
  if (ms === 0n) return "0";
  const sign = ms < 0n ? "-" : "";
  const abs = ms < 0n ? -ms : ms;
  return `${sign}${abs.toString()} milliseconds`;
}
