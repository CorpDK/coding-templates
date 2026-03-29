# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **pnpm + Turborepo monorepo** under the `@corpdk` org — a production-ready template for full-stack GraphQL applications with Next.js frontend(s) and GraphQL Yoga backend(s).

## Monorepo Layout

```
coding-templates/
├── package.json                    ← workspace root: turbo scripts + devDeps only
├── pnpm-workspace.yaml             ← packages: ["templates/*", "engines/*", "libraries/*", "packages/*"]
├── turbo.json                      ← task pipeline (codegen → build → dev/start)
├── CLAUDE.md                       ← this file
├── docs/                           ← all documentation (user / admin / developer)
├── engines/
│   └── create-app/  (@corpdk/create-app)   Interactive CLI scaffolding tool
├── libraries/
│   └── pub-sub/     (@corpdk/pub-sub)       Plugin-style GraphQL pub/sub factory (memory + Redis)
├── packages/
│   ├── ui-core/     (@corpdk/ui-core)       Design system, primitives, shadcn/ui, theming
│   ├── ui-auth/     (@corpdk/ui-auth)        Auth.js v5 BFF components + OAuth2/OIDC scaffold
│   ├── ui-charts/   (@corpdk/ui-charts)     D3.js chart components
│   ├── ui-forms/    (@corpdk/ui-forms)       React Hook Form + Zod validation wrappers
│   ├── ui-datagrid/ (@corpdk/ui-datagrid)   TanStack Table v8 + virtualization
│   └── ui-feedback/ (@corpdk/ui-feedback)   Toast notifications + error boundaries
└── templates/
    ├── docker/                    Docker templates (not a workspace package)
    │   ├── Dockerfile.ds          DS variant template (copied to packages/<ds>/Dockerfile)
    │   └── Dockerfile.ui          UI variant template (copied to packages/<ui>/Dockerfile)
    ├── ui/          (@corpdk/ui)           Next.js + Apollo Client
    ├── ui-hprt/     (@corpdk/ui-hprt)      Next.js + urql + Graphcache
    ├── ui-showcase/ (@corpdk/ui-showcase)  Showcase app — demonstrates all shared packages
    ├── ds/          (@corpdk/ds)           GraphQL Yoga + Prisma + PostgreSQL
    ├── ds-hprt/     (@corpdk/ds-hprt)      GraphQL Yoga + Drizzle + PostgreSQL
    ├── ds-cdb/      (@corpdk/ds-cdb)       GraphQL Yoga + Couchbase SDK + Zod
    ├── ds-mongo/    (@corpdk/ds-mongo)     GraphQL Yoga + MongoDB native driver + Zod
    ├── ds-ddb/      (@corpdk/ds-ddb)       GraphQL Yoga + DocumentDB (documentdb.io) + Zod
    ├── ds-file/     (@corpdk/ds-file)      GraphQL Yoga + JSON/YAML file storage + Zod
    ├── ds-sdk/      (@corpdk/ds-sdk)       TypedDocumentNode SDK (shared by all DS variants)
    └── ds-cli/      (@corpdk/ds-cli)       Auto-generated CLI for LLM/automation access to the GraphQL DS
```

### Package Purpose

| Package | Scope | Description |
|---------|-------|-------------|
| `ui` | `@corpdk/ui` | Standard Next.js UI using Apollo Client for GraphQL |
| `ui-hprt` | `@corpdk/ui-hprt` | High-performance real-time UI using urql + Graphcache |
| `ds` | `@corpdk/ds` | GraphQL Yoga server with Prisma ORM (PostgreSQL/MySQL/SQLite/CockroachDB/MongoDB) |
| `ds-hprt` | `@corpdk/ds-hprt` | GraphQL Yoga server with Drizzle ORM (PostgreSQL/MySQL/SQLite/CockroachDB), optimized for real-time |
| `ds-cdb` | `@corpdk/ds-cdb` | GraphQL Yoga server with Couchbase SDK + Zod (cloud-agnostic NoSQL) |
| `ds-mongo` | `@corpdk/ds-mongo` | GraphQL Yoga server with MongoDB native driver + Zod (Atlas or self-hosted) |
| `ds-ddb` | `@corpdk/ds-ddb` | GraphQL Yoga server with DocumentDB (documentdb.io) + Zod (MongoDB-compatible wire protocol) |
| `ds-file` | `@corpdk/ds-file` | GraphQL Yoga server with JSON/YAML file storage + Zod (zero external dependencies) |
| `ds-sdk` | `@corpdk/ds-sdk` | Auto-generated TypedDocumentNode SDK shared by all DS variants |
| `ds-cli` | `@corpdk/ds-cli` | Auto-generated CLI (queries, mutations, subscriptions) for LLM/automation access; man page + GNU info included |
| `pub-sub` | `@corpdk/pub-sub` | Plugin-style pub/sub factory: `createAppPubSub<T>()` selects Redis or in-memory; topics defined per app |
| `ui-core` | `@corpdk/ui-core` | Design system: shadcn/ui, Tailwind v4, lucide icons, next-themes, Zustand |
| `ui-auth` | `@corpdk/ui-auth` | Auth.js v5 BFF: sign-in/out components, session gates, OAuth2/OIDC scaffold |
| `ui-charts` | `@corpdk/ui-charts` | D3.js chart components with CSS variable theming |
| `ui-forms` | `@corpdk/ui-forms` | React Hook Form + Zod integration (form fields, resolvers) |
| `ui-datagrid` | `@corpdk/ui-datagrid` | TanStack Table v8 + @tanstack/react-virtual for large datasets |
| `ui-feedback` | `@corpdk/ui-feedback` | Sonner toast notifications + AppErrorBoundary |

