# coding-templates

A pnpm + Turborepo monorepo template for full-stack GraphQL applications under the `@corpdk` org.

Run `pnpm create-app` to scaffold a full-stack project, or `pnpm create-ds init` / `pnpm create-ds upgrade` for a DAL-automated DS package ([DS automation upgrades](docs/developer/ds-automation-upgrades.md)).

## Published packages

| Package | Path | Registry |
| --- | --- | --- |
| `@corpdk/codegen-cli` | `libraries/codegen-cli` | npm (public) |
| `@corpdk/dal-codegen` | `libraries/dal-codegen` | npm (public) |
| `@corpdk/dal-core` | `libraries/dal-core` | npm (public) |
| `@corpdk/pub-sub` | `libraries/pub-sub` | npm (public) |
| `@corpdk/create-app` | `engines/create-app` | npm (public) |
| `@corpdk/create-ds` | `engines/create-ds` | npm (public) |
| `@corpdk/eslint-config` | `packages/eslint-config` | npm (public) |
| `@corpdk/ui-auth` | `packages/ui-auth` | npm (public) |
| `@corpdk/ui-charts` | `packages/ui-charts` | npm (public) |
| `@corpdk/ui-core` | `packages/ui-core` | npm (public) |
| `@corpdk/ui-datagrid` | `packages/ui-datagrid` | npm (public) |
| `@corpdk/ui-feedback` | `packages/ui-feedback` | npm (public) |
| `@corpdk/ui-forms` | `packages/ui-forms` | npm (public) |
| `@corpdk/ds` | `templates/ds` | Artifactory (private) |
| `@corpdk/ds-cdb` | `templates/ds-cdb` | Artifactory (private) |
| `@corpdk/ds-cli` | `templates/ds-cli` | Artifactory (private) |
| `@corpdk/ds-ddb` | `templates/ds-ddb` | Artifactory (private) |
| `@corpdk/ds-file` | `templates/ds-file` | Artifactory (private) |
| `@corpdk/ds-mongo` | `templates/ds-mongo` | Artifactory (private) |
| `@corpdk/ds-no-sql` | `templates/ds-no-sql` | Artifactory (private) |
| `@corpdk/ds-sdk` | `templates/ds-sdk` | Artifactory (private) |
| `@corpdk/ui` | `templates/ui` | Artifactory (private) |
| `@corpdk/ui-hprt` | `templates/ui-hprt` | Artifactory (private) |
| `@corpdk/ui-showcase` | `templates/ui-showcase` | Artifactory (private) |

## License

MIT — see [LICENSE](LICENSE). Use, modify, and redistribute freely; retain the copyright and permission notice in copies or substantial portions.

## Documentation

- [User Guide](docs/user/01-introduction.md) — scaffolding, setup, and usage
- [Admin Guide](docs/admin/01-environment-variables.md) — environment variables, Docker, PubSub/Redis
- [Architecture](docs/architecture/01-system-overview.md) — system design, decisions, and rationale
- [Developer Guide](docs/developer/01-monorepo-overview.md) — patterns, conventions, and coding standards
