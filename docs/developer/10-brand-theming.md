# Brand Theming

Brand theming lets consumers of `@corpdk/ui-*` libraries apply their organization's visual identity without modifying library source code. A **Brand JSON file** defines all visual tokens — colors, shape, typography, and motion — and `StyleProvider` injects them as CSS custom properties at runtime.

**Related**: [UI Architecture](05-ui-architecture.md) | [UI Status](06-ui-status.md)

---

## Architecture

```text
Brand JSON ──▶ StyleProvider ──▶ CSS Custom Properties ──▶ Tailwind classes ──▶ Components
                    │
                    ├─ ThemeProvider (next-themes) → light/dark class
                    └─ BrandInjector → reads resolved theme, sets CSS vars
```

1. Brand JSON defines token values (OKLCH colors, radii, shadows, typography, motion)
2. `StyleProvider` combines next-themes (light/dark toggle) with brand token injection into a single provider
3. Tailwind's `@theme inline` block maps CSS variables to utility classes (`bg-primary`, `text-foreground`, etc.)
4. shadcn/ui components in `ui-core` consume these classes — no component changes needed

Apps without a `brand` prop on `StyleProvider` get theme-only behavior (backwards compatible).

---

## Quick Start

### 1. Use a built-in preset

```tsx
import { StyleProvider, corporateBlueBrand } from "@corpdk/ui-core";
import type { BrandConfig } from "@corpdk/ui-core";

export default function Layout({ children }) {
  return (
    <StyleProvider
      attribute="class"
      defaultTheme="light"
      brand={corporateBlueBrand as BrandConfig}
    >
      {children}
    </StyleProvider>
  );
}
```

`StyleProvider` accepts all `ThemeProvider` props (from next-themes) plus an optional `brand` prop. When `brand` is omitted, it behaves identically to `ThemeProvider`.

### 2. Create a custom brand

Create a JSON file with `$schema` for editor validation:

```json
{
  "$schema": "./node_modules/@corpdk/ui-core/dist/brands/brand-config.schema.json",
  "name": "My Brand",
  "colors": {
    "light": {
      "background": "oklch(1 0 0)",
      "foreground": "oklch(0.15 0 0)",
      "primary": "oklch(0.5 0.2 260)",
      "primaryForeground": "oklch(0.99 0 0)",
      ...
    },
    "dark": { ... }
  },
  "shape": {
    "radius": "0.5rem",
    "borderWidth": "1px",
    "shadow": {
      "sm": "0 1px 2px oklch(0 0 0 / 5%)",
      "md": "0 4px 6px oklch(0 0 0 / 7%)",
      "lg": "0 10px 15px oklch(0 0 0 / 10%)"
    }
  }
}
```

### 3. Use `createBrandConfig` for partial overrides

Only specify what differs from the neutral baseline:

```tsx
import { createBrandConfig } from "@corpdk/ui-core";

const myBrand = createBrandConfig({
  name: "My Brand",
  colors: {
    light: {
      primary: "oklch(0.5 0.2 260)",
      primaryForeground: "oklch(0.99 0 0)",
    },
    dark: {
      primary: "oklch(0.7 0.15 260)",
      primaryForeground: "oklch(0.1 0 0)",
    },
  },
  shape: { radius: "0" },
});
```

---

## Brand JSON Schema Reference

The schema is defined in `packages/ui-core/src/brands/brand-config.schema.json` and published at `dist/brands/brand-config.schema.json`.

### Required fields

| Field          | Type               | Description                                                                   |
| -------------- | ------------------ | ----------------------------------------------------------------------------- |
| `name`         | `string`           | Human-readable brand name                                                     |
| `colors.light` | `BrandColorTokens` | Light mode color palette (18 required + optional sidebar/chart)               |
| `colors.dark`  | `BrandColorTokens` | Dark mode color palette                                                       |
| `shape.radius` | `string`           | Base border radius (`"0"` for sharp, `"0.625rem"` default, `"1rem"` for pill) |

### Color tokens (required)

`background`, `foreground`, `card`, `cardForeground`, `popover`, `popoverForeground`, `primary`, `primaryForeground`, `secondary`, `secondaryForeground`, `muted`, `mutedForeground`, `accent`, `accentForeground`, `destructive`, `border`, `input`, `ring`

