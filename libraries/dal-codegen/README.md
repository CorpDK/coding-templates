# @corpdk/dal-codegen

CLI that generates GraphQL SDL, repositories, resolvers, and pub/sub wiring from Drizzle schema files (`dal-codegen`, `dal-entity-lint`).

Typical pipeline in a DAL DS package:

1. `dal-codegen --mode=schema` — emit GraphQL schema and DAL stubs
2. `graphql-codegen` — SDK + resolver types (`@corpdk/codegen-cli`)
3. `dal-codegen --mode=impl` — emit repository and resolver implementations

Depends on `@corpdk/dal-core`.

## Install

```bash
pnpm add -D @corpdk/dal-codegen
# or
npm install --save-dev @corpdk/dal-codegen
```

Binaries: `dal-codegen`, `dal-entity-lint`.

## Documentation

- [DAL automation upgrades (`create-ds`)](https://github.com/CorpDK/coding-templates/blob/main/docs/developer/ds-automation-upgrades.md)
- Reference DS template: [`templates/ds`](https://github.com/CorpDK/coding-templates/tree/main/templates/ds)
- Package source: [`libraries/dal-codegen`](https://github.com/CorpDK/coding-templates/tree/main/libraries/dal-codegen)

## License

MIT — see the [repository LICENSE](https://github.com/CorpDK/coding-templates/blob/main/LICENSE).
