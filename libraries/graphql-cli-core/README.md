# @corpdk/graphql-cli-core

Shared **runtime** (C-P2+) and **codegen** (C-P1) for generated GraphQL automation CLIs.

Design: [docs/developer/14-graphql-cli-generator.md](../../docs/developer/14-graphql-cli-generator.md)

## Entry points

| Import                             | Purpose                                             |
| ---------------------------------- | --------------------------------------------------- |
| `@corpdk/graphql-cli-core`         | `runCli()` runtime (C-P2)                           |
| `@corpdk/graphql-cli-core/codegen` | Schema → catalog, relation-ids selections, man/texi |

## Codegen API (C-P1)

```ts
import { buildSchema } from "graphql";
import { emitCliModules } from "@corpdk/graphql-cli-core/codegen";

const schema = buildSchema(sdl);
const result = emitCliModules(schema, {
  bin: "my-cli",
  selection: { policy: "relation-ids", connection: "nodes" },
  transport: { httpUrlEnv: "GRAPHQL_HTTP_URL" },
  man: { enabled: true },
});

// result.commands       — CommandDescriptor[] (catalog)
// result.commandsSource — generated commands.ts module source
// result.selections     — Record<command, generated TS source>
// result.runtimeConfig — transport/guard/output defaults
// result.man / texi   — optional documentation
// result.warnings     — collisions, skipped nested connections, etc.
```

### Selection policy

**relation-ids** with the **lookup rule** (doc §3.3): entity references in selections are stubs matching lookup-query required arguments; embedded types (payloads, connections, errors) are expanded.

Helpers exported for tests and `create-graphql-cli`:

- `buildLookupIndex`, `emitSelectionForOperation`, `buildOperationDocument`
- `extractOperations`, `validateLookupConfig`
- `emitMan` / `emitTexi` (endpoint env configurable; default `GRAPHQL_HTTP_URL`)

## Scripts

```bash
pnpm --filter @corpdk/graphql-cli-core build
pnpm --filter @corpdk/graphql-cli-core test
```
