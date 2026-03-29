# Package Dependencies

Version reference for every third-party dependency used across the monorepo. Updated: 2026-03-29.

---

## Version Policies

| Policy | Applies to | Example |
|--------|-----------|---------|
| **Exact pin** | `next`, `eslint-config-next`, `react`, `react-dom` | `"next": "16.2.1"` |
| **Caret range** | All other dependencies | `"graphql": "^16.13.2"` |
| **Workspace protocol** | Internal `@corpdk/*` packages | `"@corpdk/pub-sub": "workspace:*"` |

All workspace packages using the same dependency **must** use the same version range.

---

## Root

| Package | Version | Purpose |
|---------|---------|---------|
| turbo | ^2.8.21 | Monorepo task orchestration |
| typescript | ^6.0.2 | Type checking (inherited by all packages) |

---

## Shared Runtime Dependencies

Dependencies used across multiple workspace packages.

### GraphQL Stack

| Package | Version | Used by |
|---------|---------|---------|
| graphql | ^16.13.2 | ds, ds-hprt, ds-cdb, ds-mongo, ds-ddb, ds-file, ui, ui-hprt, ds-sdk, codegen-cli |
| graphql-yoga | ^5.18.1 | ds, ds-hprt, ds-cdb, ds-mongo, ds-ddb, ds-file, pub-sub |
| graphql-ws | ^6.0.8 | ds, ds-hprt, ds-cdb, ds-mongo, ds-ddb, ds-file, ui, ui-hprt |
| @graphql-yoga/redis-event-target | ^3.0.0 | ds, ds-hprt, ds-cdb, ds-mongo, ds-ddb, ds-file, pub-sub |

### UI Framework

| Package | Version | Used by |
|---------|---------|---------|
| next | 16.2.1 | ui, ui-hprt |
| react | 19.2.4 | ui, ui-hprt, ui-showcase |
| react-dom | 19.2.4 | ui, ui-hprt, ui-showcase |
| @tanstack/react-query | ^5.95.2 | ui, ui-hprt |
| tailwindcss | ^4.2.1 | ui, ui-hprt, ui-showcase |
| @tailwindcss/postcss | ^4.2.1 | ui, ui-hprt, ui-showcase |

### Validation & Schema

| Package | Version | Used by |
|---------|---------|---------|
| zod | ^4.3.6 | ds, ds-hprt, ds-cdb, ds-mongo, ds-ddb, ds-file, ui-forms |

### Infrastructure

| Package | Version | Used by |
|---------|---------|---------|
| ioredis | ^5.10.1 | ds, ds-hprt, ds-cdb, ds-mongo, ds-ddb, ds-file, pub-sub |
| ws | ^8.20.0 | ds, ds-hprt, ds-cdb, ds-mongo, ds-ddb, ds-file |

---

## Template-Specific Dependencies

### UI Templates

| Package | Version | Used by |
|---------|---------|---------|
| @apollo/client | ^4.1.6 | ui |
| urql | ^5.0.1 | ui-hprt |
| @urql/exchange-graphcache | ^9.0.0 | ui-hprt |
| shadcn | ^4.1.0 | ui-showcase (devDep) |
| tw-animate-css | ^1.4.0 | ui-showcase (devDep) |

### DS Templates

| Package | Version | Used by |
|---------|---------|---------|
| @prisma/client | ^7.6.0 | ds |
| prisma | ^7.6.0 | ds (devDep) |
| drizzle-orm | ^0.45.2 | ds-hprt |
| drizzle-kit | ^0.31.10 | ds-hprt (devDep) |
| pg | ^8.20.0 | ds-hprt |
| couchbase | ^4.6.1 | ds-cdb |
| mongodb | ^7.1.1 | ds-mongo, ds-ddb |
| js-yaml | ^4.1.0 | ds-file |

---

## Shared Package Dependencies

### ui-core (@corpdk/ui-core)

