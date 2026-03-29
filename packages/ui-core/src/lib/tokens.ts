/**
 * CSS custom property names for all design tokens.
 *
 * Use these constants when referencing theme tokens programmatically
 * (e.g. in D3 fill values, canvas drawing, or inline style computations)
 * to get autocomplete and avoid hardcoding raw CSS variable strings.
 *
 * @example
 * // In a D3 chart component
 * import { TOKENS } from '@corpdk/ui-core';
 * const color = getComputedStyle(el).getPropertyValue(TOKENS.primary);
 */
export const TOKENS = {
  background: '--background',
  foreground: '--foreground',
  card: '--card',
  cardForeground: '--card-foreground',
  popover: '--popover',
  popoverForeground: '--popover-foreground',
  primary: '--primary',
  primaryForeground: '--primary-foreground',
  secondary: '--secondary',
  secondaryForeground: '--secondary-foreground',
  muted: '--muted',
  mutedForeground: '--muted-foreground',
  accent: '--accent',
  accentForeground: '--accent-foreground',
  destructive: '--destructive',
  border: '--border',
  input: '--input',
  ring: '--ring',
  radius: '--radius',
} as const;

export type TokenKey = keyof typeof TOKENS;
export type TokenValue = (typeof TOKENS)[TokenKey];
