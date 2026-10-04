# DS automation upgrades (`@corpdk/create-ds`)

Teams that adopt DAL automation own **`src/db/schema/`** (and optional **`src/db/seed.ts`**) only. Everything else — scripts, `dal/dal.config.yaml`, GraphQL codegen config, Docker, Yoga bootstrap — should track **`templates/ds`** in this monorepo or the bundled canonical snapshot shipped with **`@corpdk/create-ds`**.

## Tooling

| Command | Purpose |
| ------- | ------- |
| `create-ds init [dir]` | Scaffold a new DS package (minimal tag schema by default) |
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
- `package.json` scripts/deps aligned with the canonical template (`workspace:*` in monorepo; semver when published)
- `.gitignore` entries for `src/generated/**`
- Yoga bootstrap via **`dal-codegen --mode=bootstrap`** (`src/schema.ts`, `src/index.ts`, `src/db/index.ts`)

### `upgrade` behavior

1. Merges **`package.json`**: scripts normalized to `dal-codegen` / `dal-entity-lint` bins; **`@corpdk/dal-core`**, **`@corpdk/dal-codegen`**, **`@corpdk/pub-sub`**, **`@corpdk/codegen-cli`** versions taken from the canonical template; consumer **`name`**, **`version`**, and non-`@corpdk` deps preserved.
2. Merges **`dal/dal.config.yaml`**: template defaults + consumer overrides (consumer keys win).
3. Overwrites automation files: `codegen.ts`, `drizzle.config.ts`, `tsconfig.json`, Docker assets, `.env.example`, `.gitignore`, bootstrap TypeScript entry files.
4. **Skips** `src/db/schema/**` entirely.
5. Runs **`entity:lint`** when `dal-entity-lint` is available.
6. Prints **`pnpm dal:codegen`** as the required follow-up.

## Semver playbook

| Bump | When | Consumer action |
| ---- | ---- | ----------------- |
| **Patch** `@corpdk/dal-core` / `@corpdk/dal-codegen` | Bug fixes, lint rules, generated output tweaks | `create-ds upgrade` → `pnpm install` → `pnpm dal:codegen` |
| **Minor** `@corpdk/dal-core` | New filter operators, relation behavior, optional env | Same; review `entity:lint` warnings |
| **Major** `@corpdk/dal-core` or codegen breaking changes | GraphQL naming, payload shape, removed scalars | Upgrade tool + fix schema comments/indexes per release notes; run full test suite |
| **Template-only** (scripts, Docker, bootstrap) | No library semver change | `create-ds upgrade` sufficient; schema untouched |

Always run the three-step codegen chain after upgrading libraries:

```bash
pnpm dal:codegen
# dal:codegen:schema → pnpm codegen → dal:codegen:impl
```

## What stays manual (today)

| Area | Owner | Roadmap |
| ---- | ----- | ------- |
| `src/db/schema/**` | Team | Only hand-authored surface |
| `src/db/seed.ts` | Team | Optional demo data |
| `drizzle/migrations/**` | Team | `pnpm db:generate` / `db:migrate` |
| Auth wiring in `src/index.ts` context | Team | Future: auth plugin hook in bootstrap generator |
| Custom GraphQL extensions | Team | Future: `dal.config.yaml` extension points |
| Monorepo `turbo.json` / root workspace | Platform | Documented separately; not merged by `create-ds` yet |

## Maintainers

When changing `templates/ds` automation files, refresh the bundled snapshot:

```bash
cp templates/ds/package.json engines/create-ds/canonical/
# … or re-run the copy list documented in engines/create-ds/README (if added)
```

Release **`@corpdk/create-ds`** on the same train as **`@corpdk/dal-codegen`** when upgrade deltas matter.