| Package | Version | Type |
|---------|---------|------|
| @base-ui/react | ^1.3.0 | runtime |
| class-variance-authority | ^0.7.1 | runtime |
| clsx | ^2.1.1 | runtime |
| lucide-react | ^1.7.0 | runtime |
| luxon | ^3.7.2 | runtime |
| next-themes | ^0.4.6 | runtime |
| shadcn | ^4.1.0 | runtime |
| sonner | ^2.0.7 | runtime |
| tailwind-merge | ^3.5.0 | runtime |
| tw-animate-css | ^1.4.0 | runtime |
| zustand | ^5.0.12 | runtime |

### ui-auth (@corpdk/ui-auth)

| Package | Version | Type |
|---------|---------|------|
| next-auth | ^5.0.0-beta.25 | runtime |

### ui-charts (@corpdk/ui-charts)

| Package | Version | Type |
|---------|---------|------|
| d3 | ^7.9.0 | runtime |

### ui-forms (@corpdk/ui-forms)

| Package | Version | Type |
|---------|---------|------|
| @hookform/resolvers | ^5.2.2 | runtime |
| react-hook-form | ^7.72.0 | runtime |
| zod | ^4.3.6 | runtime |

### ui-datagrid (@corpdk/ui-datagrid)

| Package | Version | Type |
|---------|---------|------|
| @tanstack/react-table | ^8.21.3 | runtime |
| @tanstack/react-virtual | ^3.13.23 | runtime |

### ui-feedback (@corpdk/ui-feedback)

| Package | Version | Type |
|---------|---------|------|
| sonner | ^2.0.7 | runtime |

---

## Libraries & Engines

### codegen-cli (@corpdk/codegen-cli)

| Package | Version | Type |
|---------|---------|------|
| graphql | ^16.0.0 | peer |
| @graphql-codegen/plugin-helpers | ^6.2.0 | dev |
| tsup | ^8.5.1 | dev |

### pub-sub (@corpdk/pub-sub)

| Package | Version | Type |
|---------|---------|------|
| @graphql-yoga/redis-event-target | ^3.0.0 | runtime |
| graphql-yoga | ^5.18.1 | runtime |
| ioredis | ^5.10.1 | runtime |

### create-app (@corpdk/create-app)

| Package | Version | Type |
|---------|---------|------|
| @clack/prompts | ^1.1.0 | runtime |
| tsup | ^8.5.1 | dev |

---

## Shared Dev Dependencies

Common dev dependencies used across most workspace packages.

| Package | Version | Scope |
|---------|---------|-------|
| typescript | ^6.0.2 | All packages |
| eslint | ^9.39.4 | All UI packages + templates |
| eslint-config-next | 16.2.1 | All UI packages + templates |
| @corpdk/eslint-config | workspace:* | All UI packages + templates |
| @types/node | ^20.19.37 | All packages |
| @types/react | ^19.2.14 | All UI packages |
| @types/react-dom | ^19.2.3 | All UI packages |
| tsx | ^4.21.0 | All DS templates |
| @types/ws | ^8.18.1 | All DS templates |

### GraphQL Codegen (DS templates devDeps)

| Package | Version | Used by |
|---------|---------|---------|
| @graphql-codegen/cli | ^6.2.1 | ds, ds-hprt, ds-cdb, ds-mongo, ds-ddb, ds-file |
| @graphql-codegen/client-preset | ^5.2.4 | ds, ds-hprt, ds-cdb, ds-mongo, ds-ddb, ds-file |
| @graphql-codegen/typescript | ^5.0.9 | ds, ds-hprt, ds-cdb, ds-mongo, ds-ddb, ds-file |
| @graphql-codegen/typescript-resolvers | ^5.1.7 | ds, ds-hprt, ds-cdb, ds-mongo, ds-ddb, ds-file |

---

## Peer Dependencies

| Package | Constraint | Declared by |
|---------|-----------|-------------|
| next | 16.x | ui-core, ui-auth, ui-charts, ui-forms, ui-datagrid, ui-feedback |
| react | 19.x | ui-core, ui-auth, ui-charts, ui-forms, ui-datagrid, ui-feedback |
| react-dom | 19.x | ui-core, ui-auth, ui-charts, ui-forms, ui-datagrid, ui-feedback |
| graphql | ^16.0.0 | ds-sdk, codegen-cli |
| eslint | ^9 | eslint-config |
| eslint-config-next | >=16 | eslint-config |

