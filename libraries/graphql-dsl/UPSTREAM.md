# Upstream tracking — `remorses/genql`

| Field         | Value                                                    |
| ------------- | -------------------------------------------------------- |
| Upstream repo | [remorses/genql](https://github.com/remorses/genql)      |
| Base commit   | `15f27b9` (merge PR #202, 6.3.4 + 6 unpublished commits) |
| Fork package  | `@corpdk/graphql-dsl`                                    |
| License       | MIT (genql copyright retained in `LICENSE`)              |

## Kept from upstream (~1,480 LOC)

- Selection-type and type-map renderers (`cli/src/render/requestTypes`, `cli/src/render/typeMap`, `cli/src/render/common` minus prettify/path helpers)
- Operation printer (`generateGraphqlOperation`, `linkTypeMap`, runtime `types`)
- `FieldsSelection` core (`typeSelection.ts`) with **L1 union patch**
- Upstream selection tests ported to `test/typeSelection.upstream.test.ts` (typechecked via `tsconfig.test.json`)

## Dropped

- Transport client (`createClient`, `fetcher`, `batcher`, `error`)
- CLI, introspection fetch, Listr tasks, response-type and schema renderers
- Dependencies: `@graphql-tools/load`, `prettier`, `undici`, `yargs`, `listr2`, `lodash`, etc.

## CorpDK divergences

| Topic            | Behavior                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| ESM              | `NodeNext` with explicit `.js` import specifiers                                                         |
| L1 results       | `FieldsSelection<SRC,DST>` over SDK `Types.*`, not genql response interfaces                             |
| L1 `__args`      | Codegen references `Types.<Parent><Field>Args`                                                           |
| Aliases          | `__aliases` (R-01): one field per entry (`ExactlyOneField` + printer); result gains alias keys           |
| Directives       | `@include` / `@skip` via `__include` / `__skip`; optional result fields                                  |
| Named variables  | `define*` + `v<T>()`; **R-04:** mismatch check is **runtime** at operation build (compile-time deferred) |
| Response helpers | §3.8 error normaliser + connection iterator (transport-free)                                             |
| Selection suffix | `*Selection` (not `*GenqlSelection`)                                                                     |

## Cherry-pick log

| Date       | Upstream  | Action                                          |
| ---------- | --------- | ----------------------------------------------- |
| 2026-11-22 | `15f27b9` | Initial fork into `libraries/graphql-dsl` (P1b) |

## Sonar inherited paths (R-30 / doc 13 §16.2.1)

These paths are listed in the repo root `sonar-project.properties` under
`sonar.coverage.exclusions` and `sonar.cpd.exclusions`. They track genql @ `15f27b9`
with only mechanical ESM/import edits until rewritten. **Fork-owned** code under
`libraries/graphql-dsl` (runtime printer/typing/helpers, `emitDslModules`,
`renderBoundIndex`, `aliasSelection`, tests) stays in Sonar new-code scope.

| Path                                                                          |
| ----------------------------------------------------------------------------- |
| `libraries/graphql-dsl/src/codegen/render/common/comment.ts`                  |
| `libraries/graphql-dsl/src/codegen/render/common/excludedTypes.ts`            |
| `libraries/graphql-dsl/src/codegen/render/common/renderTyping.ts`             |
| `libraries/graphql-dsl/src/codegen/render/common/support.ts`                  |
| `libraries/graphql-dsl/src/codegen/render/requestTypes/objectType.ts`         |
| `libraries/graphql-dsl/src/codegen/render/requestTypes/renderRequestTypes.ts` |
| `libraries/graphql-dsl/src/codegen/render/requestTypes/requestTypeName.ts`    |
| `libraries/graphql-dsl/src/codegen/render/requestTypes/unionType.ts`          |
| `libraries/graphql-dsl/src/codegen/render/typeMap/objectType.ts`              |
| `libraries/graphql-dsl/src/codegen/render/typeMap/renderTypeMap.ts`           |
| `libraries/graphql-dsl/src/codegen/render/typeMap/scalarType.ts`              |
| `libraries/graphql-dsl/src/codegen/render/typeMap/support.ts`                 |
| `libraries/graphql-dsl/src/codegen/render/typeMap/unionType.ts`               |
| `libraries/graphql-dsl/src/runtime/linkTypeMap.ts`                            |
| `libraries/graphql-dsl/src/runtime/types.ts`                                  |

**Tests:** `libraries/graphql-dsl/test` is registered in `sonar.tests`. R-42
`scripts/check-self-contained.mjs` and `test/helpers/*` are excluded from the
Sonar coverage denominator (CI runs the script; helpers are test-only utilities).

## Quarterly review

Reconcile new upstream commits; note applicable fixes here before cherry-picking.
