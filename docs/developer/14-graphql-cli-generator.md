# GraphQL CLI generator (`@corpdk/create-graphql-cli`)

Design specification for a **GraphQL automation CLI** that **wraps a sibling SDK package** produced by [`@corpdk/create-graphql-sdk`](13-graphql-sdk-generator.md), and for the engine that scaffolds, regenerates, and upgrades it. The CLI is for **ops, scripts, CI, and LLM agents**, not for application UI runtimes. It runs queries and mutations over HTTP and streams subscriptions over **SSE only** (`graphql-ws` is sunset).

**Status:** Design (pre-implementation). Revision 5.

- Appendix A: gap review of revision 1.
- Appendix B: prototype evidence.
- Open work is tracked in the §16 register.

**Revision history**

| Rev | Date | Change |
| --- | ---- | ------ |
| 1 | 2026-11-08 | Initial proposal (built on SDK design rev 1) |
| 2 | 2026-11-12 | Gap review (Appendix A). Aligned to SDK design rev 6 (L1/L2/L3, genql-fork DSL, `./validation` entry, Zod as an optional peer, private `templates/ds-sdk`). Selection policy redesigned for wrapper types and proven on the full DAL schema. Added: flag and argument spec, exit codes, auth, LLM command catalog, destructive-operation guard, full monorepo migration, testing, and a remaining-work register. |
| 3 | 2026-11-12 | **Shared runtime over copied code:** the CLI runtime moves from per-package `canonical/src/runtime/*` copies into `@corpdk/graphql-cli-core` (entry `.`; generator at `./codegen`). A generated CLI is now a `cli.ts` binding + generated catalog + user extensions. **Top-level custom-scalar arguments** are validated with the SDK's `scalarZodSchemas` (SDK rev 7). Owners assigned. |
| 4 | 2026-11-13 | **Final cross-design review.** No joint PR: the SDK removes `../ds-sdk` in SDK P2, the CLI removes `../ds-cli` in C-P3. C-P2 also needs SDK P1c; R-C03/04/05 close against a fixture SDK in C-P2 and E2E in C-P3. `scalarZodSchemaName` / `scalarWire` on `ArgDescriptor`; scalar-registry stale check; JSON scalars from SDK `scalarWireFormats`. `graphql-cli-core` depends on `graphql-input-zod` (types); engine adds `graphql`. Scripts renamed `cli:codegen` / `cli:check`; `init --defer-generate`, `runInit` export. Publish bootstrap; `create-ds` work moved to [doc 15](15-create-ds-generator-integration.md); `create-app` declared frozen and out of scope (R-C13 dropped). Engine built on the shared `@corpdk/engine-kit` with the `create-ds`-style contract (doc 15 §11). |
| 5 | 2026-11-13 | **Second review.** `create-graphql-cli` publishes in C-P3 (with `create-ds --with-cli`, doc 15 DS-P2); C-P1 needs SDK P1a; selection files named by command; `graphql-cli-core` codegen API; `--version`; stale comments fixed. |

**Related:** [13-graphql-sdk-generator.md](13-graphql-sdk-generator.md) (SDK design, rev 9) · [11-ds-subscription-sse.md](11-ds-subscription-sse.md) · [ds-automation-upgrades.md](ds-automation-upgrades.md) · [graphql-dal-requirements.md](graphql-dal-requirements.md) · legacy [`@corpdk/codegen-cli`](../../libraries/codegen-cli)

---

## 1. Goals and non-goals

