# CorpDK UI Template — Architecture Reference

This document defines the UI template architecture: how the current app packages are structured, what reusable packages have been extracted, and the rationale behind every technology decision. It is a stable reference — update it when decisions change, not when implementation progress changes.

For implementation status and installation checklists, see [ui-status.md](ui-status.md).

---

## Current State

The monorepo contains two runnable UI application templates and six shared packages:

| Package | Scope | GraphQL Client | Real-time |
|---------|-------|----------------|-----------|
| `templates/ui` | `@corpdk/ui` | Apollo Client | graphql-ws via split link |
| `templates/ui-hprt` | `@corpdk/ui-hprt` | urql + Graphcache | graphql-ws via subscriptionExchange |

Both apps consume shared capabilities from `packages/ui-*` as workspace dependencies. The key difference between apps is the GraphQL client layer and its caching strategy.

Shared packages (`packages/ui-core`, `packages/ui-feedback`, `packages/ui-forms`, `packages/ui-datagrid`, `packages/ui-charts`, `packages/ui-auth`) are built to `dist/` and are publishable to npm under the `@corpdk` scope. Consuming apps install them as regular npm dependencies from the registry — not as local workspace links — so the `@corpdk` scope is preserved even in scaffolded outputs.

---

## Package Architecture

Shared capabilities extracted into `packages/`. Each package has a clearly scoped responsibility, builds to `dist/`, and exports from its `package.json` `exports` map.

### `ui-core`

**Scope:** Design system foundation. Everything an app needs to render consistent, accessible, themeable UI.

| Capability | Technology | Notes |
|------------|------------|-------|
| Utility styling | Tailwind CSS v4 | `@tailwindcss/postcss` — already installed |
| Component primitives | shadcn/ui | Accessible, unstyled-first, copy-into-repo model |
| Icons | lucide-react | Default icon set bundled with shadcn |
| Dark mode | next-themes | CSS class-based toggling, SSR-safe |
| Date/time | Luxon | Timezone-safe; replaces dayjs/date-fns for complex locale work |
| Client state | Zustand | Minimal boilerplate, React-native feel, SSR-compatible |
| Design tokens | CSS variables | Defined per-app in `globals.css` via `@theme`; supports partner/tenant theming |
| Theme system | CSS vars + Tailwind | Multi-tenant white-label via token overrides per tenant |

**Design notes:**
- shadcn uses a copy-into-repo model — components land in `packages/ui-core/src/components/ui/` and are owned by the package, not a locked dependency.
- Tailwind v4 uses `@import "tailwindcss"` and CSS-first config (`@theme` in globals.css) — no `tailwind.config.js` needed.
- next-themes wraps the root layout and toggles `class="dark"` on `<html>`. Tailwind's `dark:` variant responds to this.
- CSS design tokens (`@theme` block) remain app-level — not extracted. Each app owns its own theme tokens for per-tenant flexibility.

---

### `ui-datagrid`

**Scope:** High-performance data table and virtualized list rendering.

| Capability | Technology | Notes |
|------------|------------|-------|
| Data grid | TanStack Table v8 | Headless — bring your own shadcn table UI |
| Virtualization | @tanstack/react-virtual | Required for HPRT and any list >500 rows |
| Column features | Custom wrappers | Sorting, filtering built on TanStack Table APIs |
| Table UI shell | shadcn `<Table>` | Pairs with TanStack Table as the render layer |

**Design notes:**
- TanStack Table is headless — it owns state and logic, shadcn owns markup and styling. This separation means the grid can be restyled without touching table logic.
- Virtualization via `@tanstack/react-virtual` is mandatory in `ui-hprt` (high-frequency real-time data). Optional in `ui` but available.

---

### `ui-charts`

**Scope:** Data visualization components with consistent theming.

| Capability | Technology | Notes |
|------------|------------|-------|
| Charting library | D3 | `useD3`, `LineChart`, `BarChart` |
| Real-time charts | D3 | D3 scales update incrementally on data change |
| Theme integration | Wrapper layer | Components consume CSS var tokens |

**Design notes:**
- `useD3(renderFn, deps)` hook attaches D3 to an SVG ref and handles cleanup — keeps D3 side effects out of component bodies.
- D3 was chosen for low-level control and zero bundle overhead for unused chart types. Higher-level wrappers (Recharts/Nivo) can be layered on top if ergonomics become a concern.

---

### `ui-forms`

**Scope:** Form state, validation, and form-connected UI components.

| Capability | Technology | Notes |
|------------|------------|-------|
| Form state | React Hook Form (RHF) | Uncontrolled inputs, minimal re-renders |
| Validation | Zod | Schema-first; schemas shared with DS packages |
| Form UI | shadcn form wrappers | `FormField` built on RHF Controller |
| Complex workflows | RHF | Multi-step forms, conditional fields, field arrays |
| File upload | **TBD** | react-dropzone is the leading candidate |
| File preview | **TBD** | Optional; depends on file upload decision |

**Design notes:**
- Zod schemas defined in `ui-forms` can be re-used server-side in DS packages for input validation, keeping client and server validation in sync.
- `useZodForm<TSchema>` pre-wires the Zod resolver — no boilerplate at the call site.

---

### `ui-feedback`

**Scope:** User feedback patterns — notifications, loading states, error presentation.

| Capability | Technology | Notes |
|------------|------------|-------|
| Toasts | shadcn Sonner | `Toaster` component + `useToast` hook |
| Dialogs / modals | shadcn Dialog | Accessible, focus-trapped — via `ui-core` |
| Loading states | shadcn Skeleton + LoadingState | Consistent loading UX across all apps |
| Global error boundary | AppErrorBoundary | React class component wrapping app root |
| Notification center | Custom | Enterprise pattern — optional, app-level decision |

