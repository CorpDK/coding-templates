# Monorepo Overview

`coding-templates` is a pnpm + Turborepo monorepo under the `@corpdk` org. It provides production-ready templates and shared libraries for full-stack GraphQL applications.

---

## Repository Layout

```
coding-templates/
├── package.json                    ← workspace root: turbo scripts + devDeps only
├── pnpm-workspace.yaml             ← packages: ["templates/*", "engines/*", "libraries/*", "packages/*"]
├── turbo.json                      ← task pipeline (codegen → build → dev/start)
├── engines/
│   └── create-app/  (@corpdk/create-app)   Interactive CLI scaffolding tool
├── libraries/
│   ├── codegen-cli/ (@corpdk/codegen-cli)   GraphQL codegen plugin for resolver types + SDK generation
│   └── pub-sub/     (@corpdk/pub-sub)       Plugin-style GraphQL pub/sub factory
├── packages/
│   ├── ui-core/     (@corpdk/ui-core)       Design system foundation
│   ├── ui-datagrid/ (@corpdk/ui-datagrid)   Data tables + virtualization
│   ├── ui-charts/   (@corpdk/ui-charts)     D3 chart components
│   ├── ui-forms/    (@corpdk/ui-forms)      React Hook Form + Zod forms
│   ├── ui-feedback/ (@corpdk/ui-feedback)   Toasts, errors, loading states
│   ├── ui-auth/     (@corpdk/ui-auth)       Auth.js v5 BFF scaffold + session UI
│   └── eslint-config/ (@corpdk/eslint-config) Shared ESLint flat config for all packages
└── templates/
    ├── docker/                    Docker templates (not a workspace package)
    ├── ui/          (@corpdk/ui)           Next.js + Apollo Client
    ├── ui-hprt/     (@corpdk/ui-hprt)      Next.js + urql + Graphcache
    ├── ui-showcase/ (@corpdk/ui-showcase)  Storybook showcase — visual testing for all shared packages
    ├── ds/          (@corpdk/ds)           GraphQL Yoga + Prisma + PostgreSQL
    ├── ds-hprt/     (@corpdk/ds-hprt)      GraphQL Yoga + Drizzle + PostgreSQL
    ├── ds-cdb/      (@corpdk/ds-cdb)       GraphQL Yoga + Couchbase SDK + Zod
    ├── ds-mongo/    (@corpdk/ds-mongo)     GraphQL Yoga + MongoDB native driver + Zod
    ├── ds-ddb/      (@corpdk/ds-ddb)       GraphQL Yoga + DocumentDB + Zod
    ├── ds-file/     (@corpdk/ds-file)      GraphQL Yoga + JSON/YAML file storage + Zod
    ├── ds-sdk/      (@corpdk/ds-sdk)       Auto-generated TypedDocumentNode SDK
    └── ds-cli/      (@corpdk/ds-cli)       Auto-generated CLI for LLM/automation access
```

---

## Package Reference

### Template apps

| Package | Scope | Description |
|---------|-------|-------------|
| `ui` | `@corpdk/ui` | Standard Next.js UI using Apollo Client for GraphQL |
| `ui-hprt` | `@corpdk/ui-hprt` | High-performance real-time UI using urql + Graphcache |
| `ui-showcase` | `@corpdk/ui-showcase` | Storybook showcase — visual testing for all 6 shared `packages/ui-*` components; `pnpm storybook` |
| `ds` | `@corpdk/ds` | GraphQL Yoga + Prisma (PostgreSQL / MySQL / SQLite / CockroachDB) |
| `ds-hprt` | `@corpdk/ds-hprt` | GraphQL Yoga + Drizzle, optimised for real-time workloads |
| `ds-cdb` | `@corpdk/ds-cdb` | GraphQL Yoga + Couchbase SDK + Zod |
| `ds-mongo` | `@corpdk/ds-mongo` | GraphQL Yoga + MongoDB native driver + Zod |
| `ds-ddb` | `@corpdk/ds-ddb` | GraphQL Yoga + DocumentDB + Zod |
| `ds-file` | `@corpdk/ds-file` | GraphQL Yoga + JSON/YAML file storage + Zod (zero external dependencies) |
| `ds-sdk` | `@corpdk/ds-sdk` | Auto-generated TypedDocumentNode SDK shared by all DS variants |
| `ds-cli` | `@corpdk/ds-cli` | Auto-generated CLI (queries, mutations, subscriptions) for LLM/automation access; ships with a man page and GNU info page |

### Shared packages

| Package | Scope | Description |
|---------|-------|-------------|
| `ui-core` | `@corpdk/ui-core` | Design system: Tailwind v4, shadcn/ui, dark mode, Zustand, Luxon |
| `ui-datagrid` | `@corpdk/ui-datagrid` | TanStack Table v8 + react-virtual data grid |
| `ui-charts` | `@corpdk/ui-charts` | D3 chart components with CSS token theming |
| `ui-forms` | `@corpdk/ui-forms` | React Hook Form + Zod forms and field components |
| `ui-feedback` | `@corpdk/ui-feedback` | Toasts (Sonner), error boundaries, loading states |
| `ui-auth` | `@corpdk/ui-auth` | Auth.js v5 BFF scaffold, `SessionProvider`, gate components |
| `eslint-config` | `@corpdk/eslint-config` | Shared ESLint flat config (base + Next.js) for all packages |

### Engines and libraries

| Package | Scope | Description |
|---------|-------|-------------|
| `create-app` | `@corpdk/create-app` | Interactive CLI scaffolding tool |
| `codegen-cli` | `@corpdk/codegen-cli` | GraphQL codegen plugin for resolver types + SDK generation |
| `pub-sub` | `@corpdk/pub-sub` | `createAppPubSub<T>()` — selects Redis or in-memory pub/sub |

For versioning strategy and key design decisions (module system, HTTP/WS routing, SDK strategy, repository pattern, pub/sub), see [Monorepo Design](../architecture/02-monorepo-design.md).

---

## Root Scripts

```bash
pnpm dev        # start all packages in dev mode (via Turbo)
pnpm build      # build all packages (codegen → build)
pnpm codegen    # run graphql-codegen for @corpdk/ds
pnpm storybook  # start Storybook for ui-showcase (port 6006)
pnpm create-app # run the interactive scaffolding CLI
```

Per-package:

```bash
pnpm --filter @corpdk/ds dev        # start only ds
pnpm --filter @corpdk/ui dev        # start only ui
pnpm --filter @corpdk/ds codegen    # run codegen for ds
```
