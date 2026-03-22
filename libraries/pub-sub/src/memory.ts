/** Default in-memory pub/sub — zero dependencies, single process only */
export function createMemoryEventTarget(): EventTarget {
  return new EventTarget();
}
