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

Optional:

| Variable | Default |
| -------- | ------- |
| `OTEL_SERVICE_NAME` | `@corpdk/ds` |

When enabled, `dev` and `start` preload `src/observability/preload-otel.ts` so **pg** and **HTTP** instrumentation register before the pool is created. GraphQL operations get spans via a Yoga plugin (`graphql.operation.name`, sanitized variables).

Local dev without these env vars behaves as before (no exporter, no extra spans).

---

## Runtime Zod for GraphQL inputs

`pnpm dal:codegen` (impl phase) emits `src/generated/dal/input-zod.ts` with Zod schemas for **every generated GraphQL input object** (create/update, entity filters, column filter operators, association filters, sort inputs, bulk update entries) plus an `inputZodSchemas` registry. Generated resolvers validate list/mutation args at the boundary via `parseGraphqlInput`, `parseOptionalGraphqlInput`, and `parseGraphqlInputList`. Re-export those helpers from `src/validation/parse-input.ts` in custom resolvers. Top-level pagination args (`first`, `after`, `limit`, etc.) remain scalar GraphQL args — not input objects. Hand-written SDL inputs outside DAL codegen are not covered.

**Follow-up:** Filter, sort, and association input types are not generated yet — only entity create/update inputs.

---

**Related:** [09-enhancement-backlog.md](09-enhancement-backlog.md) | [11-ds-subscription-sse.md](11-ds-subscription-sse.md)

**Last updated:** October 6, 2026
