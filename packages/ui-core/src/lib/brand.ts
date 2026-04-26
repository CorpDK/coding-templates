import { TOKENS } from "./tokens";

/** Color palette for a single mode (light or dark). */
export interface BrandColorTokens {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  border: string;
  input: string;
  ring: string;
  overlay?: string;
  sidebar?: string;
  sidebarForeground?: string;
  sidebarBorder?: string;
  sidebarAccent?: string;
  sidebarAccentForeground?: string;
  sidebarRing?: string;
  chart1?: string;
  chart2?: string;
  chart3?: string;
  chart4?: string;
  chart5?: string;
}

/** Border radius, border width, and shadow presets. */
export interface BrandShape {
  radius: string;
  borderWidth?: string;
  shadow?: {
    sm?: string;
    md?: string;
    lg?: string;
  };
}

/** Typography overrides. Font loading remains app-level. */
export interface BrandTypography {
  fontSans?: string;
  fontMono?: string;
  fontWeightNormal?: string;
  fontWeightMedium?: string;
  fontWeightBold?: string;
  letterSpacing?: string;
  lineHeight?: string;
}

/** Transition and animation preferences. */
export interface BrandMotion {
  transitionDuration?: string;
  transitionTimingFn?: string;
}

/** Complete brand configuration. */
export interface BrandConfig {
  name: string;
  description?: string;
  logoUrl?: string;
  colors: {
    light: BrandColorTokens;
    dark: BrandColorTokens;
  };
  shape: BrandShape;
  typography?: BrandTypography;
  motion?: BrandMotion;
}

const DEFAULT_COLORS_LIGHT: BrandColorTokens = {
  background: "oklch(1 0 0)",
  foreground: "oklch(0.145 0 0)",
  card: "oklch(1 0 0)",
  cardForeground: "oklch(0.145 0 0)",
  popover: "oklch(1 0 0)",
  popoverForeground: "oklch(0.145 0 0)",
  primary: "oklch(0.205 0 0)",
  primaryForeground: "oklch(0.985 0 0)",
  secondary: "oklch(0.97 0 0)",
  secondaryForeground: "oklch(0.205 0 0)",
  muted: "oklch(0.97 0 0)",
  mutedForeground: "oklch(0.556 0 0)",
  accent: "oklch(0.97 0 0)",
  accentForeground: "oklch(0.205 0 0)",
  destructive: "oklch(0.577 0.245 27.325)",
  border: "oklch(0.922 0 0)",
  input: "oklch(0.922 0 0)",
  ring: "oklch(0.708 0 0)",
  overlay: "oklch(0 0 0 / 80%)",
};

const DEFAULT_COLORS_DARK: BrandColorTokens = {
  background: "oklch(0.145 0 0)",
  foreground: "oklch(0.985 0 0)",
  card: "oklch(0.205 0 0)",
  cardForeground: "oklch(0.985 0 0)",
  popover: "oklch(0.205 0 0)",
  popoverForeground: "oklch(0.985 0 0)",
  primary: "oklch(0.922 0 0)",
  primaryForeground: "oklch(0.205 0 0)",
  secondary: "oklch(0.269 0 0)",
  secondaryForeground: "oklch(0.985 0 0)",
  muted: "oklch(0.269 0 0)",
  mutedForeground: "oklch(0.708 0 0)",
  accent: "oklch(0.269 0 0)",
  accentForeground: "oklch(0.985 0 0)",
  destructive: "oklch(0.704 0.191 22.216)",
  border: "oklch(1 0 0 / 10%)",
  input: "oklch(1 0 0 / 15%)",
  ring: "oklch(0.556 0 0)",
  overlay: "oklch(0 0 0 / 85%)",
};

const DEFAULT_SHAPE: BrandShape = {
  radius: "0.625rem",
  borderWidth: "1px",
  shadow: {
    sm: "0 1px 2px oklch(0 0 0 / 5%)",
    md: "0 4px 6px oklch(0 0 0 / 7%)",
    lg: "0 10px 15px oklch(0 0 0 / 10%)",
  },
};

const DEFAULT_TYPOGRAPHY: BrandTypography = {
  fontWeightNormal: "400",
  fontWeightMedium: "500",
  fontWeightBold: "700",
  letterSpacing: "0em",
  lineHeight: "1.5",
};

const DEFAULT_MOTION: BrandMotion = {
  transitionDuration: "150ms",
  transitionTimingFn: "cubic-bezier(0.4, 0, 0.2, 1)",
};

/** Default neutral brand (baseline). */
export const DEFAULT_BRAND: BrandConfig = {
  name: "Default Neutral",
  description:
    "Achromatic neutral baseline with subtle rounded corners and soft shadows.",
  colors: { light: DEFAULT_COLORS_LIGHT, dark: DEFAULT_COLORS_DARK },
  shape: DEFAULT_SHAPE,
  typography: DEFAULT_TYPOGRAPHY,
  motion: DEFAULT_MOTION,
};

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    const val = override[key];
    if (
      val !== undefined &&
      val !== null &&
      typeof val === "object" &&
      !Array.isArray(val)
    ) {
      result[key] = deepMerge(
        (base[key] ?? {}) as Record<string, unknown>,
        val as Record<string, unknown>,
      );
    } else if (val !== undefined) {
      result[key] = val;
    }
  }
  return result;
}

/**
 * Create a BrandConfig by merging partial overrides onto the default neutral baseline.
 * Only specify what differs from the defaults.
 *
 * @example
 * const brand = createBrandConfig({
 *   name: 'My Brand',
 *   colors: {
 *     light: { primary: 'oklch(0.55 0.2 250)' },
 *     dark: { primary: 'oklch(0.7 0.15 250)' },
 *   },
 *   shape: { radius: '0' },
 * });
 */
export function createBrandConfig(
  overrides: DeepPartial<BrandConfig> & { name: string },
): BrandConfig {
  return deepMerge(
    DEFAULT_BRAND as unknown as Record<string, unknown>,
    overrides as unknown as Record<string, unknown>,
  ) as unknown as BrandConfig;
}

/**
 * Maps a camelCase BrandColorTokens key to its CSS custom property name.
 * Uses the TOKENS constant as the single source of truth.
 */
export function colorKeyToCssVar(key: keyof BrandColorTokens): string {
  return (
    TOKENS[key as keyof typeof TOKENS] ??
    `--${key.replaceAll(/([A-Z])/g, "-$1").toLowerCase()}`
  );
}
