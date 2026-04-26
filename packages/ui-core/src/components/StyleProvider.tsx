"use client";

import { useEffect, type ReactNode } from "react";
import { ThemeProvider, useTheme, type ThemeProviderProps } from "next-themes";

export { useTheme } from "next-themes";
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
}: Readonly<{
  config: BrandConfig;
  children: ReactNode;
}>) {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const el = document.documentElement;
    const appliedVars: string[] = [];

    const setVar = (cssVar: string, value: string | null | undefined) => {
      if (value == null) return;
      el.style.setProperty(cssVar, value);
      appliedVars.push(cssVar);
    };

    const mode = resolvedTheme === "dark" ? "dark" : "light";
    const colorSet = config.colors[mode];
    for (const key of COLOR_KEYS) {
      setVar(colorKeyToCssVar(key), colorSet[key]);
    }

    setVar(TOKENS.radius, config.shape.radius);
    setVar(TOKENS.shadowSm, config.shape.shadow?.sm);
    setVar(TOKENS.shadowMd, config.shape.shadow?.md);
    setVar(TOKENS.shadowLg, config.shape.shadow?.lg);

    const typo = config.typography;
    if (typo) {
      setVar(TOKENS.fontSans, typo.fontSans);
      setVar(TOKENS.fontMono, typo.fontMono);
      setVar(TOKENS.fontWeightNormal, typo.fontWeightNormal);
      setVar(TOKENS.fontWeightMedium, typo.fontWeightMedium);
      setVar(TOKENS.fontWeightBold, typo.fontWeightBold);
      setVar(TOKENS.letterSpacing, typo.letterSpacing);
      setVar(TOKENS.lineHeight, typo.lineHeight);
    }

    const m = config.motion;
    if (m) {
      setVar(TOKENS.transitionDuration, m.transitionDuration);
      setVar(TOKENS.transitionTimingFn, m.transitionTimingFn);
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
}: Readonly<StyleProviderProps>) {
  if (brand) {
    return (
      <ThemeProvider {...themeProps}>
        <BrandInjector config={brand}>{children}</BrandInjector>
      </ThemeProvider>
    );
  }

  return <ThemeProvider {...themeProps}>{children}</ThemeProvider>;
}
