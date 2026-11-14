# DS generator integration and the generator engine family

Design for the changes the **DS generator** (`@corpdk/create-ds`) needs, so it scaffolds and upgrades data services together with the new SDK and CLI packages. It also specifies the **generator engine family**: `create-ds`, `create-graphql-sdk`, and `create-graphql-cli` share one command shape and one implementation library, `@corpdk/engine-kit` (§11).

**Status:** Design (pre-implementation). Revision 6, 2026-11-14.

**Depends on:**

- [13-graphql-sdk-generator.md](13-graphql-sdk-generator.md) (SDK design, rev 12)
- [14-graphql-cli-generator.md](14-graphql-cli-generator.md) (CLI design, rev 6)

**Related:** [ds-automation-upgrades.md](ds-automation-upgrades.md) · [04-npm-publish-ds-automation.md](../admin/04-npm-publish-ds-automation.md)

## Revision history

| Rev | Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 2026-11-13 | Initial design, covering `create-ds` and `create-app`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2   | 2026-11-13 | `create-app` removed from scope: it is frozen and outdated (§6)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 3   | 2026-11-13 | Generator engine family: shared `@corpdk/engine-kit`, common command shape, `create-ds` refactored onto it (§11). Engine names stay `create-graphql-sdk` / `create-graphql-cli`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 4   | 2026-11-13 | **Second review.** Phases re-planned so no `create-ds` release points at an unpublished engine: `--with-sdk` ships with SDK P2 (which now publishes `create-graphql-sdk`), and `--with-cli` with CLI C-P3 (which now publishes `create-graphql-cli`); DS-P3 merged. Next steps fixed (`dal:codegen`, `sdk:sync`, dependency-aware builds). DAL scalar preset. Preflight, dry run, idempotent `--with-*`. Legacy detection from `codegen.ts` and `package.json` instead of gitignored files. `engine-kit` helpers parameterized (caller root, excludes, merge rules, deep YAML merge). Refactor exceptions, exit-code mapping, and fixture spec. Canonical publish order (§4.3). Current-state corrections, including a pre-existing `--demo-schema` bug. |
| 5   | 2026-11-13 | **Package bootstrap phase B0** (§4.4): the first work after the design creates every new publishable package as a placeholder, publishes it to npmjs by hand once, and configures npm trusted publishing, so every later release runs from CI. Per-phase bootstrap steps removed. `graphql-cli-core` now also depends on `graphql-dsl` (CLI rev 6). R-D17.                                                                                                                                                                                                                                                                                                                                                                                               |
| 6   | 2026-11-14 | `graphql-dsl` joins the lockstep set as order 1 (SDK rev 12); all seven B0 packages trust `publish-ds-automation.yml`; the separate workflow and the version-gate guard rule are dropped.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

---

## 1. Goals and non-goals

| Goals                                                                                                                                        | Non-goals                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `create-ds init` can scaffold a DS **with** its SDK and CLI in one command, using `create-graphql-sdk` and `create-graphql-cli`              | Changing DAL schema authoring, `dal-codegen`, or the DS runtime                  |
| A DS-only scaffold stays minimal: SDK and CLI are opt-in                                                                                     | Generating SDK/CLI code inside `create-ds` itself (the engines own that)         |
| `create-ds upgrade` removes the legacy preset wiring and gives existing consumers a working path to the new packages **in the same release** | Silently rewriting or deleting a consumer's existing `ds-sdk` / `ds-cli` folders |
| No `create-ds` release ever tells users to run an unpublished engine or flag                                                                 | Any change to `create-app` (frozen, §6)                                          |
| No logic is copied: `create-ds` calls the engines' exported `runInit` / `runUpgrade`; all three engines share `@corpdk/engine-kit` (§11)     | Renaming the engines (`create-graphql-*` names are kept)                         |

---

## 2. Current state (evidence)

