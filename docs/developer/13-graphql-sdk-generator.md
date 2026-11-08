# GraphQL client SDK generator (`@corpdk/create-graphql-sdk`)

Design specification for a **publishable GraphQL client SDK** produced from a **complete schema** (SDL on disk or a TypeScript `typeDefs` module). This initiative covers **only** the SDK package and the **scaffolding/regeneration CLI**—not the GraphQL server, not the **automation CLI** ([14-graphql-cli-generator.md](14-graphql-cli-generator.md)), and not HTTP transport (Apollo, `graphql-request`, `graphql-sse`, and similar stay in consumer apps).

**Status:** Design (pre-implementation).

**Related:** [02-graphql-schema.md](02-graphql-schema.md) · [11-ds-subscription-sse.md](11-ds-subscription-sse.md) · [ds-automation-upgrades.md](ds-automation-upgrades.md) (pattern reference for `create-ds`)

---

## 1. Goals and non-goals

| Goals | Non-goals |
| ----- | --------- |
| Generate an npm-publishable SDK from **any** complete GraphQL schema | DS server, resolvers, DAL, databases |
| Support schema input as **`.graphql(s)`** or **TypeScript `typeDefs`** | `typescript-resolvers`, `client-preset`, `@corpdk/codegen-cli` |
| **§2** schema types + **§3** type-safe document builders | Bundled Apollo / urql / `graphql-sse` |
| SDK installable in **Node services** and **Next.js** apps | WebSocket subscriptions (`graphql-ws` is sunset) |
| CLI shaped like **`@corpdk/create-ds`** (`init`, `upgrade`, regenerate) | Coupling to a specific CorpDK DS implementation |

Consumers use the SDK for **types + `TypedDocumentNode` operations** they build in app code (or optional shared operation modules). They choose transport separately.

---

## 2. Monorepo integration (this repository)

### 2.1 Output package: `templates/ds-sdk`

The canonical **dogfood output** in `coding-templates` is **`templates/ds-sdk`** (`@corpdk/ds-sdk` in workspace). The generator **materializes or refreshes** that package—not a sibling path hard-coded in DS `codegen.ts`.

| Phase | Action |
| ----- | ------ |
| **Design (now)** | This document |
| **Implementation start** | **Retire** current `templates/ds-sdk` output: delete generated artifacts and/or rename package to `templates/ds-sdk-legacy` (or `legacy/` subtree) for comparison; keep git history |
| **Implementation** | Run `create-graphql-sdk` against **`templates/ds-sdk`** as the target directory; package name remains **`@corpdk/ds-sdk`** unless product chooses a rename |

### 2.2 Schema input for testing: `templates/ds`

Primary integration test schema:

| Input kind | Path (after `pnpm dal:codegen:schema` or full `dal:codegen`) |
| ---------- | ------------------------------------------------------------- |
| **TypeScript `typeDefs`** (preferred for DAL DS) | `templates/ds/src/generated/generated-schema.ts` |
| **SDL directory** (manual DS variants) | `templates/ds-no-sql/src/schema/**/*.graphqls` (etc.) |

The generator must accept **the same schema sources** that `@graphql-codegen/cli` already accepts for `templates/ds` (see `templates/ds/codegen.ts` using `generated-schema.ts`).

Example (future):

```bash
# From repo root — refresh SDK from DAL-emitted typeDefs
pnpm create-graphql-sdk generate templates/ds-sdk \
  --schema templates/ds/src/generated/generated-schema.ts
```

### 2.3 DS server codegen decoupling (implementation follow-up)

Today `templates/ds/codegen.ts` writes **`client-preset` → `../ds-sdk`**. When the SDK generator ships:

1. Remove **`client-preset`** / **`../ds-sdk`** from DS `codegen.ts` (server keeps **`typescript` + `typescript-resolvers`** only).
2. Regenerate **`templates/ds-sdk`** only via **`@corpdk/create-graphql-sdk`** (local script or CI after `dal:codegen:schema`).

---

## 3. SDK package architecture

Two generated layers in one publishable package (no transport):

| Layer | Tool | Output |
| ----- | ---- | ------ |
| **§2 Schema types** | `@graphql-codegen/cli` + plugin `typescript` | `src/schema-types.ts` |
| **§3 Document builder** | **buildgql** (`client: 'none'`) | `src/gql/**` (or `src/gql/index.ts`) |

