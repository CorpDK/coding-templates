# UI Package Design

Rationale behind the six shared UI packages and the design decisions within each.

---

## Why Six Packages?

The shared packages are divided by concern rather than by feature. Each package has a clearly scoped responsibility and can be installed independently. An app that only needs forms should not pull in chart or data grid code.

The split also maps to natural team and ownership boundaries:
- `ui-core` — design system, owned by whoever governs the visual language
- `ui-datagrid` / `ui-charts` — data display, typically owned by data or analytics teams
- `ui-forms` — input and validation, a cross-cutting concern
- `ui-feedback` — UX patterns, often a shared responsibility
- `ui-auth` — security boundary, typically owned by a platform or security team

All packages build to `dist/` and export from their `package.json` `exports` map, making them publishable to the `@corpdk` npm scope.

---

## `ui-core` — Design System Foundation

**Scope:** Everything an app needs to render consistent, accessible, themeable UI.

| Capability | Technology | Design rationale |
|------------|------------|-----------------|
| Utility styling | Tailwind CSS v4 | CSS-first config via `@theme` — no `tailwind.config.js` file needed; `@import "tailwindcss"` is the entry point |
| Component primitives | shadcn/ui | Copy-into-repo model gives full ownership; no dependency version lock; accessible by default |
| Icons | lucide-react | Bundled with shadcn; consistent stroke weight; tree-shakeable |
| Dark mode | next-themes | Class-based toggling on `<html>` — SSR-safe, no hydration flash |
| Date/time | Luxon | Immutable API; first-class timezone and locale support; avoids the timezone pitfalls of `Date` |
| Client state | Zustand | No provider wrapper needed; SSR-compatible with `createStore`; minimal boilerplate |
| Design tokens | CSS variables in `@theme` | Token definitions stay app-level — each app owns its own `globals.css` for per-tenant theming flexibility |
| Token constants | `TOKENS` object | Maps semantic names to CSS variable strings; enables autocomplete when referencing tokens programmatically (e.g. D3 fills) |
| Component demo | `ComponentShowcase` | Single canonical interactive demo of `SearchInput` + `FilterButton`; exported so all consuming apps share one implementation |

