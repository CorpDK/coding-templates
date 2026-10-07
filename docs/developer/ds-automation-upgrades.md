# DS automation upgrades (`@corpdk/create-ds`)

Teams that adopt DAL automation own **`src/db/schema/`** (and optional **`src/db/seed.ts`**) only. Everything else — scripts, `dal/dal.config.yaml`, GraphQL codegen config, Docker, Yoga bootstrap — should track **`templates/ds`** in this monorepo or the bundled canonical snapshot shipped with **`@corpdk/create-ds`**.

## Tooling

| Command                   | Purpose                                                        |
| ------------------------- | -------------------------------------------------------------- |
| `create-ds init [dir]`    | Scaffold a new DS package (minimal tag schema by default)      |
| `create-ds upgrade [dir]` | Merge template deltas; **never** overwrites `src/db/schema/**` |

From the monorepo root (after `pnpm install` and building engines):

```bash
pnpm create-ds init ./packages/my-ds --name @myorg/my-ds
pnpm create-ds upgrade ./packages/my-ds
```

Published CLI (after `@corpdk/create-ds` is on npm):

```bash
pnpm dlx @corpdk/create-ds init ./packages/my-ds --name @myorg/my-ds
pnpm dlx @corpdk/create-ds upgrade ./packages/my-ds
```

### `init` options

- **`--name <pkg>`** — npm package name (default `@corpdk/ds`)
- **`--demo-schema`** — copy the full commerce demo schema and `seed.ts` from `templates/ds` instead of the minimal starter under `engines/create-ds/starter/`

`init` writes:

- Drizzle schema directory (starter or demo)
- `dal/dal.config.yaml`
- `package.json` at an initial **CalVer** **`YYYY.MM.0`** (UTC year and month when `init` runs, `MICRO` starts at `0`), **`license`: `MIT`**, scripts/deps aligned with the canonical template (`workspace:*` when resolving `templates/ds`; **`^@corpdk/create-ds` release version** for `@corpdk/*` when using the bundled canonical snapshot, e.g. `pnpm dlx`). Deployable DS packages follow Limitless **CalVer** (`YYYY.MM.MICRO`), not semver `0.1.0`; see [Monorepo design — CalVer](../architecture/02-monorepo-design.md#calver-format-rules).
- Root **`LICENSE`** (MIT, CorpDK) copied from the canonical template
- Does **not** copy template **`publishConfig`** (avoids inheriting monorepo Artifactory registry settings)
- `.gitignore` entries for `src/generated/**`
- Yoga bootstrap via **`dal-codegen --mode=bootstrap`** when the monorepo `dal-codegen` CLI is built; otherwise copies bootstrap files from the canonical template

### Monorepo layout (`codegen.ts`)

Scaffolded **`codegen.ts`** targets sibling **`../ds-sdk`** and **`../ds-cli`** (same as `templates/ds`). **`pnpm codegen`** / the middle step of **`pnpm dal:codegen`** expects those packages beside the DS package. DS-only repos outside this layout must add matching packages or adjust `generates` paths (see the header comment in `codegen.ts`).

### `upgrade` behavior

1. Merges **`package.json`**: scripts normalized to `dal-codegen` / `dal-entity-lint` bins; **`@corpdk/dal-core`**, **`@corpdk/dal-codegen`**, **`@corpdk/pub-sub`**, **`@corpdk/codegen-cli`** versions taken from the canonical template (bundled canonical rewrites `workspace:*` `@corpdk/*` to **`^@corpdk/create-ds` release version**); consumer **`name`**, **`version`**, **`publishConfig`**, non-`@corpdk` deps, and top-level metadata preserved when already set (**`private`**, **`license`**, **`engines`**, **`packageManager`**, **`author`**, **`repository`**, **`bugs`**, **`homepage`**, **`keywords`**).
2. Merges **`dal/dal.config.yaml`**: template defaults + consumer overrides (consumer keys win).
3. Overwrites automation files: `codegen.ts`, `drizzle.config.ts`, `tsconfig.json`, Docker assets, `.env.example`, `.gitignore`, bootstrap TypeScript entry files.
4. **Skips** `src/db/schema/**` entirely.
5. Runs **`entity:lint`** only when the monorepo `libraries/dal-codegen/dist/lint-cli.js` exists or **`node_modules/.bin/dal-entity-lint`** is present (skipped after a bare merge until `pnpm install` in DS-only repos).
6. Prints **`pnpm install`** then **`pnpm dal:codegen`** as required follow-up.

## Upgrade playbook

Published `@corpdk/*` libraries use [CalVer](../architecture/02-monorepo-design.md#calver-format-rules); rows below describe **compatibility impact**, not npm semver version fields.

| Bump                                                     | When                                                  | Consumer action                                                                   |
| -------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Patch** `@corpdk/dal-core` / `@corpdk/dal-codegen`     | Bug fixes, lint rules, generated output tweaks        | `create-ds upgrade` → `pnpm install` → `pnpm dal:codegen`                         |
| **Minor** `@corpdk/dal-core`                             | New filter operators, relation behavior, optional env | Same; review `entity:lint` warnings                                               |
| **Major** `@corpdk/dal-core` or codegen breaking changes | GraphQL naming, payload shape, removed scalars        | Upgrade tool + fix schema comments/indexes per release notes; run full test suite |
| **Template-only** (scripts, Docker, bootstrap)           | No `@corpdk` library release                          | `create-ds upgrade` sufficient; schema untouched                                  |

Always run the three-step codegen chain after upgrading libraries:

```bash
pnpm dal:codegen
# dal:codegen:schema → pnpm codegen → dal:codegen:impl
```

## What stays manual (today)

| Area                                   | Owner    | Roadmap                                              |
| -------------------------------------- | -------- | ---------------------------------------------------- |
| `src/db/schema/**`                     | Team     | Only hand-authored surface                           |
| `src/db/seed.ts`                       | Team     | Optional demo data                                   |
| `drizzle/migrations/**`                | Team     | `pnpm db:generate` / `db:migrate`                    |
| Auth wiring in `src/index.ts` context  | Team     | Future: auth plugin hook in bootstrap generator      |
| Custom GraphQL extensions              | Team     | Future: `dal.config.yaml` extension points           |
| Monorepo `turbo.json` / root workspace | Platform | Documented separately; not merged by `create-ds` yet |

## Maintainers

When changing `templates/ds` automation files, refresh the bundled snapshot under **`engines/create-ds/canonical/`** (paths merged on upgrade):

`package.json`, `LICENSE`, `dal/dal.config.yaml`, `codegen.ts`, `drizzle.config.ts`, `tsconfig.json`, `Dockerfile`, `docker-compose.yml`, `docker-entrypoint.sh`, `.gitignore`, `.env.example`, `src/schema.ts`, `src/index.ts`, `src/db/index.ts`, `src/health.ts`, `src/validation/parse-input.ts`, `src/observability/**`

Copy from `templates/ds` (omit `src/db/schema/**`, `drizzle/**`, and generated output). Keep **`engines/create-ds/starter/`** in sync when changing the minimal default schema.

Release **`@corpdk/create-ds`** on the same train as **`@corpdk/dal-codegen`** when upgrade deltas matter.

---

**Related**: [Monorepo Overview](01-monorepo-overview.md) | [GraphQL DAL Requirements](graphql-dal-requirements.md) | [Monorepo Design — CalVer](../architecture/02-monorepo-design.md#calver-format-rules)

**Last updated**: October 5, 2026
