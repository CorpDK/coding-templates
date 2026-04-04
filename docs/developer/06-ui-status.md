# UI Capability Status Dashboard

Living document. Update this file as packages are installed and decisions are resolved.
For architecture rationale and technology decisions, see [05-ui-architecture.md](05-ui-architecture.md).

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Implemented — in `package.json`, code exists |
| 📦 | Accepted — technology decided, not yet installed |
| 🔲 | TBD — decision not yet made |
| ⚠️ | Optional — app-level decision, not part of template default |

---

## App-Level Capabilities

Capabilities that live in each app (`templates/ui`, `templates/ui-hprt`) rather than a shared package.

### Core Framework & Runtime

| Capability | Technology | `ui` | `ui-hprt` | Notes |
|------------|------------|------|-----------|-------|
| React framework | Next.js 16 (App Router) | ✅ | ✅ | SSR/SSG/RSC |
| Rendering | Next.js | ✅ | ✅ | |
| Routing | Next.js App Router | ✅ | ✅ | |
| Edge/server runtime | Next.js | ⚠️ | ⚠️ | Use per feature |

### GraphQL Client

| Capability | Technology | `ui` | `ui-hprt` | Notes |
|------------|------------|------|-----------|-------|
| GraphQL client | Apollo Client 3 | ✅ | — | Standard apps |
| GraphQL client (HPRT) | urql 5 + Graphcache | — | ✅ | High-frequency real-time |
| Subscriptions | graphql-ws 5 | ✅ | ✅ | Both use graphql-ws |

### REST Caching

| Capability | Technology | `ui` | `ui-hprt` | Notes |
|------------|------------|------|-----------|-------|
| REST caching | @tanstack/react-query | ✅ | ✅ | For non-GraphQL data fetching |

### Authentication & Authorization

| Capability | Technology | `ui` | `ui-hprt` | Notes |
|------------|------------|------|-----------|-------|
| Auth framework | Auth.js v5 (BFF) | ✅ | ✅ | OAuth2/OIDC SSO; via `ui-auth` scaffold |
| Route protection | Next.js middleware | ✅ | ✅ | `middleware.ts` in `ui-auth` scaffold |

### Internationalization

| Capability | Technology | `ui` | `ui-hprt` | Notes |
|------------|------------|------|-----------|-------|
| i18n framework | 🔲 TBD | 🔲 | 🔲 | next-intl leading candidate; global apps only |
| Localization | Depends on i18n | 🔲 | 🔲 | |

### Observability

| Capability | Technology | `ui` | `ui-hprt` | Notes |
|------------|------------|------|-----------|-------|
| Error tracking | 🔲 TBD | 🔲 | 🔲 | Sentry leading candidate |
| Analytics | 🔲 TBD | ⚠️ | ⚠️ | Business apps only |
| Performance monitoring | 🔲 TBD | — | 🔲 | HPRT-specific need |

---

## `ui-core` — Design System & Foundation

| Capability | Technology | `ui` | `ui-hprt` | Notes |
|------------|------------|------|-----------|-------|
| Utility styling | Tailwind CSS v4 | ✅ | ✅ | `@tailwindcss/postcss` installed |
| Component primitives | shadcn/ui (all 54) | ✅ | ✅ | Full shadcn registry in `packages/ui-core/src/components/ui/` |
| Icons | lucide-react | ✅ | ✅ | Bundled with shadcn |
| Dark mode | next-themes | ✅ | ✅ | `ThemeProvider` + `useTheme` exported from `ui-core` |
| Date/time | Luxon | ✅ | ✅ | `formatTimestamp` exported from `ui-core` |
| Client state | Zustand | ✅ | ✅ | Available in `ui-core` |
| Fine-grained state | Jotai | ⚠️ | ⚠️ | Complex UI only |
| Design tokens | CSS variables | ✅ | ✅ | Defined per-app in `globals.scss` via `@theme` |
| Token constants | `TOKENS` object in `ui-core` | ✅ | ✅ | CSS var names as typed constants; use with D3 or inline styles |
| Theme system | CSS vars + Tailwind | ✅ | ✅ | Multi-tenant ready |
| SCSS stylesheets | Sass | ✅ | ✅ | `globals.css` → `globals.scss`; `sass` devDep in all UI templates |
| Brand theming | BrandProvider + Brand JSON | ✅ | ✅ | JSON-driven brand config; 4 presets; Storybook brand switcher. See [10-brand-theming.md](10-brand-theming.md) |
| Brand JSON Schema | JSON Schema (draft-07) | ✅ | ✅ | `brand-config.schema.json` for editor validation + autocomplete |
| Tree-shaking | `"sideEffects": false` | ✅ | ✅ | All 6 shared packages; bundlers drop unused exports |
| Shared ESLint config | `@corpdk/eslint-config` | ✅ | ✅ | `packages/eslint-config`; all packages + templates use it |
| Component demo | `ComponentShowcase` in `ui-core` | ✅ | ✅ | Canonical interactive demo; replaces per-app `PrimitivesDemo` |
| Component stories | Storybook 10 | ✅ | — | In `ui-showcase`; covers all 6 shared packages; `pnpm storybook` |
| Prop documentation | JSDoc on interfaces | ✅ | ✅ | All exported prop interfaces in `ui-core`, `ui-forms`, `ui-datagrid`, `ui-charts` |

