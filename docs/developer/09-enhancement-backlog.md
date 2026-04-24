# Enhancement Backlog

Items to address after the core implementation is complete.

---

## UI Enhancements

### 1. Testing Infrastructure

Add Vitest to `ui-core` and `ui-forms` — these are the most testable packages (pure utility functions + form logic with no DOM dependencies). Install `vitest` and `@testing-library/react` as devDependencies. Full adoption timing is TBD per the architecture doc, but setting up the runner now unblocks incremental test authoring.

### 2. CalVer Graduation (alpha → stable)

Packages are versioned using **CalVer `YYYY.MM.MICRO`** (e.g. `2026.3.0`). Current packages are at `2026.3.0-alpha.1`. Once the package APIs stabilize, drop the pre-release tag to publish the first stable release (`2026.3.0` or the next calendar period). See [02-monorepo-design.md](../architecture/02-monorepo-design.md) for the full CalVer format rules.

### 3. i18n Scaffold Pattern

Add `packages/ui-i18n/scaffold/` following the same BFF pattern as `ui-auth`: `next-intl` request handler + middleware + locale message files, merged into the UI app by `create-app` when selected. Mirrors the `ui-auth` scaffold mechanism so the CLI pattern is consistent.

### 4. CSS Token Export from `ui-core`

Instead of requiring each consuming app to copy CSS variable definitions into its own `globals.css`, investigate exporting a prebuilt CSS file from `ui-core` (e.g. `@corpdk/ui-core/styles`) that apps can import with a single line. **Blocker:** Turbopack does not resolve the `"style"` export condition used by CSS-exporting packages — the same limitation that blocked importing `shadcn/tailwind.css`. Needs a Turbopack fix or workaround before this is viable.

### 5. GitHub Actions CI (UI)

Add `.github/workflows/ci.yml`: lint + typecheck + `pnpm build` on every PR. Turbo's remote cache can be wired to Vercel for speed. Ensures the monorepo always builds cleanly before merge.

---

## DS Enhancements

Items below apply to `ds`, `ds-hprt`, `ds-cdb`, `ds-mongo`, `ds-ddb`, and `ds-file` unless noted.

### 1. Shared Zod Schemas for GraphQL Input Types

Generate Zod validators directly from the `.graphqls` SDL so resolvers can validate input at runtime without hand-rolling schemas. Candidate tools: `graphql-to-zod` or a custom codegen plugin. Benefits: single source of truth for input shapes, runtime safety at the resolver layer, and schema-parity with `ui-forms` validators.

### 2. OpenTelemetry Tracing

Add `@opentelemetry/sdk-node` instrumentation to DS packages for distributed request tracing. Each GraphQL operation should emit a span with operation name, variables (sanitized), and DB query timing. Integrates with Jaeger, Tempo, or any OTLP-compatible backend without vendor lock-in.

### 3. DataLoader Batching

Add `dataloader` to the resolver layer to batch and deduplicate N+1 DB calls. GraphQL resolvers that load related entities (e.g. fetching a user for each item in a list) currently issue one query per item. DataLoader coalesces these into a single batched query per tick.

### 4. Cursor-Based Pagination

Replace offset pagination with connection-spec (Relay-style) cursor pagination across all DS variants. Cursor pagination is stable under concurrent writes — offset pagination skips or duplicates rows when the dataset changes between pages. The GraphQL SDL change is backward-compatible: add `Connection` / `Edge` types alongside existing list fields.

### 5. Health Check Endpoint

Add `GET /health` to each DS package returning:

- HTTP 200 on healthy, 503 on degraded
- JSON body: `{ status, uptime, db: { connected, latencyMs }, version }`

Enables load balancer health checks, Kubernetes liveness/readiness probes, and on-call dashboards without instrumenting GraphQL.

### 6. Rate Limiting Middleware

Add per-operation rate limiting via a Yoga plugin or `graphql-rate-limit`. Protects against runaway queries and abuse without requiring an API gateway. Limits should be configurable via env vars and keyed by IP or authenticated user ID.

### 7. GitHub Actions CI (DS)

Add `.github/workflows/ci.yml` covering all DS packages: lint + typecheck + `pnpm build`. DS packages have no external DB in CI — the `ds-file` variant can serve as the build smoke test since it has zero external dependencies.

### 8. Schema Identity Guard

Add a CI step that runs codegen against all DS variants and asserts their SDL output is identical. This enforces the schema-identical guarantee that allows `@corpdk/ds-sdk` to be a single shared package. A diverging variant should fail CI before it reaches main.

### 9. Shared ESLint Config

DS packages currently have no `eslint.config.mjs`. Add `@corpdk/eslint-config` as a devDependency and a two-line config to each DS package. Note: DS packages use `module: NodeNext` (ESM) — the base library config from `@corpdk/eslint-config` is appropriate; the `./next` preset should not be used.

### 10. Subscription Durability (HPRT)

For `ds-hprt`, investigate durable subscriptions: if a client disconnects and reconnects, it should be able to resume from a checkpoint rather than missing events that arrived during the gap. Options: event sourcing with a Drizzle-backed event log, or a Redis Streams approach via `@corpdk/pub-sub`.

---

**Related**: [UI Status Dashboard](06-ui-status.md) | [UI Package Design](../architecture/04-ui-package-design.md) | [Monorepo Design](../architecture/02-monorepo-design.md)

**Last updated**: March 31, 2026
