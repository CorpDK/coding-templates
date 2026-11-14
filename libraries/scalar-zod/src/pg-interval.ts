import { PG_INT64_MAX, PG_INT64_MIN } from "./pg-bounds.js";

const MS_PER_SECOND = 1000n;
const MS_PER_MILLISECOND = 1n;
const MS_PER_MINUTE = 60n * MS_PER_SECOND;
const MS_PER_HOUR = 60n * MS_PER_MINUTE;
const MS_PER_DAY = 24n * MS_PER_HOUR;
// Fixed 30-day month; PG calendar `mon` fields are not equal to this ms literal in filters.
const MS_PER_MONTH = 30n * MS_PER_DAY;
// Fixed 365.25-day year; PG calendar `year` fields are not equal to this ms literal in filters.
const MS_PER_YEAR = 31557600000n;

const RE_YEAR = /([+-]?\d+)\s+years?\b/i;
const RE_MON = /([+-]?\d+)\s+mons?\b/i;
const RE_DAY = /([+-]?\d+)\s+days?\b/i;
const RE_TIME_SUFFIX = /\s+([+-])?(\d*):(\d{2}):(\d{2})(?:\.(\d{1,6}))?$/;
const RE_TIME_ONLY = /^([+-])?(\d*):(\d{2}):(\d{2})(?:\.(\d{1,6}))?$/;

const TIME_ONLY = /^([+-])?(\d+):(\d{2}):(\d{2})(?:\.(\d{1,6}))?$/;
const DAY_TIME = /^(\d+)\s+([+-])?(\d+):(\d{2}):(\d{2})(?:\.(\d{1,6}))?$/;

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

function fractionToMs(fraction: string): bigint {
  return BigInt((fraction + "000").slice(0, 3));
}

function stripField(
  source: string,
  pattern: RegExp,
): [string, string | undefined] {
  const match = pattern.exec(source);
  if (!match) return [source, undefined];
  const value = match[1];
  const next = (
    source.slice(0, match.index) + source.slice(match.index + match[0].length)
  )
    .replace(/\s+/g, " ")
    .trim();
  return [next, value];
}

function parseBackendInterval(text: string): bigint | null {
  const trimmed = text.trim();
  let remainder = trimmed;
  let timeSign: string | undefined;
  let hours: string | undefined;
  let minutes: string | undefined;
  let seconds: string | undefined;
  let fraction: string | undefined;

  const suffixTime = RE_TIME_SUFFIX.exec(trimmed);
  if (suffixTime) {
    remainder = trimmed.slice(0, suffixTime.index).trim();
    [, timeSign, hours, minutes, seconds, fraction] = suffixTime;
  } else {
    const onlyTime = RE_TIME_ONLY.exec(trimmed);
    if (onlyTime) {
      [, timeSign, hours, minutes, seconds, fraction] = onlyTime;
      remainder = "";
    }
  }

  let years: string | undefined;
  let months: string | undefined;
  let days: string | undefined;
  [remainder, years] = stripField(remainder, RE_YEAR);
  [remainder, months] = stripField(remainder, RE_MON);
  [remainder, days] = stripField(remainder, RE_DAY);

  if (remainder.length > 0) return null;
  if (!years && !months && !days && hours === undefined) return null;

  let total = 0n;
  if (years) total += BigInt(Number.parseInt(years, 10)) * MS_PER_YEAR;
  if (months) total += BigInt(Number.parseInt(months, 10)) * MS_PER_MONTH;
  if (days) total += BigInt(Number.parseInt(days, 10)) * MS_PER_DAY;

  if (hours !== undefined) {
    const negativeTime = timeSign === "-";
    let h = BigInt(Number.parseInt(hours || "0", 10));
    let min = BigInt(Number.parseInt(minutes!, 10));
    let sec = BigInt(Number.parseInt(seconds!, 10));
    let ms = fraction ? fractionToMs(fraction) : 0n;
    if (negativeTime) {
      h = -h;
      min = -min;
      sec = -sec;
      ms = -ms;
    }
    total += h * MS_PER_HOUR + min * MS_PER_MINUTE + sec * MS_PER_SECOND + ms;
  }
  return total;
}

function parseTimeOnly(text: string): bigint | null {
  const m = TIME_ONLY.exec(text.trim());
  if (!m) return null;
  const [, sign, hours, minutes, seconds, fraction] = m;
  const base =
    BigInt(hours) * MS_PER_HOUR +
    BigInt(minutes) * MS_PER_MINUTE +
    BigInt(seconds) * MS_PER_SECOND +
    (fraction ? fractionToMs(fraction) : 0n);
  return sign === "-" ? -base : base;
}

function parseDayTime(text: string): bigint | null {
  const m = DAY_TIME.exec(text.trim());
  if (!m) return null;
  const [, days, sign, hours, minutes, seconds, fraction] = m;
  const dayMs = BigInt(days) * MS_PER_DAY;
  const timeMs =
    BigInt(hours) * MS_PER_HOUR +
    BigInt(minutes) * MS_PER_MINUTE +
    BigInt(seconds) * MS_PER_SECOND +
    (fraction ? fractionToMs(fraction) : 0n);
  return dayMs + (sign === "-" ? -timeMs : timeMs);
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
  if (!trimmed || TIME_ONLY.test(trimmed) || DAY_TIME.test(trimmed))
    return null;
  const tokens = trimmed.split(/\s+/);
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