### Color tokens (optional)

`sidebar`, `sidebarForeground`, `sidebarBorder`, `sidebarAccent`, `sidebarAccentForeground`, `sidebarRing`, `chart1`–`chart5`

### Shape

| Field             | Default        | Description                                                    |
| ----------------- | -------------- | -------------------------------------------------------------- |
| `radius`          | (required)     | Base border radius. Derived radii computed via `@theme inline` |
| `borderWidth`     | `"1px"`        | Default border thickness                                       |
| `shadow.sm/md/lg` | subtle shadows | Box shadows. Use `"none"` for flat brands                      |

### Typography

| Field              | Default | Description                         |
| ------------------ | ------- | ----------------------------------- |
| `fontSans`         | —       | Sans-serif font stack               |
| `fontMono`         | —       | Monospace font stack                |
| `fontWeightNormal` | `"400"` | Normal text weight                  |
| `fontWeightMedium` | `"500"` | Medium weight (labels, subheadings) |
| `fontWeightBold`   | `"700"` | Bold weight (headings)              |
| `letterSpacing`    | `"0em"` | Letter spacing                      |
| `lineHeight`       | `"1.5"` | Line height                         |

### Motion

| Field                | Default                        | Description                                        |
| -------------------- | ------------------------------ | -------------------------------------------------- |
| `transitionDuration` | `"150ms"`                      | Default transition speed. `"0ms"` for no animation |
| `transitionTimingFn` | `cubic-bezier(0.4, 0, 0.2, 1)` | Easing function                                    |

---

## Built-in Presets

| Preset           | Import                 | Description                                                  |
| ---------------- | ---------------------- | ------------------------------------------------------------ |
| Default Neutral  | `defaultNeutralBrand`  | Achromatic grays, `0.625rem` radius, subtle shadows          |
| Corporate Blue   | `corporateBlueBrand`   | Professional blue primary, `0.5rem` radius                   |
| Sharp Enterprise | `sharpEnterpriseBrand` | Zero radius, 2px borders, no shadows, tighter spacing        |
| Vibrant Startup  | `vibrantStartupBrand`  | Purple/pink, `1rem` radius, prominent shadows, bouncy easing |

---

## Storybook Brand Switcher

The Storybook showcase (`ui-showcase`) includes a **Brand** toolbar selector that lets you preview all components under any brand preset. The selector is wired via `globalTypes` in `.storybook/preview.tsx` and wraps stories with `StyleProvider`.

To add a custom brand to the Storybook selector:

1. Create a brand JSON file in `packages/ui-core/src/brands/`
2. Export it from `packages/ui-core/src/index.ts`
3. Add it to the `BRAND_MAP` in `templates/ui-showcase/.storybook/preview.tsx`

---

## SCSS Stylesheets

All `globals.css` files have been migrated to `globals.scss`. The SCSS files retain full Tailwind compatibility — SCSS is processed first, then Tailwind's PostCSS plugin runs.

SCSS adds value for:

- Organized SCSS comments (`//`) for token sections
- Future use of SCSS partials, mixins, and nesting for complex brand logic

The `sass` package is installed as a devDependency in `ui-showcase`, `ui`, and `ui-hprt`. Both Next.js and Storybook (Vite) natively support SCSS when `sass` is present.

---

## How StyleProvider Works

`StyleProvider` is a unified provider that:

1. Wraps `ThemeProvider` from next-themes (handles the `light`/`dark` class on `<html>`)
2. When a `brand` prop is provided, renders an internal `BrandInjector` that:
   - Reads the resolved theme via `useTheme()`
   - In a `useEffect`, sets CSS custom properties on `document.documentElement` for all tokens in the active color set
   - Applies shape, typography, and motion tokens similarly
   - On cleanup (unmount or config change), removes all properties it set
3. When `brand` is omitted, renders `ThemeProvider` only — fully backwards compatible

Brand token injection overrides `:root` CSS values at the highest specificity (inline style on `<html>`). When removed, the `globals.scss` values take effect again.

`useTheme` is re-exported from `@corpdk/ui-core` alongside `StyleProvider` for components that need to read the resolved theme programmatically.

---

**Last updated**: April 3, 2026
