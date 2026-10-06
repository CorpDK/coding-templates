# coding-templates

A pnpm + Turborepo monorepo template for full-stack GraphQL applications under the `@corpdk` org.

Run `pnpm create-app` to scaffold a full-stack project, or `pnpm create-ds init` / `pnpm create-ds upgrade` for a DAL-automated DS package ([DS automation upgrades](docs/developer/ds-automation-upgrades.md)).

## Published packages

These five DS automation packages ship together on [npmjs](https://www.npmjs.org/) (public, lockstep CalVer). See [npm publish — DS automation](docs/admin/04-npm-publish-ds-automation.md).

| Package | Path | Registry |
| --- | --- | --- |
| `@corpdk/dal-core` | `libraries/dal-core` | npm (public) |
| `@corpdk/pub-sub` | `libraries/pub-sub` | npm (public) |
| `@corpdk/codegen-cli` | `libraries/codegen-cli` | npm (public) |
| `@corpdk/dal-codegen` | `libraries/dal-codegen` | npm (public) |
| `@corpdk/create-ds` | `engines/create-ds` | npm (public) |

Other workspace packages (`engines/create-app`, `packages/ui-*`, `packages/eslint-config`, `templates/*`) are used from this monorepo or from a private Artifactory registry when your team publishes them — they are not part of the npm DS automation release.

## License

MIT — see [LICENSE](LICENSE). Use, modify, and redistribute freely; retain the copyright and permission notice in copies or substantial portions.

## Documentation

- [User Guide](docs/user/01-introduction.md) — scaffolding, setup, and usage
- [Admin Guide](docs/admin/01-environment-variables.md) — environment variables, Docker, PubSub/Redis
- [Architecture](docs/architecture/01-system-overview.md) — system design, decisions, and rationale
- [Developer Guide](docs/developer/01-monorepo-overview.md) — patterns, conventions, and coding standards