### Key Design Decisions

- **`"type": "module"` on DS packages only** — Yoga v5 is pure ESM; Next.js manages its own module system
- **HTTP via Next.js proxy, WS direct** — `rewrites()` handles queries/mutations; WebSocket connects directly via `NEXT_PUBLIC_DS_WS_URL` (avoids Next.js WS proxy limitations)
- **SDK as workspace dependency** — `ui` depends on `@corpdk/ds-sdk: "workspace:*"`; Turbo ensures codegen runs before build
- **All ports from env, no defaults** — prevents port collision surprises; each package has `.env.example`
- **`.js` extension on imports in DS server packages** — all DS packages (`ds`, `ds-hprt`, `ds-cdb`, `ds-mongo`, `ds-ddb`, `ds-file`) use `module: NodeNext` (pure ESM Node.js runtime); explicit `.js` is required even for `.ts` source files. `ds-sdk` uses `module: ESNext / moduleResolution: bundler` (consumed by Next.js bundler) and must omit the `.js` extension.
- **Single shared SDK** — all DS variants codegen into `@corpdk/ds-sdk` (one package, schema-identical output); the consolidated SDK replaced the former per-variant `ds-sdk-hprt` and `ds-sdk-cdb` packages.
- **`dev` depends on `^build`** — Turbo's `dev` task declares `dependsOn: ["^build"]` so codegen and upstream builds complete before Next.js starts, preventing missing-type errors on first launch.
- **Repository Pattern in all DS packages** — every DS package exposes `src/db/repository.ts` with an `IItemRepository` interface. GraphQL resolvers in `schema.ts` call only `itemRepository.*` — never DB-specific APIs directly.
- **GraphQL SDL in `src/schema/`** — DS packages define the schema as multiple `.graphqls` files in `src/schema/` (not inline in TypeScript). `base.graphqls` declares empty root types; feature files use `extend type` to add fields. Loaded at runtime by scanning the directory with `readdirSync`. Codegen uses `./src/schema/**/*.graphqls`. The directory is copied to `dist/` as part of the build script (`cp -r src/schema dist/`).
- **Plugin-style pub/sub via `@corpdk/pub-sub`** — all DS packages use `createAppPubSub<T>()` from the shared library to wire up memory or Redis event targets. Topics (`PubSubTopics`) are defined locally in each package's `src/pubsub/index.ts`.
- **Publishing: npmjs vs Artifactory** — engines, libraries, and `packages/*` (including `eslint-config`) publish to **npmjs** (public, `"access": "public"`). Templates publish to a **private Artifactory** registry. Only the workspace root stays `"private": true`. See [docs/architecture/02-monorepo-design.md](docs/architecture/02-monorepo-design.md) for the full publishing strategy.
- **Shared tsconfig hierarchy** — four base configs at the workspace root (`tsconfig.base.json` → `tsconfig.node.json`, `tsconfig.react.json` → `tsconfig.next.json`). All packages target **ES2024**. Per-package tsconfigs declare only local overrides.

## Coding Standards

**All code changes MUST follow the guidelines in [docs/developer/08-coding-guidelines.md](docs/developer/08-coding-guidelines.md)**.

Key principles:

