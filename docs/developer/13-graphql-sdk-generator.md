# GraphQL client SDK generator (`@corpdk/create-graphql-sdk`)

Design specification for a **publishable GraphQL client SDK** produced from a **complete schema** (one or many SDL files, or a TypeScript `typeDefs` module), and for the **CLI** that scaffolds, regenerates, and upgrades it. This initiative covers the SDK package, the CLI, and two in-house libraries the SDK is built from. It does not cover the GraphQL server, `ds-cli`, or HTTP transport. Apollo, urql, `graphql-sse`, and similar clients stay in consumer apps.

**Status:** Design (pre-implementation). Revision 6. Open work is tracked in the §17 register.

- Appendix A: gap review of revision 1.
- Appendix B: dependency maintenance audit.
- Appendix C: prototype evidence.

**Revision history**

| Rev | Date | Change |
| --- | ---- | ------ |
| 1 | 2026-11-07 | Initial proposal (`buildgql` builder, codegen validation plugin) |
| 2 | 2026-11-08 | Gap review (Appendix A) |
| 3 | 2026-11-12 | Multi-file SDL merge (§4); dependency audit; `gql.tada` replaced `buildgql` |
| 4 | 2026-11-12 | Builder DSL is a hard requirement; `genql` (vendored output) replaced `gql.tada` |
| 5 | 2026-11-12 | **`genql` forked into the owned `@corpdk/graphql-dsl`**, which adds aliases, `@include`/`@skip`, named variables, and native ESM. The DSL computes its result types from the SDK's own `Types.*` (L1) instead of generating a second set of interfaces. |
| 6 | 2026-11-12 | **`templates/ds-sdk` is a test proof and sample, never published** (§9.1). New libraries join the npmjs publish pipeline (§13). All remaining work is collected in the §17 register. Later on rev 6: `graphql-dsl` stays in this monorepo with its own version line and move-out triggers (§16.2.1). The §5 diagram's `z.ZodType<Types.X>` label is escaped (Mermaid stripped it as HTML). |

**Related:** [02-graphql-schema.md](02-graphql-schema.md) · [11-ds-subscription-sse.md](11-ds-subscription-sse.md) · [ds-automation-upgrades.md](ds-automation-upgrades.md) (pattern reference for `create-ds`) · [dal-pg-type-mapping.md](dal-pg-type-mapping.md) · [02-monorepo-design.md](../architecture/02-monorepo-design.md)

---

## 1. Goals and non-goals

| Goals | Non-goals |
| ----- | --------- |
| Generate a publishable SDK from **any** complete GraphQL schema | DS server, resolvers, DAL, databases |
| Accept the schema as **many `.graphql` / `.graphqls` files**, a **TypeScript `typeDefs`** module, or both, merged into **one** SDL (§4) | `typescript-resolvers`, `client-preset`, `@corpdk/codegen-cli` / `ds-cli` output |
| Ship a **typed builder DSL** (DGS-projection style) with aliases, `@include`/`@skip`, named variables, unions/interfaces, and compile-time rejection of unknown fields and arguments (§3.4) | Hand-written GraphQL strings as the primary API |
| **One set of type interfaces:** L1 `Types.*` is what the DSL's arguments and results are typed against, what L3 validators are annotated with, and what consumers import (§3.3) | Two parallel type sets (DSL-private interfaces next to L1) |
| Ship **L3 input validators** (`inputZodSchemas` + parse helpers) | Copying the server's column-aware `input-zod.ts` into the SDK (§7.5) |
| Install the SDK in **Node services** (NodeNext ESM) and **Next.js** apps from the same `dist/` | Transport in the SDK; WebSocket subscriptions (`graphql-ws` is sunset) |
| Shape the CLI like **`@corpdk/create-ds`** (`init`, `upgrade`, regenerate) | Coupling the generator to a CorpDK DS implementation |
| Detect schema drift and breaking changes in CI | Persisted queries, operation allow-lists, Relay artifacts |
| Depend only on packages that pass §16.1, or on code we own (§16.2) | |

---

## 2. Terminology

| Term | Meaning |
| ---- | ------- |
| **Source** | One schema input listed in `sdk.config.yaml`: a file, a directory, a glob, or a `typeDefs` module |
| **Snapshot** | The single merged, validated, sorted SDL file committed at `schema/schema.graphqls` |
| **L1 types** | TypeScript interfaces for every schema type, from `@graphql-codegen/typescript`. The SDK's only entity, input, enum, scalar, and argument types; exported as `Types`. |
| **L2 DSL** | The typed selection builder. Runtime and generator come from `@corpdk/graphql-dsl` (owned fork of `genql`). Per-schema selection types and the type map are generated into the SDK. |
| **L3 validators** | Zod v4 schemas for every GraphQL `input` object type, from the in-house `@corpdk/graphql-input-zod` |
| **Owned fork** | Third-party code copied into this repo, maintained by the team under repo standards, with the original licence notice kept (§16.2) |
| **Canonical file** | A file the engine owns; `upgrade` overwrites it |
| **User-owned file** | A file the team owns; no CLI command overwrites it after `init` |

---

## 3. SDK package architecture

### 3.1 Layers

| Layer | Tool | Output in the SDK | Reads |
| ----- | ---- | ----------------- | ----- |
| **L1 types** | `@graphql-codegen/cli` ^8 + `@graphql-codegen/typescript` ^7 (`enumsAsTypes`, `nonOptionalTypename`) | `src/generated/schema-types.ts` | snapshot |
| **L2 DSL** | `@corpdk/graphql-dsl/codegen` (generator); `@corpdk/graphql-dsl` (runtime, a dependency) | `src/generated/dsl/selections.ts` (selection types, with `__args` typed as L1 `*Args`), `src/generated/dsl/type-map.ts`, `src/generated/dsl/index.ts` (builders bound to this schema) | snapshot + L1 |
| **L3 validators** | `@corpdk/graphql-input-zod` | `src/generated/input-schemas.ts`, `src/generated/input-registry.ts` (annotated with L1 types) | snapshot + L1 |

All generated code lives under **`src/generated/`**, which is gitignored and regenerated from the committed snapshot.

### 3.2 Why fork `genql` into `@corpdk/graphql-dsl`

A builder DSL is a hard requirement. Among builder generators, `genql` has the widest adoption and the best fit: DGS-projection-style selection objects, and plain `tsc` rejecting unknown fields and arguments (Appendix C.3). Upstream, however:

