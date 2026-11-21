export function sortKeys<T extends Record<string, unknown>>(obj: T): T {
  const ordered = {} as T;
  Object.keys(obj ?? {})
    .sort()
    .forEach((key) => {
      ordered[key as keyof T] = obj[key as keyof T];
    });
  return ordered;
}

export function intersection<T>(a: T[][]): T[] {
  return a.reduce((p, c) => p.filter((e) => c.includes(e)));
}
