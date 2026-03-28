# UI Enhancement Backlog

Items to address after the main implementation plan is complete.

---

## 1. Shared ESLint Config Package

Create `packages/eslint-config/` — currently each app has its own `eslint.config.mjs`, leading to rule drift over time. A shared config in `packages/eslint-config/index.mjs` that all apps and shared packages extend ensures consistent linting rules across the entire monorepo.

---

## 2. Testing Infrastructure

Add Vitest to `ui-core` and `ui-forms` — these are the most testable packages (pure utility functions + form logic with no DOM dependencies). Install `vitest` and `@testing-library/react` as devDependencies. Full adoption timing is TBD per the architecture doc, but setting up the runner now unblocks incremental test authoring.

---

## 3. Tree-Shaking: `"sideEffects": false`

Add `"sideEffects": false` to all shared package `package.json` files. This signals to bundlers (Next.js Webpack/Turbopack) that all exports are pure and unused exports can be dropped. Critical for bundle size — apps that only use `ui-forms` shouldn't pull in `ui-datagrid` code.

---

## 4. Design Token Constants in `ui-core`

Export a `TOKENS` object mapping CSS variable names to TypeScript constants:

```ts
export const TOKENS = {
  background: '--background',
  foreground: '--foreground',
  primary: '--primary',
  // ...
} as const;
```

Enables autocomplete when referencing theme tokens programmatically (e.g., D3 fills) without hardcoding raw CSS variable strings.

---

## 5. CalVer Graduation (alpha → stable)

Packages are versioned using **CalVer `YYYY.MM.MICRO`** (e.g. `2026.3.0`). Current packages are at `2026.3.0-alpha.1`. Once the package APIs stabilize, drop the pre-release tag to publish the first stable release (`2026.3.0` or the next calendar period).

**Version format rules:**

| Release type | Format | Example |
|---|---|---|
| Stable | `YYYY.MM.MICRO` | `2026.3.0` |
| Alpha | `YYYY.MM.MICRO-alpha.N` | `2026.3.0-alpha.1` |
| Beta | `YYYY.MM.MICRO-beta.N` | `2026.3.0-beta.2` |
| Patch | `YYYY.MM.MICRO` (increment MICRO) | `2026.03.1` |
| Hotfix | `YYYY.MM.MICRO-hotfix.N` | `2026.03.1-hotfix.1` |

---

## 6. `PrimitivesDemo.tsx` → `ComponentShowcase.tsx` in `ui-core`

The current `PrimitivesDemo.tsx` lives in both app templates and will become stale as primitives evolve in `ui-core`. Move it to `packages/ui-core/src/components/ComponentShowcase.tsx` and export it. The showcase template can then import it directly, keeping the demo in sync with the actual exported API.

---

## 7. `next-auth.d.ts` Session Type Augmentation in `ui-auth` scaffold

The scaffold's `auth.config.ts` should include a `next-auth.d.ts` that extends `Session` and `JWT` with role/scope claims, enabling typed `IfPermission` usage without `as any` casts in consuming apps. Without this, `session.user.role` produces a type error and callers must cast.

---

## 8. i18n Scaffold Pattern

Add `packages/ui-i18n/scaffold/` following the same BFF pattern as `ui-auth`: `next-intl` request handler + middleware + locale message files, merged into the UI app by `create-app` when selected. Mirrors the `ui-auth` scaffold mechanism so the CLI pattern is consistent.

---

## 9. CSS Token Export from `ui-core`

Instead of requiring each consuming app to copy CSS variable definitions into its own `globals.css`, investigate exporting a prebuilt CSS file from `ui-core` (e.g. `@corpdk/ui-core/styles`) that apps can import with a single line. **Blocker:** Turbopack does not resolve the `"style"` export condition used by CSS-exporting packages — the same limitation that blocked importing `shadcn/tailwind.css`. Needs a Turbopack fix or workaround before this is viable.

---

## 10. Storybook for `ui-showcase`

Replace or augment the Next.js showcase pages with a Storybook 8 instance. Enables component-level args/controls/interactions and is the standard reference format for design system consumers. Storybook 8 has first-class RSC and Next.js support.

---

## 11. GitHub Actions CI

Add `.github/workflows/ci.yml`: lint + typecheck + `pnpm build` on every PR. Turbo's remote cache can be wired to Vercel for speed. Ensures the monorepo always builds cleanly before merge.