Hand-written template files: `src/index.ts`, `sdk.config.yaml`, `codegen.ts` / `codegen.yml`, `buildgql.config.mjs`, `package.json`, `tsconfig.json`, `README.md`.

### 3.1 Public exports

```ts
// src/index.ts (template — not overwritten on regenerate)
export * from "./schema-types.js";
export {
  query,
  mutation,
  subscription,
  $,
  v,
  on,
  spread,
  include,
  skip,
} from "./gql/index.js";
export type { TypedDocumentNode } from "@graphql-typed-document-node/core";
```

### 3.2 Dependencies

| Kind | Packages |
| ---- | -------- |
| **peerDependencies** | `graphql` ^16, `@graphql-typed-document-node/core` ^3 |
| **devDependencies** (codegen at build time) | `@graphql-codegen/cli`, `@graphql-codegen/typescript`, `buildgql`, `typescript` |
| **Forbidden in published SDK** | Apollo, urql, `graphql-request`, `graphql-sse`, `graphql-ws`, `typescript-resolvers` |

### 3.3 Normalized schema snapshot

Regardless of input format, the SDK repo keeps a **committed SDL snapshot** under `schema/` (e.g. `schema/schema.graphqls`) so:

- **buildgql** always reads SDL on disk (its native input).
- Consumers and CI can diff schema changes without executing DS code.
- Audit trail matches the published SDK version.

**Normalization pipeline** (CLI responsibility when input is TypeScript):

1. Load module (dynamic `import()` of the `typeDefs` file).
2. Read `export const typeDefs` (or `export { typeDefs }`) — `string` or `string[]` (DAL emits a single template string; graphql-scalars-style arrays are supported).
3. Merge strings, parse with `graphql`, optionally `printSchema` / sorted print for stable diffs.
4. Write `schema/schema.graphqls` (or `schema/**/*.graphqls` if split mode is enabled later).

When input is already `.graphqls`, copy or symlink into `schema/` and skip extraction.

---

## 4. Schema input contract

### 4.1 Supported inputs

| `schema.kind` | CLI flag / config | Notes |
| ------------- | ----------------- | ----- |
| `graphqls` | `--schema ./schema` or `--schema ./api.graphqls` | File or directory glob |
| `typeDefs` | `--schema ./src/generated/generated-schema.ts` | Must export **`typeDefs`** (required name for v1) |

**v1 export detection:**

- Accepted: `export const typeDefs = \`...\`` (DAL `generated-schema.ts`).
- Accepted: `export const typeDefs = [ \`...\`, ... ]`.
- Rejected: default export only, or `typeDefs` under a different name (v1.1 may add `--export typeDefs` alias).

### 4.2 GraphQL Code Generator (§2)

```yaml
# codegen.yml in SDK package
schema: ./schema/**/*.graphqls
generates:
  ./src/schema-types.ts:
    plugins:
      - typescript
    config:
      enumsAsTypes: true
      skipTypename: false
      scalars: {} # from sdk.config.yaml
```

For **`typeDefs`** inputs, **never** point codegen at the `.ts` file in the SDK package after normalization—always **`schema/**/*.graphqls`** produced by the CLI.

### 4.3 buildgql (§3)

```js
// buildgql.config.mjs
import { defineConfig } from "buildgql/config";

export default defineConfig({
  schema: "./schema/**/*.graphqls",
  output: "./src/gql",
  client: "none",
  scalars: {
    // Prefer `declare` for publish-safe SDKs (no relative `from` into server repo)
    DateTime: "string",
  },
});
```

**Builder choice:** v1 standardizes on **buildgql** only (`sdk.config.yaml` → `builder.engine: buildgql`). Alternatives (e.g. typed-graphql-builder) are out of scope until a second engine is specified.

---

## 5. CLI: `@corpdk/create-graphql-sdk`

### 5.1 Location and packaging

```text
engines/create-graphql-sdk/
  src/           # init, upgrade, generate, schema-extract, args
  canonical/     # SDK package template (like create-ds/canonical)
  starter/       # optional demo SDL
  package.json   # bin: create-graphql-sdk
```

Published to npmjs as **`@corpdk/create-graphql-sdk`** (same publish posture as `@corpdk/create-ds`).

### 5.2 Commands (v1)

