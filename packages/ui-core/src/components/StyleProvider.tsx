"use client";

import { useEffect, type ReactNode } from "react";
import { ThemeProvider, useTheme, type ThemeProviderProps } from "next-themes";

export { useTheme };
import { TOKENS } from "../lib/tokens";
import {
  type BrandConfig,
  type BrandColorTokens,
  colorKeyToCssVar,
} from "../lib/brand";

const COLOR_KEYS: Array<keyof BrandColorTokens> = [
  "background",
  "foreground",
  "card",
  "cardForeground",
  "popover",
  "popoverForeground",
  "primary",
  "primaryForeground",
  "secondary",
  "secondaryForeground",
  "muted",
  "mutedForeground",
  "accent",
  "accentForeground",
  "destructive",
  "border",
  "input",
  "ring",
  "overlay",
  "sidebar",
  "sidebarForeground",
  "sidebarBorder",
  "sidebarAccent",
  "sidebarAccentForeground",
  "sidebarRing",
  "chart1",
  "chart2",
  "chart3",
  "chart4",
  "chart5",
];

function BrandInjector({
  config,
  children,
}: {
  config: BrandConfig;
  children: ReactNode;
}) {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const el = document.documentElement;
    const appliedVars: string[] = [];

    const mode = resolvedTheme === "dark" ? "dark" : "light";
    const colorSet = config.colors[mode];

    for (const key of COLOR_KEYS) {
      const value = colorSet[key];
      if (value != null) {
        const cssVar = colorKeyToCssVar(key);
        el.style.setProperty(cssVar, value);
        appliedVars.push(cssVar);
      }
    }

    el.style.setProperty(TOKENS.radius, config.shape.radius);
    appliedVars.push(TOKENS.radius);

    if (config.shape.shadow?.sm != null) {
      el.style.setProperty(TOKENS.shadowSm, config.shape.shadow.sm);
      appliedVars.push(TOKENS.shadowSm);
    }
    if (config.shape.shadow?.md != null) {
      el.style.setProperty(TOKENS.shadowMd, config.shape.shadow.md);
      appliedVars.push(TOKENS.shadowMd);
    }
    if (config.shape.shadow?.lg != null) {
      el.style.setProperty(TOKENS.shadowLg, config.shape.shadow.lg);
      appliedVars.push(TOKENS.shadowLg);
    }

    if (config.typography) {
      const typo = config.typography;
      if (typo.fontSans != null) {
        el.style.setProperty(TOKENS.fontSans, typo.fontSans);
        appliedVars.push(TOKENS.fontSans);
      }
      if (typo.fontMono != null) {
        el.style.setProperty(TOKENS.fontMono, typo.fontMono);
        appliedVars.push(TOKENS.fontMono);
      }
      if (typo.fontWeightNormal != null) {
        el.style.setProperty(TOKENS.fontWeightNormal, typo.fontWeightNormal);
        appliedVars.push(TOKENS.fontWeightNormal);
      }
      if (typo.fontWeightMedium != null) {
        el.style.setProperty(TOKENS.fontWeightMedium, typo.fontWeightMedium);
        appliedVars.push(TOKENS.fontWeightMedium);
      }
      if (typo.fontWeightBold != null) {
        el.style.setProperty(TOKENS.fontWeightBold, typo.fontWeightBold);
        appliedVars.push(TOKENS.fontWeightBold);
      }
      if (typo.letterSpacing != null) {
        el.style.setProperty(TOKENS.letterSpacing, typo.letterSpacing);
        appliedVars.push(TOKENS.letterSpacing);
      }
      if (typo.lineHeight != null) {
        el.style.setProperty(TOKENS.lineHeight, typo.lineHeight);
        appliedVars.push(TOKENS.lineHeight);
      }
    }

    if (config.motion) {
      const m = config.motion;
      if (m.transitionDuration != null) {
        el.style.setProperty(TOKENS.transitionDuration, m.transitionDuration);
        appliedVars.push(TOKENS.transitionDuration);
      }
      if (m.transitionTimingFn != null) {
        el.style.setProperty(TOKENS.transitionTimingFn, m.transitionTimingFn);
        appliedVars.push(TOKENS.transitionTimingFn);
      }
    }

    return () => {
      for (const cssVar of appliedVars) {
        el.style.removeProperty(cssVar);
      }
    };
  }, [config, resolvedTheme]);

  return <>{children}</>;
}

export interface StyleProviderProps extends ThemeProviderProps {
  /** Brand configuration. When omitted, globals.scss values are used as-is. */
  brand?: BrandConfig;
}

/**
 * Unified style provider — combines next-themes (light/dark) with brand token injection.
 *
 * @example
 * // With brand
 * <StyleProvider attribute="class" defaultTheme="system" brand={corporateBlueBrand}>
 *   <App />
 * </StyleProvider>
 *
 * @example
 * // Without brand (theme-only, backwards compatible)
 * <StyleProvider attribute="class" defaultTheme="system">
 *   <App />
 * </StyleProvider>
 */
export function StyleProvider({
  brand,
  children,
  ...themeProps
}: StyleProviderProps) {
  if (brand) {
    return (
      <ThemeProvider {...themeProps}>
        <BrandInjector config={brand}>{children}</BrandInjector>
      </ThemeProvider>
    );
  }

  return <ThemeProvider {...themeProps}>{children}</ThemeProvider>;
}
