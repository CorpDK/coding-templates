# GraphQL CLI generator (`@corpdk/create-graphql-cli`)

Design specification for a **publishable GraphQL automation CLI** that **wraps a sibling SDK package** produced by [`@corpdk/create-graphql-sdk`](13-graphql-sdk-generator.md). The CLI is for **ops, scripts, and LLM/automation**—not for application UI runtimes. It includes **HTTP query/mutation** execution and **subscription streaming over SSE** only (`graphql-ws` is sunset).

**Status:** Design (pre-implementation).

**Related:** [13-graphql-sdk-generator.md](13-graphql-sdk-generator.md) · [11-ds-subscription-sse.md](11-ds-subscription-sse.md) · [ds-automation-upgrades.md](ds-automation-upgrades.md) · legacy [`@corpdk/codegen-cli`](../../libraries/codegen-cli)

---

## 1. Goals and non-goals

| Goals | Non-goals |
| ----- | --------- |
| Scaffold/regenerate a **CLI npm package** from **the same schema** as its SDK | GraphQL server, DAL, resolvers, `typescript-resolvers` |
| **Depend on the publishable SDK** for operation documents, types, and **§4 input validation** (wrap, don’t duplicate schema codegen) | Re-implement SDK §2/§3/§4 inside the CLI generator or ship CLI-owned Zod |
| **Non-interactive** mode: kebab-case subcommands, flags, `--input` JSON, stdin merge (today’s `ds-cli` ergonomics) | Browser/runtime Apollo or urql |
| **Interactive** mode: guided command + argument entry (`@clack/prompts`) | WebSocket subscriptions |
| Generic **any GraphQL API** (SDL or `typeDefs` → SDK → CLI) | **`DS_HTTP_URL`** and other DS-specific env names (use **`GRAPHQL_HTTP_URL`** only) |
| **Live API only** — every invocation performs fresh HTTP/SSE (no cache, no persisted query store) | Apollo-style normalized cache, offline mode, mock layers in the CLI |
| **Relation-id selections** — nested objects collapse to **`id`** (or configurable ref fields); follow-up via direct-fetch CLI commands (§3.3) | Deep nested selection trees / `maxDepth` expansion like legacy `codegen-cli` |
| CLI shaped like **`@corpdk/create-ds`** / **`@corpdk/create-graphql-sdk`** | Confusing **`@corpdk/codegen-cli`** with this scaffold CLI (different layers—see §2.4) |

---

## 2. Relationship to the SDK and legacy `ds-cli`

### 2.1 Two publishable artifacts per service

```text
┌─────────────────────┐     workspace / npm dep      ┌─────────────────────┐
│ @acme/graphql-sdk   │ ────────────────────────────►│ @acme/graphql-cli   │
│ (types + builders)  │                              │ (bin + transport)     │
└─────────────────────┘                              └─────────────────────┘
         ▲                                                      │
         │ create-graphql-sdk                                    │ create-graphql-cli
         │                                                      ▼
    schema SDL / typeDefs                                  HTTP + SSE to API
```

