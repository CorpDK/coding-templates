# GraphQL client SDK generator (`@corpdk/create-graphql-sdk`)

Design specification for a **publishable GraphQL client SDK** produced from a **complete schema** (SDL on disk or a TypeScript `typeDefs` module). This initiative covers **only** the SDK package and the **scaffolding/regeneration CLI**—not the GraphQL server, not `ds-cli`, and not HTTP transport (Apollo, `graphql-request`, `graphql-sse`, and similar stay in consumer apps).

**Status:** Design (pre-implementation).

**Related:** [02-graphql-schema.md](02-graphql-schema.md) · [11-ds-subscription-sse.md](11-ds-subscription-sse.md) · [ds-automation-upgrades.md](ds-automation-upgrades.md) (pattern reference for `create-ds`)

---

## 1. Goals and non-goals

| Goals | Non-goals |
| ----- | --------- |
| Generate an npm-publishable SDK from **any** complete GraphQL schema | DS server, resolvers, DAL, databases |
| Support schema input as **`.graphql(s)`** or **TypeScript `typeDefs`** | `typescript-resolvers`, `client-preset`, `@corpdk/codegen-cli` |
| **§2** schema types + **§3** document builders + **§4** Zod validators for GraphQL **input** types | Bundled Apollo / urql / `graphql-sse` |
| One **`inputZodSchemas`** registry + parse helpers so UI/forms/scripts skip hand-written input Zod | Duplicating **`templates/ds`** server `input-zod.ts` inside the SDK (see §4.2) |
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

Three generated layers in one publishable package (no transport):

| Layer | Tool | Output |
| ----- | ---- | ------ |
| **§2 Schema types** | `@graphql-codegen/cli` + plugin `typescript` | `src/schema-types.ts` |
| **§3 Document builder** | **buildgql** (`client: 'none'`) | `src/gql/**` (or `src/gql/index.ts`) |
| **§4 Input validators** | `@graphql-codegen/typescript-validation-schema` (`zodv4`) + thin template | `src/validation/input-schemas.ts` (generated) |

Hand-written template files: `src/index.ts`, `src/validation/parse-input.ts`, `sdk.config.yaml`, `codegen.ts` / `codegen.yml`, `buildgql.config.mjs`, `package.json`, `tsconfig.json`, `README.md`.

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
export {
  inputZodSchemas,
  type InputZodSchemaName,
  safeParseGraphqlInput,
  safeParseOptionalGraphqlInput,
  parseGraphqlInput,
} from "./validation/parse-input.js";
export type { TypedDocumentNode } from "@graphql-typed-document-node/core";
```

### 3.2 Dependencies

| Kind | Packages |
| ---- | -------- |
| **dependencies** (published SDK) | `zod` ^4 (validators are part of the shipped API) |
| **peerDependencies** | `graphql` ^16, `@graphql-typed-document-node/core` ^3 |
| **devDependencies** (codegen at build time) | `@graphql-codegen/cli`, `@graphql-codegen/typescript`, `graphql-codegen-typescript-validation-schema`, `buildgql`, `typescript` |
| **Forbidden in published SDK** | Apollo, urql, `graphql-request`, `graphql-sse`, `graphql-ws`, `typescript-resolvers`, `@corpdk/dal-core` (generic SDK stays schema-only) |

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

## 4. Input validation — §4 Zod (research + design)

### 4.1 What `create-ds` does today (not SDK)

| Artifact | Generator | Lives in | Purpose |
| -------- | --------- | -------- | ------- |
| **`input-zod.ts`** | `@corpdk/dal-codegen` (`dal:codegen:impl`) | **`templates/ds/src/generated/dal/`** (gitignored) | **Server** resolver boundary: column-aware create/update, filters, association filters, `dalScalarZod` |
| **`src/validation/parse-input.ts`** | **`create-ds` canonical** copy | **DS package** (hand path) | Re-exports `safeParseGraphqlInput`, `unwrapGraphqlInputParseResult`, etc. from generated `input-zod.ts` |

**create-ds does not generate validators into `@corpdk/ds-sdk`.** UI and other clients today have **no** generated input Zod from the SDK; they rely on GraphQL typing only or hand-written Zod (`@corpdk/ui-forms`).

### 4.2 Target: validators in the publishable SDK

Every GraphQL **`input`** object in the normalized SDL gets a **matching Zod schema** in the SDK so consumers (Next.js forms, Node scripts, BFFs) validate **before** calling the API:

```ts
import { ItemCreateInputSchema, safeParseGraphqlInput } from "@corpdk/ds-sdk";

