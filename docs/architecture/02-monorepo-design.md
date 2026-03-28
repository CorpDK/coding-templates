# Monorepo Design

Rationale behind the monorepo structure and its key architectural decisions.

---

## Why a Monorepo?

The repo combines templates, shared UI packages, engines, and libraries that evolve together. A monorepo ensures:
- Shared packages (`packages/ui-*`) are always consumed at the version that was developed alongside the templates
- Turbo's task pipeline (codegen → build → dev) can orchestrate cross-package dependencies
- `create-app` can reference template source directly without a publish/install cycle

---

## Workspace Layout Rationale

| Directory | Role | Rationale |
|-----------|------|-----------|
| `templates/` | Scaffolded project sources | Isolates runnable applications from shared infrastructure |
| `packages/` | Shared UI libraries | Publishable to npm; built to `dist/` with proper exports maps |
| `engines/` | CLI tooling | `create-app` is a dev-time tool, not a runtime dependency |
| `libraries/` | Shared runtime libraries | `pub-sub` is a runtime dep of every DS package — separate from UI concerns |

---

## Key Design Decisions

### `"type": "module"` on DS packages only

GraphQL Yoga v5 is pure ESM and requires an ESM runtime. Next.js manages its own compilation pipeline, so UI packages don't need `"type": "module"` at the package level. Applying it only to DS packages minimises the surface area of ESM configuration.

### HTTP via Next.js proxy, WebSocket direct

HTTP queries and mutations are proxied through Next.js `rewrites()` to hide the DS origin and avoid CORS. WebSocket connections (subscriptions) bypass the proxy because Next.js cannot proxy WS traffic — the DS WebSocket URL is exposed as a `NEXT_PUBLIC_` variable.

### SDK as workspace dependency

`ui` and `ui-hprt` declare `"@corpdk/ds-sdk": "workspace:*"` as a dependency. Turbo's dependency graph ensures codegen runs and `ds-sdk` is built before any UI build starts. This eliminates the publish-and-install cycle during development.

### All ports from env, no defaults

Every DS and UI package requires an explicit port environment variable. There are no fallback defaults. This prevents port collision surprises when running multiple packages simultaneously.

### `.js` extension on DS server imports

All DS server packages use `module: NodeNext`, which requires explicit `.js` extensions on TypeScript imports (even for `.ts` source files). `ds-sdk` uses `module: ESNext / moduleResolution: bundler` (consumed by Next.js bundler) and must omit the extension. This is a hard rule — incorrect extensions produce runtime import errors.

### Single shared SDK across all DS variants

All DS variants expose the same GraphQL API surface (schema-identical). Rather than shipping a separate SDK per variant, all codegen output targets a single `@corpdk/ds-sdk` package. This means UI packages are storage-agnostic by design — swapping the DS backend requires no UI code changes.

### Repository Pattern in all DS packages

Resolvers in `schema.ts` call only `itemRepository.*`, never DB-specific APIs directly. This decoupling means the GraphQL layer is identical across all DS variants; only `src/db/repository.ts` differs. See [Repository Pattern](../developer/03-repository-pattern.md) for implementation details.

### GraphQL SDL in `src/schema/`

Schema is defined as multiple `.graphqls` files in a directory, not inline TypeScript strings. `base.graphqls` declares empty root types; feature files extend them. This enables independent schema files per entity without merge conflicts, and the codegen glob (`./src/schema/**/*.graphqls`) picks up new files automatically.

### Plugin-style pub/sub via `@corpdk/pub-sub`

Each DS package calls `createAppPubSub<T>()` once. The factory selects Redis or in-memory based on `REDIS_URL`. Topics (`PubSubTopics`) are defined locally per package. This pattern keeps the transport decision outside of application code while allowing each app to define its own topic types.

### `dev` depends on `^build`

Turbo's `dev` task declares `dependsOn: ["^build"]`. This ensures shared packages and `ds-sdk` are built before any dev server starts, preventing missing-type errors on first launch. The slight startup overhead (building upstreams once) is far cheaper than debugging missing types.

---

## Versioning Strategy

| Category | Scheme | Example | Reason |
|----------|--------|---------|--------|
| Shared packages (`packages/ui-*`), engines, libraries | CalVer `YYYY.0M.MICRO[-pre.N]` | `2026.03.0-alpha.1` | Published to npm — calendar versioning communicates when a release was cut |
| Template apps (`templates/ui`, `templates/ui-hprt`, `templates/ui-showcase`) | Semver | `0.1.0` | Not published to npm — scaffolded into user projects; semver communicates API stability |

Template apps are not versioned for consumers — they are scaffolded once and then owned by the user. Semver `0.1.0` signals pre-stable without imposing CalVer semantics on code that will never be published.
