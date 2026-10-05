# @corpdk/create-ds

Scaffold and upgrade **DAL-automated** GraphQL data services outside the monorepo (`init` / `upgrade`).

The CLI copies a starter layout, merges dependency versions for `@corpdk/dal-*` packages at the CLI’s CalVer, and applies template deltas on upgrade. Your team owns `src/db/schema/`; codegen owns generated output under `src/generated/`.

## Install

```bash
pnpm add -g @corpdk/create-ds
# or
npx @corpdk/create-ds init my-ds
```

Global install is optional; `pnpm dlx` / `npx` work the same.

## Usage

```bash
create-ds init [directory]    # new DAL DS package
create-ds upgrade [directory] # merge automation updates from the published template
```

From the monorepo root (development):

```bash
pnpm create-ds init [dir]
pnpm create-ds upgrade [dir]
```

## Documentation

- [DS automation upgrades](https://github.com/CorpDK/coding-templates/blob/main/docs/developer/ds-automation-upgrades.md)
- [npm publish — DS automation](https://github.com/CorpDK/coding-templates/blob/main/docs/admin/04-npm-publish-ds-automation.md)
- Package source: [`engines/create-ds`](https://github.com/CorpDK/coding-templates/tree/main/engines/create-ds)

## License

MIT — see the [repository LICENSE](https://github.com/CorpDK/coding-templates/blob/main/LICENSE).
