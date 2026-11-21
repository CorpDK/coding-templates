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
| Aliases          | `__aliases` — one GraphQL field per entry (runtime enforced)                                             |
| Directives       | `@include` / `@skip` via `__include` / `__skip`; optional result fields                                  |
| Named variables  | `define*` + `v<T>()`; **R-04:** mismatch check is **runtime** at operation build (compile-time deferred) |
| Response helpers | §3.8 error normaliser + connection iterator (transport-free)                                             |
| Selection suffix | `*Selection` (not `*GenqlSelection`)                                                                     |

## Cherry-pick log

| Date       | Upstream  | Action                                          |
| ---------- | --------- | ----------------------------------------------- |
| 2026-11-22 | `15f27b9` | Initial fork into `libraries/graphql-dsl` (P1b) |

## Quarterly review

Reconcile new upstream commits; note applicable fixes here before cherry-picking.