- **Pure Components**: Single responsibility, no side effects, predictable outputs
- **No Duplication**: Extract shared code to utilities or reusable components
- **Type Safety**: Centralized type definitions in `types/` directory per package
- **Component Size Limits**: Pages < 100 lines, Views < 250 lines, UI components < 50 lines

## GraphQL Tooling Decision Table

| Tool | Use when |
|------|----------|
| **GraphQL Yoga** | Default for every DS. You own the schema and call your own databases. |
| **GraphQL Mesh** | Add only when you must stitch 2+ external APIs you don't own (REST/gRPC/OpenAPI/GraphQL) into one unified graph. Overkill for a single owned source. |
| **GraphQL Hive** | Add when: 3+ devs modify the schema independently, API is public/partner-facing, or you run a federated supergraph. Not warranted for a private monorepo with a small team. |

## Development Workflow

```bash
# From repo root
pnpm install              # Install all workspace deps
pnpm dev                  # Start all packages in dev mode (via Turbo)
pnpm build                # Build all packages (codegen → build)
pnpm --filter @corpdk/ds dev        # Start only ds
pnpm --filter @corpdk/ui dev        # Start only ui
pnpm codegen                        # Run graphql-codegen for @corpdk/ds (root shortcut)
pnpm showcase                       # Start @corpdk/ui-showcase dev server
pnpm --filter @corpdk/ds codegen    # Run graphql-codegen for ds
pnpm create-app                     # Run the interactive scaffolding CLI
```

Each package requires its own `.env` file — copy from `.env.example` in the package directory.

## Docker

Scaffolded projects include Dockerfiles co-located with each package:

```bash
# From the scaffolded project root
docker build -f packages/ds/Dockerfile -t my-app-ds .     # Build DS image
docker build -f packages/ui/Dockerfile -t my-app-ui .     # Build UI image
```

**UI Dockerfile requirement**: `output: 'standalone'` must be set in the UI package's `next.config.ts`. The standalone output bundles the Next.js server into `server.js` (no `next` CLI needed at runtime).

**DS Dockerfile notes**:
- Build context is always the monorepo root (needed for `pnpm-lock.yaml` and workspace manifests)
- `@corpdk/ds-sdk` is resolved at build time; Docker's `COPY` dereferences pnpm symlinks so it is self-contained in `node_modules` at runtime
- SDL schema files are copied to `dist/` by the DS build script — no extra step needed

## Code Quality Requirements

- No placeholders or pseudocode
- No TODO comments
- Must be production-ready and runnable as-is
- Clean, readable code with appropriate comments

## Docs Update Rule

**Every feature plan must include a docs update step.** When planning any feature, new package, template, script, env var, architecture change, or behavioural change to an existing pattern, identify which file(s) under `docs/` need updating and include that as an explicit step in the plan. Do not close a task as complete if the relevant docs are stale.

## Workflow Optimization & Token Efficiency

### Response Style

- **Be concise**: Provide direct, actionable responses without excessive explanations
- **Summarize over explain**: Focus on key changes rather than detailed descriptions
- **Skip pleasantries**: Get straight to the task at hand

### File Context

Files that are commonly modified together:

- `templates/<pkg>/app/layout.tsx` + `templates/<pkg>/app/globals.css` (styling)
- `templates/ds/src/schema.ts` + `templates/ds/src/pubsub/index.ts` (schema changes)
- `templates/ds/package.json` + `templates/ds-sdk/package.json` (SDK dependency updates)
- Root `package.json` + `turbo.json` (task pipeline changes)

### Common Operations

When the user says:

- **"commit"** → Run git workflow: status, diff, log, then commit with proper message
- **"upgrade"** → Compare reference project, update dependencies, config files, then test
- **"fix [issue]"** → Identify root cause, apply fix, verify with minimal explanation
- **"add [feature]"** → Implement feature following existing patterns without asking for approval unless truly ambiguous

### Efficiency Guidelines

1. **Batch file reads**: When multiple files need changes, read them in parallel
2. **Use git for context**: Leverage `git diff` and `git status` instead of re-reading entire files
3. **Assume confidence**: Make reasonable technical decisions without excessive back-and-forth
4. **Create backups only when requested**: Don't proactively create backups unless changes are risky
5. **Use targeted reads**: For large files, use offset/limit parameters to read specific sections

### Key Principle

**Optimize for throughput over safety**: The user maintains git backups and can easily revert. Prioritize getting work done efficiently over excessive caution or validation.
