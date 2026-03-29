# UI Enhancement Backlog

Items to address after the main implementation plan is complete.

---

## 1. Testing Infrastructure

Add Vitest to `ui-core` and `ui-forms` — these are the most testable packages (pure utility functions + form logic with no DOM dependencies). Install `vitest` and `@testing-library/react` as devDependencies. Full adoption timing is TBD per the architecture doc, but setting up the runner now unblocks incremental test authoring.

---

## 2. CalVer Graduation (alpha → stable)

Packages are versioned using **CalVer `YYYY.MM.MICRO`** (e.g. `2026.3.0`). Current packages are at `2026.3.0-alpha.1`. Once the package APIs stabilize, drop the pre-release tag to publish the first stable release (`2026.3.0` or the next calendar period). See [02-monorepo-design.md](../architecture/02-monorepo-design.md) for the full CalVer format rules.

---

## 3. i18n Scaffold Pattern

Add `packages/ui-i18n/scaffold/` following the same BFF pattern as `ui-auth`: `next-intl` request handler + middleware + locale message files, merged into the UI app by `create-app` when selected. Mirrors the `ui-auth` scaffold mechanism so the CLI pattern is consistent.

---

## 4. CSS Token Export from `ui-core`

Instead of requiring each consuming app to copy CSS variable definitions into its own `globals.css`, investigate exporting a prebuilt CSS file from `ui-core` (e.g. `@corpdk/ui-core/styles`) that apps can import with a single line. **Blocker:** Turbopack does not resolve the `"style"` export condition used by CSS-exporting packages — the same limitation that blocked importing `shadcn/tailwind.css`. Needs a Turbopack fix or workaround before this is viable.

---

## 5. Storybook for `ui-showcase`

Replace or augment the Next.js showcase pages with a Storybook 8 instance. Enables component-level args/controls/interactions and is the standard reference format for design system consumers. Storybook 8 has first-class RSC and Next.js support.

---

## 6. GitHub Actions CI

Add `.github/workflows/ci.yml`: lint + typecheck + `pnpm build` on every PR. Turbo's remote cache can be wired to Vercel for speed. Ensures the monorepo always builds cleanly before merge.

---

## 7. Component Prop Documentation

Add JSDoc `@param` comments to all exported component props in `ui-core`, `ui-forms`, `ui-datagrid`, and `ui-charts`. Consumers get hover documentation in their IDE without having to open source files.

---

## 8. `useTheme` Re-export from `ui-core`

Re-export `useTheme` from `next-themes` in `ui-core/src/index.ts`. Currently consumers must import it directly from `next-themes`, breaking the pattern of `@corpdk/ui-core` being the single import surface for theme utilities.

---

## 9. Accessibility Audit

Run `axe-core` or `@axe-core/react` against the showcase pages and fix all WCAG 2.1 AA violations. Document any intentional deviations. Accessibility is a prerequisite for enterprise customers.
