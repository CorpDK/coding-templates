# @corpdk/create-graphql-sdk

Engine for scaffolding, syncing, and upgrading GraphQL **client SDK** packages (L1 types, L2 DSL, L3 validators).

Design: [`docs/developer/13-graphql-sdk-generator.md`](../../docs/developer/13-graphql-sdk-generator.md).

## Commands

```bash
pnpm create-graphql-sdk init ./packages/my-sdk --name @myorg/my-sdk --schema ../ds/src/generated/generated-schema.ts
pnpm create-graphql-sdk sync ./packages/my-sdk
pnpm create-graphql-sdk codegen ./packages/my-sdk
pnpm create-graphql-sdk generate ./packages/my-sdk
pnpm create-graphql-sdk upgrade ./packages/my-sdk
```

Programmatic API: `runInit`, `runUpgrade`, `runSync`, `runCodegen`, `runGenerate` from the package root export.

## Layout

| Path | Role |
| --- | --- |
| `canonical/` | SDK package template (`init` / `upgrade`) |
| `starter/schema/` | Demo SDL for `init --demo-schema` |
| `src/` | Engine implementation |