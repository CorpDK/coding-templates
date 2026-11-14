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

/** Optional sign prefix then decimal digits (no empty unsigned part). */
export function isSignedIntegerString(s: string): boolean {
  if (s.length === 0) return false;
  let i = 0;
  if (s[0] === "-" || s[0] === "+") i = 1;
  if (i >= s.length) return false;
  return isDigitsOnly(s.slice(i));
}

/** Decimal literal: optional sign, digits, optional fraction. */
export function isDecimalString(s: string): boolean {
  if (s.length === 0) return false;
  let i = 0;
  if (s[0] === "-" || s[0] === "+") i = 1;
  if (i >= s.length) return false;
  const dot = s.indexOf(".", i);
  if (dot < 0) return isDigitsOnly(s.slice(i));
  if (dot === i || dot === s.length - 1) return false;
  return isDigitsOnly(s.slice(i, dot)) && isDigitsOnly(s.slice(dot + 1));
}

export function isHexString(s: string): boolean {
  if (s.length === 0) return false;
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    const digit = code >= 48 && code <= 57;
    const lower = code >= 97 && code <= 102;
    const upper = code >= 65 && code <= 70;
    if (!digit && !lower && !upper) return false;
  }
  return true;
}
