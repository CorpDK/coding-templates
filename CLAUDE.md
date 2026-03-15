# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **pnpm + Turborepo monorepo** under the `@corpdk` org — a production-ready template for full-stack GraphQL applications with Next.js frontend(s) and GraphQL Yoga backend(s).

## Monorepo Layout

```
coding-templates/
├── package.json                    ← workspace root: turbo scripts + devDeps only
├── pnpm-workspace.yaml             ← packages: ["packages/*"]
├── turbo.json                      ← task pipeline (codegen → build → dev/start)
├── CLAUDE.md                       ← this file
├── CODING_GUIDELINES.md            ← coding standards
└── packages/
    ├── ui/          (@corpdk/ui)           Next.js + Apollo Client
    ├── ui-hprt/     (@corpdk/ui-hprt)      Next.js + urql + Graphcache
    ├── ds/          (@corpdk/ds)           GraphQL Yoga + Prisma + PostgreSQL
    ├── ds-hprt/     (@corpdk/ds-hprt)      GraphQL Yoga + Drizzle + PostgreSQL
    ├── ds-cdb/      (@corpdk/ds-cdb)        GraphQL Yoga + Couchbase SDK + Zod
    ├── ds-sdk/      (@corpdk/ds-sdk)       TypedDocumentNode SDK (from ds)
    ├── ds-sdk-hprt/ (@corpdk/ds-sdk-hprt)  TypedDocumentNode SDK (from ds-hprt)
    └── ds-sdk-cdb/  (@corpdk/ds-sdk-cdb)   TypedDocumentNode SDK (from ds-cdb)
```

### Package Purpose

| Package | Scope | Description |
|---------|-------|-------------|
| `ui` | `@corpdk/ui` | Standard Next.js UI using Apollo Client for GraphQL |
| `ui-hprt` | `@corpdk/ui-hprt` | High-performance real-time UI using urql + Graphcache |
| `ds` | `@corpdk/ds` | GraphQL Yoga server with Prisma ORM (PostgreSQL) |
| `ds-hprt` | `@corpdk/ds-hprt` | GraphQL Yoga server with Drizzle ORM (PostgreSQL), optimized for real-time |
| `ds-cdb` | `@corpdk/ds-cdb` | GraphQL Yoga server with Couchbase SDK + Zod (cloud-agnostic NoSQL) |
| `ds-sdk` | `@corpdk/ds-sdk` | Auto-generated TypedDocumentNode SDK from `ds` schema |
| `ds-sdk-hprt` | `@corpdk/ds-sdk-hprt` | Auto-generated TypedDocumentNode SDK from `ds-hprt` schema |
| `ds-sdk-cdb` | `@corpdk/ds-sdk-cdb` | Auto-generated TypedDocumentNode SDK from `ds-cdb` schema |

### Key Design Decisions

- **`"type": "module"` on DS packages only** — Yoga v5 is pure ESM; Next.js manages its own module system
- **HTTP via Next.js proxy, WS direct** — `rewrites()` handles queries/mutations; WebSocket connects directly via `NEXT_PUBLIC_DS_WS_URL` (avoids Next.js WS proxy limitations)
- **SDK as workspace dependency** — `ui` depends on `@corpdk/ds-sdk: "workspace:*"`; Turbo ensures codegen runs before build
- **All ports from env, no defaults** — prevents port collision surprises; each package has `.env.example`
- **`.js` extension on imports in DS server packages** — `ds`, `ds-hprt`, `ds-cdb` use `module: NodeNext` (pure ESM Node.js runtime); explicit `.js` is required even for `.ts` source files. SDK packages (`ds-sdk`, `ds-sdk-hprt`, `ds-sdk-cdb`) use `module: ESNext / moduleResolution: bundler` (consumed by Next.js bundler) and must omit the `.js` extension.
- **`dev` depends on `^build`** — Turbo's `dev` task declares `dependsOn: ["^build"]` so codegen and upstream builds complete before Next.js starts, preventing missing-type errors on first launch.

## Coding Standards

**All code changes MUST follow the guidelines in [CODING_GUIDELINES.md](CODING_GUIDELINES.md)**.

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
pnpm --filter @corpdk/ds codegen    # Run graphql-codegen for ds
```

Each package requires its own `.env` file — copy from `.env.example` in the package directory.

## Code Quality Requirements

- No placeholders or pseudocode
- No TODO comments
- Must be production-ready and runnable as-is
- Clean, readable code with appropriate comments

## Workflow Optimization & Token Efficiency

### Response Style

- **Be concise**: Provide direct, actionable responses without excessive explanations
- **Summarize over explain**: Focus on key changes rather than detailed descriptions
- **Skip pleasantries**: Get straight to the task at hand

### File Context

Files that are commonly modified together:

- `packages/<pkg>/app/layout.tsx` + `packages/<pkg>/app/globals.css` (styling)
- `packages/ds/src/schema.ts` + `packages/ds/src/pubsub/index.ts` (schema changes)
- `packages/ds/package.json` + `packages/ds-sdk/package.json` (SDK dependency updates)
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
