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
| Component primitives | shadcn/ui | ✅ | ✅ | In `packages/ui-core/src/components/ui/` |
| Icons | lucide-react | ✅ | ✅ | Bundled with shadcn |
| Dark mode | next-themes | ✅ | ✅ | `ThemeProvider` exported from `ui-core` |
| Date/time | Luxon | ✅ | ✅ | `formatTimestamp` exported from `ui-core` |
| Client state | Zustand | ✅ | ✅ | Available in `ui-core` |
| Fine-grained state | Jotai | ⚠️ | ⚠️ | Complex UI only |
| Design tokens | CSS variables | ✅ | ✅ | Defined per-app in `globals.css` via `@theme` |
| Theme system | CSS vars + Tailwind | ✅ | ✅ | Multi-tenant ready |

### `ui-core` — Layout & Navigation

| Capability | Technology | `ui` | `ui-hprt` | Notes |
|------------|------------|------|-----------|-------|
| App shell | Custom + shadcn | 📦 | 📦 | Sidebar/topbar layout — not yet built |
| Responsive layout | Tailwind | ✅ | ✅ | Covered by Tailwind |
| Navigation components | shadcn | 📦 | 📦 | Not yet built |

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

---

## Repo-Level — Testing

| Capability | Technology | Status | Notes |
|------------|------------|--------|-------|
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
| i18n | 🔲 TBD | next-intl, next-i18next, Lingui | Global apps only; can be deferred per-app | — |
| Unit testing | 🔲 TBD | Vitest (strong candidate), Jest | Vitest chosen in principle; adoption timing open | — |
| E2E testing | 🔲 TBD | Playwright (strong candidate), Cypress | Playwright chosen in principle; adoption timing open | — |
| Error tracking | 🔲 TBD | Sentry (strong candidate), Datadog, Rollbar | Production infra decision; DSN/org config needed | — |