- has **declined or never shipped** the missing features. Aliases have been requested since 2020 (#10, #55); directives too (#66, and #104, closed 2024-11-18 without implementation). The selection renderer still carries `// TODO if i want to add __directive support`.
- is **slow to release** (6.3.3 in March 2024, 6.3.4 in June 2026). A typing fix PR (#168, nullable non-scalars) has been open since March 2024.
- emits **extensionless imports** that fail under NodeNext ESM (Appendix C.4).
- ships **its own copy of every schema type**, a second interface set next to L1.

The source is small and MIT-licensed. Of about 3,140 lines of production code, about **1,480 are kept**: selection-type and type-map generation, the operation printer, result typing, and the type-map linker. About **1,660 are dropped**: transport client, fetcher, batcher, CLI, introspection fetching, response-type and client renderers, and their stale dependencies (`@graphql-tools/load` v7, `prettier` 2, `undici` 5, `yargs` 15, `listr2`, `rimraf` 2, `mkdirp` 0.5).

Owning the fork removes the single-maintainer risk entirely. The rev 4 §16.2 exception for `genql` is withdrawn.

### 3.3 One set of type interfaces

The DSL does not generate entity, input, enum, or scalar interfaces. Instead:

- **Results** are computed by the fork's `FieldsSelection` directly over **L1** `Types.Query` / `Types.Mutation` / `Types.Subscription`.
- **`__args`** in selection types are typed as L1's generated argument types (for example `Types.QueryItemsArgs`).
- **L3** schemas are annotated `z.ZodType<Types.X>`.

So `Types.ItemFilter` is the same type in a form, in a validator, in `__args`, and in a result.

Two adjustments make this work:

1. **L1 config:** `nonOptionalTypename: true`, so `__typename` is a required literal on every object type, and `enumsAsTypes: true`.
2. **Fork patch:** upstream `FieldsSelection` finds unions through a genql-only `__isUnion` marker. The fork detects object unions structurally, *before* the scalar check (which would otherwise distribute over the union members), and builds each member's result from `__typename` plus its `on_<Type>` selection.

Appendix C.8 shows upstream failing on L1 unions, and the patched version passing exact type-equality tests for object fields, enums, scalars, and union narrowing.

### 3.4 DSL surface

Upstream syntax is kept (existing `genql` knowledge transfers), and the fork adds aliases, directives, and named variables.

```ts
import { buildQuery, defineQuery, v, everything, type Types } from "@corpdk/ds-sdk";

// Ad-hoc: argument values are hoisted to $v1, $v2, … (upstream behavior).
const { document, variables } = buildQuery({
  __name: "Items",
  items: { __args: { filter: { name: "x" } }, id: true, name: true, status: true },
  search: { __args: { term: "a" }, __typename: true, on_Item: { id: true }, on_Label: { text: true } },
});

// Reusable, named variables (fork): built once; typed TypedDocumentNode<Result, { filter: Types.ItemFilter; withTags: boolean }>.
export const ItemsQuery = defineQuery({
  name: "Items",
  variables: { filter: v<Types.ItemFilter>(), withTags: v<boolean>() },
  select: ($) => ({
    items: {
      __args: { filter: $.filter },
      ...everything,
      tags: { __include: $.withTags },       // @include(if: $withTags); result field becomes optional
    },
    __aliases: {                               // aliases (fork): same field twice with different args
      archived: { items: { __args: { filter: { status: "ARCHIVED" } }, id: true } },
    },
  }),
});
```

| Feature | Syntax | Printed GraphQL | Result type | Status |
| ------- | ------ | --------------- | ----------- | ------ |
| Field selection | `id: true` | `id` | field from L1 | upstream |
| Arguments | `__args: { … }` (typed as L1 `*Args`) | `items(filter:$v1)` | n/a | upstream |
| Unions / interfaces | `on_<Type>: { … }`, `__typename: true` | inline fragments | discriminated by `__typename` | upstream, re-implemented over L1 (§3.3) |
| All scalars | `...everything` | scalar fields | scalars from L1 | upstream |
| Operation name | `__name` / `defineQuery({ name })` | `query Items` | n/a | upstream |
| **Aliases** | `__aliases: { alias: { field: selection } }`; each entry selects exactly one field (type-enforced) | `alias: field(…) {…}` | adds key `alias` | **fork** |
| **`@include` / `@skip`** | `{ __include: cond }` / `{ __skip: cond }` on a field (scalars use the object form) | `field @include(if:$vN)` | field becomes optional | **fork** |
| **Named variables** | `defineQuery({ variables: { x: v<T>() }, select: ($) => … })` | `query Items($x: T!)`; GraphQL type taken from the type map at the use site | `VariablesOf` = declared shape | **fork** |
| Reusable selections | TypeScript object spread | inline | merged | upstream |

`aliases` keep typo protection because aliases live under one reserved key (`__aliases`), not as arbitrary sibling keys. Ordinary field keys therefore stay subject to excess-property checks.

**Variable type checking.** For named variables the runtime compares the declared `v<T>()` against the argument's GraphQL type from the type map, and throws at `define*` time on mismatch. P1 decides whether this can also be checked at compile time.

**v1.1 (not v1):** arbitrary executable directives (`__directives`), `@defer`/`@stream`, persisted-query hashes.

### 3.5 Public exports

```ts
// src/index.ts (canonical)
export {
  buildQuery, buildMutation, buildSubscription,
  defineQuery, defineMutation, defineSubscription,
  v, everything,
  type QuerySelection, type MutationSelection, type SubscriptionSelection,
  type QueryResult, type MutationResult, type SubscriptionResult,
} from "./generated/dsl/index.js";
export type * as Selections from "./generated/dsl/selections.js"; // e.g. Selections.ItemSelection
export type { BuiltOperation, ResultOf, VariablesOf } from "@corpdk/graphql-dsl";
export type { TypedDocumentNode } from "@graphql-typed-document-node/core";
export type * as Types from "./generated/schema-types.js"; // L1: the one type set
export * from "./extensions/index.js";
```

```ts
// src/validation.ts (canonical) → "@corpdk/ds-sdk/validation"
export * from "./generated/input-schemas.js";
export * from "./validation/parse-input.js";
```

`build*` and `define*` return `BuiltOperation<R, V>`, which bundles four things:

- `document: TypedDocumentNode<R, V>`, parsed once and cached by text;
- `query`: the printed text, for `fetch` and `graphql-sse`;
- `variables` (for `build*`);
- `operationName`.

### 3.6 Package layout and file ownership

```text
<sdk>/
  schema/schema.graphqls           merged snapshot           CLI-written (sync), committed
  sdk.config.yaml                  SDK config                user-owned (merged on upgrade)
  codegen.ts                       graphql-codegen config    canonical (reads sdk.config.yaml)
  package.json                     manifest                  merged on upgrade (like create-ds)
  tsconfig.json                    NodeNext build            canonical
  README.md                        consumer guide            canonical outside <!-- user --> blocks
  src/index.ts                     root entry                canonical
  src/validation.ts                ./validation entry        canonical
  src/validation/parse-input.ts    parse helpers             canonical
  src/extensions/index.ts          shared selections / ops   user-owned (never overwritten)
  src/generated/**                 L1 + L2 + L3              generated, gitignored
```

### 3.7 Module format, manifest, and dependencies

The SDK builds with **`tsconfig.node.json` (NodeNext)**. The fork's generator emits `.js` specifiers natively, so no post-processing step is needed. This changes the current `ds-sdk` convention (ESNext + bundler) recorded in `CLAUDE.md`; that update lands in P2.

```json
{
  "name": "@corpdk/ds-sdk",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./validation": { "types": "./dist/validation.d.ts", "import": "./dist/validation.js" },
    "./schema.graphqls": "./schema/schema.graphqls",
    "./package.json": "./package.json"
  },
  "files": ["dist", "schema", "README.md"],
  "scripts": {
    "sdk:sync": "create-graphql-sdk sync .",
    "sdk:check": "create-graphql-sdk sync . --check",
    "codegen": "create-graphql-sdk codegen .",
    "build": "pnpm codegen && tsc -p tsconfig.json",
    "prepublishOnly": "pnpm sdk:check && pnpm build"
  }
}
```

| Kind | Packages | Reason |
| ---- | -------- | ------ |
| **dependencies** | `@corpdk/graphql-dsl` (runtime), `@graphql-typed-document-node/core` ^3 | The runtime is owned, so it is a normal dependency. DSL fixes reach SDKs through a dependency update without regenerating. The typed-document package is types-only (§16.1 exemption). |
| **peerDependencies** | `graphql` ^16 \|\| ^17; `zod` ^4 (optional) | `graphql` for `parse` in the runtime. Zod is shared with the app and optional for consumers that never import `./validation`. |
| **devDependencies** | `@corpdk/create-graphql-sdk`, `@graphql-codegen/cli`, `@graphql-codegen/typescript`, `typescript` | Build time only |
| **Forbidden** | `@genql/*`, Apollo, urql, `graphql-request`, `graphql-sse`, `graphql-ws`, `typescript-resolvers`, `@corpdk/dal-core` | No upstream DSL packages; the SDK stays transport-free |

**Publishing is the SDK owner's choice.** The canonical `package.json` carries no `publishConfig` and no `private` flag. A team that generates an SDK for its own service adds its registry, or marks the package private. The manifest above shows the shape every generated SDK has. For the in-repo sample `templates/ds-sdk`, §9.1 overrides this: it is `private: true`.

---

## 4. Schema sources and merging

### 4.1 Sources

`sdk.config.yaml` lists **one or more sources**, which are merged into **one** snapshot. The snapshot is a single file because every downstream tool reads one file, and one file is easy to diff in PRs.

```yaml
schema:
  sources:
    - kind: graphqls
      paths: ["../ds-no-sql/src/schema/**/*.graphqls", "../shared/schema/*.graphql"]
      exclude: ["**/*.test.graphqls"]
    - kind: typeDefs
      path: ../ds/src/generated/generated-schema.ts
  snapshot: schema/schema.graphqls # fixed in v1
```

| `kind` | Fields | Accepts |
| ------ | ------ | ------- |
| `graphqls` | `paths` (files, directories, or globs), optional `exclude` | `*.graphql` and `*.graphqls`. A directory means `<dir>/**/*.{graphql,graphqls}`. |
| `typeDefs` | `path` | A module exporting `typeDefs` by name: a string, a `DocumentNode`, or an array of either |
| `snapshot` | none | No upstream; `schema/schema.graphqls` is maintained by hand (publish-only SDKs) |

`--schema` may be repeated on the CLI. The kind is inferred: `.ts`, `.mts`, `.js`, and `.mjs` mean `typeDefs`; anything else means `graphqls`. Globs use Node's built-in `fs.promises.glob` (no experimental warning on Node 24.21). `typeDefs` modules load with `import()` and Node's built-in type stripping, which handles erasable syntax only and does not apply under `node_modules`. The CLI imports only configured paths and prints each one first.

### 4.2 Merge pipeline (`sync`)

1. **Collect** SDL units (one per file, plus one per `typeDefs` string or `DocumentNode`). Sort paths.
2. **Parse** each unit. Syntax errors name the file, line, and column.
3. **Merge** with `@graphql-tools/merge` `mergeTypeDefs(units, { sort: true, throwOnConflict: true })` (§4.3).
4. **Validate:** `buildASTSchema` + `assertValidSchema`.
5. **Completeness:** a `Query` root exists, and every custom scalar has a `scalars` entry (§6). All unmapped scalars are reported together.
6. **Print** with `print(merged)`, which keeps applied directives. A fixed header line is added, with no timestamp.
7. **Breaking-change report** (§4.4).
8. **Write** the snapshot, or with `--check`, compare and exit 1 on any difference.

### 4.3 Merge rules

These rules are `mergeTypeDefs` behavior. Rows marked ✓ were verified in Appendix C.1–C.2.

| Situation | Result |
| --------- | ------ |
| ✓ Same type in several files without `extend` | One type with the union of fields |
| ✓ `extend type X` with the base in another file | Folded into `X` |
| ✓ `extend type X` with no base `X` | **Error**: `Cannot extend type "X" because it is not defined.` |
| Same field, same type, in two files | De-duplicated |
| ✓ Same field, **different** type in two files | **Error** naming the type, field, and both types. The CLI adds the declaring files. |
| ✓ Enum declared in two files | Union of values |
| ✓ Same directive definition in two files | De-duplicated |
| ✓ Duplicate descriptions on one type | The first description in path order wins; describe a type in one file only |
| ✓ No explicit `schema { }` block | One is emitted |
| ✓ Output order | Types sorted; merged object fields sorted. Input fields keep (stable) source order. |

### 4.4 Breaking-change report

- **graphql 17+:** `findSchemaChanges`.
- **graphql 16:** `findBreakingChanges` + `findDangerousChanges`. These are deprecated in 17 and removed in 18, so the CLI prefers `findSchemaChanges` whenever it exists.

`--fail-on-breaking` exits 1 on any breaking change. `@graphql-inspector/core` is the fallback.

---

## 5. Generation pipeline

```mermaid
flowchart TD
  S1["Source: .graphqls files / dirs / globs"]
  S2["Source: typeDefs module"]
  SYNC["sync: parse → mergeTypeDefs → validate → scalar check → print → diff"]
  SNAP["schema/schema.graphqls (committed)"]
  GC["graphql-codegen typescript (nonOptionalTypename, enumsAsTypes)"]
  L1["src/generated/schema-types.ts (Types)"]
  DSL["@corpdk/graphql-dsl/codegen"]
  L2["src/generated/dsl/** (selections typed with L1 *Args, type map, bound builders)"]
  IZ["@corpdk/graphql-input-zod"]
  L3["src/generated/input-schemas.ts + input-registry.ts (z.ZodType#lt;Types.X#gt;)"]
  TSC["tsc (NodeNext) → dist/"]

  S1 --> SYNC
  S2 --> SYNC
  SYNC --> SNAP
  SNAP --> GC --> L1
  SNAP --> DSL
  L1 -. type imports .-> DSL
  DSL --> L2
  SNAP --> IZ
  L1 -. type imports .-> IZ
  IZ --> L3
  L1 --> TSC
  L2 --> TSC
  L3 --> TSC
```

L1 runs first, because L2 and L3 import its types by name. `sync` is the only step that reads outside the SDK; `codegen` and `build` read only the snapshot.

---

## 6. Configuration: `sdk.config.yaml`

```yaml
apiVersion: corpdk.dev/graphql-sdk/v1
package: "@corpdk/ds-sdk"

schema:
  sources:
    - kind: typeDefs
      path: ../ds/src/generated/generated-schema.ts
  snapshot: schema/schema.graphqls

# One entry per custom scalar. `sync` fails on any unmapped scalar.
# Values show the shape; the real DAL entries are written in P2.
scalars:
  DateTime:
    type: string # L1 TypeScript type (L2 and L3 use L1)
    zod: z.string() # L3 expression; `z` is in scope
  BigInt:
    type: string
    zod: z.union([z.string(), z.number().int()])

dsl:
  engine: corpdk-graphql-dsl # enum; only value in v1

validation:
  enabled: true
  strictObjects: false
```

`types.enumsAsTypes` and `nonOptionalTypename` are fixed in the canonical `codegen.ts`, because the DSL needs both (§3.3). Scalars map only into L1 (`scalars.<Name>.type`) and L3 (`zod`). L2 has no scalar config, because it reads L1.

**DAL scalar entries.** The custom scalars are `DateTime`, `Date`, `TimeTz`, `BigInt`, `Decimal`, `IntervalMs`, `SmallInt`, `Double`, `InsensitiveString`, `IP`, `CIDR`, `MAC` (`DAL_SCALAR_ZOD_BY_NAME` in `libraries/dal-codegen/src/generators/input-zod-scalars.ts`). Their entries encode the wire format from [dal-pg-type-mapping.md](dal-pg-type-mapping.md) and `libraries/dal-core/src/scalar-zod.ts`, without importing `@corpdk/dal-core`. The server stays authoritative where its rules are stricter.

**Custom scalars typed as objects** (for example `JSON: Record<string, unknown>`) need care. The result-typing scalar check is `string | number | Date | boolean | null | undefined`, so an object-typed scalar would be treated as a selectable object. The fork adds a generated scalar-name list to the type map so `FieldsSelection` treats those fields as leaves. P1 adds a regression test.

---

## 7. L3 input validators (Zod)

### 7.1 Current state (not SDK)

| Artifact | Generator | Lives in | Purpose |
| -------- | --------- | -------- | ------- |
| `input-zod.ts` | `@corpdk/dal-codegen` (`dal:codegen:impl`) | `templates/ds/src/generated/dal/` (gitignored) | **Server** resolver boundary |
| `src/validation/parse-input.ts` | `create-ds` canonical | DS package | Re-exports parse helpers |

### 7.2 Generator: `@corpdk/graphql-input-zod`

`graphql-codegen-typescript-validation-schema` fails §16.1 (Appendix B.2). The repo already owns an SDL-walk emitter: `emitGraphqlInputZodBlocks` in `libraries/dal-codegen/src/generators/input-zod-graphql.ts`, about 200 lines. It orders inputs topologically, uses `z.lazy` for cycles, and emits enums as `z.enum([...])`. v1 extracts it into `libraries/graphql-input-zod`:

```ts
export interface EmitInputZodOptions {
  scalars: Record<string, string>;
  skipTypeNames?: ReadonlySet<string>;
  typesImport?: string; // "./schema-types.js" → z.ZodType<Types.X> annotations
  strictObjects?: boolean;
}
export function emitInputZodModule(schema: GraphQLSchema, options: EmitInputZodOptions): {
  source: string; registrySource: string; registryNames: string[];
};
```

`dal-codegen` calls it with DAL scalars and its create/update skip set, and its output is unchanged. The SDK calls it with the snapshot and `sdk.config.yaml` scalars.

### 7.3 Scope

All `input` object types in the snapshot. Output types, whole variable bags, and server-only Drizzle constraints are out of scope.

### 7.4 Parse helpers

```ts
// src/generated/input-registry.ts (generated)
export const inputZodSchemas = { ItemCreateInput: ItemCreateInputSchema, /* … */ } as const;
export type InputZodSchemaName = keyof typeof inputZodSchemas;

// src/validation/parse-input.ts (canonical) — contract
export type InputOf<N extends InputZodSchemaName> = z.output<(typeof inputZodSchemas)[N]>;
export interface GraphqlInputIssue { path: (string | number)[]; message: string; code: string }
export type GraphqlInputParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; issues: GraphqlInputIssue[] };
export class GraphqlInputValidationError extends Error { readonly issues: GraphqlInputIssue[] }

safeParseGraphqlInput(name, value): GraphqlInputParseResult<InputOf<N>>
safeParseOptionalGraphqlInput(name, value): GraphqlInputParseResult<InputOf<N> | undefined>
safeParseGraphqlInputList(name, value): GraphqlInputParseResult<InputOf<N>[]>
parseGraphqlInput(name, value): InputOf<N>                 // throws GraphqlInputValidationError
parseOptionalGraphqlInput(name, value): InputOf<N> | undefined
```

Because `InputOf<"ItemFilter">` and the DSL's `__args.filter` are both `Types.ItemFilter`, a parsed value goes straight into a selection or a named variable without a cast.

### 7.5 Client vs server strictness

| Mechanism | Strictness | Where |
| --------- | ---------- | ----- |
| Column-aware `*CreateInput` / `*UpdateInput` | Strongest | **Server only** |
| `graphql-input-zod` with DAL scalar rules | Structure, nullability, enums, `dalScalarZod` | Server |
| `graphql-input-zod` with `sdk.config.yaml` scalars | Structure, nullability, enums, wire-format scalars | **SDK** |

The server does not import the SDK and wins at runtime (`userErrors` / `BAD_USER_INPUT`).

### 7.6 Consumer: `@corpdk/ui-forms`

`useZodForm(ItemCreateInputSchema)` works directly. Zod resolves to one instance (peer of the SDK, dependency of `ui-forms`, both ^4). L3 does not coerce HTML string values.

---

## 8. Libraries and CLI

### 8.1 `@corpdk/graphql-dsl` (owned fork of `genql`)

```text
libraries/graphql-dsl/
  src/runtime/        printer (aliases, directives, named variables), FieldsSelection over L1,
                      linkTypeMap, define*/build* helpers, BuiltOperation, ResultOf/VariablesOf
  src/codegen/        selection-type renderer (__args → L1 *Args), type-map renderer, bound-index renderer
  test/               ported upstream typeSelection/printer tests + new feature tests
  LICENSE             MIT, with genql's copyright notice kept
  UPSTREAM.md         base commit, divergence list, cherry-pick log
  package.json        exports "." (runtime) and "./codegen" (generator); build: tsc
```

- **Base:** `remorses/genql` `main` at `15f27b9` (6.3.4 plus 6 unreleased commits).
- **Published** to npmjs under CalVer, like the other `libraries/*`. Runtime peer: `graphql` ^16 || ^17. No other runtime dependencies.
- **Divergences from upstream:**
  - transport, CLI, introspection, and own response types removed;
  - native ESM output;
  - results computed over L1;
  - aliases, `@include`/`@skip`, and named variables added;
  - the selection-type key renamed from `GenqlSelection` to `Selection`.
- **Upstream tracking:** each quarter, review new upstream commits and cherry-pick relevant fixes into `UPSTREAM.md`. Open PR #168 (nullable non-scalar typing) is reviewed in P1 and its case added as a regression test.

### 8.2 `@corpdk/graphql-input-zod`

See §7.2. It is published to npmjs under CalVer.

### 8.3 `@corpdk/create-graphql-sdk`

```text
engines/create-graphql-sdk/
  src/        index, args, init, sync, merge, codegen, upgrade, schema-load, scalars, diff
  canonical/  SDK package template
  starter/    demo SDL
  package.json  bin: create-graphql-sdk; build: tsc (not tsup — see Appendix B.4)
```

Runtime dependencies: `graphql`, `@graphql-tools/merge`, `@graphql-codegen/cli`, `@graphql-codegen/typescript`, `@corpdk/graphql-dsl` (`/codegen`), `@corpdk/graphql-input-zod`, `yaml`, `@clack/prompts`.

### 8.4 Commands

| Command | Does | Touches |
| ------- | ---- | ------- |
| `init [dir]` | Copy `canonical/`, write config and `package.json`, `sync`, `codegen` | Whole package (empty target only) |
| `sync [dir]` | Merge sources → validate → snapshot | `schema/schema.graphqls` |
| `codegen [dir]` | Snapshot → L1 → L2 + L3 | `src/generated/**` |
| `generate [dir]` | `sync`, then `codegen` | Both |
| `upgrade [dir]` | Overwrite canonical files; merge `package.json` and `sdk.config.yaml` | Canonical files only |

### 8.5 Flags

```text
create-graphql-sdk <init|sync|codegen|generate|upgrade> [directory] [options]

  --schema <path>       Source file, directory, glob, or typeDefs module; repeatable
  --name <pkg>          npm package name (init; required unless --demo-schema)
  --demo-schema         Use the engine's starter SDL (init)
  --check               Compare only; exit 1 on drift (sync, generate)
  --fail-on-breaking    Exit 1 on breaking schema changes (sync, generate)
  --no-install          Skip pnpm install (init)
  --dry-run             Print planned writes without writing (init, upgrade)
  -h, --help
```

### 8.6 `init`, `upgrade`, exit codes

**`init`:**

1. The target must be empty.
2. Copy `canonical/`.
3. Write `sdk.config.yaml` and `package.json` (CalVer `YYYY.M.0`).
4. Run `sync`. Unmapped scalars get reviewable stubs, and the command exits 1.
5. Install, then run `codegen`.

**`upgrade`:**

- **Overwrite:** `codegen.ts`, `tsconfig.json`, `src/index.ts`, `src/validation.ts`, `src/validation/parse-input.ts`, and the README outside `<!-- user -->` blocks.
- **Merge:** `package.json` and `sdk.config.yaml`.
- **Never touch:** `schema/**`, `src/extensions/**`.
- Then run `codegen`.

| Code | Meaning |
| ---- | ------- |
| 0 | Success |
| 1 | Validation failure (parse, merge conflict, invalid schema, unmapped scalar, drift, breaking change) |
| 2 | Usage error (flags, non-empty `init` target, a source matching no files) |
| 3 | Tool failure (graphql-codegen, DSL or Zod generator, install) |

---

## 9. Monorepo integration (this repository)

### 9.1 Output package and its source

`templates/ds-sdk` (`@corpdk/ds-sdk`) is the dogfood output, sourced from `templates/ds` only. It is a **test proof and sample, and is never published** to any registry. It exists to prove the engine end to end against the DAL schema in CI, and to serve as the reference copy that `create-app` scaffolds from (through the engine canonical, §9.4). Consequences:

- `templates/ds-sdk/package.json` gets `"private": true`, and its Artifactory `publishConfig` is removed. npm documents that a real publish of a private package is refused.
- **Dry runs do not check `private`.** Both `pnpm publish --dry-run` and `npm publish --dry-run` accepted a `private: true` package in a local test (Appendix C.10). A successful dry run therefore proves nothing about this guard. CI adds an explicit check (§11) that `templates/ds-sdk` stays `private: true`, has no `publishConfig`, and is absent from `PUBLISH_ORDER` in `.github/scripts/publish-ds-automation.sh`.
- It is an exception to the repo rule that only the workspace root is private. `CLAUDE.md` ("Publishing: npmjs vs Artifactory"), [02-monorepo-design.md](../architecture/02-monorepo-design.md) (publishing table), and [04-npm-publish-ds-automation.md](../admin/04-npm-publish-ds-automation.md) (which today calls `templates/ds-sdk` "Artifactory-only") are updated in P2.
- The "packed manifest" checks in §11 and §14 still run, through `pnpm pack`, which works on private packages, so the generated-SDK contract stays tested.
- CalVer bumps for `templates/ds-sdk` stop. Its version stays a fixed placeholder (`0.0.0-sample`), so nothing suggests a release.

All six DS variants stop writing `client-preset` output into `../ds-sdk`:

| File | Change |
| ---- | ------ |
| `templates/{ds,ds-no-sql,ds-cdb,ds-mongo,ds-ddb,ds-file}/codegen.ts` | Remove the `../ds-sdk/src/generated/` target; keep resolvers and the `../ds-cli` target |
| `engines/create-ds/canonical/codegen.ts` | Same; drop the "must sit beside ds-sdk" note |
| DS `package.json` files | Drop `@graphql-codegen/client-preset` |
| `turbo.json` `codegen.outputs` | Remove `../ds-sdk/src/generated/**` |

The manual variants' multi-file SDL (`base.graphqls`, `item.graphqls`, `server.graphqls`) is covered by a CI smoke test (§11).

### 9.2 Turbo wiring

```jsonc
"@corpdk/ds-sdk#sdk:sync": {
  "dependsOn": ["@corpdk/ds#dal:codegen:schema", "@corpdk/create-graphql-sdk#build"],
  "inputs": ["../ds/src/generated/generated-schema.ts", "sdk.config.yaml"],
  "outputs": ["schema/**"],
  "cache": true
},
"@corpdk/ds-sdk#build": {
  "dependsOn": ["^build", "sdk:sync"],
  "outputs": ["dist/**", "src/generated/**"]
}
```

`^build` covers `@corpdk/graphql-dsl` and `@corpdk/graphql-input-zod`, which are workspace dependencies. If Turbo rejects the package-relative `../ds/...` input, use `$TURBO_ROOT$/templates/ds/...`; check this in P2.

### 9.3 Docker

| Dockerfile | Change |
| ---------- | ------ |
| `templates/ds/Dockerfile`, `engines/create-ds/canonical/Dockerfile`, `templates/docker/Dockerfile.ds` | Remove `templates/ds-sdk` `COPY` / build lines |
| `templates/docker/Dockerfile.ui` | From P5, `COPY` and build `packages/ds-sdk` before the UI (hermetic: snapshot only) |

### 9.4 `create-app` and `create-ds`

- **`create-app`** produces `ds-sdk` from the engine canonical, with `schema.sources` set for the chosen DS: `typeDefs` for `ds`; a `graphqls` directory (multi-file) for the manual variants.
- **`create-ds upgrade`** overwrites `codegen.ts`. Release notes tell consumers to run once:

```bash
pnpm dlx @corpdk/create-graphql-sdk init ../ds-sdk \
  --name @<scope>/ds-sdk --schema ./src/generated/generated-schema.ts
```

---

## 10. Consumer usage (SDK README; transport is not in the SDK)

| Runtime | Query / mutation | Subscription (SSE) |
| ------- | ---------------- | ------------------ |
| Node service | `fetch` with `{ query, variables, operationName }` | `graphql-sse` with `{ query, variables }` from `buildSubscription` / `defineSubscription` |
| Next.js (`templates/ui`, Apollo) | `useQuery(ItemsQuery.document, { variables })` | Apollo SSE link from [11-ds-subscription-sse.md](11-ds-subscription-sse.md) |
| Next.js (`templates/ui-hprt`, urql) | `useQuery({ query: ItemsQuery.document, variables })` | urql `subscriptionExchange` backed by `graphql-sse` |

P2 type tests confirm that Apollo and urql infer `data` and check `variables` without casts.

---

## 11. Testing and CI

| Check | Where |
| ----- | ----- |
| Ported upstream tests (`typeSelection.test.ts`, printer tests) pass against L1-typed sources | `libraries/graphql-dsl` |
| `FieldsSelection` over L1: exact equality for object fields, enums, scalars, nullable objects (PR #168 case), lists, union and interface narrowing, object-typed custom scalars | `libraries/graphql-dsl` |
| Aliases: printed `alias: field(…)`, result key added, two aliases of one field with different args, `@ts-expect-error` on an entry selecting two fields | `libraries/graphql-dsl` |
| Directives: `@include` / `@skip` printed with hoisted or named `Boolean!` variables; result field optional | `libraries/graphql-dsl` |
| Named variables: printed variable definitions use the type map's GraphQL type; `VariablesOf` matches the declaration; runtime mismatch throws | `libraries/graphql-dsl` |
| Every generated operation in the test suite passes `graphql.validate` against its schema | `libraries/graphql-dsl` |
| Merge unit tests (one per §4.3 row), file-order determinism, source and glob tests, breaking-change report on graphql 16 and 17 | `engines/create-graphql-sdk` |
| Emitter parity: `dal-codegen` output unchanged; cyclic-input fixture | `libraries/graphql-input-zod`, `libraries/dal-codegen` |
| Snapshot drift | CI: `pnpm --filter @corpdk/ds-sdk sdk:check` |
| SDK type tests: DSL results and variables against the DAL schema; `@ts-expect-error` on an unknown field and unknown `__args` key; `Types.ItemFilter` flows from `parseGraphqlInput` into `__args` without a cast | `templates/ds-sdk/test/` |
| Apollo / urql type compatibility with `BuiltOperation.document` | `templates/ds-sdk/test/` |
| Consumer `tsc` time against the full DAL schema; baseline recorded | CI job, P2 |
| Manual-variant smoke: `generate <tmp> --schema templates/ds-no-sql/src/schema`, then `tsc --noEmit` | CI |
| Packed manifest: no forbidden dependencies; no `@genql/*` anywhere | CI (`pnpm pack`, which works on private packages) |
| Sample-never-published guard: `templates/ds-sdk` has `private: true`, no `publishConfig`, and is absent from `PUBLISH_ORDER` | CI |
| Publish order: `@corpdk/graphql-input-zod` precedes `@corpdk/dal-codegen` in `PUBLISH_ORDER` | CI |

---

## 12. Feature parity (L2 DSL vs DGS client)

| Capability | SDK support |
| ---------- | ----------- |
| Typed projection / selection builder | Yes |
| Typed arguments (L1 `*Args`) | Yes |
| Unknown field or argument rejected by `tsc` | Yes |
| Inferred result type over L1 | Yes |
| Unions / interfaces | Yes (`on_<Type>`, `__typename` narrowing) |
| Field aliases | **Yes (fork)** |
| `@include` / `@skip` | **Yes (fork)** |
| Named, reusable variables (`$var`) | **Yes (fork)**: `define*` |
| Operation names | Yes |
| `TypedDocumentNode` for Apollo / urql | Yes |
| Arbitrary executable directives, `@defer` / `@stream` | v1.1 |
| Federation `_entities` helpers | No dedicated API |
| Input object Zod + registry | Yes (L3) |

---

## 13. Implementation phases

| Phase | Deliverable | Docs updated in the same PR |
| ----- | ----------- | --------------------------- |
| **P0** | This design | `docs/00-index.md`, `docs/developer/README.md` |
| **P1a** | `libraries/graphql-input-zod` extracted; `dal-codegen` output unchanged. Added to `PUBLISH_ORDER` ahead of `dal-codegen` in the same PR, because `dal-codegen` now depends on it (R-20). | `libraries/graphql-input-zod/README.md`; `CLAUDE.md`; `docs/developer/01-monorepo-overview.md`; `docs/admin/04-npm-publish-ds-automation.md` (new package in the lockstep set) |
| **P1b** | `libraries/graphql-dsl`: fork at `15f27b9`, strip transport and CLI, native ESM, `FieldsSelection` over L1, port upstream tests. Then a **feature spike**: alias typing (one-field-per-entry), directive optionality, `define*` named variables (decide whether variable/argument type checks can be compile-time). | `libraries/graphql-dsl/README.md`, `UPSTREAM.md`; `CLAUDE.md`; `docs/developer/01-monorepo-overview.md` |
| **P1c** | `engines/create-graphql-sdk` | `engines/create-graphql-sdk/README.md`; `CLAUDE.md` |
| **P2** | Replace `templates/ds-sdk` with `init` output, marked `private: true` with no `publishConfig` (§9.1); first `sync` from `templates/ds`; Turbo; DAL scalars; client compatibility tests; type-check baseline | `CLAUDE.md` (ds-sdk → NodeNext; "single shared SDK" rule; ds-sdk private exception); `docs/architecture/02-monorepo-design.md` (publishing table); `docs/architecture/06-package-dependencies.md`; `docs/admin/04-npm-publish-ds-automation.md` (ds-sdk is no longer "Artifactory-only") |
| **P3** | Decouple all six DS `codegen.ts` + `create-ds` canonical; drop `client-preset`; Docker | `docs/admin/02-docker-deployment.md`, `docs/developer/ds-automation-upgrades.md`, `docs/developer/graphql-dal-requirements.md`, `docs/architecture/01-system-overview.md`, `libraries/codegen-cli/README.md` |
| **P4** | `create-app` uses the engine canonical. Publish `@corpdk/graphql-input-zod` and `@corpdk/create-graphql-sdk` to npmjs through the lockstep CalVer pipeline (`.github/scripts/publish-ds-automation.sh` `PUBLISH_ORDER`, its build/test filters, and the workflow `paths`). Publish `@corpdk/graphql-dsl` through its own workflow and CalVer line (§16.2.1), before `create-graphql-sdk`, which depends on it. `graphql-input-zod` must publish **before** `dal-codegen`, which depends on it from P1a; from P1a on, `dal-codegen` cannot ship without it. `templates/ds-sdk` is not published. | `docs/user/01-introduction.md`, `02-interactive-mode.md`, `03-cli-reference.md`, `05-post-scaffold-setup.md`; `docs/admin/04-npm-publish-ds-automation.md` |
| **P5** | First SDK usage in `templates/ui` and `templates/ui-hprt`; `Dockerfile.ui` | `docs/developer/05-ui-architecture.md`, `docs/developer/06-ui-status.md` |

**Out of scope, raised by the audit:** `create-app`, `create-ds`, and `codegen-cli` still build with tsup (unmaintained). Moving them is a separate task.

---

## 14. Acceptance criteria

- [ ] `generate templates/ds-sdk --schema templates/ds/src/generated/generated-schema.ts` succeeds, and a second run leaves `git status` clean.
- [ ] `generate <tmp> --schema templates/ds-no-sql/src/schema` merges the three files into one snapshot that type-checks. Shuffled file order gives a byte-identical snapshot.
- [ ] A cross-file field type conflict exits 1, naming the type, field, both types, and both files. An unmapped scalar exits 1 and names the scalar. `sync --check` detects drift.
- [ ] `dist/` loads from Node ESM and from Next.js. No `@genql/*` package is installed or imported.
- [ ] The SDK exports exactly one interface per schema type (`Types.*`). DSL results, `__args`, and L3 schemas all reference it (no duplicate entity types under `src/generated/dsl/`).
- [ ] DSL tests pass for selections, args, unions, aliases, `@include`/`@skip`, and named variables. Every test operation validates against its schema.
- [ ] Apollo and urql accept `BuiltOperation.document` with inferred `data` and checked `variables`.
- [ ] `dal-codegen`'s `input-zod.ts` output is unchanged after the emitter extraction. `inputZodSchemas` covers the DAL inputs.
- [ ] No DS `codegen.ts` references `../ds-sdk` or `client-preset`. DS Docker images build without `templates/ds-sdk`.
- [ ] `upgrade` keeps `src/extensions/**` and `sdk.config.yaml` customizations.
- [ ] On the P4 release date, every third-party dependency passes §16.1.

---

## 15. Decisions

| Topic | Decision |
| ----- | -------- |
| Builder DSL | Required |
| L2 engine | **Owned fork `@corpdk/graphql-dsl`** (from `genql` `15f27b9`) |
| Type interfaces | **One set: L1 `Types.*`** (graphql-codegen, `nonOptionalTypename`, `enumsAsTypes`), used by DSL results, `__args`, L3, and consumers |
| DSL runtime packaging | Normal dependency of the SDK (owned and versioned), not vendored |
| L3 engine | Owned `@corpdk/graphql-input-zod` (extracted from `dal-codegen`) |
| Multiple schema files | Many sources → `mergeTypeDefs` → one committed snapshot |
| Module format | ESM, NodeNext, `exports` → `dist/` |
| Engine and library builds | `tsc`, not tsup |
| graphql major | Repo stays on ^16; libraries and SDK support 17 |
| Breaking-change detection | graphql-js (`findSchemaChanges` when present); `@graphql-inspector/core` as fallback |
| `templates/ds-sdk` publishing | **Never published.** Test proof and sample: `private: true`, no `publishConfig` (§9.1) |
| Generated SDK publishing (outside this repo) | The SDK owner's choice; the canonical sets no registry (§3.7) |
| New package publishing | `graphql-input-zod` and `create-graphql-sdk` → npmjs, lockstep CalVer with the DS automation stack. `graphql-dsl` → npmjs on its **own** CalVer line and workflow (§16.2.1). |
| Where `graphql-dsl` lives | **This monorepo** (`libraries/graphql-dsl`), kept self-contained, with explicit triggers for moving to its own repo (§16.2.1) |
| **Open (P1b spike):** compile-time check of named-variable types against argument types | Runtime check in v1 for sure; compile-time if the spike shows it stays readable and fast |

---

## 16. Dependency policy

### 16.1 Third-party packages

Every third-party package the SDK, the libraries, or the engine depends on must meet **all** of these on the review date:

1. **Ownership:** backed by an organization, or at least two active npm publishers.
2. **Activity:** a release in the last 6 months **and** a commit in the last 3 months. Stable types-only packages are exempt if widely used.
3. **Adoption:** at least 100 k weekly downloads, or an organization already relied on in this repo (The Guild, graphql-js).
4. **Compatibility:** supports Node 24, TypeScript 6, and graphql 16, with a path to the next graphql major.
5. **Status:** not archived or deprecated; the README does not say it is unmaintained; MIT, ISC, or Apache-2.0.

### 16.2 Owned forks

When no package meets §16.1, the code may be **forked into the repo** if all of these hold:

- the licence is MIT, ISC, or Apache-2.0, and the original notice is kept in `LICENSE`;
- the fork lives under `libraries/`, follows repo coding standards, CI, and CalVer publishing, and has a README;
- `UPSTREAM.md` records the base commit, every divergence, and each upstream review (quarterly);
- the upstream package is removed from every dependency tree (CI-checked);
- each fork has a named owner, recorded in §17.

Owned forks today: `@corpdk/graphql-dsl` (from `genql`). `@corpdk/graphql-input-zod` is in-house code, not a fork.

#### 16.2.1 Where the fork lives (decided 2026-11-12)

**Decision: `@corpdk/graphql-dsl` stays in this monorepo** under `libraries/graphql-dsl`. It is not moved to its own repository for now.

**Why:**

- **Size is not a reason to split.** About 1,480 lines are kept from upstream, plus about 600 lines of ported tests and the new features. That is smaller than `libraries/dal-codegen` (about 5,500 lines), which already lives here.
- **The coupling is highest during P1b–P2.** Alias, directive, and named-variable typing, and result typing over L1, change the DSL, the engine's codegen, and the `templates/ds-sdk` type tests together. One repo keeps that to one PR and one end-to-end CI run against the DAL schema.
- **It matches existing practice.** Published libraries (`dal-core`, `dal-codegen`, `pub-sub`, `codegen-cli`) already live under `libraries/`.
- **A second repo costs real overhead** for a single owner: CI, Sonar, publishing, npm trusted publishing, Renovate, branch protection, and GitHub account mapping.
- **Keeping upstream's git history adds little.** The fork removes more than half of upstream and restructures the rest, so upstream commits rarely apply cleanly, and upstream changes slowly.

**Rules that keep a later move cheap:**

| Rule | Detail |
| ---- | ------ |
| Own version line | `graphql-dsl` has its **own CalVer** and its own publish workflow (`.github/workflows/publish-graphql-dsl.yml`, triggered by its `package.json` version). It is not in the lockstep DS automation set, because `publish-ds-automation.sh` checks one expected version for every package. Consumers (`create-graphql-sdk`, generated SDKs) use a caret range. |
| Self-contained package | No imports from other workspace packages. Its own `LICENSE` (with genql's MIT notice), `UPSTREAM.md`, README, tests, and fixture schemas, so it builds and tests in isolation (`pnpm --filter @corpdk/graphql-dsl test`). |
| Clean import, no upstream history | Import a clean copy of the kept files. `UPSTREAM.md` records the base commit (`15f27b9`) and each divergence; upstream history is not merged in. |
| Sonar scope | The import PR excludes the inherited upstream files from SonarCloud's new-code coverage and duplication conditions (via `sonar.coverage.exclusions` / `sonar.cpd.exclusions` for that path, listed in `UPSTREAM.md`). The exclusions are removed file by file as each file is rewritten or brought under the fork's tests. Code added by the fork is gated normally. |

**Move it to its own repository when any of these happens:**

- a consumer outside CorpDK templates adopts it and needs its own issue tracker and release notes;
- we decide to send features (aliases, directives) back to upstream `genql` as PRs, which a GitHub fork is the natural vehicle for;
- its API settles after P2 and its release cadence clearly separates from the SDK engine's;
- maintaining it here starts to slow monorepo CI or reviews in a measurable way.

Because of the rules above, moving out is a directory extraction (`git subtree split --prefix=libraries/graphql-dsl`) plus a new workflow, with no code changes. The host organization is decided at that point.

### 16.3 Re-audit

Re-audit at the start of each phase and quarterly after P4, and record the numbers in Appendix B. A failing §16.1 package moves to "watch" for one quarter, then gets replaced or forked under §16.2.

---

## 17. Remaining work register

Everything this design has not yet proven, built, or decided. Each item closes only with the evidence in its "Done when" column. Update the status here (`Open` → `In progress` → `Done`, with a PR link) instead of in prose elsewhere.

**Owners** (interim, assigned 2026-11-12):

| Package | Owner |
| ------- | ----- |
| `libraries/graphql-dsl` (also the §16.2 fork owner) | Debraj Kundu |
| `libraries/graphql-input-zod` | Debraj Kundu |
| `engines/create-graphql-sdk` | Debraj Kundu |

### 17.1 Spikes and unproven design points

| ID | Item | Why it is open | Phase | Done when | Status |
| -- | ---- | -------------- | ----- | --------- | ------ |
| R-01 | Alias typing: `__aliases` entries must select **exactly one** field, and the result gains the alias key | Designed (§3.4), not built; the one-key constraint is type-level work | P1b | `@ts-expect-error` on a two-field entry; exact result equality for two aliases of one field with different args; printed operation validates | Open |
| R-02 | `@include` / `@skip` typing: the selected field becomes optional in the result; scalar fields take the object form | Designed, not built | P1b | Exact result equality with `field?:`; printed `@include(if:$vN)` validates | Open |
| R-03 | Named variables (`define*`, `v<T>()`): GraphQL variable types come from the type map; `VariablesOf` matches the declaration | Designed, not built | P1b | Printed variable definitions validate; `VariablesOf` exact equality; mismatched `v<T>()` throws at `define*` time | Open |
| R-04 | Compile-time check that a named variable's declared type matches the argument it feeds | Unknown whether it stays readable and fast (§15 open row) | P1b | Spike verdict recorded in §15: compile-time, or runtime-only with a reason | Open |
| R-05 | Patched `FieldsSelection` passes upstream's ported tests (`typeSelection.test.ts`, 618 lines) against L1-typed sources | Prototype covered objects, enums, scalars, unions only (Appendix C.8) | P1b | Ported suite green in `libraries/graphql-dsl` | Open |
| R-06 | Object-typed custom scalars (for example `JSON: Record<string, unknown>`) treated as leaves | Scalar check is `string \| number \| Date \| boolean \| null \| undefined` (§6) | P1b | Type-map scalar list added; regression test passes | Open |
| R-07 | Upstream PR #168 (nullable non-scalar typing, open since 2024-03) | Possible inherited typing bug | P1b | Case reproduced as a test; fixed or shown not to apply; logged in `UPSTREAM.md` | Open |
| R-08 | Interfaces (not only unions) through `on_<Type>` over L1 | Prototype tested a union only | P1b | Exact result equality for an interface field with two implementations | Open |
| R-09 | L3 annotations `z.ZodType<Types.X>` compile against L1's `InputMaybe` / optional fields, including recursive inputs | Not prototyped | P1a | `@corpdk/graphql-input-zod` output type-checks against L1 for the DAL schema and a cyclic fixture | Open |
| R-10 | `dal-codegen` output unchanged after extracting the emitter | Extraction not done | P1a | Existing `input-zod` tests green; byte-identical `input-zod.ts` for the DAL schema | Open |

### 17.2 Measurements still owed

| ID | Item | Phase | Done when | Status |
| -- | ---- | ----- | --------- | ------ |
| R-11 | Consumer type-check time with the full DAL schema (DSL result inference over L1) | P2 | Baseline recorded in this doc. The acceptable threshold is <!-- TBD: agree the max acceptable consumer `tsc` time before P2 closes -->. | Open |
| R-12 | Apollo `useQuery(document)` and urql `useQuery({ query: document })` infer `data` and check `variables` without casts | P2 | Type tests green (§11) | Open |
| R-13 | Turbo accepts `../ds/src/generated/generated-schema.ts` as a package-relative input, or `$TURBO_ROOT$` is needed | P2 | `turbo run build` caches and invalidates correctly on a DAL schema change | Open |

### 17.3 Content still to write

| ID | Item | Phase | Done when | Status |
| -- | ---- | ----- | --------- | ------ |
| R-14 | Real `scalars` entries (`type` + `zod`) for the 12 DAL scalars, matching `dal-core` wire rules | P2 | Entries in `templates/ds-sdk/sdk.config.yaml`; L3 tests accept and reject the same wire values as `dalScalarZod` for each scalar's documented format | Open |
| R-15 | `libraries/graphql-dsl/UPSTREAM.md` (base `15f27b9`, divergence list) and `LICENSE` with genql's MIT notice | P1b | Files present; review checklist signed off | Open |
| R-16 | SDK README template: DSL guide, consumer recipes (§10), client-vs-server validation note (§7.5) | P1c | Canonical README renders for `templates/ds-sdk` | Open |
| R-17 | `create-ds` release note and migration step (`create-graphql-sdk init ../ds-sdk …`) | P3 | Note in `docs/developer/ds-automation-upgrades.md` and the release notes | Open |

### 17.4 Repo changes outside the new packages

| ID | Item | Phase | Done when | Status |
| -- | ---- | ----- | --------- | ------ |
| R-18 | `templates/ds-sdk/package.json`: `private: true`, drop Artifactory `publishConfig`, version `0.0.0-sample` | P2 | CI guard (§11) green | Open |
| R-19 | Docs reflect "ds-sdk is a sample, never published": `CLAUDE.md`, `docs/architecture/02-monorepo-design.md`, `docs/admin/04-npm-publish-ds-automation.md` | P2 | No doc says `templates/ds-sdk` is published or Artifactory-bound | Open |
| R-20 | Publish pipeline: add `graphql-input-zod` (before `dal-codegen`) and `create-graphql-sdk` to `PUBLISH_ORDER`, build/test filters, and workflow `paths`. Create `publish-graphql-dsl.yml` for `graphql-dsl`'s own CalVer line, with npm trusted publishing configured for it. | P1a for `graphql-input-zod` (`dal-codegen` depends on it from then); P1b for the `graphql-dsl` workflow; P4 for `create-graphql-sdk` | CI publish-order guard green; dry-run publish of both workflows lists the expected packages | Open |
| R-30 | `graphql-dsl` self-containment and Sonar scope (§16.2.1): no workspace imports; isolated build and test; Sonar exclusions for inherited files listed in `UPSTREAM.md` | P1b | CI check fails on any `@corpdk/*` import in `libraries/graphql-dsl/src`; Sonar gate passes on the import PR with only fork-added code gated | Open |
| R-31 | Review the §16.2.1 move-out triggers | Quarterly, with R-29 | Outcome recorded in `UPSTREAM.md` | Open |
| R-21 | Decouple six DS `codegen.ts` + `create-ds` canonical; drop `client-preset`; Turbo `codegen.outputs`; Dockerfiles | P3 | §14 criteria for DS packages green | Open |
| R-22 | `create-app` scaffolds `ds-sdk` from the engine canonical with per-DS `schema.sources` | P4 | Scaffold test for `ds` and one manual variant generates and builds | Open |
| R-23 | `CLAUDE.md` / architecture docs: ds-sdk module format (NodeNext), drop the "single shared SDK, all variants codegen into it" rule, add the three new packages | P1–P2 | Docs Update Rule satisfied per phase (§13) | Open |

### 17.5 Follow-ups outside this initiative

| ID | Item | Trigger | Status |
| -- | ---- | ------- | ------ |
| R-24 | Move `create-app`, `create-ds`, `codegen-cli` builds off tsup (unmaintained) to `tsc` or tsdown ≥ 1.0 | Audit finding (Appendix B.4) | Open |
| R-25 | Repo-wide move to graphql 17 (the new libraries already support ^16 \|\| ^17) | graphql 18 removes `findBreakingChanges`; plan before then | Open |
| R-26 | DSL v1.1: arbitrary executable directives (`__directives`), `@defer` / `@stream` | After v1 ships | Open |
| R-27 | Engine v1.1: introspection URL as a source; directive-driven validation (`@constraint`) in L3 | After v1 ships | Open |

### 17.6 Recurring

| ID | Item | Cadence |
| -- | ---- | ------- |
| R-28 | Dependency re-audit (§16.3); update Appendix B | Start of each phase; quarterly after P4 |
| R-29 | Upstream `genql` review; cherry-pick relevant fixes; log in `UPSTREAM.md` | Quarterly |

---

## Appendix A. Gap review of revision 1 (2026-11-08)

| # | Severity | Gap | Resolution |
| - | -------- | --- | ---------- |
| 1 | Blocker | `buildgql` devDependency but imported at runtime | Rev 5: owned `@corpdk/graphql-dsl` runtime dependency |
| 2 | Blocker | `buildgql` reads one SDL file; rev 1 used a glob | One merged snapshot (§4) |
| 3 | Blocker | Operations not `TypedDocumentNode`s | `BuiltOperation.document` (§3.5) |
| 4 | Blocker | Validation plugin named wrongly (does not exist) | `@corpdk/graphql-input-zod` (§7.2) |
| 5 | Blocker | Plugin function exports vs value usage | In-house emitter emits `const`s |
| 6 | Blocker | `enumsAsTypes` mismatch → L3 compile error | In-house emitter emits `z.enum([...])` |
| 7 | High | `export *` name collisions; union helpers missing | `Types` / `Selections` namespaces; one L1 type set (§3.3) |
| 8 | High | `src/index.ts` never overwritten | Canonical entries + user-owned `src/extensions/` |
| 9 | High | Only `templates/ds` decoupled | All six decoupled (§9.1) |
| 10 | High | Bundler resolution, `exports` → `src` | NodeNext, `exports` → `dist/`, native ESM generator |
| 11 | High | No drift detection | `sync --check`, Turbo `sdk:sync` |
| 12 | High | `create-app` relies on DS codegen | Engine canonical (§9.4) |
| 13 | Medium | Scalars in three places; unmapped silent | One table; unmapped fails (§6) |
| 14 | Medium | `codegen.yml` both template and CLI-merged | Canonical `codegen.ts` reads `sdk.config.yaml` |
| 15 | Medium | Zod as a regular dependency | Optional peer + `./validation` |
| 16 | Medium | `.ts` `typeDefs` loading unspecified | Node type stripping (§4.1) |
| 17 | Medium | No breaking-change reporting | §4.4 |
| 18 | Medium | Dockerfiles | §9.3 |
| 19 | Medium | Parse-helper contract undefined | §7.4 |
| 20 | Medium | Registry in a canonical file | Generated `input-registry.ts` |
| 21 | Low | `--name` defaulted to CorpDK scope | Required |
| 22 | Low | `codegen` omitted validators | L1 + L2 + L3 |
| 23 | Low | Builder maturity unmentioned | §16, Appendix B |
| 24 | Low | P5 described as a migration | First usage |
| 25 | Low | No tests, exit codes, upgrade rules, docs list | §8.6, §11, §13 |
| 26 | Low | `printSchema` drops directives | `print(mergeTypeDefs(…))` |
| 27 | High | (rev 2) Multi-file merge rules missing | §4 |
| 28 | High | (rev 2) No maintenance check | §16, Appendix B |
| 29 | High | (rev 3) `gql.tada` not a builder DSL | `genql` family |
| 30 | High | (rev 4) `genql` single-maintainer risk; missing aliases, directives, named variables, ESM; duplicate type set | Rev 5: owned fork, features added, results over L1 |

---

## Appendix B. Dependency maintenance audit (2026-11-12)

Sources: `npm view`, the npm downloads API (last week), and the GitHub REST API. "Maint." is npm publishers / GitHub contributors.

### B.1 L2 candidates

| Package | DSL? | Downloads/wk | Latest (date) | Releases 12 mo | Maint. | Last commit | Verdict |
| ------- | ---- | -----------: | ------------- | -------------: | ------ | ----------- | ------- |
| `@genql/cli` | Yes | 82,681 | 6.3.4 (2026-06-11); previous 6.3.3 (2024-03-30) | 1 | 1 / 14; 6 commits by 2 authors in 6 months; 6 open issues | 2026-10-06 | **Forked** as `@corpdk/graphql-dsl` (rev 5). Aliases (#10, #55) and directives (#66, #104) requested since 2020, never shipped; PR #168 open since 2024-03. |
| `buildgql` | Yes | 5 | 0.1.0 (2026-08-11) | 1 | 1 / 3 | 2026-10-29 | Rejected |
| `graphql-zeus` | Yes | 50,652 | 7.2.1 (2026-04-08) | 6 | 5 / 37 | 2026-04-01 | Rejected: inactive 7 months; CLI broken non-interactively (C.6) |
| `typed-graphql-builder` | Yes | 3,934 | 5.1.2 (2025-12-05) | 2 | 1 / 8 | 2025-12-05 | Rejected |
| `gql.tada` | No | 1,347,518 | 1.11.4 (2026-10-02) | 13 | 2 / 29 | 2026-10-23 | Passes §16.1; not a DSL |
| `@graphql-codegen/client-preset` | No | 9,195,755 | 7.0.0 (2026-11-07) | 413 | 5 / 607 | 2026-11-10 | Not a DSL; removed from DS codegen |

### B.2 L3 validators

| Package | Downloads/wk | Latest (date) | Releases 12 mo | Maint. | Last commit | Verdict |
| ------- | -----------: | ------------- | -------------: | ------ | ----------- | ------- |
| `graphql-codegen-typescript-validation-schema` | 142,311 | 0.19.0 (2026-04-25) | 1 | 1 / 27 | 2026-11-10 | Rejected: single publisher, one release a year, `graphql` peer stops at ^16 |
| `zod` | 451,046,074 | 4.6.7 (2026-10-12) | 220 | 1 / 592 | 2026-11-06 | Adopted (repo standard) |

### B.3 Schema loading, merging, types

| Package | Downloads/wk | Latest (date) | Releases 12 mo | Maint. | Last commit | Verdict |
| ------- | -----------: | ------------- | -------------: | ------ | ----------- | ------- |
| `graphql` | 68,857,957 | 17.1.0 (2026-11-04) | 23 | 6 / 240 | 2026-11-10 | Adopted |
| `@graphql-tools/merge` | 24,563,105 | 10.0.9 (2026-11-10) | 452 | 5 / 430 | 2026-11-10 | Adopted |
| `@graphql-codegen/cli` | 10,069,826 | 8.0.0 (2026-11-07) | 461 | 5 / 607 | 2026-11-10 | Adopted (^8) |
| `@graphql-codegen/typescript` | 13,106,246 | 7.0.1 (2026-11-10) | 379 | 5 / 607 | 2026-11-10 | Adopted (^7); L1 is now the only type set |
| `@graphql-typed-document-node/core` | 25,226,682 | 3.2.0 (2023-03-20) | 0 | 3 / 18 | 2023-10-26 | Adopted (types-only exemption) |
| `@graphql-inspector/core` | 1,643,923 | 8.0.1 (2026-10-13) | 45 | 4 / 91 | 2026-10-20 | Fallback only |

### B.4 Engine tooling

| Package | Downloads/wk | Latest (date) | Releases 12 mo | Maint. | Last commit | Verdict |
| ------- | -----------: | ------------- | -------------: | ------ | ----------- | ------- |
| `tsup` | 12,339,187 | 9.0.0 (2026-10-14) | 2 | 2 / 103 | 2026-10-14 | Rejected: README says "not actively maintained anymore" |
| `yaml` | 310,933,044 | 2.9.1 (2026-09-11) | 9 | 1 / 38 | 2026-09-23 | Adopted |
| `@clack/prompts` | 43,259,952 | 1.9.0 (2026-11-09) | 17 | 7 / 62 | 2026-11-11 | Adopted |

### B.5 Consumer-side (README examples only)

| Package | Downloads/wk | Latest (date) | Note |
| ------- | -----------: | ------------- | ---- |
| `graphql-sse` | 475,560 | 2.6.3 (2026-10-15) | Healthy |
| `graphql-request` | 11,905,930 | 7.4.0 (2025-12-12) | README uses `fetch` instead |

---

## Appendix C. Prototype evidence (2026-11-12)

Throwaway prototypes in `/tmp` (not committed): Node 24.21, TypeScript 6, `graphql` 16, `@graphql-tools/merge` 10.0.9, `@graphql-codegen/cli` 8.0.0 + `typescript` 7.0.1, `@genql/cli` 6.3.4.

1. **Multi-file merge.** Two files (one redeclaring `type Item` without `extend`, adding inputs including a self-referencing `ItemFilter`, extending `Query`/`Mutation`) → `fs.promises.glob` → `mergeTypeDefs({ sort: true, throwOnConflict: true })` → `print`. Result: one valid, sorted SDL with fields combined and `@deprecated` kept.
2. **Merge failures.** Field type conflict: `Field "a" already defined with a different type. Declared as "Int", but you tried to override with "String"`. Missing base: `Cannot extend type "Ghost" because it is not defined.`. Enum values and duplicate directive definitions merged.
3. **`genql` DSL typing (upstream).** Result field types, enum unions, `__typename` union narrowing, and nested `__args` with a recursive input all type-checked. Plain `tsc` rejected `nmae` and `__args.idd` (TS2353).
4. **Upstream output under NodeNext ESM.** TS2835 at compile time, `ERR_MODULE_NOT_FOUND` at run time.
5. **After an import rewrite.** Compiled under NodeNext and ran. A query (with union fragments) and a subscription validated with **0** errors. Argument values were hoisted to `$v1`, `$v2`.
6. **`graphql-zeus` 7.2.1.** `zeus <schema> <out>` always opened an interactive prompt and crashed (`ERR_USE_AFTER_CLOSE`), because it reads `args._[0]` while yargs supplies `args.path`.
7. **Upstream runtime gaps.** No handling for aliases or directives anywhere in the runtime source; the selection renderer carries `// TODO if i want to add __directive support`.
8. **DSL results over L1 (`Types.*`).** graphql-codegen 8 output (`enumsAsTypes`, `nonOptionalTypename`) used as the source types:
   - **Upstream `FieldsSelection`:** object fields correct, **unions broken**. `Property 'text' does not exist on type 'Pick<{ __typename: "Label"; … }, "__typename" | "on_Item" | "on_Label">'`.
   - **Patched `FieldsSelection`** (structural object-union detection placed before the scalar check, and per-member `__typename` + `on_<Type>` handling, about 15 lines): **all pass**. Exact equality for `{ id: string; status: "ACTIVE" | "ARCHIVED"; createdAt: string }`, `__typename` narrowing, and exact equality for `({ __typename: "Item" } & { name: string }) | ({ __typename: "Label" } & { text: string })`.
9. **Fork sizing** (`genql` `main` at `15f27b9`). Kept: about 1,480 lines (selection-type and type-map renderers, `render/common`, printer, `typeSelection`, `linkTypeMap`, runtime types). Dropped: about 1,660 lines (transport client, fetcher, batcher, error, CLI, schema fetching, tasks, response-type, client, and schema renderers, printer formatting).

10. **Private-package publishing.** A `private: true` package packed with `pnpm pack` produced a tarball. `pnpm publish --dry-run` and `npm publish --dry-run` both reported success (`+ @x/sample@0.0.0`), so dry runs ignore `private`. A real publish could not be tested without registry credentials (npm stopped at `ENEEDAUTH` first).

Not yet built or measured: everything in the §17 register.

---

**Last updated:** November 12, 2026