| Area                     | Today                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Evidence                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Canonical `codegen.ts`   | Two preset targets: `../ds-sdk/src/generated/` (`client-preset`) and `../ds-cli/src/generated/` (`@corpdk/codegen-cli`), plus a header comment requiring both siblings                                                                                                                                                                                                                                                                                                                                                                                                                         | `engines/create-ds/canonical/codegen.ts`                                                  |
| Canonical `package.json` | Depends on `@corpdk/codegen-cli` and `@graphql-codegen/client-preset` (same as `templates/ds/package.json`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `engines/create-ds/canonical/package.json`                                                |
| Canonical `Dockerfile`   | **Monorepo-only**: copies `templates/ds`, `templates/ds-sdk`, `templates/ds-cli`, and listed `libraries/*` (`scalar-zod`, `dal-core`, `graphql-input-zod`, `dal-codegen`, `pub-sub`, `codegen-cli`) in dependency order ([SDK §9.3](13-graphql-sdk-generator.md#93-docker)); it does not work in a consumer repo                                                                                                                                                                                                                                                                               | `engines/create-ds/canonical/Dockerfile`                                                  |
| `init`                   | Flags `--name` (default `@corpdk/ds`), `--demo-schema`; target defaults to the current directory. Unknown flags and a value-less `--name` are silently ignored. Writes the starter schema and starter `dal.config.yaml` (overwriting the template's) unless `--demo-schema`. Runs the DAL bootstrap through the monorepo `dal-codegen` when it is built, otherwise copies bootstrap files, then copies static `src` files. Copies `docker/postgres-init/**`. Never creates `../ds-sdk` / `../ds-cli`, yet `pnpm dal:codegen` writes into them. Next steps: `pnpm install`, `pnpm dal:codegen`. | `engines/create-ds/src/args.ts`; `init.ts`; `index.ts`                                    |
| `upgrade`                | Requires `dal/dal.config.yaml`. Overwrites every file in `UPGRADE_RELATIVE_FILES` (including `codegen.ts`, `Dockerfile`, `.gitignore`). Merges `package.json` (keeps every consumer dependency outside `CORP_DK_BUMP`; normalizes DAL scripts) and `dal.config.yaml` (**shallow** merge, consumer keys win). Then runs `entity:lint` and throws on failure, **after** files were already written. Never updates `docker/postgres-init/**`.                                                                                                                                                     | `engines/create-ds/src/upgrade.ts`; `package-merge.ts`; `template.ts`                     |
| Dependency bump set      | `CORP_DK_BUMP = { dal-core, pub-sub, codegen-cli, dal-codegen }`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `engines/create-ds/src/package-merge.ts`                                                  |
| Consequence              | After the canonical drops the presets, `upgrade` removes `@corpdk/codegen-cli` (in the bump set, no longer in the template) but **keeps** `@graphql-codegen/client-preset` forever                                                                                                                                                                                                                                                                                                                                                                                                             | same                                                                                      |
| Exit codes               | Help, no arguments, and unknown commands exit 0; thrown errors exit 1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `engines/create-ds/src/index.ts`; `args.ts`                                               |
| Exports                  | Only `parseArgs`, `printHelp` (`types-entry.ts`); `index.ts` runs `main()` on import                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `engines/create-ds/src/types-entry.ts`; `index.ts`                                        |
| Build                    | tsup with a shebang `banner`; `publish-ds-automation.sh` special-cases `dist/types-entry.d.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `engines/create-ds/tsup.config.ts`; `.github/scripts/publish-ds-automation.sh`            |
| **Pre-existing bug**     | Published `create-ds init --demo-schema` silently does nothing extra: the bundled canonical has no `src/db/schema` or seed, and `copyDir` returns quietly when its source is missing                                                                                                                                                                                                                                                                                                                                                                                                           | `engines/create-ds/canonical/src/db/` (only `index.ts`); `engines/create-ds/src/utils.ts` |
| Canonical sync           | `engines/create-ds/canonical/` is a hand-maintained copy of `templates/ds`; no sync script, no CI check; the two `.gitignore` files already differ                                                                                                                                                                                                                                                                                                                                                                                                                                             | repository                                                                                |
| Tests                    | `create-ds` has none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `engines/create-ds/`                                                                      |
| Legacy sibling output    | `ds-sdk/src/generated/{gql.ts, graphql.ts, index.ts}`, `ds-cli/src/generated/index.js` — **gitignored**, so absent in a clean checkout. Stable signals: the consumer's `codegen.ts` preset targets, and the CLI `package.json` `bin` (`./src/generated/index.js`)                                                                                                                                                                                                                                                                                                                              | `templates/ds-sdk/.gitignore`; `templates/ds-cli/package.json`                            |
| Custom scalars           | The starter schema uses `timestamp` (→ `DateTime`); SDK `sync` fails on any unmapped scalar (SDK §6)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `engines/create-ds/starter/db/schema/tags.ts`                                             |

---

## 3. Engine API used by `create-ds`

**This section owns the programmatic API.** The SDK and CLI engine sections (SDK §8.6, CLI §6.2) implement it.

```ts
// @corpdk/engine-kit
export interface Reporter {
  step(message: string): void; // spinner / progress line
  info(message: string): void;
  warn(message: string): void;
}
export type EngineResult = {
  exitCode: 0 | 1 | 2 | 3;
  nextSteps?: string[];
  changedFiles: string[];
};

// @corpdk/create-graphql-sdk
export function runInit(options: {
  dir: string;
  name: string;
  schema: string[]; // resolved against cwd, stored relative to dir (SDK §8.5)
  scalarPreset?: "dal"; // write the DAL scalar entries into sdk.config.yaml (SDK §6)
  deferSync?: boolean;
  noInstall?: boolean;
  demoSchema?: boolean;
  dryRun?: boolean;
  reporter?: Reporter;
}): Promise<EngineResult>;
export function runUpgrade(options: {
  dir: string;
  dryRun?: boolean;
  reporter?: Reporter;
}): Promise<EngineResult>;

// @corpdk/create-graphql-cli
export function runInit(options: {
  dir: string;
  name: string;
  sdk: string;
  bin?: string;
  deferGenerate?: boolean;
  noInstall?: boolean;
  dryRun?: boolean;
  reporter?: Reporter;
}): Promise<EngineResult>;
export function runUpgrade(options: {
  dir: string;
  dryRun?: boolean;
  reporter?: Reporter;
}): Promise<EngineResult>;

// @corpdk/create-ds (new exports, from a separate entry file; index.ts stays the bin)
export function runInit(options: {
  dir: string;
  name: string;
  demoSchema?: boolean;
  withSdk?: { dir?: string; name?: string };
  withCli?: { dir?: string; name?: string; bin?: string };
  noInstall?: boolean;
  dryRun?: boolean;
  reporter?: Reporter;
}): Promise<EngineResult>;
export function runUpgrade(options: {
  dir: string;
  withSdk?: { dir?: string; name?: string };
  withCli?: { dir?: string; name?: string; bin?: string };
  dryRun?: boolean;
  reporter?: Reporter;
}): Promise<EngineResult>;
```

- **Results, not exits.** No function calls `process.exit`; the bin wrappers map `exitCode`.
- **`dryRun`** returns the planned `changedFiles` without writing.
- **Deferred modes** exist because a DS scaffolded in the same command has no `generated-schema.ts` until after `pnpm install` and its first `dal:codegen`.

---

## 4. `create-ds init`

### 4.1 Flags

```text
create-ds init [dir] [options]

  --name <pkg>            DS package name (existing; REQUIRED when --with-sdk or --with-cli is given)
  --demo-schema           Demo commerce schema (existing)
  --with-sdk[=<dir>]      Also scaffold an SDK (default dir: sibling <ds-dir>-sdk)
  --sdk-name <pkg>        SDK package name (default: <ds-name>-sdk, e.g. @acme/orders-ds → @acme/orders-ds-sdk)
  --with-cli[=<dir>]      Also scaffold a CLI; implies --with-sdk (default dir: sibling <ds-dir>-cli)
  --cli-name <pkg>        CLI package name (default: <ds-name>-cli)
  --cli-bin <name>        CLI executable (default: last segment of --cli-name)
  --no-install            Skip pnpm install (also passed to the engines)
  --dry-run               Print the planned writes for all packages; write nothing
```

The new flags are **off by default**. `--name` is required with `--with-*`, because the default `@corpdk/ds` would derive `@corpdk/ds-sdk`, which collides with the in-repo sample.

### 4.2 Order and preflight

1. **Preflight, before writing anything:**
   - Every target (DS, SDK, CLI) must be missing or empty.
   - Every package name must be valid and different from the others.
   - When run inside a pnpm workspace, each target must match a `pnpm-workspace.yaml` glob, so `workspace:` dependencies install.
   - Any failure exits 2 with nothing written.
2. Scaffold the DS (today's behavior, minus the preset targets and dependencies once DS-P1 / DS-P2 ship).
3. If `--with-sdk`: SDK `runInit({ dir, name, schema: ["<dsDir>/src/generated/generated-schema.ts"], scalarPreset: "dal", deferSync: true, noInstall: true })`.
4. If `--with-cli`: CLI `runInit({ dir, name, sdk: sdkDir, bin, deferGenerate: true, noInstall: true })`.
5. Unless `--no-install`, run `pnpm install` once, at the end.
6. Print next steps for what was created:

```text
pnpm install                                   # if --no-install was used
pnpm --filter <ds-name> dal:codegen            # full DAL chain (today's step); creates generated-schema.ts
pnpm --filter <sdk-name> sdk:sync              # first schema snapshot
pnpm --filter "<sdk-name>..." build            # sdk:codegen + tsc, after its workspace dependencies
pnpm --filter "<cli-name>..." build            # cli:codegen + tsc, after the SDK
```

7. Also print a `turbo.json` snippet for repeat builds (`<sdk>#sdk:sync` depends on `<ds>#dal:codegen:schema`; `<sdk>#build` depends on `sdk:sync`). `create-ds` does not edit `turbo.json`, and `generated-schema.ts` is gitignored, so without it a fresh clone's build would fail.

**Partial failure.** Earlier output stays in place and the command exits with the failing engine's code. Nothing is deleted. To recover, run `create-ds upgrade <dsDir> --with-sdk` (or `--with-cli`) to finish the missing part (§5.3).

**Release stamping** rewrites only `@corpdk/*` engine and library ranges. It never rewrites the CLI's dependency on the generated SDK, which stays `workspace:^` inside a workspace.

### 4.3 Dependencies and publishing (canonical publish order)

`create-ds` depends on `@corpdk/engine-kit` (from DS-P0b), `@corpdk/create-graphql-sdk` (from DS-P1), and `@corpdk/create-graphql-cli` (from DS-P2): `workspace:^` in the monorepo.

**The one publish order for all three designs:**

| Order | Package                      | Channel  | First release                                       |
| ----- | ---------------------------- | -------- | --------------------------------------------------- |
| 1     | `@corpdk/graphql-dsl`        | Lockstep | SDK P1b (no `@corpdk/*` dependencies)               |
| 2     | `@corpdk/scalar-zod`         | Lockstep | SDK P1a                                             |
| 3     | `@corpdk/dal-core`           | Lockstep | today (depends on 2 from SDK P1a)                   |
| 4     | `@corpdk/pub-sub`            | Lockstep | today                                               |
| 5     | `@corpdk/graphql-input-zod`  | Lockstep | SDK P1a                                             |
| 6     | `@corpdk/dal-codegen`        | Lockstep | today (depends on 5 from SDK P1a)                   |
| 7     | `@corpdk/engine-kit`         | Lockstep | DS-P0b                                              |
| 8     | `@corpdk/graphql-cli-core`   | Lockstep | CLI C-P2 (depends on 1 and 5)                       |
| 9     | `@corpdk/create-graphql-sdk` | Lockstep | SDK P2 (depends on 1, 5, 7)                         |
| 10    | `@corpdk/create-graphql-cli` | Lockstep | CLI C-P3 (depends on 7, 8)                          |
| 11    | `@corpdk/codegen-cli`        | Lockstep | today, until its deprecation release after CLI C-P3 |
| 12    | `@corpdk/create-ds`          | Lockstep | today (depends on 7, 9, 10)                         |

**Publish-order guard** (CI, used by SDK R-20, CLI R-C11, R-D05, R-D10):

- the script derives a topological order from each listed package's `dependencies` on other `@corpdk/*` packages;
- it fails if `PUBLISH_ORDER` disagrees with that order;
- it fails if any listed package has no trusted-publisher entry.

"First release" is the first **implementation** CalVer after the B0 scaffold. Every new package already exists on npm from phase B0 (§4.4), with trusted publishing configured; later bumps publish from CI like the other lockstep packages.

### 4.4 Package bootstrap (phase B0)

npm trusted publishing can only be configured for a package that already exists on the registry, and only for a workflow file that is on the default branch (`docs/admin/04-npm-publish-ds-automation.md`, "First-time bootstrap" and "Troubleshooting: E400 trust setup"). B0 does this once for every new package, **before any implementation phase** (SDK P1a, CLI C-P1, DS-P0b), so no implementation PR has to stop for a manual npm step.

**Packages (seven):**

| Package                      | Path                          | Trusted-publisher workflow  |
| ---------------------------- | ----------------------------- | --------------------------- |
| `@corpdk/scalar-zod`         | `libraries/scalar-zod`        | `publish-ds-automation.yml` |
| `@corpdk/graphql-input-zod`  | `libraries/graphql-input-zod` | `publish-ds-automation.yml` |
| `@corpdk/graphql-dsl`        | `libraries/graphql-dsl`       | `publish-ds-automation.yml` |
| `@corpdk/engine-kit`         | `libraries/engine-kit`        | `publish-ds-automation.yml` |
| `@corpdk/graphql-cli-core`   | `libraries/graphql-cli-core`  | `publish-ds-automation.yml` |
| `@corpdk/create-graphql-sdk` | `engines/create-graphql-sdk`  | `publish-ds-automation.yml` |
| `@corpdk/create-graphql-cli` | `engines/create-graphql-cli`  | `publish-ds-automation.yml` |

`templates/ds-sdk` and `templates/ds-cli` are private samples and are never published, so they are not in B0.

**Steps:**

1. **One PR to `main`** with a **typed scaffold** at each path above (same lockstep CalVer as the other DS automation packages, e.g. `2026.10.0-alpha.14`). Each scaffold has:
   - `package.json`: final `name`; **lockstep** `version`; description noting scaffold status; `license: MIT`; monorepo `repository` (`url` → this repo, `directory` → package path); `publishConfig.access: public`; `type: "module"`; `build` / `typecheck` scripts; `files` including `dist` and `README.md`; `types` and `exports` pointing at compiled `dist/` (engines use `dist/types-entry.d.ts`; libraries use `dist/index.d.ts`); `engines.node: ">=24.0.0"`. **`@corpdk/create-graphql-sdk` and `@corpdk/create-graphql-cli`** also declare stub `bin` entries.
   - Minimal `src/` compiled by `tsc` (phase constants / empty barrels until the implementation phase).
   - `README.md` linking to the design doc; `LICENSE` (MIT). `graphql-dsl` gets genql's notice in P1b, when upstream code arrives.

   The same PR adds all seven to [`PUBLISH_ORDER`](../../.github/scripts/publish-ds-automation.sh), [Monorepo CI `publish-paths` filters](../../.github/workflows/ci.yml) (same globs as the lockstep set), and the admin trusted-publisher table slots. CI dry-run on the PR must build all twelve packages and emit the declaration paths the publish script checks (§4.3).

2. **Merge** to `main` (workflow file on default branch before trust setup).
3. **Maintainer registry setup** from a local terminal (2FA; not OIDC): run [`scripts/npm-b0-bootstrap.sh`](../../scripts/npm-b0-bootstrap.sh) per [admin — Generator B0](../../admin/04-npm-publish-ds-automation.md#generator-family--package-bootstrap-phase-b0). It publishes each of the seven at the lockstep CalVer with dist-tag **`bootstrap`**, deprecates that version with the placeholder message, configures `npm trust github` for `publish-ds-automation.yml`, and verifies registry + trust. Manual per-package steps are listed there if the script cannot run.
4. **Recommended:** in each package's npm settings, require 2FA and disallow tokens, so CI's OIDC path is the only way to publish.
5. **Record** each package in the admin doc's trusted-publisher table when trust is confirmed.

**Why lockstep CalVer + `bootstrap` tag:** B0 uses the same version line as the rest of the stack so `pnpm` workspaces and the publish script stay aligned; the **`bootstrap`** dist-tag reserves the first registry upload without consumers installing scaffold tarballs from `latest` until CI publishes with `--tag latest` on the first post-merge CalVer bump.

**After B0:** implementation phases replace stub sources with real code; CalVer bumps on `main` publish all twelve from CI with provenance (no token).

---

## 5. `create-ds upgrade`

### 5.1 Removals

| Change                                                                                                            | How                                                                    | Ships with       |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------- |
| `../ds-sdk` `client-preset` target out of `codegen.ts`                                                            | Canonical `codegen.ts` changes; `upgrade` already overwrites it        | DS-P1 (SDK P2)   |
| `templates/ds-sdk` steps out of the canonical `Dockerfile`                                                        | Same                                                                   | DS-P1            |
| `@graphql-codegen/client-preset` removed from the consumer's `package.json`                                       | `REMOVED_DEPS`, applied by `engine-kit` `mergePackageJson` (`removed`) | DS-P1            |
| `../ds-cli` preset target out of `codegen.ts`; `templates/ds-cli` and `codegen-cli` steps out of the `Dockerfile` | Canonical changes                                                      | DS-P2 (CLI C-P3) |
| `@corpdk/codegen-cli` removed                                                                                     | Added to `REMOVED_DEPS`; removed from the owned (bumped) set           | DS-P2            |

Each removal ships in the **same release** as the matching `--with-*` flag and published engine, so a consumer who upgrades always has a published replacement.

### 5.2 Legacy detection

`upgrade` reads the consumer's **current** `codegen.ts` **before** overwriting it, and takes the sibling paths from its `generates` keys (`../ds-sdk/src/generated/`, `../ds-cli/src/generated/`). That's where the legacy packages really are, whatever they're named.

| Detected                            | Confirmed by                                                  | Printed guidance                                                                                                                                                                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An SDK sibling path in `codegen.ts` | The sibling has no `sdk.config.yaml`                          | Move the old package **out of the workspace globs** (or delete it once replaced), so two packages don't share a name. Then run `create-ds upgrade <dsDir> --with-sdk=<sibling path> --sdk-name <old package name>`, which keeps the path and name consumers already import. |
| A CLI sibling path in `codegen.ts`  | Its `package.json` `bin` points at `./src/generated/index.js` | Same, with `--with-cli=<sibling path> --cli-name <old name> --cli-bin <old bin>`                                                                                                                                                                                            |

`upgrade` prints this guidance; it never moves or deletes anything.

### 5.3 `--with-sdk` / `--with-cli` on `upgrade`

| Target state                                                        | Behavior                                                         |
| ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Missing or empty                                                    | Engine `runInit` (as in `init`, deferred, `scalarPreset: "dal"`) |
| A new-style package (`sdk.config.yaml` / `cli.config.yaml` present) | Engine `runUpgrade`: idempotent, safe to repeat                  |
| A legacy package still in place                                     | Exit 2 with the §5.2 guidance; nothing written                   |

`--dry-run` lists the planned writes for the DS and every sibling.

The new SDK has a different API (DSL instead of `graphql()` documents); the release notes link to SDK §3.4.

---

## 6. `create-app`: out of scope

`create-app` is **frozen and outdated**. None of the three designs (SDK, CLI, DS generator) changes it, plans work for it, or tests it.

What happens to existing `create-app` output as the monorepo changes is not covered here. Any future revival of `create-app` needs its own design.

---

## 7. Fixed-order builds and CI

From SDK P1a, `dal-codegen` imports `@corpdk/graphql-input-zod/codegen`. Fixed-order builds are wired in [SDK §9.3](13-graphql-sdk-generator.md#93-docker) (`dal.yml`, Sonar, DS Dockerfiles):

- `.github/workflows/ci.yml` (Monorepo quality matrix + Sonar)
- `sonar-project.properties`
- `templates/ds/Dockerfile`
- `engines/create-ds/canonical/Dockerfile`

The canonical `Dockerfile` is **monorepo-only** (it copies named `templates/*` and `libraries/*` paths in fixed order). This change keeps the in-repo build working. It does not give consumer repos a working Dockerfile; that is a pre-existing limitation, outside this design.

---

## 8. Phases

| Phase      | Timing                                                                       | Deliverable                                                                                                                                                                                                                                      | Docs updated in the same PR                                                                                                                                                                                                                             |
| ---------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DS-P0**  | n/a                                                                          | This design                                                                                                                                                                                                                                      | `docs/00-index.md`, `docs/developer/README.md`                                                                                                                                                                                                          |
| **B0**     | **First work after the design merges**, before DS-P0b, SDK P1a, and CLI C-P1 | Package bootstrap for all seven new packages (§4.4): placeholders, one manual publish each, deprecation, trusted publishing                                                                                                                      | `docs/admin/04-npm-publish-ds-automation.md` (new packages, trust table, B0 procedure); `CLAUDE.md` (package table lists the placeholders)                                                                                                              |
| **DS-P0b** | **Before** SDK P1c and CLI C-P2 (both need it)                               | `libraries/engine-kit` (§11.3); `create-ds` refactored onto it (§11.5); `syncCanonical` / `checkCanonical` for `templates/ds`; first real `engine-kit` release on npm (scaffold already in `PUBLISH_ORDER` since B0); publish-order guard (§4.3) | `libraries/engine-kit/README.md`; `engines/create-ds/README.md`; `docs/developer/ds-automation-upgrades.md` (exit codes, version file, new flags `--dry-run` / `--no-install` / `--version`); `docs/admin/04-npm-publish-ds-automation.md`; `CLAUDE.md` |
| **DS-P1**  | Ships with SDK P2 (which publishes `create-graphql-sdk`)                     | Canonical without the `../ds-sdk` target, `client-preset`, or `ds-sdk` Docker steps; `REMOVED_DEPS` + `client-preset`; `--with-sdk` on `init` and `upgrade` with preflight and DAL scalar preset; legacy-SDK detection; tests                    | `docs/developer/ds-automation-upgrades.md` ("Monorepo layout", `upgrade`, `--with-sdk`, migration steps); `engines/create-ds/README.md`; release notes                                                                                                  |
| **DS-P2**  | Ships with CLI C-P3 (which publishes `create-graphql-cli`)                   | Canonical without the `../ds-cli` target, `codegen-cli`, or sibling Docker steps; `REMOVED_DEPS` + `codegen-cli`; `--with-cli`; legacy-CLI detection; tests                                                                                      | same files; `docs/admin/02-docker-deployment.md`                                                                                                                                                                                                        |
| **DS-P3**  | —                                                                            | Merged into DS-P1 / DS-P2 (rev 4)                                                                                                                                                                                                                | —                                                                                                                                                                                                                                                       |

---

## 9. Tests

`create-ds` has none today, so these are new:

| Test                                                                                                                                                                                     | Phase         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| R-D11 refactor fixture (§11.5): before/after comparison                                                                                                                                  | DS-P0b        |
| `engine-kit` unit tests: caller-root resolution, exclude lists, `mergePackageJson` (`owned`, `removed`, `preserveKeys`, `scriptsTransform`), deep YAML merge, upgrade plan with `dryRun` | DS-P0b        |
| Publish-order guard fails on a misordered list and on a missing trusted-publisher entry                                                                                                  | DS-P0b        |
| `package-merge`: `REMOVED_DEPS` deleted, other consumer deps kept                                                                                                                        | DS-P1 / DS-P2 |
| Preflight: non-empty target, duplicate names, target outside workspace globs, missing `--name` with `--with-*` — all exit 2 with nothing written                                         | DS-P1         |
| `init --name @acme/orders-ds --with-sdk` (DS-P1) and `--with-cli` (DS-P2) in a temp workspace, then the printed next steps succeed, including a starter `DateTime` field                 | DS-P1 / DS-P2 |
| `upgrade` on a legacy fixture whose siblings have non-default names: detection from `codegen.ts`, guidance printed, nothing moved, exit 2 for `--with-*` into the legacy folder          | DS-P1 / DS-P2 |
| `upgrade --with-sdk` twice on a new-style SDK: second run changes nothing                                                                                                                | DS-P1         |

---

## 10. Decisions

| Topic                                          | Decision                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| SDK/CLI on `create-ds init`                    | Opt-in `--with-sdk` / `--with-cli` (CLI implies SDK); `--name` required with them                                              |
| Release alignment                              | Each removal and each `--with-*` flag ships in the same phase as its engine's first publish (DS-P1 ↔ SDK P2, DS-P2 ↔ CLI C-P3) |
| How `create-ds` calls the engines              | Exported `runInit` / `runUpgrade` (§3); no spawning, no copied logic                                                           |
| Ordering when everything is scaffolded at once | Preflight; SDK `deferSync`, CLI `deferGenerate`; one install; printed next steps and Turbo snippet                             |
| Custom scalars in new SDKs                     | DAL scalar preset (`scalarPreset: "dal"`, SDK §6)                                                                              |
| Legacy siblings                                | Detected from the consumer's `codegen.ts` (and `package.json` / `sdk.config.yaml`); guided, never moved                        |
| Dependency removal                             | `REMOVED_DEPS` via `engine-kit` `mergePackageJson`                                                                             |
| Publishing                                     | One canonical order (§4.3) with a dependency-derived guard                                                                     |
| First publish of new packages                  | Phase B0: placeholders published by hand once and given trusted publishing before any implementation work (§4.4)               |
| `create-app`                                   | Out of scope (frozen)                                                                                                          |
| Engine names                                   | `create-ds`, `create-graphql-sdk`, `create-graphql-cli` (kept)                                                                 |
| Shared engine code                             | `@corpdk/engine-kit`; `create-ds` refactored in DS-P0b                                                                         |
| Engine contract                                | §11.2                                                                                                                          |

---

## 11. Generator engine family and `@corpdk/engine-kit`

### 11.1 The family

| Engine                       | Bin / root script                                | Commands                                         | Canonical source (monorepo → published)              |
| ---------------------------- | ------------------------------------------------ | ------------------------------------------------ | ---------------------------------------------------- |
| `@corpdk/create-ds`          | `create-ds` · `pnpm create-ds`                   | `init`, `upgrade`                                | `templates/ds` → bundled `canonical/`                |
| `@corpdk/create-graphql-sdk` | `create-graphql-sdk` · `pnpm create-graphql-sdk` | `init`, `sync`, `codegen`, `generate`, `upgrade` | `engines/create-graphql-sdk/canonical/` (both modes) |
| `@corpdk/create-graphql-cli` | `create-graphql-cli` · `pnpm create-graphql-cli` | `init`, `generate`, `upgrade`                    | `engines/create-graphql-cli/canonical/` (both modes) |

**Canonical source direction.**

- **`create-ds`:** the canonical is `templates/ds`, a hand-authored, runnable DS. The engine bundles a copy at publish.
- **SDK and CLI engines:** the canonical files live in the engine. `templates/ds-sdk` and `templates/ds-cli` are generated samples refreshed by `upgrade`.
- **Drift is checked either way** (§11.4).

### 11.2 Shared command shape

| Aspect           | Contract                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invocation       | `<engine> <command> [dir] [options]`. `help` / `-h` exits 0; no command exits 2; unknown command or flag exits 2                                                                                                                                                                                                                                                                                                                                     |
| Common commands  | `init [dir]` (empty or missing target only), `upgrade [dir]`, plus engine-specific ones                                                                                                                                                                                                                                                                                                                                                              |
| Common flags     | `--name <pkg>`, `--no-install`, `--dry-run`, `-h` / `--help`, `--version` (all three engine docs list `--version`)                                                                                                                                                                                                                                                                                                                                   |
| Output           | A `@clack/prompts` spinner while working; an `outro` with **Next steps**                                                                                                                                                                                                                                                                                                                                                                             |
| Exit codes       | 0 success · 1 validation or stale input · 2 usage error · 3 tool failure (install, codegen, `tsc`, lint)                                                                                                                                                                                                                                                                                                                                             |
| Programmatic API | §3                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Upgrade model    | **Overwrite** files, **merge** files (`package.json`, the engine's YAML config), **never-touch** paths, and a `removed` dependency list. YAML merge is **deep for maps**: consumer leaf values win, template-only keys are added; arrays and scalars are taken from the consumer. `package.json`: template scripts and owned dependency ranges win; consumer `name`, `version`, `bin`, `man`, `publishConfig`, and extra dependencies are preserved. |
| Version record   | `upgrade` writes `.<engine>-version`                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Release stamping | From a bundled canonical, `workspace:*` / `workspace:^` ranges on `@corpdk/*` engines and libraries become `^<engine release>`; never on generated sibling packages. New packages get CalVer `YYYY.M.0` for the UTC month.                                                                                                                                                                                                                           |
| Build            | `tsc`; the bin source starts with `#!/usr/bin/env node`; programmatic exports come from a separate entry file                                                                                                                                                                                                                                                                                                                                        |
| Root script      | `"<engine>": "node engines/<engine>/dist/index.js"`                                                                                                                                                                                                                                                                                                                                                                                                  |

### 11.3 `@corpdk/engine-kit`

`libraries/engine-kit` (`@corpdk/engine-kit`, npmjs, lockstep). **Every helper takes the calling engine's root** (its `import.meta.url` or package directory). Nothing resolves paths from `engine-kit`'s own location, which would read the wrong version or template.

| Module      | From today's `create-ds`         | Generalized as                                                                                                                                                                                                                                                                                                     |
| ----------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cli`       | `args.ts`, `index.ts`            | `defineEngineCli({ engineRoot, name, commands, help })`: `node:util` `parseArgs` (strict), dispatch, `outro`, §11.2 exit codes                                                                                                                                                                                     |
| `template`  | `template.ts`                    | `resolveCanonical({ engineRoot, monorepoPath, bundledPath })`, `readEngineRelease(engineRoot)`, `initialCalVer(date)`                                                                                                                                                                                              |
| `fs`        | `utils.ts`                       | `pathExists`, `readJson`, `writeJson`, `copyDir(src, dest, { exclude, transform, skipIfExists, requireSource })`. **No built-in excludes**: today's `src` / `generated` / `drizzle` excludes become `create-ds` options. `requireSource` (default `true`) throws on a missing source instead of returning quietly. |
| `merge`     | `package-merge.ts`, `upgrade.ts` | `mergePackageJson(consumer, template, { owned, removed, preserveKeys, scriptsTransform, releaseVersion })` (`normalizeDalScripts` becomes `create-ds`'s `scriptsTransform`); `mergeYamlConfig(template, consumer)` (deep, §11.2)                                                                                   |
| `upgrade`   | `UPGRADE_RELATIVE_FILES` loop    | `runUpgradePlan({ overwrite, merge, neverTouch, templateDir, packageDir, dryRun, afterWrite })`; `writeEngineVersion()`. `afterWrite` hooks (`create-ds`: `entity:lint`) run after writing; their failure maps to exit 3 and lists the files already written.                                                      |
| `canonical` | none                             | `syncCanonical({ from, to, exclude })`, `checkCanonical(...)`                                                                                                                                                                                                                                                      |
| `publish`   | none                             | The §4.3 publish-order guard                                                                                                                                                                                                                                                                                       |

Engine-specific logic stays in each engine:

- **`create-ds`:** DAL bootstrap, entity lint, `dal.config.yaml` rules, starter schema, the `--with-*` orchestration.
- **SDK engine:** schema merge, codegen.
- **CLI engine:** catalog and selection emit.

`engine-kit` depends only on `@clack/prompts` and `yaml` (SDK Appendix B.4).

### 11.4 Canonical drift checks

| Pair                                                                                 | Check                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `templates/ds` ⇄ `engines/create-ds/canonical`                                       | `syncCanonical` in the engine's `prepack`; CI `checkCanonical` against a documented exclude list. The list must decide whether the demo schema and seed ship in the canonical, which fixes the published `--demo-schema` bug (R-D15), and must settle the `.gitignore` difference (R-D14). |
| `engines/create-graphql-sdk/canonical` ⇄ canonical-owned files in `templates/ds-sdk` | CI: `create-graphql-sdk upgrade templates/ds-sdk --dry-run` must report no changes (SDK P2)                                                                                                                                                                                                |
| `engines/create-graphql-cli/canonical` ⇄ canonical-owned files in `templates/ds-cli` | Same with `create-graphql-cli` (CLI C-P3)                                                                                                                                                                                                                                                  |

### 11.5 Migration of `create-ds` onto `engine-kit` (DS-P0b)

This is a refactor that preserves outputs. The changes **intended** to be visible are:

| Change                             | Today                                            | After                                                                                                                      |
| ---------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Exit codes                         | Help / no args / unknown command → 0; errors → 1 | §11.2                                                                                                                      |
| Unknown flags, value-less `--name` | Silently ignored                                 | Exit 2 (strict parsing)                                                                                                    |
| New flags                          | —                                                | `--dry-run`, `--no-install` (`create-ds` itself never installs; the flag is passed to the engines from DS-P1), `--version` |
| Exports                            | `parseArgs`, `printHelp`                         | §3 `runInit` / `runUpgrade` from a separate entry; `index.ts` stays the bin                                                |
| Version file                       | —                                                | `.create-ds-version` on `upgrade`                                                                                          |
| Build                              | tsup with shebang banner                         | `tsc`, shebang in source; update `publish-ds-automation.sh`'s `dist/types-entry.d.ts` special case                         |
| Missing copy source                | Silently skipped                                 | Error (exit 3), except for documented optional sources                                                                     |

**Error → exit-code mapping for `create-ds`:**

| Situation                                                                            | Exit |
| ------------------------------------------------------------------------------------ | ---- |
| Non-empty target, missing `dal/dal.config.yaml` on `upgrade`, invalid flags or names | 2    |
| `entity:lint` failure, bootstrap `exec` failure, install failure                     | 3    |
| Invalid consumer files (unparseable `package.json` / YAML)                           | 1    |

**R-D11 fixture comparison:**

- the byte-for-byte file tree, with JSON key order and YAML output preserved;
- monorepo mode (`workspace:*` kept) and bundled mode (`^release` rewrite);
- starter and `--demo-schema` scaffolds;
- bootstrap through `dal-codegen` and the fallback copy;
- `upgrade` of a consumer fixture with custom dependencies, scripts, `dal.config.yaml` overrides, and preserved top-level keys;
- a fixed clock for CalVer;
- `.create-ds-version` excluded from the comparison.

---

## 12. Remaining work register

**Owners** (interim, assigned 2026-11-13):

| Package                                   | Owner        |
| ----------------------------------------- | ------------ |
| `libraries/engine-kit`                    | Debraj Kundu |
| `engines/create-ds` changes (this design) | Debraj Kundu |

| ID    | Item                                                                                                                                                                              | Phase                      | Done when                                                                                                                                                                                                                   | Status                                                        |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| R-D01 | `REMOVED_DEPS` via `engine-kit` `mergePackageJson` (`client-preset` in DS-P1, `codegen-cli` in DS-P2)                                                                             | DS-P1 / DS-P2              | §9 merge test green                                                                                                                                                                                                         | Open                                                          |
| R-D02 | Legacy-sibling detection from `codegen.ts` and guidance (also the release-note migration steps formerly SDK R-17)                                                                 | DS-P1 / DS-P2              | §9 legacy-fixture test green                                                                                                                                                                                                | Open                                                          |
| R-D03 | `runInit` / `runUpgrade` exports with the §3 options in both engines                                                                                                              | SDK P1c / CLI C-P2         | Called from a test harness without spawning                                                                                                                                                                                 | Open                                                          |
| R-D04 | `--with-sdk` (DS-P1) and `--with-cli` (DS-P2) on `init` and `upgrade`, with preflight, dry run, idempotency                                                                       | DS-P1 / DS-P2              | §9 tests green                                                                                                                                                                                                              | Open                                                          |
| R-D05 | `create-ds` depends on the engines; publish order per §4.3                                                                                                                        | DS-P1 / DS-P2              | Publish-order guard green                                                                                                                                                                                                   | Open                                                          |
| R-D06 | ~~`create-app` integration~~                                                                                                                                                      | —                          | —                                                                                                                                                                                                                           | Dropped (2026-11-13): `create-app` is frozen and out of scope |
| R-D07 | Fixed-order builds learn `graphql-input-zod` (SDK §9.3)                                                                                                                           | SDK P1a                    | `ci.yml` Monorepo quality + Sonar, and both Dockerfiles build green                                                                                                                                                         | Open                                                          |
| R-D08 | Docs per phase (§8)                                                                                                                                                               | DS-P0b to DS-P2            | Docs Update Rule satisfied                                                                                                                                                                                                  | Open                                                          |
| R-D09 | Owner for the `create-ds` and `engine-kit` changes                                                                                                                                | Before DS-P1               | Owners table filled                                                                                                                                                                                                         | Done (2026-11-13)                                             |
| R-D10 | `libraries/engine-kit` with tests; publish-order guard; first CalVer release from CI                                                                                              | DS-P0b                     | Engine-kit tests and guard green; first real release on npm                                                                                                                                                                 | Open                                                          |
| R-D11 | `create-ds` on `engine-kit`: fixture comparison per §11.5                                                                                                                         | DS-P0b                     | Comparison green with only the §11.5 intended changes                                                                                                                                                                       | Open                                                          |
| R-D12 | `create-graphql-sdk` and `create-graphql-cli` built on `engine-kit` with the §11.2 contract and root scripts                                                                      | SDK P1c / CLI C-P2         | Help, exit codes, `--version`, and exports covered by tests                                                                                                                                                                 | Open                                                          |
| R-D13 | Canonical drift checks (§11.4) in CI                                                                                                                                              | DS-P0b / SDK P2 / CLI C-P3 | CI check fails on an injected difference                                                                                                                                                                                    | Open                                                          |
| R-D14 | Resolve the `templates/ds/.gitignore` vs `engines/create-ds/canonical/.gitignore` difference                                                                                      | DS-P0b                     | `checkCanonical` green                                                                                                                                                                                                      | Open                                                          |
| R-D15 | Published `--demo-schema` ships no demo schema or seed (pre-existing): decide whether the canonical includes them; `copyDir` `requireSource` makes the failure visible either way | DS-P0b                     | Published `init --demo-schema` produces the demo schema, or fails clearly                                                                                                                                                   | Open                                                          |
| R-D16 | DAL scalar preset (`scalarPreset: "dal"`) in the SDK engine, written as `{ from, name }` references to `@corpdk/scalar-zod` (SDK §7.7), shared with `templates/ds-sdk` (SDK R-14) | SDK P1c / P2               | Starter `DateTime` field syncs and builds in the §9 init test                                                                                                                                                               | Open                                                          |
| R-D17 | Phase B0 (§4.4) for the seven new packages                                                                                                                                        | B0                         | Lockstep CalVer on the registry for all seven (bootstrap tag after maintainer publish); deprecated placeholder message on that version; `npm trust list <pkg>` shows `publish-ds-automation.yml`; admin trust table updated | Open                                                          |

---

**Last updated:** November 13, 2026
