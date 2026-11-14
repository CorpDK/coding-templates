export function isAsciiDigit(ch: string): boolean {
  return ch.length === 1 && ch >= "0" && ch <= "9";
}

export function isDigitsOnly(s: string): boolean {
  if (s.length === 0) return false;
  for (const ch of s) {
    if (!isAsciiDigit(ch)) return false;
  }
  return true;
}

function stripOptionalSign(s: string): string | null {
  if (s.length === 0) return null;
  if (s.startsWith("-") || s.startsWith("+")) {
    const unsigned = s.slice(1);
    return unsigned.length > 0 ? unsigned : null;
  }
  return s;
}

/** Optional sign prefix then decimal digits (no empty unsigned part). */
export function isSignedIntegerString(s: string): boolean {
  const unsigned = stripOptionalSign(s);
  return unsigned !== null && isDigitsOnly(unsigned);
}

/** Decimal literal: optional sign, digits, optional fraction. */
export function isDecimalString(s: string): boolean {
  const unsigned = stripOptionalSign(s);
  if (unsigned === null) return false;
  const dot = unsigned.indexOf(".");
  if (dot < 0) return isDigitsOnly(unsigned);
  if (dot === 0 || dot === unsigned.length - 1) return false;
  return (
    isDigitsOnly(unsigned.slice(0, dot)) &&
    isDigitsOnly(unsigned.slice(dot + 1))
  );
}

function isHexCodePoint(code: number): boolean {
  const digit = code >= 0x30 && code <= 0x39;
  const lower = code >= 0x61 && code <= 0x66;
  const upper = code >= 0x41 && code <= 0x46;
  return digit || lower || upper;
}

export function isHexString(s: string): boolean {
  if (s.length === 0) return false;
  for (const ch of s) {
    const code = ch.codePointAt(0);
    if (code === undefined || !isHexCodePoint(code)) return false;
  }
  return true;
}

function isTwoDigitTimeField(seg: string): boolean {
  return seg.length === 2 && isAsciiDigit(seg[0]!) && isAsciiDigit(seg[1]!);
}

function findTimeTzOffsetStart(value: string): number {
  if (value.endsWith("Z")) return value.length - 1;
  const plus = value.lastIndexOf("+");
  const minus = value.lastIndexOf("-");
  const candidate = Math.max(plus, minus);
  return candidate > 0 ? candidate : -1;
}

function isTimeTzOffsetPartValid(offsetPart: string): boolean {
  if (offsetPart === "Z") return true;
  if (offsetPart.length !== 6 || offsetPart[3] !== ":") return false;
  return (
    isTwoDigitTimeField(offsetPart.slice(1, 3)) &&
    isTwoDigitTimeField(offsetPart.slice(4, 6))
  );
}

function isTimeTzSecondsFieldValid(sec: string): boolean {
  const dot = sec.indexOf(".");
  if (dot < 0) return true;
  const whole = sec.slice(0, dot);
  const frac = sec.slice(dot + 1);
  if (whole.length !== 2 || frac.length === 0 || frac.length > 3) return false;
  return isDigitsOnly(frac);
}

function isTimeTzTimePartValid(timePart: string): boolean {
  const segments = timePart.split(":");
  if (segments.length < 2 || segments.length > 3) return false;
  for (const seg of segments) {
    if (!isTwoDigitTimeField(seg)) return false;
  }
  if (segments.length === 3) {
    return isTimeTzSecondsFieldValid(segments[2]!);
  }
  return true;
}

/** ISO-8601 time with `Z` or `±HH:MM` offset (GraphQL TimeTz wire). */
export function isTimeTzWire(value: string): boolean {
  const offsetStart = findTimeTzOffsetStart(value);
  if (offsetStart < 0) return false;
  const timePart = value.slice(0, offsetStart);
  const offsetPart = value.slice(offsetStart);
  if (!isTimeTzOffsetPartValid(offsetPart)) return false;
  return isTimeTzTimePartValid(timePart);
}
