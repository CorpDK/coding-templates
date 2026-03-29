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

## 5. GitHub Actions CI

Add `.github/workflows/ci.yml`: lint + typecheck + `pnpm build` on every PR. Turbo's remote cache can be wired to Vercel for speed. Ensures the monorepo always builds cleanly before merge.

---

## 6. Accessibility Audit

Run `axe-core` or `@axe-core/react` against the Storybook stories; fix all WCAG 2.1 AA violations. Document any intentional deviations. Accessibility is a prerequisite for enterprise customers.

---

## 7. Storybook Interaction Tests

Add `@storybook/test` interaction tests to the existing story files — form validation flows, toast triggers, error boundary recovery, and auth gate state transitions. These run in the Storybook test runner and complement future Vitest unit tests.

---

## 8. Storybook Visual Regression

Integrate Chromatic or `storybook-addon-visual-tests` for automated visual regression snapshots. Catch unintended design changes across PRs without manual review of every component.
