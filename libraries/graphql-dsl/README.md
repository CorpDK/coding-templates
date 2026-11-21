# @corpdk/graphql-dsl

Owned fork of [**genql**](https://github.com/remorses/genql): typed GraphQL **selection builders** (SDK L2) and codegen used by `@corpdk/create-graphql-sdk`.

- Design: [docs/developer/13-graphql-sdk-generator.md](../../docs/developer/13-graphql-sdk-generator.md) (§3, §8.1, P1b)
- Upstream tracking: [UPSTREAM.md](./UPSTREAM.md)

## Install

```bash
pnpm add @corpdk/graphql-dsl graphql
```

Peer: `graphql` ^16 || ^17.

## Runtime (`@corpdk/graphql-dsl`)

- `FieldsSelection` — result types over SDK L1 `Types.*`
- `generateGraphqlOperation` / `linkTypeMap` — print validated operations from selections + type map
- `defineQuery` / `defineMutation` / `defineSubscription`, `v()`, `everything` — bound in each SDK’s `src/generated/dsl/index.ts`
- `BuiltOperation` (`document` optional until the SDK binds a parsed node), `ResultOf`, `VariablesOf`
- §3.8 helpers: `normalizeGraphqlResult`, `unwrapGraphqlResult`, `iterateConnection`, `paginateConnection`

## Codegen (`@corpdk/graphql-dsl/codegen`)

```ts
import { emitDslModules } from "@corpdk/graphql-dsl/codegen";

const { selections, typeMap, index } = emitDslModules(schema, {
  typesImport: "../schema-types.js",
  customScalars: ["JSON"],
});
```

## Develop

```bash
pnpm --filter @corpdk/graphql-dsl build
pnpm --filter @corpdk/graphql-dsl test       # vitest (excludes typeSelection.upstream.test.ts)
pnpm --filter @corpdk/graphql-dsl typecheck  # includes upstream FieldsSelection suite
```

Monorepo CI runs R-42 `scripts/check-self-contained.mjs` and `typecheck` on the `@corpdk/graphql-dsl` lockstep quality job (doc 13 §11).