---

### `ui-auth`

**Scope:** Authentication-aware UI. Session display, permission-gated rendering, login/logout flows.

| Capability | Technology | Notes |
|------------|------------|-------|
| Session UI | Auth.js v5 | SignInButton, SignOutButton, SessionProvider, useSession |
| Permission-aware rendering | Custom | `IfAuthenticated`, `IfPermission` gate components |
| BFF boilerplate | `scaffold/` | Auth.js route handler, middleware, env vars |

**Design notes:**
- Auth strategy: the app **never handles credentials**. Auth is entirely SSO via configured OAuth2/OIDC providers. The Next.js server acts as the **BFF (Backend for Frontend)** — it performs the OAuth2 code exchange server-side, stores tokens server-side (never in the browser), and the browser receives only an HttpOnly session cookie.
- `packages/ui-auth/scaffold/` provides BFF boilerplate (`app/api/auth/[...nextauth]/route.ts`, `auth.config.ts`, `middleware.ts`, `.env.example.append`) that `create-app` merges into the UI app directory when `ui-auth` is selected.
- The `scaffold/` directory is not included in the npm publish — it is a `create-app` concern only.

---

## App-Level Configuration

These concerns belong to each individual app (`templates/ui`, `templates/ui-hprt`) and are not extracted into shared packages.

### Next.js & Routing
- App Router — all routes under `app/`
- `next.config.ts` proxies `/api/graphql/*` to `DS_HTTP_URL` (avoids CORS, hides backend origin)
- WebSocket connects directly via `NEXT_PUBLIC_DS_WS_URL` (Next.js cannot proxy WS)
- `output: 'standalone'` required for Docker — bundles the Next.js server into `server.js`

### GraphQL Client

| App | Client | Cache | Subscriptions |
|-----|--------|-------|---------------|
| `ui` | Apollo Client 3 | InMemoryCache | GraphQLWsLink (split link) |
| `ui-hprt` | urql 5 | Graphcache (normalized) | subscriptionExchange + graphql-ws |

Apollo is the default for standard CRUD UIs. urql + Graphcache is reserved for apps with high-frequency real-time data where normalized cache invalidation matters for performance.

### Authentication
Auth.js v5 — BFF pattern (OAuth2/OIDC SSO). Configured via `ui-auth` scaffold. Env vars: `AUTH_SECRET`, `AUTH_ISSUER`, `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`.

### Internationalization
**TBD** — next-intl is the leading candidate. Only required for globally-deployed apps.

### Observability
**TBD** — Sentry is the leading candidate for error tracking.

---

## Technology Decisions

Rationale for each accepted choice.

| Decision | Chosen | Considered | Reason |
|----------|--------|------------|--------|
| CSS framework | Tailwind v4 | CSS Modules, styled-components | Utility-first; no runtime; v4 eliminates config file overhead |
| Component primitives | shadcn/ui | Radix UI (bare), MUI, Mantine | Accessible primitives + copy model = full ownership, no version lock |
| Icons | lucide-react | Heroicons, Phosphor | Ships with shadcn; consistent stroke weight; tree-shakeable |
| Dark mode | next-themes | Manual CSS, Tailwind `prefers-color-scheme` | SSR-safe class toggling; no flash on load |
| Date/time | Luxon | date-fns, dayjs | Immutable API; first-class timezone and locale support |
| Client state | Zustand | Redux Toolkit, Jotai, Context | Minimal API; no provider wrapping; SSR-compatible with `createStore` |
| Form state | React Hook Form | Formik, TanStack Form | Uncontrolled inputs = no re-renders on keystroke; best performance |
| Validation | Zod | Yup, Valibot | TypeScript-first inference; schemas shareable with DS |
| Data grid | TanStack Table v8 | AG-Grid, MUI DataGrid | Headless = full styling control; no license cost; feature parity achievable |
| Virtualization | @tanstack/react-virtual | react-window, react-virtuoso | Same TanStack ecosystem; simple API |
| REST caching | TanStack Query | SWR | Feature-rich; DevTools; consistent with TanStack ecosystem |
| GraphQL (standard) | Apollo Client 3 | urql (standard apps) | Largest ecosystem; mature DevTools; sufficient for standard UIs |
| GraphQL (HPRT) | urql + Graphcache | Apollo (HPRT) | Graphcache normalized cache handles high-frequency updates without over-rendering |
| Charts | D3 | Recharts, Nivo, ECharts, Victory | Low-level control; `useD3` hook abstracts attach/cleanup; bundles only what's used |
| Auth | Auth.js v5 (BFF) | Clerk, custom JWT | OIDC/OAuth2 SSO; BFF keeps tokens server-side; Next.js-native |

---

## Open Decisions

These are genuinely unresolved. They will be worked out separately and this document updated when a decision is made.

| Area | Leading Candidate | Blocker / Notes |
|------|------------------|-----------------|
| **i18n framework** | next-intl | Only needed for global apps; decision can be deferred per-app |
| **Unit/component testing** | Vitest + Testing Library | Stack is clear; adoption timing is the open question |
| **E2E testing** | Playwright | Stack is clear; adoption timing is the open question |
| **Error tracking** | Sentry | Production infra decision; DSN and org config needed |
| **Performance monitoring** | TBD | HPRT-specific; may be Sentry Performance or a custom solution |
| **File upload** | react-dropzone | Confirmed candidate; not yet required by any package |
