# @corpdk/codegen-cli

GraphQL Code Generator **preset** that emits resolver typings and a TypedDocumentNode SDK aligned with CorpDK data services.

Configure it in your `codegen.ts` (or `codegen.yml`) alongside `@graphql-codegen/cli`. DAL DS apps run this after `dal-codegen` schema generation.

## Install

```bash
pnpm add -D @corpdk/codegen-cli
# or
npm install --save-dev @corpdk/codegen-cli
```

Peer dependency: `graphql` ^16.

## Example

```ts
import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "./src/generated/generated-schema.ts",
  generates: {
    "../ds-sdk/src/": {
      preset: "@corpdk/codegen-cli",
      // …preset options from templates/ds-sdk
    },
  },
};

export default config;
```

See [`templates/ds-sdk/codegen.ts`](https://github.com/CorpDK/coding-templates/blob/main/templates/ds-sdk/codegen.ts) in the monorepo for the canonical setup.

## Documentation

- Package source: [`libraries/codegen-cli`](https://github.com/CorpDK/coding-templates/tree/main/libraries/codegen-cli)
- [Monorepo overview](https://github.com/CorpDK/coding-templates/blob/main/docs/developer/01-monorepo-overview.md)

## License

MIT — see the [repository LICENSE](https://github.com/CorpDK/coding-templates/blob/main/LICENSE).