| Command | Purpose |
| ------- | ------- |
| `create-graphql-sdk init [dir]` | Scaffold empty SDK package; run extract + codegen |
| `create-graphql-sdk generate [dir]` | Re-run extract (if needed) + `graphql-codegen` + `buildgql generate` |
| `create-graphql-sdk upgrade [dir]` | Merge **canonical** template deltas; **do not** overwrite `schema/**`, `sdk.config.yaml`, or user `src/index.ts` |

### 5.3 Flags

```text
create-graphql-sdk init [directory] [options]
create-graphql-sdk generate [directory] [options]

Options:
  --name <pkg>        npm package name (default: @corpdk/graphql-sdk)
  --schema <path>     SDL file/dir OR TypeScript module with typeDefs export (required unless --demo-schema)
  --demo-schema       Copy bundled starter SDL from the engine package
  --no-install        Skip pnpm install after scaffold
  -h, --help
```

**`init` behavior**

1. Target directory must be empty (except when documented **in-place refresh** mode for `templates/ds-sdk`—see §5.4).
2. Copy `canonical/` → target.
3. Resolve schema → write `schema/**/*.graphqls`.
4. Write / merge `sdk.config.yaml` and `package.json` (`--name`, CalVer initial version per [monorepo design](../architecture/02-monorepo-design.md)).
5. Run `pnpm codegen` (alias for §2 + §3) when dependencies are available.

**`generate` behavior**

1. Read `sdk.config.yaml` for default schema source if `--schema` omitted.
2. Re-extract SDL when `schema.source` is `typeDefs`.
3. Run `graphql-codegen` and `buildgql generate`.
4. Do not modify hand-maintained files (`src/index.ts`, README boilerplate sections marked `<!-- user -->`).

### 5.4 In-place refresh: `templates/ds-sdk`

For monorepo dogfood, **`generate`** (not necessarily `init`) is the steady-state command:

```bash
pnpm --filter @corpdk/ds exec pnpm dal:codegen:schema   # ensure typeDefs exists
pnpm create-graphql-sdk generate templates/ds-sdk \
  --schema templates/ds/src/generated/generated-schema.ts
pnpm --filter @corpdk/ds-sdk build
```

`init` into `templates/ds-sdk` runs **once** after legacy cleanup; thereafter only **`generate`**.

---

## 6. Configuration: `sdk.config.yaml`

```yaml
apiVersion: corpdk.dev/graphql-sdk/v1
service: ds # logical name; used in README and telemetry only
package: "@corpdk/ds-sdk"

schema:
  # Last-used input (for generate without --schema)
  source:
    kind: typeDefs # graphqls | typeDefs
    path: ../ds/src/generated/generated-schema.ts
  # Normalized artifact (always updated by CLI)
  snapshot: schema/**/*.graphqls

codegen:
  enumsAsTypes: true
  scalars:
    DateTime: string
    UUID: string

builder:
  engine: buildgql
  client: none
  output: src/gql
```

**Large schemas:** optional future `schema.snapshot: schema/public.graphqls` fed by a trimmed composed SDL (consumer-owned), analogous to DGS `includeQueries` at the SDL layer.

---

## 7. Generation pipeline

```mermaid
flowchart TD
  IN_SDL[Input: .graphqls]
  IN_TS[Input: typeDefs.ts]
  EXTRACT[normalize → schema/**/*.graphqls]
  GC[graphql-codegen typescript]
  BG[buildgql generate client none]
  TYPES[src/schema-types.ts]
  GQL[src/gql]
  TSC[tsc → dist]
  PKG[@corpdk/ds-sdk publishable]

  IN_SDL --> EXTRACT
  IN_TS --> EXTRACT
  EXTRACT --> GC
  EXTRACT --> BG
  GC --> TYPES
  BG --> GQL
  TYPES --> TSC
  GQL --> TSC
  TSC --> PKG
```

**Package scripts (generated SDK)**

```json
{
  "scripts": {
    "codegen": "graphql-codegen && buildgql generate",
    "build": "pnpm codegen && tsc",
    "prepublishOnly": "pnpm build"
  }
}
```

Turbo (optional): `@corpdk/ds-sdk#build` may `dependsOn: ['^build']` and document that **`dal:codegen:schema`** should run before SDK `codegen` in CI when using DAL `typeDefs`.