### `ui-core` — Layout & Navigation

| Capability | Technology | `ui` | `ui-hprt` | Notes |
|------------|------------|------|-----------|-------|
| App shell | shadcn Sidebar | ✅ | ✅ | `Sidebar*` components exported from `ui-core` |
| Responsive layout | Tailwind | ✅ | ✅ | Covered by Tailwind |
| Navigation components | shadcn NavigationMenu, Menubar, Breadcrumb | ✅ | ✅ | Exported from `ui-core` |

---

## `ui-datagrid` — Data Display & Grids

| Capability | Technology | `ui` | `ui-hprt` | Notes |
|------------|------------|------|-----------|-------|
| Data grid | TanStack Table v8 | ✅ | ✅ | `DataGrid` component with sorting + filtering |
| Virtualization | @tanstack/react-virtual | ✅ | ✅ | `VirtualGrid` component |
| Column features | Custom wrappers | ✅ | ✅ | Sorting, global filter via `useDataGrid` |
| Table UI | shadcn `<Table>` | ✅ | ✅ | Render layer for TanStack Table |

---

## `ui-charts` — Charts & Visualization

| Capability | Technology | `ui` | `ui-hprt` | Notes |
|------------|------------|------|-----------|-------|
| Charting library | D3 | ✅ | ✅ | `LineChart`, `BarChart`, `useD3` hook |
| Real-time charts | D3 | ✅ | ✅ | D3 scales update on data change |
| Themed charts | Wrapper layer | ✅ | ✅ | Components consume CSS var tokens |

---

## `ui-forms` — Forms & Input

| Capability | Technology | `ui` | `ui-hprt` | Notes |
|------------|------------|------|-----------|-------|
| Form state | React Hook Form | ✅ | ✅ | `useZodForm` hook pre-wires resolver |
| Validation | Zod | ✅ | ✅ | `z` re-exported from `ui-forms` |
| Form UI components | shadcn form wrappers | ✅ | ✅ | `FormField` component (RHF Controller) |
| Complex workflows | RHF | ✅ | ✅ | Multi-step, field arrays via RHF API |
| File upload | 🔲 TBD | 🔲 | 🔲 | react-dropzone leading candidate |
| File preview | 🔲 TBD | ⚠️ | ⚠️ | Optional |

---

## `ui-feedback` — Feedback & UX

| Capability | Technology | `ui` | `ui-hprt` | Notes |
|------------|------------|------|-----------|-------|
| Toasts | shadcn Sonner | ✅ | ✅ | `Toaster` + `useToast` hook |
| Dialogs | shadcn Dialog | ✅ | ✅ | Available via `ui-core` shadcn primitives |
| Loading states | shadcn Skeleton + LoadingState | ✅ | ✅ | `LoadingState` in `ui-core` |
| Global error boundary | Custom | ✅ | ✅ | `AppErrorBoundary` class component |
| Notification center | Custom | ⚠️ | ⚠️ | Enterprise apps only |

---

## `ui-auth` — Authentication UI

| Capability | Technology | `ui` | `ui-hprt` | Notes |
|------------|------------|------|-----------|-------|
| Session UI | Auth.js v5 | ✅ | ✅ | `SignInButton`, `SignOutButton`, `SessionProvider`, `useSession` |
| Permission-aware UI | Custom | ✅ | ✅ | `IfAuthenticated`, `IfPermission` gate components |
| BFF boilerplate | `scaffold/` | ✅ | ✅ | Merged into app by `create-app` when `ui-auth` selected |
| Session type augmentation | `AppUserClaims` + `next-auth.d.ts` | ✅ | ✅ | Typed `session.user.role`/`scope`; extend via declaration merging |

---

## Repo-Level — Testing & Documentation