const parsed = safeParseGraphqlInput("ItemCreateInput", formValues);
if (!parsed.ok) {
  // map parsed.issues → UI errors
}
```

**Scope (v1):** all **`input`** object types in the schema snapshot (create/update payloads, filters, sort inputs, bulk entries, custom hand-written inputs present in SDL).

**Out of scope (v1):** validating **output** types, operation variable bags as a whole (consumers pass already-typed builder variables), or **server-only** Drizzle column metadata not reflected in SDL.

### 4.3 Recommended generator: `graphql-codegen-typescript-validation-schema`

The monorepo already standardizes on **Zod v4** ([06-package-dependencies.md](../architecture/06-package-dependencies.md)). The Guild-maintained ecosystem plugin **`graphql-codegen-typescript-validation-schema`** ([plugin docs](https://the-guild.dev/graphql/codegen/plugins/typescript/typescript-validation-schema)) generates Zod (or Yup/Valibot) from the **same SDL** as §2:

- Fits the existing **`graphql-codegen`** step in `create-graphql-sdk generate`.
- Shares **`scalars`** / **`scalarSchemas`** with `sdk.config.yaml` (e.g. `DateTime: z.string()`, DAL custom scalars as documented wire validators).
- Optional **`directives`** mapping when SDL uses `@constraint` / similar (v1.1 for DAL if constraints move into emitted SDL).

**Codegen output (v1):** single file `src/validation/input-schemas.ts` with one `*Schema` export per input type.

**Hand-written `src/validation/parse-input.ts` (canonical template, not overwritten):**

- Imports generated schemas.
- Builds **`inputZodSchemas`** registry keyed by GraphQL input type name (same ergonomics as DS server).
- Exposes **`safeParseGraphqlInput`**, **`safeParseOptionalGraphqlInput`**, **`parseGraphqlInput`** with **client-neutral** errors (`ZodIssue[]` or `{ field, message }[]`) — **no** `GraphQLError`, **no** `MutationUserError` / `@corpdk/dal-core`.

DS server code **keeps** generated `src/generated/dal/input-zod.ts`; it does **not** import from `@corpdk/ds-sdk` for validation (avoids circular workspace coupling and keeps column-aware create/update on the server).

### 4.4 Relation to `dal-codegen` `input-zod.ts`

`libraries/dal-codegen` already contains two mechanisms:

| Mechanism | Source | Strictness |
| --------- | ------ | ---------- |
| **Column-aware** `*CreateInput` / `*UpdateInput` | Drizzle `EntityModel` + constraints in `input-zod.ts` | Strongest; **server only** |
| **SDL walk** `emitGraphqlInputZodBlocks` in `input-zod-graphql.ts` | All other GraphQL input objects from built schema | Same shape as generic §4.3 |

**SDK §4** aligns with the **SDL walk** approach (and with what **`typescript-validation-schema`** would emit). For CorpDK DAL dogfood:

- **Client** (`@corpdk/ds-sdk`): structural + scalar + enum validation from SDL; sufficient for **`ui-forms`** and builder variable prep.
- **Server** (`templates/ds`): remains authoritative for create/update **business rules** (min/max length, numeric bounds, `dalScalarZod` parse rules).

When server and client disagree, server wins at runtime (`userErrors` / `BAD_USER_INPUT`). Document in SDK README.

**Future (optional):** extract `emitGraphqlInputZodBlocks` (+ topological/lazy input handling) into a small **`@corpdk/graphql-input-zod`** library shared by `dal-codegen` and `create-graphql-sdk` if the codegen plugin cannot match DAL lazy cycles or scalar parity. **v1** does not block on that extraction.

**DAL scalar parity for `@corpdk/ds-sdk`:** map custom scalars in `sdk.config.yaml` → `validation.scalarSchemas` using the **same wire rules** as [dal-pg-type-mapping.md](dal-pg-type-mapping.md) (string expressions in plugin config, e.g. `Decimal: z.string()`, not an import of `dalScalarZod` in the published SDK).

### 4.5 Example `codegen` fragment (SDK package)

```yaml
schema: ./schema/**/*.graphqls
generates:
  ./src/schema-types.ts:
    plugins:
      - typescript
    config:
      enumsAsTypes: true
      scalars: {} # from sdk.config.yaml

  ./src/validation/input-schemas.ts:
    plugins:
      - typescript-validation-schema:
          schema: zodv4
          importFrom: ../schema-types.js
          scalarSchemas: {} # from sdk.config.yaml validation.scalarSchemas
