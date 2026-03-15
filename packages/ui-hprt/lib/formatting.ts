/**
 * Format timestamp from YYYY-MM-DD-HHMMSS to readable format
 */
export function formatTimestamp(timestamp: string): string {
  return timestamp
    .replaceAll("-", "/")
    .replace(/(\d{4}\/\d{2}\/\d{2})\/(\d{2})(\d{2})(\d{2})/, "$1 $2:$3:$4");
}
