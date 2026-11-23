# @corpdk/create-graphql-cli

Scaffold, regenerate, and upgrade GraphQL automation CLI packages that wrap a sibling SDK ([doc 14](../../docs/developer/14-graphql-cli-generator.md)).

Built on `@corpdk/engine-kit` (doc 15 §11.2).

## Commands

```bash
pnpm create-graphql-cli init [dir] --sdk <path> --name <pkg> [--bin <name>] [--defer-generate] [--no-install]
pnpm create-graphql-cli generate [dir] [--check]
pnpm create-graphql-cli upgrade [dir] [--dry-run]
```

## Programmatic API

```ts
import { runInit, runGenerate, runUpgrade } from "@corpdk/create-graphql-cli";
```

## Layout

- `canonical/` — binding-only CLI template (`src/cli.ts`, `extensions/`, config); runtime lives in `@corpdk/graphql-cli-core`.
- `generate` reads the SDK snapshot at `<sdk>/schema/schema.graphqls` and writes `src/generated/**` via `@corpdk/graphql-cli-core/codegen`.

## Scripts

```bash
pnpm --filter @corpdk/create-graphql-cli build
pnpm --filter @corpdk/create-graphql-cli test
```