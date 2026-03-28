# Technology Decisions

Consolidated record of architectural technology choices — what was chosen, what was considered, and why. Update this document when a decision changes or a new decision is made.

---

## UI Layer

| Decision | Chosen | Considered | Reason |
|----------|--------|------------|--------|
| CSS framework | Tailwind CSS v4 | CSS Modules, styled-components, vanilla-extract | Utility-first; no runtime; v4 eliminates `tailwind.config.js` overhead |
| Component primitives | shadcn/ui | Radix UI (bare), MUI, Mantine, Chakra | Copy-into-repo model = full ownership; accessible primitives; no version lock |
| Icons | lucide-react | Heroicons, Phosphor, react-icons | Consistent stroke weight; ships with shadcn; tree-shakeable |
| Dark mode | next-themes | Manual CSS vars, Tailwind `prefers-color-scheme` only | SSR-safe class toggling; no hydration flash |
| Date/time | Luxon | date-fns, dayjs | Immutable API; first-class timezone and locale support |
| GraphQL client (standard) | Apollo Client 3 | urql (standard apps) | Largest ecosystem; mature DevTools; proven in production |
| GraphQL client (HPRT) | urql 5 + Graphcache | Apollo Client | Graphcache normalised cache handles high-frequency updates without over-rendering |
| REST caching | TanStack Query | SWR, Apollo REST link | Richer feature set; DevTools; consistent with TanStack ecosystem |
| Form state | React Hook Form | Formik, TanStack Form | Uncontrolled inputs = no re-renders on keystroke; best-in-class performance |
| Validation | Zod | Yup, Valibot, io-ts | TypeScript-first inference; schemas shareable client ↔ server |
| Data grid | TanStack Table v8 | AG-Grid Community, MUI DataGrid, Glide Data Grid | Headless = full styling control; no license cost |
| Virtualization | @tanstack/react-virtual | react-window, react-virtuoso | Same TanStack ecosystem; minimal API surface |
| Charts | D3 | Recharts, Nivo, ECharts, Victory | Low-level control; `useD3` hook abstracts attach/cleanup; bundles only what's used |
| Auth | Auth.js v5 (BFF) | Clerk, custom JWT | OIDC/OAuth2 SSO; BFF keeps tokens server-side; Next.js-native |

---

## State Management

Choose based on complexity and team context:

| Choice | Use when |
|--------|----------|
| **Zustand** | Default. Simple API, minimal boilerplate, works for most cases. |
| **Jotai** | Prefer atom-based reactivity: highly modular state, complex UI dependency graphs, or fine-grained re-render control. |
| **Redux Toolkit** | Large team with strict conventions, advanced middleware needs, time-travel debugging, or enterprise compliance requirements. |

Never reach for a heavier solution before exhausting the simpler one. React `useState` + `useContext` is still the right answer for purely local or lightly shared state.

---

## GraphQL Tooling

| Tool | Use when |
|------|----------|
| **GraphQL Yoga** | Default for every DS. You own the schema and call your own databases. |
| **GraphQL Mesh** | Add only when you must stitch 2+ external APIs you don't own (REST/gRPC/OpenAPI/GraphQL) into one unified graph. Overkill for a single owned source. |
| **GraphQL Hive** | Add when: 3+ devs modify the schema independently, API is public/partner-facing, or you run a federated supergraph. Not warranted for a private monorepo with a small team. |

---

## Open Decisions

Unresolved technology choices. Update this table when a decision is made.

| Area | Leading Candidate | Blocker / Notes | Date opened |
|------|------------------|-----------------|-------------|
| i18n framework | next-intl | Global apps only; can be deferred per-app | Pre-template |
| Unit/component testing | Vitest + Testing Library | Stack is clear; adoption timing is the open question | Pre-template |
| E2E testing | Playwright | Stack is clear; adoption timing is the open question | Pre-template |
| Error tracking | Sentry | Production infra decision; DSN and org config needed | Pre-template |
| Performance monitoring | TBD | HPRT-specific; may be Sentry Performance or custom | Pre-template |
| File upload | react-dropzone | Confirmed candidate; not yet required by any package | Pre-template |
