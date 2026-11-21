export function isEmpty(x: Record<string, unknown> | undefined | null) {
  if (!x) {
    return true;
  }
  return Object.keys(x).length === 0;
}
