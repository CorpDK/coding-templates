# UI Architecture Reference

This document covers the current state of the UI templates and their app-level configuration. For package design rationale and technology decisions, see the architecture section.

- [UI Package Design](../architecture/04-ui-package-design.md) — scope and design rationale for each shared package
- [Technology Decisions](../architecture/05-technology-decisions.md) — ADR table for all UI technology choices

For implementation status, see [06-ui-status.md](06-ui-status.md).

---

## Current State

The monorepo contains three UI application templates and six shared packages:

| Package | Scope | GraphQL Client | Real-time | Purpose |
|---------|-------|----------------|-----------|---------|
| `templates/ui` | `@corpdk/ui` | Apollo Client | graphql-ws via split link | Standard CRUD template |
| `templates/ui-hprt` | `@corpdk/ui-hprt` | urql + Graphcache | graphql-ws via subscriptionExchange | High-frequency real-time template |
| `templates/ui-showcase` | `@corpdk/ui-showcase` | — | — | Storybook showcase — visual testing for all 6 shared packages; `pnpm storybook` |

Both runnable templates consume shared capabilities from `packages/ui-*` as workspace dependencies. The Storybook showcase (`ui-showcase`) imports from all six packages and is used during development to verify the shared package API visually.

Shared packages (`packages/ui-core`, `packages/ui-feedback`, `packages/ui-forms`, `packages/ui-datagrid`, `packages/ui-charts`, `packages/ui-auth`) are built to `dist/` and are publishable to npm under the `@corpdk` scope.

---

## App-Level Configuration

These concerns belong to each individual app (`templates/ui`, `templates/ui-hprt`) and are not extracted into shared packages.

### Next.js & Routing
- App Router — all routes under `app/`
- `next.config.ts` proxies `/api/graphql/*` to `DS_HTTP_URL` (avoids CORS, hides backend origin)
- WebSocket connects directly via `NEXT_PUBLIC_DS_WS_URL` (Next.js cannot proxy WS)
- `output: 'standalone'` required for Docker — bundles the Next.js server into `server.js`

### GraphQL Client

| App | Client | Cache | Subscriptions |
|-----|--------|-------|---------------|
| `ui` | Apollo Client 3 | InMemoryCache | GraphQLWsLink (split link) |
| `ui-hprt` | urql 5 | Graphcache (normalized) | subscriptionExchange + graphql-ws |

### Authentication
Auth.js v5 — BFF pattern (OAuth2/OIDC SSO). Configured via `ui-auth` scaffold. Env vars: `AUTH_SECRET`, `AUTH_ISSUER`, `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`.

### Internationalization
**TBD** — next-intl is the leading candidate. Only required for globally-deployed apps.

### Observability
**TBD** — Sentry is the leading candidate for error tracking.

---

## Open Decisions

| Area | Leading Candidate | Blocker / Notes |
|------|------------------|-----------------|
| **i18n framework** | next-intl | Only needed for global apps; decision can be deferred per-app |
| **Unit/component testing** | Vitest + Testing Library | Stack is clear; adoption timing is the open question |
| **E2E testing** | Playwright | Stack is clear; adoption timing is the open question |
| **Error tracking** | Sentry | Production infra decision; DSN and org config needed |
| **Performance monitoring** | TBD | HPRT-specific; may be Sentry Performance or a custom solution |
| **File upload** | react-dropzone | Confirmed candidate; not yet required by any package |

---

**Related**: [UI Package Design](../architecture/04-ui-package-design.md) | [UI Status Dashboard](06-ui-status.md) | [Technology Decisions](../architecture/05-technology-decisions.md)

**Last updated**: March 31, 2026
