/**
 * Simple fuzzy search - checks if all characters of query appear in order in the target
 */
export function fuzzyMatch(query: string, target: string): boolean {
  if (!query) return true;

  const lowerQuery = query.toLowerCase();
  const lowerTarget = target.toLowerCase();

  let queryIndex = 0;
  for (
    let i = 0;
    i < lowerTarget.length && queryIndex < lowerQuery.length;
    i++
  ) {
    if (lowerTarget[i] === lowerQuery[queryIndex]) {
      queryIndex++;
    }
  }

  return queryIndex === lowerQuery.length;
}
