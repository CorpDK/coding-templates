# Enhancement Backlog

Items to address after the core implementation is complete. Each entry includes a **Status** line (verified against the repo as of October 2026).

---

## Platform (shipped)

Work that landed on `main` outside the numbered UI/DS lists below:

- **DAL automation (`templates/ds`)** — Drizzle schema as sole authoring surface; 3-phase `pnpm dal:codegen`; gitignored `src/generated/`; GraphQL subscriptions over SSE on HTTP `/graphql` ([11-ds-subscription-sse.md](11-ds-subscription-sse.md)).
- **`@corpdk/create-ds`** — Merged ([PR #14](https://github.com/CorpDK/coding-templates/pull/14)): `init` / `upgrade`; scaffold CalVer `YYYY.M.0`; never overwrites team `src/db/schema/**`.
- **MIT license** — Root `LICENSE` plus `license` fields on packages; scaffolds copy license via `create-app` / `create-ds`.
- **DS automation on npmjs** — Five packages (`dal-core`, `pub-sub`, `codegen-cli`, `dal-codegen`, `create-ds`); **trusted publishing** (GitHub Actions OIDC) → [`.github/workflows/publish-ds-automation.yml`](../../.github/workflows/publish-ds-automation.yml). Live publish on push to `main` when `libraries/dal-core` CalVer changes ([PR #15](https://github.com/CorpDK/coding-templates/pull/15)); auto tag `ds-automation/v<CalVer>`, npm provenance, GitHub Release. See [04-npm-publish-ds-automation.md](../admin/04-npm-publish-ds-automation.md).
- **`2026.10.0-alpha.2` + package READMEs** — [PR #16](https://github.com/CorpDK/coding-templates/pull/16) (branch `feature/ds-automation-readmes-alpha2`): CalVer bump and READMEs on all five npm packages; **`checks-passed`**. Merge to `main` triggers the first automated OIDC publish at `alpha.2`.

Templates and other `@corpdk/*` packages remain **Artifactory**; only the DS automation npm set uses the publish workflow above.

---

## UI Enhancements

### 1. Testing Infrastructure

**Status:** Not started — Vitest runs in `libraries/dal-core`, `libraries/dal-codegen`, and `templates/ui-showcase` only; `packages/ui-core` and `packages/ui-forms` have no Vitest devDependencies or test scripts.

Add Vitest to `ui-core` and `ui-forms` — these are the most testable packages (pure utility functions + form logic with no DOM dependencies). Install `vitest` and `@testing-library/react` as devDependencies. Full adoption timing is TBD per the architecture doc, but setting up the runner now unblocks incremental test authoring.

### 2. CalVer Graduation (alpha → stable)

**Status:** Partial — **npm (DS automation set):** `2026.10.0-alpha.1` published manually; monorepo versions at `2026.10.0-alpha.2` on [PR #16](https://github.com/CorpDK/coding-templates/pull/16), pending automated publish when that PR merges. **Other publishable `@corpdk/*`:** still on `2026.10.0-alpha.1` (e.g. `@corpdk/ui-core`) until the next lockstep bump. Stable `2026.10.0` (or next calendar period) not yet released.

Packages use **Limitless CalVer `YYYY.MM.MICRO`** (e.g. `2026.10.0`). Graduate to stable when APIs stabilize. See [02-monorepo-design.md](../architecture/02-monorepo-design.md) and [04-npm-publish-ds-automation.md](../admin/04-npm-publish-ds-automation.md).

### 3. i18n Scaffold Pattern

**Status:** Not started — no `packages/ui-i18n` or `create-app` i18n scaffold; `ui-auth` BFF scaffold pattern exists as the model to mirror.

Add `packages/ui-i18n/scaffold/` following the same BFF pattern as `ui-auth`: `next-intl` request handler + middleware + locale message files, merged into the UI app by `create-app` when selected. Mirrors the `ui-auth` scaffold mechanism so the CLI pattern is consistent.

### 4. CSS Token Export from `ui-core`

**Status:** Not started — `@corpdk/ui-core` exports only `./dist/index.js`; apps still define theme tokens in their own `globals.css` / SCSS.

Instead of requiring each consuming app to copy CSS variable definitions into its own `globals.css`, investigate exporting a prebuilt CSS file from `ui-core` (e.g. `@corpdk/ui-core/styles`) that apps can import with a single line. **Blocker:** Turbopack does not resolve the `"style"` export condition used by CSS-exporting packages — the same limitation that blocked importing `shadcn/tailwind.css`. Needs a Turbopack fix or workaround before this is viable.

### 5. GitHub Actions CI (UI)

**Status:** Not started — no repo-wide `.github/workflows/ci.yml`. [`.github/workflows/dal.yml`](../../.github/workflows/dal.yml) and [`.github/workflows/sonar.yml`](../../.github/workflows/sonar.yml) cover DAL libraries and Sonar coverage only, not UI packages or full-monorepo lint/typecheck/build.

Add `.github/workflows/ci.yml`: lint + typecheck + `pnpm build` on every PR. Turbo's remote cache can be wired to Vercel for speed. Ensures the monorepo always builds cleanly before merge.

---

## DS Enhancements

**Scope:** **`templates/ds` only** — the DAL-automated primary DS template (`@corpdk/ds`). Manual DS templates (`ds-no-sql`, `ds-cdb`, `ds-mongo`, `ds-ddb`, `ds-file`) are **out of scope** here until explicitly added back.

### 1. Shared Zod Schemas for GraphQL Input Types

**Status:** Not started — `templates/ds` validates via generated repositories and GraphQL types; no runtime Zod validators are emitted from DAL codegen or merged SDL.

Generate Zod validators from the DAL-generated GraphQL input shapes (merged SDL in `src/generated/generated-schema.ts` or a dedicated codegen pass) so resolvers can validate input at runtime without hand-rolling schemas. Candidate tools: `graphql-to-zod` or a custom `@corpdk/dal-codegen` plugin. Benefits: single source of truth for input shapes, runtime safety at the resolver layer, and schema-parity with `ui-forms` validators.

### 2. OpenTelemetry Tracing

**Status:** Not started — no `@opentelemetry/*` dependencies or instrumentation in `templates/ds`.

Add `@opentelemetry/sdk-node` instrumentation to `templates/ds` for distributed request tracing. Each GraphQL operation should emit a span with operation name, variables (sanitized), and DB query timing. Integrates with Jaeger, Tempo, or any OTLP-compatible backend without vendor lock-in.

### 3. DataLoader Batching

**Status:** Done — per-request DataLoaders for navigation fields are emitted by `@corpdk/dal-codegen` ([GraphQL DAL Requirements §6.6](graphql-dal-requirements.md#66-association-output-fields-and-dataloaders)).

GraphQL resolvers that load related entities (e.g. fetching a user for each item in a list) issue one query per item without batching. DataLoader coalesces these into a single batched query per tick; DAL codegen covers this for association fields in `templates/ds`.

### 4. Cursor-Based Pagination

**Status:** Done — Relay-style `<entity>Connection` fields with keyset cursors are generated ([GraphQL DAL Requirements §13](graphql-dal-requirements.md#13-cursor-pagination)).

Connection-spec cursor pagination replaces offset paging for generated list fields. Cursor pagination is stable under concurrent writes; DAL codegen emits `Connection` / `Edge` types for eligible entities in `templates/ds`.

### 5. Health Check Endpoint

**Status:** Not started — `templates/ds` exposes GraphQL only; no `GET /health` route.

Add `GET /health` to `templates/ds` returning:

- HTTP 200 on healthy, 503 on degraded
- JSON body: `{ status, uptime, db: { connected, latencyMs }, version }`

Enables load balancer health checks, Kubernetes liveness/readiness probes, and on-call dashboards without instrumenting GraphQL.

### 6. Rate Limiting Middleware

**Status:** Not started — no Yoga rate-limit plugin or equivalent in `templates/ds`.

Add per-operation rate limiting via a Yoga plugin or `graphql-rate-limit` in `templates/ds`. Protects against runaway queries and abuse without requiring an API gateway. Limits should be configurable via env vars and keyed by IP or authenticated user ID.

### 7. GitHub Actions CI (DS)

**Status:** Partial — [`.github/workflows/dal.yml`](../../.github/workflows/dal.yml) builds/tests DAL libraries and runs `@corpdk/ds` (`templates/ds`) build + `entity:lint`; [`.github/workflows/sonar.yml`](../../.github/workflows/sonar.yml) runs DAL unit tests with coverage + SonarCloud; [`.github/workflows/publish-ds-automation.yml`](../../.github/workflows/publish-ds-automation.yml) dry-runs packaging on PRs touching the npm set. **Still wanted:** unified `.github/workflows/ci.yml` that includes `templates/ds` — lint + typecheck + full `pnpm --filter @corpdk/ds build` on every PR (alongside UI when item UI #5 lands).

### 8. Schema Identity Guard

**Status:** Not started — no CI step verifies that `pnpm dal:codegen` + GraphQL codegen output for `templates/ds` is deterministic and matches committed expectations (if any) or fails on unexpected SDL drift.

Add a CI step that runs the full DAL codegen chain for `templates/ds` and asserts stable, reviewable SDL output (e.g. snapshot or hash of `src/generated/generated-schema.ts`). Catches accidental schema drift before merge. Cross-variant SDL parity with manual DS templates is **out of scope** until those variants re-enter this backlog.

### 9. Shared ESLint Config

**Status:** Not started — `templates/ds` declares `"lint": "eslint src/"` but has no `eslint.config.mjs` and no `@corpdk/eslint-config` devDependency (unlike `templates/ui`).

Add `@corpdk/eslint-config` as a devDependency and a two-line config to `templates/ds`. Note: the package uses `module: NodeNext` (ESM) — the base library config from `@corpdk/eslint-config` is appropriate; the `./next` preset should not be used.

### 10. Subscription Durability (HPRT)

**Status:** Not started — `templates/ds` uses in-memory/Redis pub/sub via `@corpdk/pub-sub` with SSE transport; no checkpoint or event log for reconnect resume. `templates/ui-hprt` still uses graphql-ws until UI migrates to DS SSE ([11-ds-subscription-sse.md](11-ds-subscription-sse.md)).

For `templates/ds`, investigate durable subscriptions: if a client disconnects and reconnects, it should be able to resume from a checkpoint rather than missing events that arrived during the gap. Options: event sourcing with a Drizzle-backed event log, or a Redis Streams approach via `@corpdk/pub-sub`.

---

**Related**: [UI Status Dashboard](06-ui-status.md) | [UI Package Design](../architecture/04-ui-package-design.md) | [Monorepo Design](../architecture/02-monorepo-design.md)

**Last updated**: October 5, 2026
