# Enhancement Backlog

Open enhancements only — shipped work lives in git history and [admin](../admin/) / [architecture](../architecture/) docs. Each item has a **Status** verified against the repo (October 2026).

---

## UI Enhancements

### 1. Testing infrastructure (`ui-core`, `ui-forms`)

**Status:** Not started — Vitest runs in `libraries/dal-core`, `libraries/dal-codegen`, and `templates/ui-showcase` only; `@corpdk/ui-core` and `@corpdk/ui-forms` have no Vitest devDependencies or test scripts.

Add Vitest (and `@testing-library/react` where components need it) to the two most testable shared UI packages: pure utilities in `ui-core` and form helpers in `ui-forms`. Stack choice matches [05-ui-architecture.md](05-ui-architecture.md); timing for broad adoption remains TBD.

**Why it still matters:** Unblocks incremental unit tests without waiting on a monorepo-wide testing policy.

### 2. CalVer graduation (alpha → stable)

**Status:** In progress — npm **DS automation set** (`dal-core`, `dal-codegen`, `codegen-cli`, `pub-sub`, `create-ds`) is on **`2026.10.0-alpha.2`** with automated publish on `main` when CalVer bumps ([04-npm-publish-ds-automation.md](../admin/04-npm-publish-ds-automation.md)). Other publishable `@corpdk/*` (e.g. `@corpdk/ui-core`) remain on **`2026.10.0-alpha.1`** until the next lockstep bump. Stable `2026.10.0` (or the next calendar period) not released yet.

Graduate to stable CalVer (`YYYY.MM.MICRO`, Limitless rules in [02-monorepo-design.md](../architecture/02-monorepo-design.md)) when public APIs for the npm set and UI libraries stabilize.

**Why it still matters:** Downstream `create-ds` and npm consumers need a non-alpha signal before treating semver-like compatibility as frozen.

### 3. i18n scaffold pattern

**Status:** Not started — no `packages/ui-i18n` or `create-app` i18n option; [06-ui-status.md](06-ui-status.md) marks i18n as TBD.

Add `packages/ui-i18n/scaffold/` using the same merge pattern as `ui-auth`: `next-intl` request handler, middleware, and locale message stubs, wired from `create-app` when selected.

**Why it still matters:** Global apps need a consistent CLI path instead of one-off copies per scaffolded UI.

### 4. CSS token export from `ui-core`

**Status:** Blocked — `@corpdk/ui-core` exports only `./dist/index.js`; apps define theme tokens in local `globals.css`. Turbopack still does not resolve the `"style"` export condition (same limitation as importing `shadcn/tailwind.css`). See [04-ui-package-design.md](../architecture/04-ui-package-design.md).

Investigate `@corpdk/ui-core/styles` (or equivalent) once Turbopack supports the export condition or a documented workaround exists.

**Why it still matters:** Removes duplicated `@theme` / CSS variable blocks across every UI app.

### 5. GitHub Actions CI (monorepo)

**Status:** Partial — [dal.yml](../../.github/workflows/dal.yml) builds/tests DAL libraries and runs `@corpdk/ds` (`templates/ds`) Turbo build plus `entity:lint`; [sonar.yml](../../.github/workflows/sonar.yml) runs DAL coverage + SonarCloud; [publish-ds-automation.yml](../../.github/workflows/publish-ds-automation.yml) dry-runs the npm five-pack on relevant PRs. **Gap:** no repo-wide workflow for UI packages — lint, typecheck, and `pnpm build` (or targeted Turbo filters) on every PR.

Add `.github/workflows/ci.yml` (or extend an existing workflow) for shared packages and UI templates. Optional: Turbo remote cache (e.g. Vercel) for speed.

**Why it still matters:** UI and cross-cutting changes can merge without the same build gates already applied to DAL/`templates/ds`.

---

## DS Enhancements

**Scope:** **`templates/ds` only** (`@corpdk/ds`, DAL automation). Manual DS templates (`ds-no-sql`, `ds-cdb`, `ds-mongo`, `ds-ddb`, `ds-file`) are out of scope here.

### 1. Shared Zod schemas for GraphQL input types

**Status:** Not started — validation is via generated repositories and GraphQL types; DAL codegen does not emit runtime Zod for inputs.

Generate Zod from DAL-generated input shapes (merged SDL in `src/generated/generated-schema.ts` or a dedicated plugin in `@corpdk/dal-codegen`) for resolver-layer runtime checks and optional alignment with `ui-forms`.

**Why it still matters:** Closes the gap between compile-time GraphQL types and runtime validation without hand-written duplicate schemas.

### 2. OpenTelemetry tracing

**Status:** Not started — no `@opentelemetry/*` in `templates/ds`.

Instrument Yoga + DB access: span per operation (name, sanitized variables), DB latency. Export OTLP to Jaeger, Tempo, or any compatible backend.

**Why it still matters:** Production DS deployments need request-level traces without locking to a vendor.

### 3. Health check endpoint

**Status:** Not started — GraphQL only; Docker Compose healthchecks target Postgres, not the Node process.

Add `GET /health`: 200 when healthy, 503 when degraded; JSON `{ status, uptime, db: { connected, latencyMs }, version }` for load balancers and Kubernetes probes.

**Why it still matters:** Orchestrators cannot use GraphQL POST for liveness/readiness.

### 4. Rate limiting middleware

**Status:** Not started — no Yoga rate-limit plugin in `templates/ds`.

Per-operation limits via a Yoga plugin or `graphql-rate-limit`, keyed by IP or authenticated user, driven by env vars.

**Why it still matters:** Protects the DS when no API gateway enforces quotas.

### 5. Shared ESLint config (`templates/ds`)

**Status:** Not started — `package.json` defines `"lint": "eslint src/"` but there is no `eslint.config.mjs` and no `@corpdk/eslint-config` devDependency (unlike `templates/ui`).

Add `@corpdk/eslint-config` (base preset only — NodeNext ESM, not `./next`) and a minimal flat config.

**Why it still matters:** Local and CI lint for the primary DS template should match the rest of the monorepo.

### 6. Subscription resume (SSE)

**Status:** Not started — `templates/ds` publishes via `@corpdk/pub-sub` (memory or Redis) over **SSE** ([11-ds-subscription-sse.md](11-ds-subscription-sse.md)); reconnecting clients can miss events during gaps. Stock UI templates still use **graphql-ws** and are out of scope until they consume DS SSE.

Explore durable delivery for the DS side: checkpoint/resume after disconnect (e.g. Drizzle-backed event log or Redis Streams via `@corpdk/pub-sub`).

**Why it still matters:** SSE clients need a defined recovery story once UIs migrate off WebSocket transport.

---

**Related:** [UI Status Dashboard](06-ui-status.md) | [UI Package Design](../architecture/04-ui-package-design.md) | [Monorepo Design](../architecture/02-monorepo-design.md)

**Last updated:** October 5, 2026
