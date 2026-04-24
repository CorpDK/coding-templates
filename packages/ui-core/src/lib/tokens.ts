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
  // Core color tokens
  background: "--background",
  foreground: "--foreground",
  card: "--card",
  cardForeground: "--card-foreground",
  popover: "--popover",
  popoverForeground: "--popover-foreground",
  primary: "--primary",
  primaryForeground: "--primary-foreground",
  secondary: "--secondary",
  secondaryForeground: "--secondary-foreground",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  accent: "--accent",
  accentForeground: "--accent-foreground",
  destructive: "--destructive",
  border: "--border",
  input: "--input",
  ring: "--ring",

  // Sidebar
  sidebar: "--sidebar",
  sidebarForeground: "--sidebar-foreground",
  sidebarBorder: "--sidebar-border",
  sidebarAccent: "--sidebar-accent",
  sidebarAccentForeground: "--sidebar-accent-foreground",
  sidebarRing: "--sidebar-ring",

  // Chart palette
  chart1: "--chart-1",
  chart2: "--chart-2",
  chart3: "--chart-3",
  chart4: "--chart-4",
  chart5: "--chart-5",

  // Overlay
  overlay: "--overlay",

  // Shape
  radius: "--radius",
  shadowSm: "--shadow-sm",
  shadowMd: "--shadow-md",
  shadowLg: "--shadow-lg",

  // Typography
  fontSans: "--font-sans",
  fontMono: "--font-mono",
  fontWeightNormal: "--font-weight-normal",
  fontWeightMedium: "--font-weight-medium",
  fontWeightBold: "--font-weight-bold",
  letterSpacing: "--tracking-normal",
  lineHeight: "--leading-normal",

  // Motion
  transitionDuration: "--transition-duration",
  transitionTimingFn: "--transition-timing-fn",
} as const;

export type TokenKey = keyof typeof TOKENS;
export type TokenValue = (typeof TOKENS)[TokenKey];
