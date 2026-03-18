/**
 * Shared utility functions
 */

// Search utilities
export { fuzzyMatch } from "./search";

// Formatting utilities
export { formatTimestamp } from "./formatting";

/**
 * Merge class names - utility for conditional Tailwind class composition
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
