# coding-templates

A pnpm + Turborepo monorepo template for full-stack GraphQL applications under the `@corpdk` org.

Run `pnpm create-app` to scaffold a full-stack project, or `pnpm create-ds init` / `pnpm create-ds upgrade` for a DAL-automated DS package ([DS automation upgrades](docs/developer/ds-automation-upgrades.md)).

## Published packages

These **twelve** DS automation packages ship together on [npmjs](https://www.npmjs.org/) (public, lockstep CalVer, e.g. **`2026.10.0-alpha.16`**). Order matches [`PUBLISH_ORDER`](.github/scripts/lockstep-calver.sh). See [npm publish — DS automation](docs/admin/04-npm-publish-ds-automation.md).

After Monorepo CI quality and Sonar succeed on a commit, [Monorepo CI](.github/workflows/ci.yml) dispatches [**Publish DS automation (npm)**](.github/workflows/publish-ds-automation.yml) via `workflow_dispatch` (`checkout_sha` = the orchestrator commit).

| Package | Path | Registry |
| --- | --- | --- |
| `@corpdk/graphql-dsl` | `libraries/graphql-dsl` | npm (public) |
| `@corpdk/scalar-zod` | `libraries/scalar-zod` | npm (public) |
| `@corpdk/dal-core` | `libraries/dal-core` | npm (public) |
| `@corpdk/pub-sub` | `libraries/pub-sub` | npm (public) |
| `@corpdk/graphql-input-zod` | `libraries/graphql-input-zod` | npm (public) |
| `@corpdk/dal-codegen` | `libraries/dal-codegen` | npm (public) |
| `@corpdk/engine-kit` | `libraries/engine-kit` | npm (public) |
| `@corpdk/graphql-cli-core` | `libraries/graphql-cli-core` | npm (public) |
| `@corpdk/create-graphql-sdk` | `engines/create-graphql-sdk` | npm (public) |
| `@corpdk/create-graphql-cli` | `engines/create-graphql-cli` | npm (public) |
| `@corpdk/codegen-cli` | `libraries/codegen-cli` | npm (public) |
| `@corpdk/create-ds` | `engines/create-ds` | npm (public) |

Other workspace packages (`engines/create-app`, `packages/ui-*`, `packages/eslint-config`, `templates/*`) are used from this monorepo or from a private Artifactory registry when your team publishes them — they are not part of the npm DS automation release.

## License

MIT — see [LICENSE](LICENSE). Use, modify, and redistribute freely; retain the copyright and permission notice in copies or substantial portions.

## Documentation

- [User Guide](docs/user/01-introduction.md) — scaffolding, setup, and usage
- [Admin Guide](docs/admin/01-environment-variables.md) — environment variables, Docker, PubSub/Redis
- [Architecture](docs/architecture/01-system-overview.md) — system design, decisions, and rationale
- [Developer Guide](docs/developer/01-monorepo-overview.md) — patterns, conventions, and coding standards
- [Generator implementation roadmap](docs/developer/16-generator-implementation-roadmap.md) — Wave 1 complete; Wave 2 execution plan (SDK, CLI, `create-ds` generators)