```

`create-graphql-sdk generate` merges `sdk.config.yaml` into this file; **`buildgql generate`** runs after (or in parallel) — order: normalize SDL → **graphql-codegen** (§2 + §4) → **buildgql** (§3) → `tsc`.

### 4.6 Consumer: `@corpdk/ui-forms`

`packages/ui-forms` already depends on **Zod** and `zodResolver`. After §4 ships, app code passes **`ItemCreateInputSchema`** (or registry lookup) into `useZodForm` instead of duplicating shapes from GraphQL types. Types stay aligned because both §2 and §4 regenerate from one SDL snapshot.

---

## 5. Schema input contract

### 5.1 Supported inputs

| `schema.kind` | CLI flag / config | Notes |
| ------------- | ----------------- | ----- |
| `graphqls` | `--schema ./schema` or `--schema ./api.graphqls` | File or directory glob |
| `typeDefs` | `--schema ./src/generated/generated-schema.ts` | Must export **`typeDefs`** (required name for v1) |

**v1 export detection:**

- Accepted: `export const typeDefs = \`...\`` (DAL `generated-schema.ts`).
- Accepted: `export const typeDefs = [ \`...\`, ... ]`.
- Rejected: default export only, or `typeDefs` under a different name (v1.1 may add `--export typeDefs` alias).

### 5.2 GraphQL Code Generator (§2)

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

### 5.3 buildgql (§3)

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

## 6. CLI: `@corpdk/create-graphql-sdk`

### 6.1 Location and packaging

```text
engines/create-graphql-sdk/
  src/           # init, upgrade, generate, schema-extract, args
  canonical/     # SDK package template (like create-ds/canonical)
  starter/       # optional demo SDL
  package.json   # bin: create-graphql-sdk
```

Published to npmjs as **`@corpdk/create-graphql-sdk`** (same publish posture as `@corpdk/create-ds`).

### 6.2 Commands (v1)

| Command | Purpose |
| ------- | ------- |
| `create-graphql-sdk init [dir]` | Scaffold empty SDK package; run extract + codegen |
| `create-graphql-sdk generate [dir]` | Re-run extract (if needed) + `graphql-codegen` (§2 + §4) + `buildgql generate` (§3) |
| `create-graphql-sdk upgrade [dir]` | Merge **canonical** template deltas; **do not** overwrite `schema/**`, `sdk.config.yaml`, or user `src/index.ts` |

### 6.3 Flags

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

1. Target directory must be empty (except when documented **in-place refresh** mode for `templates/ds-sdk`—see §6.4).
2. Copy `canonical/` → target.
3. Resolve schema → write `schema/**/*.graphqls`.
4. Write / merge `sdk.config.yaml` and `package.json` (`--name`, CalVer initial version per [monorepo design](../architecture/02-monorepo-design.md)).
5. Run `pnpm codegen` (alias for §2 + §3) when dependencies are available.

**`generate` behavior**

1. Read `sdk.config.yaml` for default schema source if `--schema` omitted.
2. Re-extract SDL when `schema.source` is `typeDefs`.
3. Run `graphql-codegen` and `buildgql generate`.
4. Do not modify hand-maintained files (`src/index.ts`, README boilerplate sections marked `<!-- user -->`).

### 6.4 In-place refresh: `templates/ds-sdk`

For monorepo dogfood, **`generate`** (not necessarily `init`) is the steady-state command:

```bash
pnpm --filter @corpdk/ds exec pnpm dal:codegen:schema   # ensure typeDefs exists
pnpm create-graphql-sdk generate templates/ds-sdk \
  --schema templates/ds/src/generated/generated-schema.ts
pnpm --filter @corpdk/ds-sdk build
```

`init` into `templates/ds-sdk` runs **once** after legacy cleanup; thereafter only **`generate`**.

---

## 7. Configuration: `sdk.config.yaml`

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

validation:
  engine: typescript-validation-schema
  zod: zodv4
  output: src/validation/input-schemas.ts
  scalarSchemas:
    DateTime: z.string()
    # DAL/custom scalars: wire-shape rules only (see §4.4)
```

**Large schemas:** optional future `schema.snapshot: schema/public.graphqls` fed by a trimmed composed SDL (consumer-owned), analogous to DGS `includeQueries` at the SDL layer.

---

## 8. Generation pipeline

```mermaid
flowchart TD
  IN_SDL[Input: .graphqls]
  IN_TS[Input: typeDefs.ts]
  EXTRACT[normalize → schema/**/*.graphqls]
  GC[graphql-codegen typescript + validation]
  BG[buildgql generate client none]
  TYPES[src/schema-types.ts]
  VAL[src/validation/input-schemas.ts]
  GQL[src/gql]
  TSC[tsc → dist]
  PKG[@corpdk/ds-sdk publishable]

  IN_SDL --> EXTRACT
  IN_TS --> EXTRACT
  EXTRACT --> GC
  EXTRACT --> BG
  GC --> TYPES
  GC --> VAL
  BG --> GQL
  TYPES --> TSC
  VAL --> TSC
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