| Package | Generator | Contains transport? |
| ------- | --------- | ------------------- |
| **SDK** | `create-graphql-sdk` | **No** (includes transport-free **`inputZodSchemas`** + parse helpers — [§4](13-graphql-sdk-generator.md#4-input-validation--§4-zod-research--design)) |
| **CLI** | `create-graphql-cli` | **Yes** (`fetch` + SSE + **SDK-backed variable validation** before every request) |

### 2.2 Monorepo dogfood output: `templates/ds-cli`

| Phase | Action |
| ----- | ------ |
| **Implementation start** | Retire today’s **`templates/ds-cli`** + [`@corpdk/codegen-cli`](../../libraries/codegen-cli) wiring in DS `codegen.ts` (move to `ds-cli-legacy` or delete generated `index.js`) |
| **Steady state** | `@corpdk/ds-cli` workspace package refreshed by **`create-graphql-cli generate templates/ds-cli`** with SDK path **`templates/ds-sdk`** |
| **Prerequisite** | SDK must exist first (`create-graphql-sdk generate templates/ds-sdk`) with **§4 validators** built (`inputZodSchemas` export) |

### 2.3 Dogfood testing schema: `templates/ds`

Same convention as the [SDK generator](13-graphql-sdk-generator.md#22-schema-input-for-testing-templatesds):

| Input | Path (after `pnpm dal:codegen:schema` or full `dal:codegen` in `templates/ds`) |
| ----- | ----------------------------------------------------------------------------- |
| **`typeDefs`** (primary) | `templates/ds/src/generated/generated-schema.ts` |
| **SDL** (alternate smoke) | Manual DS templates’ `src/schema/**/*.graphqls` |

CI / local refresh:

```bash
pnpm --filter @corpdk/ds dal:codegen:schema
pnpm create-graphql-sdk generate templates/ds-sdk \
  --schema templates/ds/src/generated/generated-schema.ts
pnpm create-graphql-cli generate templates/ds-cli --sdk templates/ds-sdk
```

### 2.4 `@corpdk/codegen-cli` vs `@corpdk/create-graphql-cli` (re-verify)

These are **different responsibilities**. The design doc must not say the scaffold engine “replaces” the library wholesale.

| | **`@corpdk/codegen-cli`** | **`@corpdk/create-graphql-cli`** |
| --- | --- | --- |
| **What it is** | A **GraphQL Code Generator preset** (plugin run inside DS `pnpm codegen`) | An **engine / bin** (like `create-ds`, `create-graphql-sdk`) that scaffolds and regenerates a **CLI npm package** |
| **When it runs** | During **DS server** codegen, coupled to `templates/ds/codegen.ts` | On demand: `init` / `generate templates/ds-cli` (independent of DS deploy package) |
| **Output** | Emits into **`../ds-cli/src/generated/`** (monolithic `index.js`, man, texi) | Emits **`templates/ds-cli`** layout: stable `runtime/` + `generated/operations/*` + SDK dependency |
| **Uses SDK?** | **No** — builds GraphQL strings from schema only | **Yes** — CLI package **wraps** the SDK |
| **Runtime CLI** | Generated **`ds-cli`** binary (via preset output) | Same **product** (`ds-cli`), different **generation pipeline** |

**What we supersede:** the **integration pattern** “DS `codegen.ts` → `@corpdk/codegen-cli` preset → sibling `ds-cli`”, not the abstract idea of “codegen for CLIs” in general.

**Codegen migration:** see §2.5 (source moves into **`@corpdk/graphql-cli-core`**; preset deprecated on npm).

---

### 2.5 Migrating `libraries/codegen-cli` → `@corpdk/graphql-cli-core`

**Decision:** keep **one shared library** for schema→operation metadata and optional **man/texi** emitters. The GraphQL Code Generator **preset surface** (`export const preset` in `libraries/codegen-cli/src/index.ts`) is **not** carried forward; consumers call **`create-graphql-cli generate`** instead.

#### 2.5.1 Module inventory (today → target)

| Current file (`libraries/codegen-cli`) | Fate | Target home |
| -------------------------------------- | ---- | ----------- |
| **`schema-utils.ts`** — `extractOperations`, `OperationDescriptor`, `buildDocument`, `buildSelectionSet` | **Move + refactor** | `@corpdk/graphql-cli-core` — replace recursive `buildSelectionSet` with **relation-id policy** (§3.3) + `include`/`exclude`; retire depth `6` |
| **`gen-man.ts`** — `generateMan(ops)` | **Move** | `@corpdk/graphql-cli-core` — env/docs use **`GRAPHQL_HTTP_URL`** (not `DS_HTTP_URL`) |
| **`gen-info.ts`** — `generateInfo(ops)` | **Move** | `@corpdk/graphql-cli-core` — same env/name fixes as man |
| **`gen-cli.ts`** — `generateCli` (monolithic runtime + `OPERATIONS` + `fetch` + SSE) | **Do not port** | Replaced by engine **`canonical/`** `src/runtime/*` + per-operation `generated/operations/*` (§3.1) |
| **`index.ts`** — `Types.OutputPreset` wiring | **Deprecate** | No replacement export; **do not** re-export preset from `create-graphql-cli` or `graphql-cli-core` |

**Engine ownership:** `engines/create-graphql-cli` **depends on** `@corpdk/graphql-cli-core` for:

1. Load `GraphQLSchema` (from SDK snapshot / `--schema` / `cli.config.yaml`)
2. `extractOperations(schema, selectionConfig)` → filtered `OperationDescriptor[]`
3. Emit `generated/commands.ts`, `generated/operations/*` (emit v1/v2 per §3.4)
4. Optionally emit `generated/man/*`, `generated/info/*` when `cli.config.yaml` → `man.enabled`

**Publish posture:** `@corpdk/graphql-cli-core` is a **public npm library** (same as `@corpdk/dal-core` / other `libraries/*`). It is **not** a graphql-codegen plugin—only a programmatic API for the engine and tests.

#### 2.5.2 Monorepo layout (post-P1)

```text
libraries/graphql-cli-core/
  src/
    extract-operations.ts    # from schema-utils (profiles + include/exclude)
    types.ts                 # OperationDescriptor, ArgDescriptor, …
    emit-man.ts              # from gen-man.ts
    emit-texi.ts             # from gen-info.ts
    index.ts                 # public API only — no preset
  package.json               # @corpdk/graphql-cli-core

engines/create-graphql-cli/
  package.json               # depends on @corpdk/graphql-cli-core (workspace:*)
  canonical/                 # runtime template (replaces gen-cli output)
  src/                       # init, upgrade, generate
```

`libraries/codegen-cli/` remains in the repo until **npm deprecation** ships; after P3 it has **no in-monorepo callers** (DS `codegen.ts` drops the preset target).

#### 2.5.3 `@corpdk/codegen-cli` on npm

| Milestone | Action |
| --------- | ------ |
| **P1** | Create `graphql-cli-core`; copy/port modules; unit tests against `templates/ds` schema |
| **P3** | Remove preset from all template `codegen.ts`; last monorepo release that still **publishes** `codegen-cli` is optional one-off **deprecation notice** |
| **After P3** | Publish **`@corpdk/codegen-cli`** with README **DEPRECATED** → use `@corpdk/create-graphql-cli`; no new features; security fixes only if needed |
| **P6+** | Archive or delete `libraries/codegen-cli` from monorepo once downstream callers are gone (external consumers had migration window via deprecation) |

**Imports after migration:**

```text
# Before (remove)
generates["../ds-cli/src/generated/"] = { preset: "@corpdk/codegen-cli", … }

# After
pnpm create-graphql-cli generate templates/ds-cli --sdk templates/ds-sdk
# (or package script: "codegen": "create-graphql-cli generate .")
```

#### 2.5.4 What stays outside `graphql-cli-core`

| Concern | Owner |
| ------- | ----- |
| HTTP/SSE runtime, `parseArgs`, interactive UX | `create-graphql-cli` **`canonical/src/runtime/`** |
| SDK builders / schema types | **`@corpdk/ds-sdk`** (via `create-graphql-sdk`) |
| Server resolver typings | DS `codegen.ts` server plugins — **never** `codegen-cli` |

---

## 3. Generated CLI package architecture

### 3.1 Stable runtime + generated catalog (split from legacy monolith)

Legacy `ds-cli` emits one huge **`src/generated/index.js`** (runtime + `OPERATIONS` + transport). The new layout:

```text
templates/ds-cli/
  package.json                 # bin → dist/cli.js; depends on @corpdk/ds-sdk
  cli.config.yaml              # generator + runtime config
  .env.example                 # GRAPHQL_HTTP_URL (configurable env var name)
  src/
    cli.ts                     # hand-written entry (thin)
    runtime/                   # copied from engine canonical — stable across regen
      transport-http.ts        # POST JSON query/mutation
      transport-sse.ts         # subscription stream (GraphQL-over-SSE)
      args.ts                  # parseArgs, coerce, --input / stdin merge
      validate-variables.ts    # SDK §4 Zod — before HTTP/SSE (§3.5)
      interactive.ts           # @clack/prompts flow
      registry.ts              # dispatches command → operation
    generated/                 # overwritten on each generate
      commands.ts              # command registry metadata (descriptions, arg types)
      operations/              # one module per root field (SDK builder output)
        audit-event.ts
        hello.ts
        …
      man/                     # optional: ds-cli.1, .texi (port from codegen-cli)
  tsconfig.json
```

**Why split:** transport and interactive UX **do not** regenerate on every schema change; only **`generated/**`** does.

### 3.2 “Wrapping the SDK”

Each CLI operation is a **generated TypeScript module** that imports builders from the SDK:

```ts
// src/generated/operations/hello.ts — @generated
import { query, $ } from "@corpdk/ds-sdk";
import type { TypedDocumentNode } from "@graphql-typed-document-node/core";

export const HelloDocument = query("Hello", ($, q) => [
  q.hello({ name: $.name }, (r) => [/* selection from cli.config */]),
]);

export const helloMeta = {
  operationType: "query" as const,
  commandName: "hello",
  fieldName: "hello",
  args: [
    /* ArgDescriptor[] — see §3.5; scalar args have no inputZodSchemaName */
    { name: "name", graphqlType: "String!", parseType: "string", required: true },
  ],
};

// create-item style mutation:
// { name: "input", graphqlType: "ItemCreateInput!", inputZodSchemaName: "ItemCreateInput", ... }
```

At runtime the registry resolves **`commandName` → `{ document, meta }`**, then:

```ts
import { print } from "graphql";
const variables = buildVariablesFromArgv(meta, process.argv); // args.ts
const validated = validateOperationVariables(meta, variables); // §3.5 → SDK
if (!validated.ok) {
  writeValidationErrorsToStderr(validated);
  process.exit(1);
}
await executeHttp(print(document), validated.variables);
```

The package **must depend on the SDK from day one** (see §3.4 if the first generator milestone emits bridge documents instead of full builder source).

### 3.3 Selection policy: relation ids (default)

Legacy `codegen-cli` **recursively expands every object field to depth 6**, producing megabyte documents (`templates/ds-cli/src/generated/index.js`). That model fits exploratory UIs, not ops/LLM CLIs.

**Default for generated CLI operations:** **`selection.policy: relation-ids`** (fixed default in v1 unless overridden).

#### 3.3.1 Intent

| Principle | Detail |
| --------- | ------ |
| **Root payload** | For the type returned by the operation (e.g. `order`, `orders`, mutation payload entity), include **all scalar and enum fields** on that type—this is the record the user searched for or mutated. |
| **Relations never fully expand** | Any field whose output is an **object** or **list of objects** (navigation / association edges) is selected as **reference stubs only**—typically `{ id }` per linked row—never nested scalars or deeper relations. |
| **Follow-up fetches** | Scripts and operators run a **second CLI command** (e.g. `get-customer --id …`) to load full rows when needed. The CLI stays stateless (§4.4); chaining is explicit in the shell. |

This removes the need for aggressive **`maxDepth`** tuning on DAL-sized graphs.

#### 3.3.2 Cardinality rules (schema-inferred)

GraphQL does not declare SQL cardinality on the wire; the emitter uses **list vs non-list** of the field’s named output type:

| Typical relation | GraphQL field shape | Generated selection under `relation-ids` |
| ---------------- | ------------------- | ---------------------------------------- |
| **1:1** or **M:1** (parent → one child) | Singular object field, e.g. `customer: Customer` | Operation root scalars/enums **+** `customer { id }` |
| **1:M** or **M:N** (parent → many children) | List field, e.g. `lines: [OrderLine!]!` | Root scalars/enums **+** `lines { id }` (array of `{ id }` in JSON) |
| **Inverse M:1** (child → parent) | Singular object on child type | Same as first row: one nested `{ id }` |
| **Connection / aggregate ops** | `*Connection`, counts, aggregates | Prefer **`exclude`** or narrow **`include`** (heavy graphs not default-generated) |

**CorpDK DAL** exposes relations as **navigation fields** (FK scalars omitted on output types per [graphql-dal-requirements.md](graphql-dal-requirements.md)); the policy above matches that shape—edges are object/list fields, not bare `customerId` on reads.

#### 3.3.3 Example document shape

```graphql
# Generated for something like order(id: …) — conceptual
query OrderById($id: ID!) {
  order(id: $id) {
    id
    status
    totalAmount
    # …all other scalars/enums on Order
    customer { id }
    lines { id }
  }
}
```

```bash
# User workflow (live HTTP each time)
ds-cli order --id "$ORDER_ID"          # order scalars + customer id + line ids
ds-cli customer --id "$CUSTOMER_ID"  # full customer row when needed
ds-cli order-line --id "$LINE_ID"    # per-line detail
```

#### 3.3.4 Emitter algorithm (`graphql-cli-core`)

Replace legacy `buildSelectionSet(type, depth)` recursion with:

1. On the **operation’s root return type** (unwrap list/non-null until named object or scalar).
2. For each field on that object:
   - **Scalar / enum** → include field name.
   - **Object (singular)** → emit `fieldName { ref }` where `ref` is from config (default `id`).
   - **List of objects** → emit `fieldName { ref }` (GraphQL returns a list of stub objects).
   - **Do not** descend into related types beyond `ref` fields.
3. **Unions / interfaces** on relation edges: v1 emits `__typename` + `id` when present; v1.1 may use `cli.config` overrides.

**Identifier field:** default `relationRefFields: [id]`. If a linked type has no `id`, emitter uses the first configured ref field that exists on the type, or **omits** the navigation field and logs a generate-time warning.

#### 3.3.5 Configuration

```yaml
# cli.config.yaml
selection:
  policy: relation-ids          # default; only supported policy in v1
  relationRefFields: [id]       # stub fields on nested objects (no deeper nesting)

include:
  queries: ["hello", "audit-event"]
  mutations: ["create-item"]
  subscriptions: ["item-changed"]

exclude:
  queries: ["*_connection", "*_aggregate"]

# Escape hatch — not recommended for DAL-sized schemas
# selection:
#   policy: depth-expansion
#   maxDepth: 1
#   leaves: scalars-and-enums
```

`include` / `exclude` still gate **which root operations** exist as CLI commands. **`relation-ids`** gates **document size** for each included operation.

#### 3.3.6 Non-goals for this policy

- No automatic **batch** or **deduplicated** follow-up requests (no DataLoader in the CLI).
- No **join** emulation in the client—if you need a denormalized view, add a dedicated GraphQL field or run multiple CLI calls.

### 3.4 Operation emit: bridge (emit v1) vs full SDK builders (emit v2)

This is **not** the same table as implementation phases in §9 (engine `P0`–`P6`). It only describes **what text lands in `src/generated/operations/*.ts`**.

| | **Emit v1 — bridge** | **Emit v2 — full SDK wrap** |
| --- | --- | --- |
| **Generated operation module** | Exports a **`TypedDocumentNode`** built from **precomputed GraphQL strings** using **§3.3 relation-ids** (not legacy depth-6 `buildSelectionSet`) | Exports a document by calling **SDK builders** with the same **relation-id** projection tree |
| **SDK usage** | **Types** (`Query`, arg types) + package **dependency**; builders optional at runtime (document is already materialized) | **Types + builders**; selection edits in `cli.config` regenerate **builder call trees** |
| **Runtime transport** | Identical: `print(document)` → POST / SSE | Identical |
| **Why ship v1 first** | Faster to port off the preset without rewriting the emitter for every GraphQL type shape | End state: CLI codegen and SDK codegen share one mental model—no parallel string builder |
| **Generator milestone** | Target **implementation P3** (dogfood) | Target **implementation P4** |

**Summary:** v1 = “strings in TS files, types from SDK”; v2 = “source code is SDK `query()` / `mutation()` / `subscription()`”. Both are **live-transport** CLIs; the difference is **regeneration output**, not caching or env vars.

### 3.5 Variable validation via SDK §4 (required)

The CLI **must not** generate or maintain its own Zod modules. All **GraphQL input object** values pass through the sibling SDK’s **`inputZodSchemas`** registry and parse helpers ([SDK §4](13-graphql-sdk-generator.md#42-target-validators-in-the-publishable-sdk)) **before** any HTTP POST or SSE stream (§4.4 — validation is local, network still live per request).

```text
argv / stdin / --input  →  args.ts (merge, JSON parse)
                        →  validate-variables.ts (SDK safeParse*)
                        →  transport (only if ok)
```

#### 3.5.1 Generated metadata (`graphql-cli-core`)

Extend **`ArgDescriptor`** (emitted into each `*Meta` / `commands.ts`) with an optional link to the SDK registry:

| Field | When set | Purpose |
| ----- | -------- | ------- |
| `graphqlType` | Always | Wire type string, e.g. `ItemCreateInput!`, `[OrderLineFilter!]` |
| `inputZodSchemaName` | Named type is a GraphQL **input object** present in `inputZodSchemas` | Key for `safeParseGraphqlInput` / list variant |
| `parseType` | Scalar CLI flags (`string` \| `boolean`) | Legacy flag parsing for **scalar** operation args only |

Emitter rule: walk each operation field arg; unwrap `!` / `[]`; if `isInputObjectType`, set `inputZodSchemaName` to the input type’s GraphQL name (must match SDK codegen).

#### 3.5.2 Runtime (`validate-variables.ts`)

Stable canonical module; imports **only** from the configured SDK package:

```ts
import {
  safeParseGraphqlInput,
  safeParseOptionalGraphqlInput,
  safeParseGraphqlInputList,
  type InputZodSchemaName,
} from "@corpdk/ds-sdk";
```

| Variable shape | SDK call |
| -------------- | -------- |
| Required input object (`input: FooInput!`) | `safeParseGraphqlInput("FooInput", value)` |
| Optional input object | `safeParseOptionalGraphqlInput` |
| List of input objects (`[FooInput!]!` or optional list) | `safeParseGraphqlInputList` (or optional list helper from SDK) |
| Scalar / enum args (`ID!`, `String!`, `Int!`) | **No Zod** in v1 — `args.ts` **coerce** only (same as legacy `coerceArg`); SDL shape is already narrow |

On failure: write **`stderr`** as JSON array of `{ path, message }` (from Zod issues), exit **1** — **do not** call `GRAPHQL_HTTP_URL`. Success replaces unknown `variables` fields with **parsed** values (coerced enums, scalar wire forms).

#### 3.5.3 `--input` / stdin / interactive

| Source | Validation |
| ------ | ------------ |
| **`--input path.json`** | Parse JSON, then per-arg §3.5.2 for input-object variables |
| **Stdin merge** (non-TTY) | Same after merge into variables bag |
| **Interactive** JSON text areas | `safeParseGraphqlInput` **before** confirm; show field errors in the prompt loop when possible (v1.1) |

**CorpDK DAL:** server `input-zod.ts` may be **stricter** on create/update than SDK §4 SDL validators; CLI failures are still useful to catch malformed automation payloads early. Server wins on conflicts.

#### 3.5.4 CLI package dependencies

- **`zod` is not a direct dependency** of the CLI package — only **`@corpdk/ds-sdk`** (which ships §4 + `zod`).
- **`create-graphql-cli init` / `generate`** fail fast if the SDK package does not export **`inputZodSchemas`** (SDK generated without §4).

---

## 4. Execution modes

### 4.1 Non-interactive (automation / CI / LLMs)

```bash
ds-cli hello --name Ada
ds-cli create-item --input payload.json
echo '{"id":"…"}' | ds-cli audit-event
ds-cli item-changed --count 5 --timeout 30000
```

| Behavior | Detail |
| -------- | ------ |
| Command names | **kebab-case** from schema field names (`auditEvent` → `audit-event`) |
| Variables | Flags → merge with `--input` file → merge with **stdin JSON** (non-TTY) |
| Pre-flight validation | **SDK §4** Zod on input-object variables (§3.5); scalar args coerced only |
| Query/mutation output | Single JSON object on **stdout**; errors on **stderr**, exit **1** |
| Validation errors | **stderr** + exit **1** before HTTP when Zod rejects variables |
| Subscription output | **NDJSON** stream on stdout until `--count`, `--timeout`, or SIGINT |
| Help | `<bin>`, `<bin> <cmd> -h` |

Compatible with existing **`ds-cli`** automation expectations; **no WebSocket** code path.

### 4.2 Interactive (human operators)

Triggered when:

- **No arguments** (`ds-cli`), or
- Explicit **`ds-cli interactive`**, or
- **`--interactive`** global flag

Flow (`src/runtime/interactive.ts`):

1. **Searchable command list** (grouped Query / Mutation / Subscription) via `@clack/prompts`.
2. Per-argument prompts (type-aware: boolean select, string text, JSON text area for input objects with optional “open editor”).
3. Run **`validateOperationVariables`** (§3.5) on the assembled bag; block confirm on failure.
4. Confirm → execute using the same transport helpers as non-interactive.
5. Optional “run again” loop.

**Dependency:** `@clack/prompts` is a **runtime dependency of the CLI package only**, not the SDK.

### 4.3 Environment and auth

**Endpoint env var:** **`GRAPHQL_HTTP_URL` only** for the generated CLI (no `DS_HTTP_URL`, no migration aliases). Application/UI packages may keep `DS_HTTP_URL` for Next.js rewrites; that is separate from the **publishable CLI** contract.

```yaml
transport:
  httpUrlEnv: GRAPHQL_HTTP_URL   # fixed name for generated packages in v1
  defaultUrl: http://localhost:4000/graphql
  # optional v1.1:
  headersEnv: GRAPHQL_HEADERS_JSON
```

`cli.config.yaml` → `transport.httpUrlEnv` defaults to `GRAPHQL_HTTP_URL`. Scaffolds ship `.env.example`:

```bash
GRAPHQL_HTTP_URL=http://localhost:4000/graphql
```

Man pages and `--help` reference **`GRAPHQL_HTTP_URL`** only (legacy preset text that mentioned `DS_HTTP_URL` / `DS_WS_URL` is removed on migration).

### 4.4 Live data only (no caching)

The generated CLI is a **thin automation client**, not a GraphQL application runtime.

| Required | Forbidden |
| -------- | --------- |
| Each query/mutation: **one HTTP POST** to `GRAPHQL_HTTP_URL` | In-memory or disk **cache** of prior results |
| Each subscription: **one SSE stream** until `--count`, timeout, or signal | **Persisted** query store, normalized cache, “offline” replay |
| Args from flags/stdin only affect **that** request’s variables | Stale data served without a network round trip |

No `@apollo/client`, urql, or similar cache layers in the CLI package. Integration tests that validate operations must hit a **running** GraphQL HTTP endpoint (local DS or test container), same as today’s `ds-cli` expectations.

---

## 5. Generator CLI: `@corpdk/create-graphql-cli`

### 5.1 Monorepo placement

```text
engines/create-graphql-cli/
  src/           # init, upgrade, generate, args
  canonical/     # cli package template (runtime + cli.ts)
  package.json   # bin: create-graphql-cli; dep: @corpdk/graphql-cli-core
libraries/graphql-cli-core/   # @corpdk/graphql-cli-core — ported from codegen-cli §2.5
```

Published to npmjs as **`@corpdk/create-graphql-cli`** (public), matching other engines.

### 5.2 Commands (v1)

| Command | Purpose |
| ------- | ------- |
| `create-graphql-cli init [dir]` | Scaffold CLI package; link SDK; first `generate` |
| `create-graphql-cli generate [dir]` | Regenerate `src/generated/**` from SDK + schema |
| `create-graphql-cli upgrade [dir]` | Merge canonical runtime / config template deltas |

### 5.3 Flags

```text
create-graphql-cli init [directory] [options]
create-graphql-cli generate [directory] [options]

Options:
  --name <pkg>           npm package name (default: @corpdk/graphql-cli)
  --bin <name>           executable name (default: derived from package, e.g. ds-cli)
  --sdk <path>           path to SDK package (default: ../ds-sdk)
  --sdk-package <name>   npm name of SDK dep (default: read from sdk/package.json)
  --schema <path>        optional; default: use sdk.schema snapshot / sdk.config.yaml
  --no-install
  -h, --help
```

**`init` prerequisites:** SDK directory exists and has been built/codegen’d at least once (`schema/` + `src/gql/`).

### 5.4 `generate` inputs

Resolve schema in order:

1. `--schema` flag
2. `cli.config.yaml` → `schema.source` (same kinds as SDK: **`graphqls`** | **`typeDefs`**)
3. SDK’s `sdk.config.yaml` / `schema/` snapshot

Load **`GraphQLSchema`**, apply **`include` / `exclude` / `selection`**, emit **`generated/operations/*`** + **`generated/commands.ts`**.

### 5.5 Steady-state (monorepo)

```bash
# 1) Refresh SDK (from prior design)
pnpm create-graphql-sdk generate templates/ds-sdk \
  --schema templates/ds/src/generated/generated-schema.ts

# 2) Refresh CLI wrapping that SDK
pnpm create-graphql-cli generate templates/ds-cli \
  --sdk templates/ds-sdk

# 3) Build
pnpm --filter @corpdk/ds-cli build
```

---

## 6. Configuration: `cli.config.yaml`

```yaml
apiVersion: corpdk.dev/graphql-cli/v1
package: "@corpdk/ds-cli"
bin: ds-cli

sdk:
  package: "@corpdk/ds-sdk"
  workspacePath: ../ds-sdk # dev-only hint; npm dep uses package name

schema:
  # Usually inherited from SDK; override when CLI trims harder than SDK
  source:
    kind: typeDefs
    path: ../ds/src/generated/generated-schema.ts

transport:
  httpUrlEnv: GRAPHQL_HTTP_URL
  defaultUrl: http://localhost:4000/graphql

selection:
  policy: relation-ids
  relationRefFields: [id]

include:
  queries: []
  mutations: []
  subscriptions: []

man:
  enabled: true
  section: "User Commands"

validation:
  source: sdk # fixed v1 — always sibling SDK §4; no CLI-local Zod codegen
```

**Order of regeneration:** SDK **`create-graphql-sdk generate`** (must include §4) **before** **`create-graphql-cli generate`** so `inputZodSchemaName` entries match the registry.

Empty `include.*` means **all root fields of that operation type** (with a **warning** when count exceeds a threshold, e.g. 50).

---

## 7. `package.json` contract (generated CLI)

```json
{
  "name": "@corpdk/ds-cli",
  "type": "module",
  "bin": { "ds-cli": "./dist/cli.js" },
  "dependencies": {
    "@corpdk/ds-sdk": "workspace:*",
    "@clack/prompts": "^1.1.0",
    "graphql": "^16.13.2"
  },
  "scripts": {
    "codegen": "create-graphql-cli generate .",
    "build": "pnpm codegen && tsc",
    "prepublishOnly": "pnpm build"
  }
}
```

| Dependency | Role |
| ---------- | ---- |
| **`@corpdk/ds-sdk`** (or generic `@acme/graphql-sdk`) | Builders, types, **`inputZodSchemas`**, parse helpers (§3.5) |
| **`graphql`** | `print(TypedDocumentNode)` |
| **`@clack/prompts`** | Interactive mode only |

No Apollo, urql, or `graphql-sse` **required** if SSE is implemented with **`fetch` + stream parsing** (current `ds-cli` approach, aligned with [11-ds-subscription-sse.md](11-ds-subscription-sse.md)).

---

## 8. Comparison: legacy vs target

| Area | Legacy (`codegen-cli` → `ds-cli`) | Target (`create-graphql-cli`) |
| ---- | -------------------------------- | ------------------------------ |
| Schema coupling | DS `codegen.ts` sibling path | **Any** SDL / `typeDefs` via SDK |
| Operation documents | String embedded in `OPERATIONS` | **SDK-backed** `operations/*.ts` |
| Runtime | Regenerated entire `index.js` | **Stable `runtime/`** + generated catalog |
| Interactive | No | **Yes** |
| Subscriptions | SSE + stale **WS** env in header | **SSE only** |
| HTTP env | `DS_HTTP_URL` in generated runtime | **`GRAPHQL_HTTP_URL` only** |
| Data freshness | Always hits HTTP/SSE (legacy also live) | **No cache** — explicit non-goal to add caching |
| Selection | depth 6 auto-expand | **`relation-ids`** on edges; root scalars; **`include` / `exclude`** |
| Input validation | `coerceArg` only | **SDK §4** `inputZodSchemas` for input objects (§3.5) |
| man/texi | Yes | **Optional** (port generators) |

---

## 9. Implementation phases

| Phase | Deliverable |
| ----- | ----------- |
| **P0** | This design spec |
| **P1** | **`@corpdk/graphql-cli-core`** — port modules (§2.5); implement **§3.3 relation-ids** selection emitter |
| **P2** | `engines/create-graphql-cli` + `canonical/` runtime (HTTP + SSE + interactive + **`validate-variables.ts`**) |
| **P3** | `generate templates/ds-cli` dogfood; remove `codegen-cli` from `templates/ds/codegen.ts` |
| **P4** | Operation **emit v2**: builder-based `operations/*.ts`; drop emit v1 bridge strings if shipped in P3 |
| **P5** | Publish `@corpdk/create-graphql-cli`; document in user/admin guides |
| **P6** | Optional: GNU **info** / **man** generation from registry metadata |

---

## 10. Acceptance criteria

- [ ] `create-graphql-cli init templates/ds-cli --sdk templates/ds-sdk --name @corpdk/ds-cli --bin ds-cli` succeeds after SDK generate.
- [ ] `ds-cli hello --name test` returns JSON against a running DS (non-interactive).
- [ ] `ds-cli` with no args launches interactive flow and runs a selected query.
- [ ] `ds-cli <subscription-cmd>` streams NDJSON over **SSE** only; no WebSocket code or env vars.
- [ ] Regenerated CLI **depends on `@corpdk/ds-sdk`**; removing the SDK package breaks the build (proves coupling).
- [ ] Invalid **`--input`** for a mutation (e.g. bad `ItemCreateInput`) exits **1** with Zod errors on **stderr** and **no** HTTP request.
- [ ] `inputZodSchemaName` on generated meta matches SDK `inputZodSchemas` keys for DAL dogfood create/filter operations.
- [ ] Generated documents on DAL dogfood schema use **`relation-ids`** (nested objects = `id` only; root scalars present)—no depth-6 expansion.
- [ ] `include` / `exclude` limit which root operations are generated; spot-check document size stays bounded on full DAL schema.
- [ ] Dogfood uses **`templates/ds/src/generated/generated-schema.ts`** (same as SDK generator §2.2).
- [ ] Runtime reads **`GRAPHQL_HTTP_URL` only**; generated help/man contain no `DS_HTTP_URL` / `DS_WS_URL`.
- [ ] No response cache or subscription replay buffer across commands (§4.4).
- [ ] DS server **`codegen.ts`** has **no** `@corpdk/codegen-cli` target.

---

## 11. Open decisions

| Topic | Decision |
| ----- | -------- |
| Engine binary name | **`create-graphql-cli`** |
| HTTP endpoint env | **`GRAPHQL_HTTP_URL` only** in generated CLI (no `DS_HTTP_URL`) |
| Nested selection | **`relation-ids`** default (§3.3): 1:1 / M:1 → `{ id }`; 1:M / M:N → `[{ id }]`; full rows via separate CLI fetches |
| Operation emit timeline | **Emit v1** (bridge strings + SDK types) for **implementation P3** dogfood; **emit v2** (full builders) in **P4** — see §3.4 |
| Variable validation | **Required** — SDK §4 only (§3.5); no CLI Zod codegen |
| `@corpdk/codegen-cli` on npm | **Deprecated after P3**; logic lives in **`@corpdk/graphql-cli-core`** (§2.5). Preset not re-exported from `create-graphql-cli` |

---

**Last updated:** November 8, 2026