**Key decisions:**
- **shadcn copy model** — components land in `packages/ui-core/src/components/ui/` and are owned by the package. This trades convenience (no upgrade path) for control (the package can evolve the component without waiting for an upstream release).
- **CSS design tokens stay app-level** — not extracted into a shared CSS export because Turbopack does not resolve the `"style"` export condition (see [UI Enhancement #9](../developer/07-ui-enhancements.md)). Each app maintains its own `globals.css` with `@theme` tokens.
- **`"sideEffects": false` on all shared packages** — signals to bundlers (Next.js Webpack/Turbopack) that all exports are pure; unused code can be tree-shaken. Apps that only import `ui-forms` do not pull in `ui-datagrid` code.

---

## `ui-datagrid` — Data Table and Virtualization

**Scope:** High-performance data table rendering for large datasets.

| Capability | Technology | Design rationale |
|------------|------------|-----------------|
| Data grid | TanStack Table v8 | Headless — owns state and logic; rendering is entirely via shadcn's `<Table>` |
| Virtualization | @tanstack/react-virtual | Mandatory for `ui-hprt`; available in `ui` for lists > 500 rows |
| Table UI shell | shadcn `<Table>` | Consistent styling layer; can be swapped without touching table logic |

**Key decision:** TanStack Table is headless by design. Separating table logic from table markup means the grid can be fully restyled without touching sorting, filtering, or pagination logic.

---

## `ui-charts` — Data Visualization

**Scope:** D3-based chart components with theme-integrated styling.

| Capability | Technology | Design rationale |
|------------|------------|-----------------|
| Charting | D3 | Low-level control; bundles only the D3 modules actually used |
| Real-time | D3 | D3 scales update incrementally on data change — no full re-render |
| Theme integration | CSS variable wrappers | Components read `--primary`, `--foreground`, etc. from the token layer |

**Key decision:** `useD3(renderFn, deps)` hook attaches D3 to an SVG ref and handles cleanup, keeping D3 imperative side effects out of React component bodies. Higher-level chart wrappers (Recharts, Nivo) can be layered on top if ergonomics become a concern — D3 doesn't prevent this.

---

## `ui-forms` — Form State and Validation

**Scope:** Form state management, validation, and form-connected UI components.

| Capability | Technology | Design rationale |
|------------|------------|-----------------|
| Form state | React Hook Form (RHF) | Uncontrolled inputs — no re-render on every keystroke; best-in-class performance |
| Validation | Zod | TypeScript-first inference; schemas are shareable with DS packages for client ↔ server validation parity |
| Form UI | shadcn form wrappers | `FormField` wraps RHF's `Controller` — standard shadcn composition |

**Key decision:** Zod schemas defined in `ui-forms` can be imported directly by DS packages for input validation. This eliminates schema drift between client-side and server-side validation without any code generation.

`useZodForm<TSchema>` pre-wires the Zod resolver — no boilerplate at the call site.

---

## `ui-feedback` — User Feedback Patterns

**Scope:** Notifications, loading states, and error presentation.

| Capability | Technology | Design rationale |
|------------|------------|-----------------|
| Toasts | shadcn Sonner | Accessible, stackable; consistent with shadcn component model |
| Dialogs | shadcn Dialog | Focus-trapped, accessible; composable with any trigger |
| Loading | shadcn Skeleton + `LoadingState` | Consistent skeleton shimmer + fallback component for async boundaries |
| Error boundary | `AppErrorBoundary` | React class component wrapping app root; catches uncaught render errors |

---

## `ui-auth` — Authentication UI

**Scope:** Session display, permission-gated rendering, and Auth.js BFF boilerplate.

| Capability | Technology | Design rationale |
|------------|------------|-----------------|
| Session UI | Auth.js v5 | `SignInButton`, `SignOutButton`, `SessionProvider`, `useSession` |
| Gate components | Custom | `IfAuthenticated`, `IfPermission` — render children conditionally based on session state |
| BFF boilerplate | `scaffold/` directory | Merged into the UI app by `create-app`; not included in the npm publish |

**Key decisions:**
- **`AppUserClaims` interface** — exported from `ui-auth` for declaration merging. Consuming apps extend it in their own `types/auth.d.ts` to add SSO-specific claims (`department`, `tenantId`, etc.). The scaffold's `next-auth.d.ts` wires `AppUserClaims` into `Session.user` and `JWT` automatically.
- **BFF pattern** — The app never handles credentials. OAuth2/OIDC authentication is performed server-side by Next.js (acting as the Backend for Frontend). The OAuth2 code exchange happens on the server; tokens are stored server-side; the browser receives only an HttpOnly session cookie. This eliminates the entire class of token leakage vulnerabilities that come from storing tokens in `localStorage` or non-HttpOnly cookies.

The `scaffold/` directory provides the BFF plumbing (`app/api/auth/[...nextauth]/route.ts`, `auth.config.ts`, `middleware.ts`, `next-auth.d.ts`) that `create-app` merges into the output when `ui-auth` is selected. It is intentionally excluded from the npm package.

---

## `eslint-config` — Shared Linting Rules

**Scope:** Consolidated ESLint flat config for all packages and templates in the monorepo.

| Export | File | Use case |
|--------|------|----------|
| `.` (default) | `index.mjs` | Shared library packages (`ui-core`, `ui-auth`, etc.) |
| `./next` | `next.mjs` | Next.js application templates (`ui`, `ui-showcase`) |

Both configs use `eslint-config-next` as a peer dependency (already installed in every consuming package). The `./next` config adds `core-web-vitals` rules on top of the base TypeScript config.

All packages and templates declare `"@corpdk/eslint-config": "workspace:*"` as a devDependency and keep a two-line `eslint.config.mjs` that imports the appropriate preset. Rule changes propagate to the whole monorepo from a single file.