## 9. Consumer usage (documented in SDK README, not implemented in SDK)

| Runtime | Query / mutation | Subscription (SSE) |
| ------- | ---------------- | ------------------ |
| Node service | Consumer-chosen: `graphql-request`, `fetch`, etc. + `TypedDocumentNode` from SDK | `graphql-sse` `createClient` + subscription document from SDK |
| Next.js (`templates/ui`) | Apollo `HttpLink` + documents from SDK | Apollo + SSE link (`@graphql-sse/apollo-client` or Yoga-compatible link) |
| Next.js (`templates/ui-hprt`) | urql `fetchExchange` | urql + `graphql-sse`-backed `subscriptionExchange` |

See [11-ds-subscription-sse.md](11-ds-subscription-sse.md). SDK README states peers only; transport examples are **consumer** documentation.

---

## 10. Migration from current `templates/ds-sdk`

| Current state | Target state |
| ------------- | ------------ |
| `client-preset` + empty `gql()` map in `ds-sdk` | Removed |
| Generated `graphql.ts` (~schema types) + unused document map | **`schema-types.ts`** (§2) + **buildgql** (§3) + **input Zod** (§4) |
| DS `codegen.ts` targets `../ds-sdk` | DS codegen **server-only**; SDK via **`create-graphql-sdk generate`** |
| UI depends on `@corpdk/ds-sdk` | Unchanged package name/path; imports shift to builder + types API |

**Legacy handling (implementation PR 1)**

1. Move or tag existing `templates/ds-sdk/src/generated/*` as **`legacy/`** or rename package to `@corpdk/ds-sdk-legacy` temporarily.
2. Scaffold fresh layout via `init` or empty `canonical` copy into `templates/ds-sdk`.
3. First `generate` from `templates/ds` `generated-schema.ts`.
4. Update UI imports in a follow-up PR (out of scope for generator-only work if types are compatible).

---

## 11. Feature parity (§3 vs DGS client)

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
| Input object Zod + registry | Yes (§4); server may enforce stricter rules (DAL) |

---

## 12. Implementation phases

| Phase | Deliverable |
| ----- | ----------- |
| **P0** | This design spec |
| **P1** | `engines/create-graphql-sdk` + `canonical/` template |
| **P2** | Legacy `ds-sdk` cleanup; `generate templates/ds-sdk` from `templates/ds` `typeDefs` |
| **P3** | DS `codegen.ts` decoupling; CI step order documented |
| **P4** | Publish `@corpdk/create-graphql-sdk`; root `pnpm create-graphql-sdk` script |
| **P5** | UI template import migration off legacy SDK patterns |

---

## 13. Acceptance criteria

- [ ] `create-graphql-sdk generate templates/ds-sdk --schema templates/ds/src/generated/generated-schema.ts` succeeds after DAL schema generation.
- [ ] Same CLI works with `--schema templates/ds-no-sql/src/schema` (graphqls directory) for non-DAL smoke test.
- [ ] `templates/ds-sdk` builds with `pnpm build` and exports types + builder symbols from `dist/`.
- [ ] Published package manifest has **no** HTTP client dependencies; only documented peers + **`zod`** as runtime dep for §4.
- [ ] Generated **`inputZodSchemas`** includes DAL dogfood inputs (e.g. `ItemCreateInput`, `ItemFilter`); `safeParseGraphqlInput` works in a unit test without GraphQL server.
- [ ] SDK validators are **SDL-derived**; DS server still uses **`dal-codegen` `input-zod.ts`** for resolver boundary (no import cycle).
- [ ] `templates/ds-sdk/schema/` contains normalized SDL diffable in PRs.
- [ ] DS server package does **not** require `client-preset` for SDK output.

---

## 14. Open decisions

| Topic | Proposal |
| ----- | -------- |
| Binary name | `create-graphql-sdk` (explicit; not `create-gql-sdk`) |
| Keep npm name `@corpdk/ds-sdk` for template package | Yes for path stability; generic CLI still works for any `--name` |
| Introspection URL as schema input | v1.1 (`--schema https://…` one-shot → `schema/`) |
| Second builder engine | Defer until buildgql gaps are proven in production |
| Input validation plugin | **`graphql-codegen-typescript-validation-schema`** + **`zodv4`** (v1) |
| Share emitter with `dal-codegen` | Defer unless plugin gaps block DAL lazy input graphs |

---

**Last updated:** November 8, 2026