| Goals | Non-goals |
| ----- | --------- |
| Scaffold and regenerate a **CLI npm package** from the **same schema snapshot** as its SDK | GraphQL server, DAL, resolvers, `typescript-resolvers` |
| **Wrap the SDK**: L2 DSL for documents, L1 `Types.*` for typing, L3 validators for input checks (SDK §3) | Re-implementing SDK layers inside the CLI, or CLI-owned Zod codegen |
| **Non-interactive** mode for scripts, CI, and LLM agents: kebab-case commands and flags, variables file, stdin JSON | Browser or app runtimes (Apollo, urql) |
| **Interactive** mode for humans (`@clack/prompts`), only on a TTY | WebSocket subscriptions |
| **Machine-readable command catalog** (`commands --json`, `describe <cmd> --json` with JSON Schema), so agents can discover operations without scraping help text | Natural-language command parsing |
| **Bounded documents**: the relation-ids selection policy (§3.3) works on payload, connection, and union wrappers | Deep nested selection trees (legacy depth-6 expansion) |
| **Live API only**: every invocation does fresh HTTP or SSE | Caching, persisted queries, offline replay |
| **Safe by default** for destructive operations (§4.6) | Policy enforcement beyond a confirm gate (authorization is the server's job) |
| Generic **any GraphQL API**; endpoint and auth from env | DS-specific env names (`DS_HTTP_URL`) in the generated CLI |
| Engine shaped like `@corpdk/create-ds` / `@corpdk/create-graphql-sdk` | Being a GraphQL Code Generator preset (§2.4) |
| Depend only on packages that pass the SDK dependency policy ([SDK §16](13-graphql-sdk-generator.md#16-dependency-policy)) | |

---

## 2. Relationship to the SDK and the legacy `ds-cli`

### 2.1 Two artifacts per service

```text
schema sources ──create-graphql-sdk sync──► SDK snapshot (schema/schema.graphqls)
                                              │
                    ┌─────────────────────────┴──────────────────────────┐
                    ▼                                                    ▼
        SDK package (types + DSL + validators)          create-graphql-cli generate
        no transport                                    reads the SAME snapshot
                    ▲                                                    │
                    └──────────── runtime dependency ◄──── CLI package (bin + transport)
                                                                         │
                                                                         ▼
                                                               HTTP + SSE to the API
```

| Package | Generator | Transport? | What it uses from the other |
| ------- | --------- | ---------- | --------------------------- |
| **SDK** | `create-graphql-sdk` | No | n/a |
| **CLI** | `create-graphql-cli` | **Yes** (`fetch` + SSE) | L2 `buildQuery` / `buildMutation` / `buildSubscription` and selection types; L1 `Types.*`; L3 `inputZodSchemas` + parse helpers from `<sdk>/validation`; the snapshot (`<sdk>/schema.graphqls`) |

**One schema, no CLI-level schema sources.** The CLI always reads its SDK's committed snapshot. Revision 1 let `cli.config.yaml` point at its own schema source "to trim harder"; that could make generated selections disagree with the SDK's types and validators. Trimming is done with `include` / `exclude` (§3.6) instead.

### 2.2 Monorepo dogfood: `templates/ds-cli`

`templates/ds-cli` (`@corpdk/ds-cli`) is the dogfood output. It wraps `templates/ds-sdk`, which is a **private test proof and sample, never published** ([SDK §9.1](13-graphql-sdk-generator.md#91-output-package-and-its-source)). A published package cannot depend on an unpublished one, so **`templates/ds-cli` is a private sample too**:

- `templates/ds-cli/package.json` gets `"private": true`, and its Artifactory `publishConfig` is removed;
- CI guards it the same way as `templates/ds-sdk` (§12);
- its version becomes the fixed placeholder `0.0.0-sample`.

CLIs generated for real services depend on their own SDK by npm name, and the SDK's owner decides where both are published.

### 2.3 Dogfood schema

Same source as the SDK: `templates/ds/src/generated/generated-schema.ts`, through the SDK snapshot. The manual DS variants (`templates/ds-no-sql/src/schema`, multi-file) are covered by a smoke test (§12).

```bash
pnpm --filter @corpdk/ds dal:codegen:schema
pnpm --filter @corpdk/ds-sdk build            # sdk:codegen + tsc (run sdk:sync first outside the monorepo Turbo wiring) (SDK §9.2)
pnpm --filter @corpdk/ds-cli build            # create-graphql-cli generate . + tsc
```

### 2.4 `@corpdk/codegen-cli` vs `@corpdk/create-graphql-cli`

| | `@corpdk/codegen-cli` (legacy) | `@corpdk/create-graphql-cli` |
| --- | --- | --- |
| **What it is** | A GraphQL Code Generator **preset** run inside each DS `pnpm codegen` | An **engine / bin** that scaffolds and regenerates a CLI package |
| **When it runs** | During DS server codegen (all six DS `codegen.ts` + `create-ds` canonical) | On demand or in the CLI package's `build` |
| **Output** | Monolithic `../ds-cli/src/generated/index.js` with depth-6 selections, plus man/texi. A copy generated on 2026-10-05 (older schema, 152 operations) is 491 KB. | `src/cli.ts` binding + `src/generated/*` (catalog and selections); the runtime lives in `@corpdk/graphql-cli-core`. About 40 KB of documents for today's 166 operations (Appendix B). |
| **Uses the SDK?** | No | Yes |

What is superseded is the **integration pattern** "DS `codegen.ts` → preset → sibling `ds-cli`".

### 2.5 Migrating `libraries/codegen-cli` → `@corpdk/graphql-cli-core`

**Decision:** one shared library, `libraries/graphql-cli-core` (`@corpdk/graphql-cli-core`, npmjs, CalVer), holds **both** the generator side and the runtime, as two entry points (the same split as `@corpdk/graphql-dsl` and `@corpdk/graphql-input-zod`):

| Entry | Used by | Contents | Dependencies |
| ----- | ------- | -------- | ------------ |
| `@corpdk/graphql-cli-core/codegen` | `create-graphql-cli` | Operation extraction, relation-ids selection emitter (§3.3), naming and collision rules (§3.6), catalog emitter, man/texi emitters | peer `graphql` ^16 \|\| ^17 |
| `@corpdk/graphql-cli-core` | Every generated CLI at runtime | `runCli()`: dispatch, flag parsing and coercion, variable merge, validation calls, HTTP and SSE transport, output and exit codes, catalog/describe, interactive mode, destructive guard | `@clack/prompts`; `@corpdk/graphql-input-zod` (shared parse-result and issue types); peer `zod` ^4 |

The runtime is written once. A generated CLI passes in its SDK's functions (§3.2), so `graphql-cli-core` never imports a specific SDK. Runtime fixes reach every CLI through a dependency update; no regenerate or `upgrade` is needed.

The GraphQL Code Generator preset surface is **not** carried forward.

| Current file (`libraries/codegen-cli/src`) | Fate | Target |
| ------------------------------------------ | ---- | ------ |
| `schema-utils.ts`: `extractOperations`, `OperationDescriptor`, `buildDocument`, `buildSelectionSet` (depth 6) | **Move + rewrite** | `codegen/extract-operations.ts`, `codegen/selection.ts` (relation-ids, §3.3), `types.ts` |
| `gen-man.ts` | **Move** | `codegen/emit-man.ts`; env text uses the configured endpoint variable |
| `gen-info.ts` | **Move** | `codegen/emit-texi.ts`; same |
| `gen-cli.ts` (runtime + `OPERATIONS` + `fetch` + SSE as strings) | **Do not port** | Replaced by the typed runtime entry `@corpdk/graphql-cli-core` (`runCli`) |
| `index.ts` (`Types.OutputPreset`) | **Deprecate** | No replacement export |

`graphql-cli-core` has no dependency on any SDK package. Codegen entry: `emitCliModules(schema, { selection, include, exclude, guard, output, man }) → { commands, runtimeConfig, selections: Record<command, source>, man?, texi?, warnings }`, the inputs coming from `cli.config.yaml`. Its codegen entry emits selection objects as text; its runtime receives the SDK's `build*` and validation functions from the generated `cli.ts`.

#### 2.5.1 `@corpdk/codegen-cli` on npm

`@corpdk/codegen-cli` **is published** (2026.10.0-alpha.13, updated 2026-11-05) in the lockstep DS automation set.

| Milestone | Action |
| --------- | ------ |
| C-P1 | `graphql-cli-core` created; codegen-cli unchanged |
| C-P3 | Remove the preset from all six DS `codegen.ts` + `create-ds` canonical; drop `@corpdk/codegen-cli` from DS `package.json` files (the SDK's `../ds-sdk` target is already gone in SDK P2) |
| Release after C-P3 | Publish a final `@corpdk/codegen-cli` with a README deprecation notice, then `npm deprecate @corpdk/codegen-cli "Replaced by @corpdk/create-graphql-cli"`. Remove it from `PUBLISH_ORDER`. |
| One quarter later | Delete `libraries/codegen-cli` from the monorepo if no in-repo callers remain (CI-checked) |

---

## 3. Generated CLI package architecture

### 3.1 Package layout: a binding, a generated catalog, and user extensions

```text
templates/ds-cli/
  package.json               bin → dist/cli.js                       merged on upgrade
  cli.config.yaml            CLI config                              user-owned (merged on upgrade)
  .env.example               endpoint + auth variable names          canonical
  tsconfig.json              NodeNext                                canonical
  src/
    cli.ts                   binding: SDK functions + catalog → runCli()   canonical (about 15 lines)
    extensions/index.ts      user-owned: custom commands, header provider  never overwritten
    generated/               overwritten on every generate; gitignored
      commands.ts            command catalog (§3.4)
      runtime-config.ts      transport / guard / output settings from cli.config.yaml
      selections/<command>.ts  one selection object per operation, named by its collision-resolved command (§3.6)
      man/<bin>.1, info/<bin>.texi   when man.enabled
```

Revision 2 copied about ten runtime files (dispatch, args, transport, SSE, output, catalog, interactive, guard) into every CLI package. Revision 3 moves all of them into `@corpdk/graphql-cli-core` (§2.5). A generated CLI contains **no runtime logic**:

- the schema changes only `src/generated/**`;
- runtime fixes arrive as a `@corpdk/graphql-cli-core` version bump;
- `create-graphql-cli upgrade` is needed only when the binding or config template changes.

### 3.2 Wrapping the SDK: one emit model

Revision 1 planned two emits: "v1" precomputed GraphQL strings, then "v2" generated method-chaining builder calls. With the SDK's genql-fork DSL ([SDK §3.4](13-graphql-sdk-generator.md#34-dsl-surface)), a selection is a plain object literal, so there is **one emit from the start**: the generator writes a typed selection object, and the shared runtime composes it with the validated arguments through the SDK's `build*`.

```ts
// src/generated/selections/create-item.ts — @generated
import type { Selections } from "@corpdk/ds-sdk";

export const createItemSelection = {
  item: {
    createdAt: true, createdBy: true, description: true, hasAttachments: true, id: true,
    isActive: true, name: true, updatedAt: true, updatedBy: true,
    category: { id: true }, detail: { id: true }, itemTags: { id: true }, orderLines: { id: true },
  },
  userErrors: { code: true, field: true, id: true, message: true },
} satisfies Selections.CreateItemPayloadSelection;
```

```ts
#!/usr/bin/env node
// src/cli.ts — canonical binding (the whole file)
import { runCli } from "@corpdk/graphql-cli-core";
import { buildQuery, buildMutation, buildSubscription } from "@corpdk/ds-sdk";
import * as validation from "@corpdk/ds-sdk/validation";
import { catalog } from "./generated/commands.js";
import { runtimeConfig } from "./generated/runtime-config.js";
import * as extensions from "./extensions/index.js";

process.exitCode = await runCli({
  catalog,
  config: runtimeConfig,
  sdk: { buildQuery, buildMutation, buildSubscription, validation },
  extensions,
});
```

```ts
// inside @corpdk/graphql-cli-core runCli() — written once, shared by every CLI (simplified)
const op = catalog[commandName];
const vars = await collectVariables(op, argv, stdin);            // §4.2–4.3
const checked = validateVariables(op, vars, sdk.validation);     // §3.5
if (!checked.ok) return exit(3, checked.issues);
const build = { query: sdk.buildQuery, mutation: sdk.buildMutation, subscription: sdk.buildSubscription }[op.kind];
const built = build({ [op.field]: { __args: checked.variables, ...op.selection } });
return op.kind === "subscription" ? streamSse(built, config) : postHttp(built, config);
```

`runCli` takes a structural `SdkBindings` type: the three `build*` functions plus the `./validation` exports (§3.5). Any SDK produced by `create-graphql-sdk` satisfies it, and `tsc` checks the binding.

- `satisfies Selections.*` means a schema change that breaks a selection fails `tsc` in the CLI package.
- `build*` hoists argument values into `$vN` variables, so no named-variable support (SDK R-03) is needed.
- The CLI sends `built.query` and `built.variables`. It does not need `graphql`'s `print`.
- Operations whose root returns a scalar (`hello(name: String): String!`) have an empty selection. How the DSL takes `__args` on a scalar root field is checked in R-C04.

### 3.3 Selection policy: relation-ids (default)

Legacy expands every object field to depth 6. That fits exploration, not automation. **v1 policy: `relation-ids`.**

#### 3.3.1 Definitions

| Term | Rule |
| ---- | ---- |
| **Entity** | An object type with a **non-null** field named in `relationRefFields` (default `id`) of leaf type. `Item.id: ID!` qualifies; `MutationUserError.id: ID` (nullable) does not. |
| **Wrapper** | Any other object type: payloads (`CreateItemPayload`), connections, edges, `PageInfo`, aggregates, bulk results, change events, status objects |
| **Abstract** | A union or interface |
| **Focus entity** | The first entity reached from the operation root by passing only through wrappers or abstracts |

#### 3.3.2 Rules

1. **Leaf fields** (scalar, enum) are always selected.
2. **Wrappers are transparent.** From the root, expand every selectable field of a wrapper and continue walking.
3. **A focus entity gets its full row:** all leaf fields. Each field pointing at another entity or abstract becomes a **stub** (`{ id }`, or `{ __typename ... on X { id } }` for abstracts). A non-entity value object inside it is expanded with the same rule, up to 2 levels.
4. **Entities under an entity are always stubs.** Never descend into a related entity.
5. **Abstracts** emit `__typename` plus one inline fragment per possible type, each following the rule for its position.
6. **Connections:** a wrapper with both `nodes` and `edges` selects `nodes` (plus `pageInfo` and other fields) and skips `edges`. Configurable: `selection.connection: nodes | edges`.
7. **Arguments on nested fields:** fields with a required argument and no default are skipped. Fields with only optional arguments are selected without arguments.
8. **Guards:** a wrapper already on the current path is cut (cycle), as is a wrapper deeper than `selection.maxWrapperDepth` (default 4). Each cut emits `__typename` and a generate-time warning.
9. **No ref field on a linked entity type:** the field is omitted with a generate-time warning.

#### 3.3.3 Results on the DAL schema (prototype, Appendix B)

| Operation | Generated selection (abridged) |
| --------- | ------------------------------ |
| `order(id)` | Order leaves + `lines { id } user { id }` |
| `createItem(input)` | `item { …leaves… category { id } detail { id } itemTags { id } orderLines { id } } userErrors { code field id message }` |
| `itemConnection(...)` | `nodes { …Item row… } pageInfo { endCursor hasNextPage hasPreviousPage startCursor }` |
| `bulkCreateItem(...)` (union) | `__typename ... on BulkMutationResult { failureCount successCount userErrors {…} } ... on ItemListPayload { items { …Item row… } }` |
| `itemChanged(...)` | `count ids isTruncated operation` |
| `status` | `ok timestamp` |
| `hello(name)` | none (scalar root) |

Across all 166 DAL operations, every document passed `graphql.validate`, with no warnings. The largest was 733 bytes; the total was 39.7 KB.

Follow-up reads are explicit and stateless: `ds-cli order --id "$ID"` returns `user { id }`, then `ds-cli user --id "$USER_ID"` returns the user's row.

#### 3.3.4 Overrides

```yaml
# cli.config.yaml
selection:
  policy: relation-ids          # only policy in v1
  relationRefFields: [id]
  connection: nodes             # nodes | edges
  maxWrapperDepth: 4
  overrides:                    # per-operation additions, by GraphQL field name
    order:
      expand: [lines]           # select lines' full rows (their own edges stay stubs)
```

`overrides.<field>.expand` lets a team widen one relation for one operation without changing the global policy. Its effect is bounded by rule 4 one level below.

### 3.4 Generated catalog (`commands.ts`)

```ts
export interface CommandDescriptor {
  command: string;                 // kebab-case, collision-resolved (§3.6)
  kind: "query" | "mutation" | "subscription";
  field: string;                   // GraphQL root field name
  description?: string;            // from the schema
  deprecated?: string;             // deprecation reason; help marks it
  destructive: boolean;            // §4.6
  args: ArgDescriptor[];
  selection: object;               // from generated/selections/*
}

export interface ArgDescriptor {
  name: string;                    // GraphQL argument name
  flag: string;                    // CLI flag, kebab-case, collision-resolved (§4.1)
  graphqlType: string;             // wire type, e.g. "[ItemCreateInput!]!"
  kind: "scalar" | "enum" | "input";
  list: boolean;
  required: boolean;               // non-null without default
  defaultValue?: unknown;
  enumValues?: string[];
  inputZodSchemaName?: string;     // set when kind === "input"; key of SDK inputZodSchemas
  scalarZodSchemaName?: string;    // set for custom scalars; key of SDK scalarZodSchemas
  scalarWire?: "string" | "json"; // custom scalars: from SDK scalarWireFormats (§4.2)
  description?: string;
}
```

### 3.5 Variable validation via the SDK (L3, required)

The CLI generates no Zod. Input-object variables **and top-level custom-scalar arguments** pass through the SDK's L3 registries **before** any request is sent. The runtime in `@corpdk/graphql-cli-core` calls them through the `validation` binding that `cli.ts` passes in (§3.2):

```ts
// @corpdk/graphql-cli-core — the shape runCli expects from "<sdk>/validation"
export interface SdkValidationBindings {
  inputZodSchemas: Record<string, ZodType>;
  scalarZodSchemas: Record<string, ZodType>;
  safeParseGraphqlInput(name: string, value: unknown): GraphqlInputParseResult<unknown>;
  safeParseOptionalGraphqlInput(name: string, value: unknown): GraphqlInputParseResult<unknown>;
  safeParseGraphqlInputList(name: string, value: unknown): GraphqlInputParseResult<unknown>;
  safeParseOptionalGraphqlInputList(name: string, value: unknown): GraphqlInputParseResult<unknown>;
  safeParseGraphqlScalar(name: string, value: unknown): GraphqlInputParseResult<unknown>;
}
```

`GraphqlInputParseResult` and the helper logic come from `@corpdk/graphql-input-zod` ([SDK §7.4](13-graphql-sdk-generator.md#74-parse-helpers)). The SDK, the CLI, forms, and scripts all use the same code.

| Argument shape | SDK call |
| -------------- | -------- |
| `input: FooInput!` | `safeParseGraphqlInput("FooInput", v)` |
| `filter: FooInput` | `safeParseOptionalGraphqlInput` |
| `inputs: [FooInput!]!` | `safeParseGraphqlInputList` |
| `inputs: [FooInput!]` | `safeParseOptionalGraphqlInputList` |
| Custom scalar (`since: DateTime`), or list of them | `safeParseGraphqlScalar("DateTime", v)` per value, using the same wire rules as input-object fields (SDK `scalarZodSchemas`) |
| Built-in scalars (`Int`, `Float`, `Boolean`, `String`, `ID`), enums, lists of them | Checked by the flag parser (§4.2): type, enum membership, integer range |

**On failure:** stderr gets `{"error":"validation","issues":[{ "arg", "path", "message", "code" }]}`, the exit code is **3**, and **no request is sent**.

**On success:** parsed values replace the raw ones.

The DAL server's column-aware rules may be stricter; the server wins at runtime (SDK §7.5).

**Package requirements.**

- The CLI lists `zod` ^4 as its own dependency, because Zod is an optional peer of the SDK ([SDK §7.4](13-graphql-sdk-generator.md#74-parse-helpers)).
- `create-graphql-cli init` and `generate` fail (exit 1) if the SDK has no `./validation` entry (`validation.enabled: false`). The message names the SDK config key to change.
- `inputZodSchemaName` and `scalarZodSchemaName` values are checked against the SDK's generated `input-registry.ts` and `scalar-registry.ts` at generate time. A mismatch means the SDK is stale: exit 1 with "rebuild the SDK first".

### 3.6 Command set: include, exclude, naming

- **Patterns match GraphQL field names** (camelCase), per root type, with `*` as the only wildcard and case-sensitive matching. For example, `"*Connection"` and `"*Aggregate"`. Revision 1's example `"*_connection"` could never match a DAL field.
- **Empty `include` means all fields of that root type.** The DAL schema yields 166 commands. A warning fires above `commands.warnAbove` (default 200).
- **Command names** are the kebab-case field names (`itemConnection` → `item-connection`).
- **Collisions** are resolved deterministically at generate time, with a warning:
  - The same name under two root types: Query keeps the bare name; Mutation gets `mutate-<name>`; Subscription gets `subscribe-<name>`.
  - A name equal to a reserved command (`commands`, `describe`, `interactive`, `help`, `version`) gets a `<kind>-` prefix (`query-describe`).

```yaml
include:
  queries: []            # [] = all
  mutations: []
  subscriptions: []
exclude:
  queries: []
  mutations: []
  subscriptions: []
commands:
  warnAbove: 200
```

---

## 4. Non-interactive contract (scripts, CI, LLM agents)

### 4.1 Flags

**Argument flags** are the kebab-case argument names (`includeDeleted` → `--include-deleted`). The camelCase spelling is accepted as an alias for legacy scripts.

**Reserved global flags.** These names are taken; a GraphQL argument whose flag would collide with one is emitted as `--arg-<name>` (warning at generate time).

| Flag | Applies to | Meaning |
| ---- | ---------- | ------- |
| `--vars-file <path>` | all | Read variables from a JSON file |
| `--endpoint <url>` | all | Override the endpoint env variable |
| `--timeout-ms <n>` | all | HTTP request timeout (default 30000); for subscriptions, stop after this long (exit 0) |
| `--max-events <n>` | subscriptions | Stop after N events (exit 0) |
| `--confirm` | destructive mutations | Required in non-interactive mode (§4.6) |
| `--interactive` | all | Force interactive mode (TTY only) |
| `--pretty` | all | Indented JSON on stdout |
| `--raw` | queries, mutations | Print the full GraphQL response (`{ data, errors, extensions }`) instead of `data` |
| `-h`, `--help` / `--version` | all | Help / version |

**Why `--input` is gone.** Legacy registered `--input` as the variables-file flag and then **overwrote it** with any GraphQL argument named `input`, which every DAL `create*` and `update*` mutation has. So `ds-cli create-item --input payload.json` sent the string `"payload.json"` as the `input` argument. Revision 1 repeated that example. In revision 2, `--input` is the `input` argument's own flag, and the variables file is `--vars-file`.

### 4.2 Argument values

| GraphQL type | Flag syntax | Coercion and checks |
| ------------ | ----------- | ------------------- |
| `String`, `ID` | `--name Ada` | As-is |
| `Int` | `--limit 50` | Integer within the 32-bit signed range; otherwise exit 2. Legacy sent `parseInt` output without range checks. |
| `Float` | `--price 9.5` | Finite number |
| `Boolean` | `--include-deleted`, `--include-deleted=false`, `--no-include-deleted` | Boolean |
| Enum | `--status ACTIVE` | Must be a schema value; otherwise exit 2 listing the allowed values |
| Custom scalar | `--since 2026-01-01T00:00:00Z` | Passed as a string, or parsed as JSON when the SDK's `scalarWireFormats` marks the scalar `json` (SDK §6; recorded in `ArgDescriptor.scalarWire` at generate time). Then validated with the SDK's `safeParseGraphqlScalar` (§3.5); failure exits 3 before any request. |
| List | `--ids a --ids b` or `--ids '["a","b"]'` | Repeatable flag, or one JSON array. Each element is coerced as above. |
| Input object | `--filter '{"name":"x"}'` or `--filter @filter.json` | JSON, or `@<path>` to read a file; then L3 validation (§3.5) |
| Explicit `null` | Only through `--vars-file` or stdin JSON | Flags never produce `null`, which avoids ambiguity with the string `"null"` |

### 4.3 Variable sources and precedence

The precedence is **`--vars-file` < stdin JSON < flags**, which is legacy's documented order, kept. Stdin is read only when it is not a TTY and the command takes arguments. Invalid JSON in any source exits 2. A missing required argument after merging exits 2, naming its flag.

### 4.4 Output and exit codes

| Outcome | stdout | stderr | Exit |
| ------- | ------ | ------ | ---- |
| Success | `data` as one JSON line (`--pretty` indents; `--raw` prints the whole response) | empty | **0** |
| GraphQL `errors` (including partial data) | `data` if present | `{"error":"graphql","errors":[…]}` | **1** |
| Usage error (unknown command or flag, bad value, missing required argument, destructive without `--confirm`, no endpoint) | empty | `{"error":"usage","message":…}` | **2** |
| Pre-flight validation failed (no request sent) | empty | `{"error":"validation","issues":[…]}` | **3** |
| Transport failure (network, timeout, non-2xx HTTP, non-JSON body, SSE stream error) | empty | `{"error":"transport","status":…,"message":…}` | **4** |
| Mutation payload reports user errors (DAL `userErrors` non-empty) | `data` | `{"error":"userErrors","userErrors":[…]}` | **5** |

- **stderr is always one JSON object per line,** so agents can parse it reliably.
- **Exit 5 detection:** the generator marks payload fields named in `output.userErrorsFields` (default `[userErrors]`) as user-error carriers. `output.failOnUserErrors: false` disables exit 5.
- **Breaking change from legacy,** which used exit 1 for every failure. The CLI README documents it.

### 4.5 Subscriptions (SSE)

- **Transport:** GraphQL over SSE, distinct-connections mode: `POST` with `Accept: text/event-stream`, as legacy does today. Same protocol as [11-ds-subscription-sse.md](11-ds-subscription-sse.md); hand-written `fetch` stream parsing, no client library.
- **Output:** each `next` event's `data` is one NDJSON line on stdout. An event carrying `errors` is written to stderr and exits 1.
- **Stopping:** the stream stops on `complete`, `--max-events`, `--timeout-ms`, or SIGINT/SIGTERM. All of these exit 0 after closing the request.
- **No reconnect.** A dropped stream exits 4, so a supervising script decides whether to retry.

### 4.6 Destructive-operation guard

A mutation is **destructive** when its field name matches `guard.destructive` (DAL default: `delete*`, `bulkDelete*`, `bulkUpdate*ByFilter`).

- **Non-interactive:** destructive commands require `--confirm`; without it they exit 2 before any request.
- **Interactive:** a confirm prompt shows the command and its variables.
- **Catalog:** `commands --json` marks them `"destructive": true`, so agents can apply their own policy.
- Schema arguments such as `confirmDeleteAll` are still passed through. The guard is a CLI-side seatbelt, not authorization.

### 4.7 Endpoint and auth

```yaml
transport:
  httpUrlEnv: GRAPHQL_HTTP_URL     # default; set per service when several CLIs share a shell
  defaultUrl: http://localhost:4000/graphql   # optional; omit for production CLIs
  tokenEnv: GRAPHQL_TOKEN          # optional; sent as "Authorization: Bearer <token>"
  headersEnv: GRAPHQL_HEADERS_JSON # optional; JSON object of extra headers
```

- **Endpoint resolution:** `--endpoint` > the `httpUrlEnv` variable > `defaultUrl`. With none of these, exit 2.
- **Auth is v1, not v1.1.** Real APIs require it, and legacy had none.
- **Secrets come only from env.** No `--token` flag, so tokens don't land in shell history.
- **Never logged:** header values are not printed, and transport errors redact `Authorization`.
- **Extension point:** `src/extensions/index.ts` can export an async header provider (`headers`) (for example, an OIDC token refresher). The runtime calls it before each request.

### 4.8 Command catalog for agents

| Command | Output |
| ------- | ------ |
| `<bin> commands --json` | Array of `{ command, kind, field, description, deprecated, destructive, args: [{ flag, graphqlType, required, enumValues }] }` |
| `<bin> describe <cmd> --json` | One command's descriptor, plus a JSON Schema for each input-object argument, produced with Zod 4's `z.toJSONSchema()` from the SDK's L3 schema |
| `<bin> help` / `<bin> <cmd> -h` | Human help text, from the same catalog |

This replaces scraping help text, which legacy offered as the only discovery path. JSON Schema output for recursive inputs (`z.lazy`) is a C-P2 check (R-C06).

### 4.9 Live data only

One HTTP POST per query or mutation, and one SSE stream per subscription. No caches, no persisted queries, no replay buffers. No retries: mutations are not idempotent, and retry is the caller's choice.

---

## 5. Interactive mode (humans)

- **Entered** with `<bin>` (no arguments) or `<bin> interactive` / `--interactive`, **only when both stdin and stdout are TTYs and `CI` is unset.** Otherwise a bare `<bin>` prints help and exits 0, as legacy did, and `--interactive` exits 2. Revision 1 would have opened prompts in CI and hung.
- **Flow:**
  1. Pick a command from a searchable list grouped by kind.
  2. Answer type-aware prompts per argument: select for enums and booleans, text for scalars, a JSON editor for input objects.
  3. L3 validation runs, with issues shown inline and the prompt repeated.
  4. Destructive commands get a confirm prompt.
  5. The command runs through the same runtime as non-interactive mode.
  6. Optionally run it again.
- **Dependency:** `@clack/prompts`, a dependency of `@corpdk/graphql-cli-core` (runtime entry), loaded with a dynamic `import()` only when interactive mode starts. It is audited in SDK Appendix B.4. Generated CLIs do not list it.

---

## 6. Engine: `@corpdk/create-graphql-cli`

### 6.1 Placement and build

```text
engines/create-graphql-cli/
  src/          index, args, init, generate, upgrade, sdk-resolve, emit
  canonical/    CLI package template (cli.ts binding, extensions/, config, tsconfig); no runtime logic
  package.json  bin: create-graphql-cli; deps: @corpdk/engine-kit, @corpdk/graphql-cli-core (./codegen), graphql; build: tsc
libraries/graphql-cli-core/   @corpdk/graphql-cli-core (§2.5)
```

The engine and `graphql-cli-core` publish to npmjs in the **lockstep CalVer set** with the DS automation stack. Both build with `tsc`, not tsup (SDK Appendix B.4).

**Engine family.** The engine is built on `@corpdk/engine-kit` and follows the shared contract in [doc 15 §11](15-create-ds-generator-integration.md#11-generator-engine-family-and-corpdkengine-kit), like `create-ds`:

- the same command shape, help, and "Next steps" output;
- exit codes 0/1/2/3 (§6.4);
- `runInit` / `runUpgrade` exports;
- the overwrite / merge / never-touch upgrade model;
- a `.create-graphql-cli-version` record;
- a root script, `"create-graphql-cli": "node engines/create-graphql-cli/dist/index.js"`.

### 6.2 Commands and flags

| Command | Does | Touches |
| ------- | ---- | ------- |
| `init [dir]` | Copy `canonical/`, write `cli.config.yaml` and `package.json`, then `generate` (skipped with `--defer-generate`). Also exported as `runInit(options)` for `create-ds`. | Whole package (empty target only) |
| `generate [dir]` | Read the SDK snapshot → extract operations → selections + catalog (+ man/texi) | `src/generated/**` |
| `upgrade [dir]` | Overwrite `cli.ts`, `tsconfig.json`, `.env.example`; merge `package.json` (including the `@corpdk/graphql-cli-core` range) and `cli.config.yaml` | Canonical files only; never `src/extensions/**`. Runtime fixes do not need `upgrade`; they arrive with a `graphql-cli-core` version bump. |

```text
create-graphql-cli <init|generate|upgrade> [directory] [options]

  --sdk <path>          SDK package directory (init; required)
  --name <pkg>          npm package name (init; required)
  --bin <name>          executable name (init; default: last segment of --name)
  --check               generate: compare only; exit 1 if src/generated would change
  --no-install          init: skip pnpm install
  --defer-generate      init: write config and binding only; skip install and generate (the SDK has not
                        synced yet, e.g. when create-ds scaffolds DS + SDK + CLI together)
  --dry-run             init/upgrade: print planned writes
  --version             print the engine version
  -h, --help
```

Revision 1 defaulted `--name` to `@corpdk/graphql-cli` and `--sdk` to `../ds-sdk`. Both are now required, as in the SDK engine. `--schema` is removed (§2.1).

### 6.3 SDK resolution

`generate` finds the SDK from `cli.config.yaml` `sdk.path` (written by `init`), then reads:

- `<sdk>/schema/schema.graphqls`, the committed snapshot;
- `<sdk>/package.json`, for its name and version, checked against the CLI's dependency range;
- `<sdk>/src/generated/input-registry.ts` and `scalar-registry.ts`, or the built `./validation` export, for the `inputZodSchemas` and `scalarZodSchemas` keys and `scalarWireFormats`.

It writes a header in `src/generated/commands.ts` recording the snapshot's SHA-256. `generate --check` fails when the SDK snapshot has changed since the last generate, which catches a CLI left behind its SDK.

### 6.4 Exit codes (engine)

| Code | Meaning |
| ---- | ------- |
| 0 | Success |
| 1 | SDK missing or stale (no snapshot, no `./validation`, input- or scalar-registry mismatch), invalid config, or drift under `--check` |
| 2 | Usage error |
| 3 | Tool failure (install, `tsc` in `init`) |

---

## 7. Configuration: `cli.config.yaml`

```yaml
apiVersion: corpdk.dev/graphql-cli/v1
package: "@corpdk/ds-cli"
bin: ds-cli

sdk:
  package: "@corpdk/ds-sdk"   # npm name the runtime imports
  path: ../ds-sdk             # where generate reads the snapshot and registry

transport:
  httpUrlEnv: GRAPHQL_HTTP_URL
  defaultUrl: http://localhost:4000/graphql
  tokenEnv: GRAPHQL_TOKEN
  headersEnv: GRAPHQL_HEADERS_JSON
  timeoutMs: 30000

selection:
  policy: relation-ids
  relationRefFields: [id]
  connection: nodes
  maxWrapperDepth: 4
  overrides: {}

include: { queries: [], mutations: [], subscriptions: [] }
exclude: { queries: [], mutations: [], subscriptions: [] }
commands: { warnAbove: 200 }

guard:
  destructive: ["delete*", "bulkDelete*", "bulkUpdate*ByFilter"]

output:
  userErrorsFields: [userErrors]
  failOnUserErrors: true

man:
  enabled: true
  section: "1"
```

`validation.source` (rev 1) is removed. Validation always comes from the SDK.

---

## 8. `package.json` contract (generated CLI)

```json
{
  "name": "@corpdk/ds-cli",
  "version": "0.0.0-sample",
  "private": true,
  "type": "module",
  "bin": { "ds-cli": "./dist/cli.js" },
  "man": ["./dist/man/ds-cli.1"],
  "files": ["dist", "README.md"],
  "engines": { "node": ">=24.0.0" },
  "dependencies": {
    "@corpdk/ds-sdk": "workspace:*",
    "@corpdk/graphql-cli-core": "workspace:*",
    "graphql": "^16.13.2",
    "zod": "^4.3.6"
  },
  "devDependencies": { "@corpdk/create-graphql-cli": "workspace:*", "typescript": "^6.0.2" },
  "scripts": {
    "cli:codegen": "create-graphql-cli generate .",
    "cli:check": "create-graphql-cli generate . --check",
    "build": "pnpm cli:codegen && tsc -p tsconfig.json"
  }
}
```

`"private": true` and the placeholder version apply to the in-repo sample only (§2.2). The canonical template for other services omits both and sets no registry.

| Dependency | Why |
| ---------- | --- |
| SDK (`@corpdk/ds-sdk` or the service's SDK) | L2 `build*` + selection types, L1 `Types`, L3 `./validation` |
| `graphql` | Peer of the SDK (`parse` inside `build*`) |
| `zod` | Peer of the SDK's `./validation` entry (optional on the SDK; required here) |
| `@corpdk/graphql-cli-core` | The whole runtime (`runCli`), including interactive mode (`@clack/prompts` comes in through it) |

**Forbidden:** Apollo, urql, `graphql-request`, `graphql-sse`, `graphql-ws`, `@corpdk/codegen-cli`.

---

## 9. Monorepo integration and migration

| Area | Change | Phase |
| ---- | ------ | ----- |
| `templates/{ds,ds-no-sql,ds-cdb,ds-mongo,ds-ddb,ds-file}/codegen.ts` + `engines/create-ds/canonical/codegen.ts` | Remove the `../ds-cli/src/generated/` preset target. The SDK's `../ds-sdk` target is removed earlier, in SDK P2 (SDK §9.1). After both, only the resolver-types target remains. | C-P3 |
| Those seven `package.json` files | Drop `@corpdk/codegen-cli` | C-P3 |
| `turbo.json` | `codegen.dependsOn`: drop `@corpdk/codegen-cli#build`. `codegen.outputs`: drop `../ds-cli/src/generated/**`. Add `@corpdk/ds-cli#build` → `dependsOn: ["^build"]`; the SDK is a workspace dependency. | C-P3 |
| `templates/ds/Dockerfile`, `engines/create-ds/canonical/Dockerfile` | Remove the `libraries/codegen-cli` and `templates/ds-cli` `COPY` lines and the `codegen-cli` build step | C-P3 |
| `templates/ds-cli` | Replace with `init` output; `private: true`; drop the Artifactory `publishConfig` (§2.2) | C-P3 |
| `engines/create-ds` | `--with-cli` on `init`; `upgrade` drops `@corpdk/codegen-cli` and guides migration ([doc 15](15-create-ds-generator-integration.md)) | C-P3 (upgrade) / C-P4 (`--with-cli`) |
| `.github/scripts/publish-ds-automation.sh` | Add `@corpdk/graphql-cli-core` (after `@corpdk/graphql-input-zod`, which it depends on for types) and `@corpdk/create-graphql-cli` to `PUBLISH_ORDER`, build and test filters, and workflow `paths`. Remove `@corpdk/codegen-cli` after its deprecation release (§2.5.1). | C-P1 / C-P4 / after C-P3 |

`create-app` is **out of scope**: it is frozen and outdated, and this design makes no changes to it.

---

## 10. Phases

The CLI phases are prefixed **C-** and depend on the SDK phases ([SDK §13](13-graphql-sdk-generator.md#13-implementation-phases)).

| Phase | Deliverable | Needs | Docs updated in the same PR |
| ----- | ----------- | ----- | --------------------------- |
| **C-P0** | This design (rev 4) | n/a | `docs/00-index.md`, `docs/developer/README.md` |
| **C-P1** | `libraries/graphql-cli-core/codegen`: extraction, relation-ids emitter (§3.3), naming and collisions (§3.6), catalog emitter, man/texi port, unit tests on the DAL schema. Added to the lockstep publish set. | SDK P1a (`graphql-input-zod`, which `graphql-cli-core` depends on for types) | `libraries/graphql-cli-core/README.md`; `CLAUDE.md`; `docs/developer/01-monorepo-overview.md`; `docs/admin/04-npm-publish-ds-automation.md` |
| **C-P2** | `@corpdk/graphql-cli-core` runtime entry (`runCli`, §4, §5) + `engines/create-graphql-cli` with the binding-only canonical | SDK P1a (L3), P1b (DSL `build*`), P1c (`create-graphql-sdk`, whose output `generate` reads), DS-P0b (`engine-kit`) | `engines/create-graphql-cli/README.md`; `CLAUDE.md` |
| **C-P3** | Dogfood `templates/ds-cli` from `templates/ds-sdk`; remove the `../ds-cli` preset target and `@corpdk/codegen-cli` (§9); Docker; Turbo; `create-ds upgrade` removal rules (doc 15 DS-P2); **publish `@corpdk/create-graphql-cli`** (lockstep, after `engine-kit` and `graphql-cli-core`; bootstrap + trusted publishing, R-C11) so the `create-ds --with-cli` release that ships alongside points at a published engine | SDK P2 | `CLAUDE.md` (ds-cli row, `codegen-cli` row, Docker notes, "private sample" exception); `docs/admin/02-docker-deployment.md`; `docs/developer/ds-automation-upgrades.md` (migration note); `libraries/codegen-cli/README.md` (deprecation) |
| **C-P4** | `create-graphql-cli` already published in C-P3 (rev 5); deprecate `@corpdk/codegen-cli` on npm | SDK P4 | `docs/admin/04-npm-publish-ds-automation.md`; `libraries/codegen-cli/README.md` (deprecation notice) |

Man and info output ship in C-P1/C-P2, not in a separate optional phase as revision 1 had it. The emitters already exist and only need porting.

---

## 11. Feature comparison: legacy vs target

| Area | Legacy (`codegen-cli` → `ds-cli`) | Target |
| ---- | -------------------------------- | ------ |
| Schema | DS `codegen.ts` sibling path | SDK snapshot (one schema for SDK and CLI) |
| Documents | Depth-6 strings (491 KB in a 2026-10-05 copy, 152 ops) | Relation-ids selections over the SDK DSL; about 40 KB for today's 166 ops |
| Runtime | Regenerated monolith copied into every CLI | Written once in `@corpdk/graphql-cli-core`; each CLI is a binding + generated catalog |
| Flags | camelCase argument names; `--input` collides with `input` args | kebab-case (+ camelCase alias); reserved flags; collision rules |
| Coercion | `Int`/`Float` via `parseInt`/`parseFloat`; lists and input objects passed as strings | Typed coercion for every GraphQL type (§4.2) |
| Validation | None | SDK L3 before any request (§3.5) |
| Auth | None | Bearer token + header JSON from env; header-provider hook |
| Exit codes | 1 for everything | 0–5 (§4.4) |
| Discovery | Help text | `commands --json`, `describe --json` with JSON Schema |
| Safety | None | Destructive-operation guard |
| Interactive | None | TTY-only `@clack/prompts` |
| Subscriptions | SSE | SSE; NDJSON; `--max-events` / `--timeout-ms` |
| Endpoint env | `DS_HTTP_URL` | `GRAPHQL_HTTP_URL` (configurable per service) |

---

## 12. Testing and CI

| Check | Where |
| ----- | ----- |
| Selection emitter: the §3.3.3 table as golden tests; every DAL operation's document passes `graphql.validate`; a size budget (fail if any document exceeds 4 KB on the DAL schema) | `libraries/graphql-cli-core` |
| Collision rules: Query/Mutation name clash, reserved command names, argument-vs-reserved-flag clash | `libraries/graphql-cli-core` |
| Manual-variant smoke: generate from the `templates/ds-no-sql` multi-file schema through a temporary SDK; `tsc --noEmit` | CI |
| Flag parsing table (§4.2), precedence (§4.3), every exit code (§4.4) | `graphql-cli-core` runtime tests |
| **No-request guarantee:** validation failure (3), usage errors (2), and destructive without `--confirm` (2) make zero `fetch` calls (fetch is stubbed to fail the test) | `graphql-cli-core` runtime tests |
| Interactive mode never starts with non-TTY stdin/stdout or with `CI` set | `graphql-cli-core` runtime tests |
| End to end against a running `templates/ds` (docker compose): query, create mutation, `userErrors` path (exit 5), connection pagination, union bulk result, subscription with `--max-events` | CI job |
| `describe --json` produces valid JSON Schema for every DAL input, including recursive filters | `graphql-cli-core` runtime tests |
| `generate --check` detects SDK snapshot drift | engine tests |
| Generated `templates/ds-cli` `tsc` passes (`satisfies Selections.*` catches schema drift) | CI |
| Sample-never-published guard for `templates/ds-cli` (same as SDK §11) | CI |
| Secrets never printed: transport error output with a token set contains no token | `graphql-cli-core` runtime tests |

---

## 13. Acceptance criteria

- [ ] `create-graphql-cli init templates/ds-cli --sdk templates/ds-sdk --name @corpdk/ds-cli` succeeds after the SDK build, and a second `generate` leaves `git status` clean.
- [ ] All DAL operations generate valid documents under relation-ids. Mutation payloads include full `userErrors`; connections include `nodes` and `pageInfo`; union results include every member.
- [ ] `ds-cli create-item --input '{"name":"x","categoryId":"…"}'` works, and `--vars-file` supplies variables. No flag collision remains.
- [ ] Invalid input-object variables exit 3 with JSON issues on stderr, and **no** HTTP request is made.
- [ ] An invalid top-level custom-scalar argument (for example a malformed `--since` on a DAL `DateTime` argument) exits 3 with no request.
- [ ] Exit codes 0–5 behave as in §4.4 in the end-to-end suite.
- [ ] `GRAPHQL_TOKEN` is sent as a Bearer header and never appears in any output.
- [ ] `ds-cli commands --json` and `ds-cli describe create-item --json` return the catalog and a valid JSON Schema.
- [ ] Destructive mutations without `--confirm` exit 2 with no request.
- [ ] A bare `ds-cli` in CI prints help (exit 0) and never prompts.
- [ ] Subscriptions stream NDJSON over SSE and stop on `--max-events` / `--timeout-ms` / SIGINT with exit 0. There is no WebSocket code or env variable anywhere.
- [ ] No DS `codegen.ts` (six templates + `create-ds` canonical), Dockerfile, `package.json`, or `turbo.json` references `@corpdk/codegen-cli` or `../ds-cli`.
- [ ] `templates/ds-cli` is `private: true` with no `publishConfig`, and the CI guard passes.
- [ ] `@corpdk/codegen-cli` is deprecated on npm with a pointer to `@corpdk/create-graphql-cli`.

---

## 14. Decisions

| Topic | Decision |
| ----- | -------- |
| Engine binary | `create-graphql-cli` |
| Schema source | The SDK snapshot only; no CLI-level schema sources |
| Emit model | One emit: typed selection objects + runtime `build*` (no v1 bridge strings, no v2 builder calls) |
| Runtime packaging | Shared runtime in `@corpdk/graphql-cli-core` (entry `.`), generator at `./codegen`; generated CLIs contain a binding, a catalog, and user extensions only |
| Custom-scalar arguments | Validated with the SDK's `scalarZodSchemas` / `safeParseGraphqlScalar` (SDK rev 7) |
| Selection policy | relation-ids with transparent wrappers, connection `nodes`, union fragments (§3.3) |
| Variables file flag | `--vars-file` (`--input` belongs to the `input` argument) |
| Exit codes | 0 ok, 1 GraphQL errors, 2 usage, 3 validation, 4 transport, 5 user errors |
| Auth | v1: Bearer token + header JSON from env; header-provider hook |
| Interactive | TTY-only and never with `CI` set |
| Destructive guard | `--confirm` required non-interactively; patterns configurable |
| Endpoint env | `GRAPHQL_HTTP_URL` by default, configurable per service; `--endpoint` override |
| Zod | Direct dependency of the CLI (optional peer on the SDK) |
| `templates/ds-cli` | Private sample, never published (it depends on the private `templates/ds-sdk`) |
| Publishing | `graphql-cli-core` + `create-graphql-cli` in the lockstep npmjs set; `@corpdk/codegen-cli` deprecated after C-P3 |
| Builds | `tsc`, not tsup |
| Dependency policy | SDK §16 applies; no new third-party packages beyond those already audited (`graphql`, `zod`, `@clack/prompts`, `yaml`) |

---

## 15. Dependency check

Every third-party dependency this design adds is already audited in [SDK Appendix B](13-graphql-sdk-generator.md#appendix-b-dependency-maintenance-audit-2026-11-12) and passes SDK §16.1: `graphql`, `zod`, `@clack/prompts`, `yaml`.

SSE parsing, flag parsing (`node:util` `parseArgs`), and globbing (`node:fs` `glob`) use Node built-ins. No SSE or CLI-framework package is added. The new owned packages (`@corpdk/graphql-cli-core`, `@corpdk/create-graphql-cli`) follow SDK §16 for their own dependencies.

---

## 16. Remaining work register

Same conventions as [SDK §17](13-graphql-sdk-generator.md#17-remaining-work-register).

**Owners** (interim, assigned 2026-11-12):

| Package | Owner |
| ------- | ----- |
| `libraries/graphql-cli-core` | Debraj Kundu |
| `engines/create-graphql-cli` | Debraj Kundu |

| ID | Item | Phase | Done when | Status |
| -- | ---- | ----- | --------- | ------ |
| R-C01 | Port the relation-ids prototype (Appendix B) into `graphql-cli-core` with golden tests | C-P1 | §12 emitter checks green on the DAL schema | Open |
| R-C02 | Port man/texi emitters; remove `DS_HTTP_URL` / `DS_WS_URL` text | C-P1 | Generated man page names the configured env variable only | Open |
| R-C03 | Selection objects type-check with `satisfies Selections.*` against SDK L2 types, including union fragments (`on_<Type>`) and connection `nodes` | C-P2 (fixture SDK) / C-P3 (`templates/ds-cli`) | Fixture SDK `tsc` green in C-P2; `templates/ds-cli` `tsc` green in C-P3; depends on SDK R-05 to R-08 | Open |
| R-C04 | `build*` composition at runtime: `__args` with validated variables + generated selection, including scalar-root fields with arguments (`hello(name)`, SDK R-34) | C-P2 (fixture SDK) / C-P3 (E2E) | Runtime tests against a fixture SDK in C-P2; E2E suite green in C-P3 | Open |
| R-C05 | GraphQL-over-SSE client: `next` / `complete` / error events, abort on SIGINT, `--max-events`, `--timeout-ms` | C-P2 (stub server) / C-P3 (E2E) | Stub-server tests green in C-P2; E2E subscription test green in C-P3 | Open |
| R-C06 | `z.toJSONSchema()` output for recursive `z.lazy` inputs (DAL filters) | C-P2 | Valid JSON Schema for every DAL input | Open |
| R-C07 | Header-provider extension hook and token redaction | C-P2 | §12 secrets test green | Open |
| R-C08 | CLI decoupling PR: `../ds-cli` preset target out of seven `codegen.ts`, `@corpdk/codegen-cli` out of seven `package.json`, `turbo.json` (`codegen` `dependsOn` and outputs), two Dockerfiles | C-P3 | §13 decoupling criterion green | Open |
| R-C09 | `templates/ds-cli` private sample + CI guard | C-P3 | Guard green | Open |
| R-C10 | Top-level custom-scalar arguments validated with the SDK's `scalarZodSchemas` / `safeParseGraphqlScalar` (decided rev 3; needs SDK R-32) | C-P2 | Invalid `--since` value exits 3 with no request, in the runtime tests | Open |
| R-C11 | Publish pipeline: `graphql-cli-core` (C-P1, after `graphql-input-zod`), `create-graphql-cli` (C-P3), including the per-package maps in `verify_version` / `verify_dist_types`, test filters, the workflow release-notes table, and `paths`. One-time local bootstrap publish + npm trusted-publisher setup for each new package. Remove `codegen-cli` after deprecation. | C-P1 / C-P3; order per [doc 15 §4.3](15-create-ds-generator-integration.md#43-dependencies-and-publishing-canonical-publish-order) | Publish-order guard green; trusted publishing configured | Open |
| R-C12 | `npm deprecate @corpdk/codegen-cli` and the final README notice; delete `libraries/codegen-cli` a quarter later | After C-P3 | npm shows the deprecation; no in-repo references | Open |
| R-C13 | ~~`create-app` scaffolds `ds-cli` from the engine canonical~~ | — | — | Dropped (2026-11-13): `create-app` is frozen and out of scope |
| R-C14 | Docs per phase (§10), including `CLAUDE.md`'s `ds-cli` / `codegen-cli` rows and the "only workspace root is private" exception for both samples. Also stale: `docs/architecture/03-data-service-design.md` (codegen-cli preset section), `docs/developer/11-ds-subscription-sse.md`, `templates/ds/codegen.ts` header comment | C-P1 to C-P4 | Docs Update Rule satisfied | Open |
| R-C15 | Assign owners for `graphql-cli-core` and `create-graphql-cli` | Before C-P1 | Owners table filled | Done (2026-11-12) |
| R-C16 | `runCli` structural `SdkBindings` type: any `create-graphql-sdk` output binds without casts; `@clack/prompts` is loaded only on interactive start | C-P2 | Binding type test green; a non-interactive run does not load `@clack/prompts` (module-load test) | Open |

---

## Appendix A. Gap review of revision 1 (2026-11-12)

Revision 1 was checked against the SDK design rev 6, `libraries/codegen-cli/src` (857 lines), the generated DAL schema (`templates/ds/src/generated/generated-schema.ts`: 62 queries, 91 mutations, 13 subscriptions), the repo wiring (`turbo.json`, Dockerfiles, `create-app`, `create-ds`, the publish script), and npm.

| # | Severity | Gap in revision 1 | Resolution |
| - | -------- | ----------------- | ---------- |
| 1 | Blocker | Relation-ids assumed every operation returns an entity. On DAL wrappers it selected `userErrors { id }` (dropping `message`/`code`/`field`, because `MutationUserError.id` is nullable), lost `pageInfo` and edges on connections, and had no rule for union roots (`Bulk*Result`) | Entity/wrapper definitions, transparent wrappers, connection `nodes`, union fragments; proven on all 166 operations (§3.3, Appendix B) |
| 2 | Blocker | `--input` is both the variables-file flag and every DAL `input` argument; legacy overwrote the flag, and rev 1's own example (`create-item --input payload.json`) hit it | `--vars-file`; reserved-flag table; collision rule (§4.1) |
| 3 | Blocker | Built on SDK rev 1: `buildgql` API (`query("Hello", ($, q) => …)`), validators from the SDK root, "SDK ships zod", publishable `ds-sdk` | SDK rev 6 DSL (`build*` + selection objects), `@corpdk/ds-sdk/validation`, Zod as a direct CLI dependency, private samples (§2.2, §3.2, §3.5) |
| 4 | Blocker | `templates/ds-cli` (Artifactory) would depend on the never-published `templates/ds-sdk` | `templates/ds-cli` is a private sample too (§2.2) |
| 5 | High | Emit v1 (strings) / v2 (builder calls) split adds a throwaway milestone | One emit: selection objects + runtime `build*` (§3.2) |
| 6 | High | CLI could use its own schema source, diverging from the SDK's types and validators | SDK snapshot only (§2.1) |
| 7 | High | Migration covered `templates/ds/codegen.ts` only; missed five DS variants, the `create-ds` canonical, seven `package.json` files, `turbo.json` (`codegen` depends on `@corpdk/codegen-cli#build`), two Dockerfiles, `create-app`, and the publish script | §9 table; joint PR with SDK P3 (`create-app` later declared frozen and out of scope, rev 4); the rev 2 "joint PR with SDK P3" was superseded in rev 4 (SDK P2 removes `../ds-sdk`, C-P3 removes `../ds-cli`) |
| 8 | High | Argument coercion unspecified for lists, enums, input-object flags, nulls, `Int` range; legacy passed lists and objects as strings | §4.2 |
| 9 | High | No exit-code contract; partial data and DAL `userErrors` unhandled | §4.4 (codes 0–5) |
| 10 | High | Auth deferred to v1.1; legacy sends no auth headers | Bearer + header JSON + provider hook in v1 (§4.7) |
| 11 | High | Bare invocation launches interactive mode even in CI or with piped stdin (would hang) | TTY-only; `CI` disables (§5) |
| 12 | High | No machine-readable catalog for the LLM/automation goal | `commands --json`, `describe --json` with JSON Schema (§4.8) |
| 13 | High | No guard on destructive operations (DAL has `bulkDelete*ByFilter`) for an LLM-facing CLI | `--confirm` guard (§4.6) |
| 14 | Medium | `include`/`exclude` semantics undefined; example `"*_connection"` cannot match camelCase DAL fields; warn threshold 50 always fires on the DAL's 166 operations | Field-name globs, documented semantics, `warnAbove: 200` (§3.6) |
| 15 | Medium | Command-name collisions across root types and with built-in commands undefined | Deterministic prefixes (§3.6) |
| 16 | Medium | Endpoint env "fixed in v1" yet configurable; multiple CLIs in one shell would share `GRAPHQL_HTTP_URL` | Configurable per service + `--endpoint` (§4.7) |
| 17 | Medium | SDK prerequisite named rev 1 paths (`schema/` + `src/gql/`); no detection of a CLI left behind its SDK | Snapshot + registry reads; `generate --check` hash (§6.3) |
| 18 | Medium | `@corpdk/codegen-cli` deprecation plan said "optional"; it is published (2026.10.0-alpha.13) | `npm deprecate` + publish-order removal (§2.5.1) |
| 19 | Medium | `--name` defaulted to the CorpDK scope; `--sdk` defaulted to `../ds-sdk` | Both required (§6.2) |
| 20 | Medium | Man/texi both "move in P1" and "optional P6"; `man.enabled: true` by default | Ported in C-P1 (§10) |
| 21 | Medium | No testing plan, docs-update steps, dependency check, or remaining-work register; phases not linked to SDK phases | §10, §12, §15, §16 |
| 22 | Low | Stale cross-links into SDK rev 1 anchors (`#4-input-validation…`, `#42-target…`, `#22-schema-input…`) | Re-pointed to rev 6 sections |
| 23 | Low | Example `hello` arg shown as `String!`; the schema has `hello(name: String)` | Examples use real DAL fields |
| 24 | Medium | (rev 2) Runtime copied into every generated CLI (about ten files); fixes needed `upgrade` per package | Rev 3: shared runtime in `@corpdk/graphql-cli-core`; generated CLI is a binding + catalog (§2.5, §3.1) |
| 25 | Medium | (rev 2) Top-level custom-scalar arguments validated only by the server | Rev 3: SDK `scalarZodSchemas` / `safeParseGraphqlScalar` (§3.5) |

---

## Appendix B. Prototype evidence (2026-11-12)

A throwaway script (`/tmp`, not committed) ran the §3.3 rules over the generated DAL schema in `templates/ds` with `graphql` 16:

- **166 operations** (62 queries, 91 mutations, 13 subscriptions) produced documents.
- **0 validation errors** (`graphql.validate` against the schema) and no generate-time warnings.
- **Largest document 733 bytes; total 39,667 bytes.** For comparison, a legacy generated `templates/ds-cli/src/generated/index.js` in the main checkout, dated 2026-10-05 and built from an older schema with 152 operations, is 490,938 bytes.
- Sample outputs are in the §3.3.3 table, among them `createItem` (full `userErrors`), `itemConnection` (`nodes` + `pageInfo`), and `bulkCreateItem` (both union members).

Also checked:

- **Legacy flag collision:** in `libraries/codegen-cli/src/gen-cli.ts`, `optionMap.input` is assigned for the variables file and then reassigned in the argument loop for any argument named `input`.
- **Legacy coercion:** `coerceArg` converts only `Int` and `Float`.
- **Legacy transport:** sends only `Content-Type` and `Accept` headers.
- **Zod 4.3.6 `z.toJSONSchema()`** produced a valid draft 2020-12 schema for an object with an enum and a nullable list.

---

**Last updated:** November 13, 2026