---

## Pending Major Upgrades

Tracked here until applied. Remove entries as they are completed.

| Package | Current | Latest | Risk | Phase |
|---------|---------|--------|------|-------|
| eslint | ^9.39.4 | 10.x | Blocked | 8 — blocked by eslint-plugin-react (via eslint-config-next) incompatibility |

---

## Upgrade Log

| Date | Package(s) | From | To | Notes |
|------|-----------|------|----|-------|
| 2026-03-29 | turbo | ^2.5.4 | ^2.8.21 | Minor bump |
| 2026-03-29 | react, react-dom | 19.2.3 | 19.2.4 | Patch bump |
| 2026-03-29 | next, eslint-config-next | 16.1.6 | 16.2.1 | Minor bump |
| 2026-03-29 | graphql | ^16.11.0 | ^16.13.2 | Minor bump |
| 2026-03-29 | graphql-yoga | ^5.13.4 | ^5.18.1 | Minor bump |
| 2026-03-29 | @prisma/client, prisma | ^7.5.0 | ^7.6.0 | Minor bump |
| 2026-03-29 | drizzle-orm | ^0.44.2 | ^0.45.2 | Minor bump |
| 2026-03-29 | drizzle-kit | ^0.31.1 | ^0.31.10 | Patch bump |
| 2026-03-29 | tsx | ^4.19.4 | ^4.21.0 | Minor bump |
| 2026-03-29 | ws | ^8.18.2 | ^8.20.0 | Minor bump |
| 2026-03-29 | pg | ^8.16.3 | ^8.20.0 | Minor bump |
| 2026-03-29 | couchbase | ^4.4.5 | ^4.6.1 | Minor bump |
| 2026-03-29 | ioredis | ^5.0.0 | ^5.10.1 | Minor bump, tightened range |
| 2026-03-29 | lucide-react | ^1.6.0 | ^1.7.0 | Minor bump |
| 2026-03-29 | react-hook-form | ^7.55.0 | ^7.72.0 | Minor bump |
| 2026-03-29 | @hookform/resolvers | ^5.0.1 | ^5.2.2 | Minor bump |
| 2026-03-29 | tsup | ^8.0.0 | ^8.5.1 | Minor bump |
| 2026-03-29 | @tanstack/react-virtual | ^3.13.6 | ^3.13.23 | Patch bump |
| 2026-03-29 | @tanstack/react-query | ^5.75.5 | ^5.95.2 | Aligned across ui, ui-hprt, ui-showcase |
| 2026-03-29 | @graphql-codegen/cli | ^5.0.5 | ^6.2.1 | Major bump, coordinated |
| 2026-03-29 | @graphql-codegen/client-preset | ^4.5.1 | ^5.2.4 | Major bump, coordinated |
| 2026-03-29 | @graphql-codegen/typescript | ^4.1.5 | ^5.0.9 | Major bump, coordinated |
| 2026-03-29 | @graphql-codegen/typescript-resolvers | ^4.5.1 | ^5.1.7 | Major bump, coordinated |
| 2026-03-29 | @graphql-codegen/plugin-helpers | ^5.0.0 | ^6.2.0 | Major bump, coordinated |
| 2026-03-29 | graphql-ws | ^5.16.0 | ^6.0.8 | Major bump; import path changed from graphql-ws/lib/use/ws to graphql-ws/use/ws |
| 2026-03-29 | mongodb | ^6.16.0 | ^7.1.1 | Major bump; no source changes needed (async/await API unchanged) |
| 2026-03-29 | @clack/prompts | ^0.9.1 | ^1.1.0 | Major bump (0.x→1.x); no source changes needed |
| 2026-03-29 | @apollo/client | ^3.13.8 | ^4.1.6 | Major bump; ApolloProvider moved to @apollo/client/react; split() replaced by ApolloLink.split() |
| 2026-03-29 | zod | ^3.24.2 | ^4.3.6 | Major bump; root export maintains v3 compat, no source changes needed |
| 2026-03-29 | typescript | ^5.9.3 | ^6.0.2 | Major bump; added rootDir to ui-* tsconfig.build.json; ignoreDeprecations for tsup baseUrl |
