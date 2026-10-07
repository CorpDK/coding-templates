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

### 1. Rate limiting middleware

**Status:** Not started — no Yoga rate-limit plugin in `templates/ds`.

Per-operation limits via a Yoga plugin or `graphql-rate-limit`, keyed by IP or authenticated user, driven by env vars.

**Why it still matters:** Protects the DS when no API gateway enforces quotas.

### 2. Shared ESLint config (`templates/ds`)

**Status:** Not started — `package.json` defines `"lint": "eslint src/"` but there is no `eslint.config.mjs` and no `@corpdk/eslint-config` devDependency (unlike `templates/ui`).

Add `@corpdk/eslint-config` (base preset only — NodeNext ESM, not `./next`) and a minimal flat config.

**Why it still matters:** Local and CI lint for the primary DS template should match the rest of the monorepo.

### 3. Subscription resume (SSE)

**Status:** Not started — `templates/ds` publishes via `@corpdk/pub-sub` (memory or Redis) over **SSE** ([11-ds-subscription-sse.md](11-ds-subscription-sse.md)); reconnecting clients can miss events during gaps. Stock UI templates still use **graphql-ws** and are out of scope until they consume DS SSE.

Explore durable delivery for the DS side: checkpoint/resume after disconnect (e.g. Drizzle-backed event log or Redis Streams via `@corpdk/pub-sub`).

**Why it still matters:** SSE clients need a defined recovery story once UIs migrate off WebSocket transport.

### 4. Multiple mutation batching in a single transaction

**Status:** Open — design needed — each generated mutation runs in its own Drizzle call today; no first-class “batch mutations, one transaction” API or Yoga extension.

- **Atomicity:** Product flows (checkout, multi-entity updates) often require all-or-nothing commits; partial success from independent mutations is hard to roll back at the GraphQL layer.
- **GraphQL batching vs explicit API:** HTTP/query batching does not imply a shared DB transaction; need a deliberate contract (e.g. `mutationBatch`, `@transaction` directive, or document-only pattern with shared `ctx.db.transaction()`).
- **Drizzle boundaries:** Transaction scope must wrap repository calls codegen emits; connection pooling and nested transactions need clear rules.
- **Resolver/codegen:** `dal-codegen` may need transaction-aware context, ordering guarantees, and error mapping so one failure aborts the whole batch.

**Why it still matters:** Without a designed path, teams hand-roll transactions in custom resolvers and bypass generated repositories.

### 5. Support for database views

**Status:** Open — Drizzle schema in `templates/ds` models tables only; views are not introspected or mapped to GraphQL types.

- Decide whether read-only views become DAL entities (queries, filters) or stay outside automation with manual SDL/resolvers.
- Document limitations if views with joins, computed columns, or non-updatable shapes cannot be safely codegen’d.

**Why it still matters:** Many Postgres schemas expose reporting or denormalized read models as views; teams need a supported or explicit unsupported story.

### 6. Support for materialized views

**Status:** Open — same scope as ordinary views, plus no refresh orchestration in the DS template.

- GraphQL exposure likely read-only; clarify whether refresh is operator-driven (`REFRESH MATERIALIZED VIEW`), scheduled job, or out of scope.
- Stale-read semantics and concurrent refresh affect API contracts and caching.

**Why it still matters:** Analytics and aggregate snapshots often live in materialized views; DAL should not silently treat them as ordinary tables.

### 7. Support for functions (stored procedures)

**Status:** Open — no codegen path to declare or invoke Postgres functions/RPCs through repositories or dedicated mutations.

- Map SQL functions to GraphQL fields or mutations with typed args/results, or document calling via raw Drizzle/`sql` in team-owned resolvers only.
- Implications for permissions, side effects, and transaction participation when mixing function calls with generated CRUD.

**Why it still matters:** Legacy and performance-critical logic often remains in the database; a consistent invoke story avoids ad hoc SQL in every app.

---

**Related:** [UI Status Dashboard](06-ui-status.md) | [UI Package Design](../architecture/04-ui-package-design.md) | [Monorepo Design](../architecture/02-monorepo-design.md)

**Last updated:** October 6, 2026
