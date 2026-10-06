# DS observability (`templates/ds`)

Health probes and optional OpenTelemetry tracing for `@corpdk/ds` (DAL-automated GraphQL Yoga server).

---

## Health check

`GET /health` (same host/port as GraphQL, path `/health`):

| HTTP | `status` in JSON | Meaning |
| ---- | ---------------- | ------- |
| 200  | `ok`             | Postgres reachable (`SELECT 1`) |
| 503  | `degraded`       | Database ping failed |

Response shape:

```json
{
  "status": "ok",
  "uptime": 42,
  "version": "2026.10.0-alpha.1",
  "db": { "connected": true, "latencyMs": 3 }
}
```

`version` comes from the DS package `package.json`. Use this endpoint for Docker/Kubernetes liveness/readiness instead of GraphQL POST.

---

## OpenTelemetry (optional)

Tracing is **off** unless you set either:

- `OTEL_EXPORTER_OTLP_ENDPOINT` (standard OTLP HTTP endpoint, e.g. `http://localhost:4318/v1/traces`), or
- `DS_OTEL_ENABLED=true` (uses the same OTLP exporter; endpoint must still be configured for export to succeed)

Set `DS_OTEL_ENABLED=false` to force tracing off when an endpoint is present (e.g. shared `.env` in CI).

Optional:

| Variable | Default |
| -------- | ------- |
| `OTEL_SERVICE_NAME` | `@corpdk/ds` |

When enabled, `pnpm dev` and `pnpm start` preload observability (`--import ./src/observability/preload-otel.ts` in dev; `--import ./dist/src/observability/preload-otel.js` after `tsc`) so **pg** and **HTTP** instrumentation register before the pool is created. GraphQL operations get spans via a Yoga plugin with attributes `graphql.operation.name`, `graphql.operation.type`, `graphql.document` (operation source with sensitive **argument/object-field literals** redacted when the field name matches password/secret/token-style keys), and `graphql.variables` (JSON with the same key-based redaction, including nested objects). Other literals in `graphql.document` are unchanged. `GET /health` emits a `db.health_ping` span when tracing is on.

Local dev without these env vars behaves as before (no exporter, no extra spans).

**Docker note:** the stock `docker-entrypoint.sh` runs `node dist/src/index.js` without the `--import` preload used by `pnpm start`, so container images built from the template do not enable OTLP until the entrypoint or CMD matches `package.json` `start`.

---

## Runtime Zod for GraphQL inputs

`pnpm dal:codegen` (impl phase) emits `src/generated/dal/input-zod.ts` with Zod schemas for **every generated GraphQL input object** (column-aware create/update, entity filters, column filter operators, association filters, sort inputs, bulk update entries) plus an `inputZodSchemas` registry. Generated **mutations** use `safeParseGraphqlInput` / `safeParseGraphqlInputList` and return `userErrors` on failure. Generated **queries** (list, connection, count, aggregate) use `safeParseOptionalGraphqlInput` / `safeParseOptionalGraphqlInputList` plus `unwrapGraphqlInputParseResult`, which throws a `GraphQLError` with `BAD_USER_INPUT` when Zod rejects input that still passed GraphQL parsing. Re-export those helpers from `src/validation/parse-input.ts` in custom resolvers; throw-based `parseGraphqlInput` / `parseOptionalGraphqlInput` / `parseGraphqlInputList` remain for callers that intentionally want exceptions. Top-level pagination args (`first`, `after`, `limit`, etc.) remain scalar GraphQL args — not input objects. Hand-written SDL inputs outside DAL codegen are not covered.

---

**Related:** [09-enhancement-backlog.md](09-enhancement-backlog.md) | [11-ds-subscription-sse.md](11-ds-subscription-sse.md)

**Last updated:** October 6, 2026