| Capability | Technology | Status | Notes |
|------------|------------|--------|-------|
| Component stories | Storybook 10 | ✅ | `templates/ui-showcase/.storybook/`; `pnpm storybook` |
| Autodocs | `@storybook/addon-docs` | ✅ | Auto-generated from JSDoc on prop interfaces via `tags: ['autodocs']` |
| Accessibility auditing | `@storybook/addon-a11y` | ✅ | axe-core WCAG 2.1 AA checks in Storybook panel |
| Interaction testing | `@storybook/addon-vitest` | ✅ | Vitest + Playwright browser tests via `play` functions; `pnpm --filter @corpdk/ui-showcase test` |
| Visual regression | `@chromatic-com/storybook` | ✅ | Chromatic visual testing integration |
| Unit testing | Vitest | 🔲 | Decision made, adoption timing TBD |
| Component testing | Testing Library | 🔲 | Pairs with Vitest |
| E2E testing | Playwright | 🔲 | Decision made, adoption timing TBD |

---

## Decision Log

| Decision | Chosen | Alternatives Considered | Reason | Date |
|----------|--------|------------------------|--------|------|
| CSS framework | Tailwind CSS v4 | CSS Modules, styled-components, vanilla-extract | Utility-first, zero runtime, v4 eliminates config overhead | Pre-template |
| Component library | shadcn/ui | Radix bare, MUI, Mantine, Chakra | Copy model = full ownership; accessible primitives; no version lock-in | Pre-template |
| Icons | lucide-react | Heroicons, Phosphor, react-icons | Consistent stroke weight; ships with shadcn; tree-shakeable | Pre-template |
| Dark mode | next-themes | Manual CSS vars, Tailwind `prefers-color-scheme` only | SSR-safe; no hydration flash; easy integration with shadcn | Pre-template |
| Date/time | Luxon | date-fns, dayjs | Immutable API; best-in-class timezone + locale support | Pre-template |
| Client state | Zustand | Redux Toolkit, Jotai, Recoil, Context API | Minimal boilerplate; no provider tree; SSR-safe `createStore` pattern | Pre-template |
| Form state | React Hook Form | Formik, TanStack Form | Uncontrolled = no keystroke re-renders; best-in-class performance | Pre-template |
| Validation | Zod | Yup, Valibot, io-ts | TypeScript-first type inference; schema shareable client ↔ server | Pre-template |
| Data grid | TanStack Table v8 | AG-Grid Community, MUI DataGrid, Glide Data Grid | Headless = full styling control; no license cost | Pre-template |
| Virtualization | @tanstack/react-virtual | react-window, react-virtuoso | Same TanStack ecosystem; minimal API surface | Pre-template |
| REST caching | TanStack Query | SWR, Apollo REST link | Richer feature set; DevTools; consistent with TanStack family | Pre-template |
| GraphQL (standard) | Apollo Client 3 | urql (standard), URQL | Largest ecosystem; mature DevTools; production-proven | Pre-template |
| GraphQL (HPRT) | urql + Graphcache | Apollo Client | Graphcache handles high-frequency normalized updates without over-rendering | Pre-template |
| Charts | D3 | Recharts, Nivo, ECharts, Victory | Low-level control; `useD3` hook abstracts attach/cleanup; bundles only what's used | 2026-03 |
| Auth | Auth.js v5 (BFF) | Clerk, custom JWT | OIDC/OAuth2 SSO; BFF keeps tokens server-side; Next.js-native | 2026-03 |
| Component stories | Storybook 10 (`@storybook/nextjs-vite`) | Ladle, Styleguidist, Docz | First-class Next.js + RSC support; Vite-based HMR; autodocs from JSDoc | 2026-03 |
| Brand theming | BrandProvider + Brand JSON | Style Dictionary, Theme UI, vanilla-extract themes | JSON-driven; no build step; works with existing CSS vars + Tailwind pipeline; JSON Schema for validation | 2026-04 |
| CSS preprocessor | Sass (SCSS) | PostCSS-only, Less, Stylus | Nesting, comments, partials; native support in Next.js + Vite; supplements Tailwind PostCSS | 2026-04 |
| i18n | 🔲 TBD | next-intl, next-i18next, Lingui | Global apps only; can be deferred per-app | — |
| Unit testing | 🔲 TBD | Vitest (strong candidate), Jest | Vitest chosen in principle; adoption timing open | — |
| E2E testing | 🔲 TBD | Playwright (strong candidate), Cypress | Playwright chosen in principle; adoption timing open | — |
| Error tracking | 🔲 TBD | Sentry (strong candidate), Datadog, Rollbar | Production infra decision; DSN/org config needed | — |

---

**Related**: [UI Architecture](05-ui-architecture.md) | [Enhancement Backlog](09-enhancement-backlog.md) | [Brand Theming](10-brand-theming.md) | [Technology Decisions](../architecture/05-technology-decisions.md)

**Last updated**: April 3, 2026