---

## 8. Consumer usage (documented in SDK README, not implemented in SDK)

| Runtime | Query / mutation | Subscription (SSE) |
| ------- | ---------------- | ------------------ |
| Node service | Consumer-chosen: `graphql-request`, `fetch`, etc. + `TypedDocumentNode` from SDK | `graphql-sse` `createClient` + subscription document from SDK |
| Next.js (`templates/ui`) | Apollo `HttpLink` + documents from SDK | Apollo + SSE link (`@graphql-sse/apollo-client` or Yoga-compatible link) |
| Next.js (`templates/ui-hprt`) | urql `fetchExchange` | urql + `graphql-sse`-backed `subscriptionExchange` |

See [11-ds-subscription-sse.md](11-ds-subscription-sse.md). SDK README states peers only; transport examples are **consumer** documentation.

---

## 9. Migration from current `templates/ds-sdk`

| Current state | Target state |
| ------------- | ------------ |
| `client-preset` + empty `gql()` map in `ds-sdk` | Removed |
| Generated `graphql.ts` (~schema types) + unused document map | **`schema-types.ts`** (§2) + **buildgql** module (§3) |
| DS `codegen.ts` targets `../ds-sdk` | DS codegen **server-only**; SDK via **`create-graphql-sdk generate`** |
| UI depends on `@corpdk/ds-sdk` | Unchanged package name/path; imports shift to builder + types API |

**Legacy handling (implementation PR 1)**

1. Move or tag existing `templates/ds-sdk/src/generated/*` as **`legacy/`** or rename package to `@corpdk/ds-sdk-legacy` temporarily.
2. Scaffold fresh layout via `init` or empty `canonical` copy into `templates/ds-sdk`.
3. First `generate` from `templates/ds` `generated-schema.ts`.
4. Update UI imports in a follow-up PR (out of scope for generator-only work if types are compatible).

---

## 10. Feature parity (§3 vs DGS client)

The generator standardizes on **buildgql** for DGS-like behavior (not class names):

| Capability | SDK support |
| ---------- | ----------- |
| Query / mutation / subscription roots + typed args | Yes |
| Nested selections, field args, variables (`$` / `v`) | Yes |
| Fragments, unions/interfaces, `@include` / `@skip` | Yes |
| Inferred result and variable types | Yes (improvement over DGS JsonPath) |
| `TypedDocumentNode` for any client | Yes (`client: none`) |
| Federation `_entities` helpers | No dedicated API; use schema as-is |
| Transport / errors spec parsing | Consumer responsibility |

---

## 11. Implementation phases

| Phase | Deliverable |
| ----- | ----------- |
| **P0** | This design spec |
| **P1** | `engines/create-graphql-sdk` + `canonical/` template |
| **P2** | Legacy `ds-sdk` cleanup; `generate templates/ds-sdk` from `templates/ds` `typeDefs` |
| **P3** | DS `codegen.ts` decoupling; CI step order documented |
| **P4** | Publish `@corpdk/create-graphql-sdk`; root `pnpm create-graphql-sdk` script |
| **P5** | UI template import migration off legacy SDK patterns |

---

## 12. Acceptance criteria

- [ ] `create-graphql-sdk generate templates/ds-sdk --schema templates/ds/src/generated/generated-schema.ts` succeeds after DAL schema generation.
- [ ] Same CLI works with `--schema templates/ds-no-sql/src/schema` (graphqls directory) for non-DAL smoke test.
- [ ] `templates/ds-sdk` builds with `pnpm build` and exports types + builder symbols from `dist/`.
- [ ] Published package manifest has **no** HTTP client dependencies; only documented peers.
- [ ] `templates/ds-sdk/schema/` contains normalized SDL diffable in PRs.
- [ ] DS server package does **not** require `client-preset` for SDK output.

---

## 13. Open decisions

| Topic | Proposal |
| ----- | -------- |
| Binary name | `create-graphql-sdk` (explicit; not `create-gql-sdk`) |
| Keep npm name `@corpdk/ds-sdk` for template package | Yes for path stability; generic CLI still works for any `--name` |
| Introspection URL as schema input | v1.1 (`--schema https://…` one-shot → `schema/`) |
| Second builder engine | Defer until buildgql gaps are proven in production |

---

**Last updated:** November 7, 2026
