# npm publish — DS automation packages

CI workflow and release process for the **lockstep CalVer** DS automation stack on [npmjs](https://www.npmjs.org/) (`@corpdk`, public). DS **templates** (`templates/ds`, `templates/ds-sdk`, etc.) remain **Artifactory-only**; see [Monorepo Design — Publishing](../architecture/02-monorepo-design.md#publishing-strategy).

---

## Package set (npmjs)

These **twelve** packages ship together at the same CalVer (e.g. `2026.10.0-alpha.14`). Order matches [`.github/scripts/publish-ds-automation.sh`](../../.github/scripts/publish-ds-automation.sh) and [generator publish order](../developer/15-create-ds-generator-integration.md#43-dependencies-and-publishing-canonical-publish-order):

| Order | Package | Path | Role |
| ----- | ------- | ---- | ---- |
| 1 | `@corpdk/graphql-dsl` | `libraries/graphql-dsl` | Typed selection DSL (SDK L2); scaffold until SDK P1b |
| 2 | `@corpdk/scalar-zod` | `libraries/scalar-zod` | Shared scalar rules; scaffold until SDK P1a |
| 3 | `@corpdk/dal-core` | `libraries/dal-core` | DAL types, filters, scalars, error taxonomy |
| 4 | `@corpdk/pub-sub` | `libraries/pub-sub` | GraphQL pub/sub factory (DAL DS runtime) |
| 5 | `@corpdk/graphql-input-zod` | `libraries/graphql-input-zod` | Input Zod codegen (SDK L3); scaffold until SDK P1a |
| 6 | `@corpdk/dal-codegen` | `libraries/dal-codegen` | `dal-codegen` / `dal-entity-lint` CLIs |
| 7 | `@corpdk/engine-kit` | `libraries/engine-kit` | Shared `create-*` engine kit; scaffold until DS-P0b |
| 8 | `@corpdk/graphql-cli-core` | `libraries/graphql-cli-core` | CLI runtime + codegen; scaffold until CLI C-P1 |
| 9 | `@corpdk/create-graphql-sdk` | `engines/create-graphql-sdk` | SDK scaffold engine; stub until SDK P1c |
| 10 | `@corpdk/create-graphql-cli` | `engines/create-graphql-cli` | CLI scaffold engine; stub until CLI C-P2 |
| 11 | `@corpdk/codegen-cli` | `libraries/codegen-cli` | Legacy GraphQL codegen plugin (deprecation planned) |
| 12 | `@corpdk/create-ds` | `engines/create-ds` | Scaffold + upgrade CLI for DAL DS apps |

**Not in this pipeline:** `@corpdk/create-app`, UI packages, `eslint-config`, or any `templates/*` (Artifactory). `@corpdk/ds` in the monorepo is a template, not an npm consumer package for this release unit.

**Rationale:** One CalVer line for DAL automation **and** the generator-family packages reserved in B0, so downstream apps and engines never mix incompatible `@corpdk/*` pairs.

Each `package.json` must include a monorepo **`repository`** object (`url` → this GitHub repo, `directory` → package path). CI live publish passes `--provenance`; npm rejects uploads when `repository.url` is missing or does not match the GitHub Actions provenance source.

### Generator family — package bootstrap (phase B0)

The [GraphQL SDK](../developer/13-graphql-sdk-generator.md), [CLI](../developer/14-graphql-cli-generator.md), and [DS generator integration](../developer/15-create-ds-generator-integration.md) designs add seven npm packages. **B0** reserved each name on the registry; they now share the lockstep CalVer in `publish-ds-automation.sh`. Trusted publishing uses **`publish-ds-automation.yml`** (OIDC validates on the first successful CI publish after merge to `main`).

| Package | Path | Status |
| ------- | ---- | ------ |
| `@corpdk/scalar-zod` | `libraries/scalar-zod` | Bootstrap on npm; trust configured; **pending OIDC validation** until first CI publish from `main` |
| `@corpdk/graphql-input-zod` | `libraries/graphql-input-zod` | Same |
| `@corpdk/graphql-dsl` | `libraries/graphql-dsl` | Same |
| `@corpdk/engine-kit` | `libraries/engine-kit` | Same |
| `@corpdk/graphql-cli-core` | `libraries/graphql-cli-core` | Same |
| `@corpdk/create-graphql-sdk` | `engines/create-graphql-sdk` | Same |
| `@corpdk/create-graphql-cli` | `engines/create-graphql-cli` | Same |

Placeholders ship only `README.md` and `LICENSE` (no `main`, `exports`, `bin`, or scripts). **`templates/ds-sdk` and `templates/ds-cli` are not published** and are not part of B0.

**After the B0 PR merges**, a maintainer completes registry setup **from a local terminal** (npm publish + trust each trigger org 2FA / OTP; **not** OIDC):

```bash
# Repo root; npm whoami must succeed; use npm >= 11.15 for trust
chmod +x scripts/npm-b0-bootstrap.sh
./scripts/npm-b0-bootstrap.sh
```

npm prompts for browser 2FA on each publish, deprecate, and `npm trust` as needed; optionally `export NPM_OTP=…` or pass `--pause` for an extra Enter before each step. If publish succeeded but deprecate/trust were skipped (registry index lag), wait a minute and run `./scripts/npm-b0-bootstrap.sh --post-publish` (deprecate + trust only, with registry wait/retry).

Resume after a failure with `--from @corpdk/<name>`; run `./scripts/npm-b0-bootstrap.sh --help` for flags.

Manual equivalent per package:

1. `npm publish --access public --tag bootstrap` in the package directory
2. `npm deprecate <pkg>@0.0.0-bootstrap.0 "Placeholder with no code; use a CalVer release"`
3. Trusted publishing via [CLI equivalent](#cli-equivalent) (`publish-ds-automation.yml`)
4. Optional: package settings — require 2FA, disallow publish tokens
5. Verify: `npm view <pkg> versions`; `npm trust list <pkg>`

Version **`0.0.0-bootstrap.0`** sorts below CalVer and is never used in consumer `^2026.x` ranges. First **real** releases join `PUBLISH_ORDER` in their implementation phase (SDK P1a/P1b, DS-P0b, CLI C-P1, etc.).

---

## Workflow

| Item   | Value                                                                                              |
| ------ | -------------------------------------------------------------------------------------------------- |
| File   | [`.github/workflows/publish-ds-automation.yml`](../../.github/workflows/publish-ds-automation.yml) |
| Script | [`.github/scripts/publish-ds-automation.sh`](../../.github/scripts/publish-ds-automation.sh)       |
| Node   | **24.x** (`actions/setup-node@v7`, `node-version: "24"`) — matches monorepo `engines.node`         |

### Triggers

Path filters include all twelve package trees (source, `package.json`, README), plus the workflow and publish script. Unrelated commits on `main` do not run this workflow.

| Trigger                                  | Behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **push** to **`main`** (paths above)     | **Live publish** when `libraries/dal-core/package.json` **version changed** vs the previous commit on `main` (`github.event.before`; workflow fetches that commit when shallow checkout omits it). CI publishes via OIDC, then creates git tag `ds-automation/v<CalVer>` and a **GitHub Release**. If CalVer is unchanged (e.g. README-only), the run exits without publish. When `before` is set but the previous CalVer at that commit cannot be read, the run **fail-closes** to dry-run only. When `before` is missing or the null SHA (unusual — e.g. first push that creates `main`), the gate does not compare CalVer and may **live publish** without a bump check; normal merges always have a real `before`. |
| **pull_request** → `main` (paths above)  | Always **dry-run** (build, tests, **`dist/` declaration check**, `npm publish --dry-run`; no npm auth, no tag, no release)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **workflow_dispatch** on **`main` only** | **Dry-run defaults to true**. `dry_run: false` on `main` is a break-glass live publish (same tag + release behavior). Dispatch from other branches is ignored.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

**Never live-publish** from feature branches, pull requests, or manual dispatch off `main`.

Dry-run never needs npm auth, never creates git tags or GitHub Releases, and logs what would happen on a live run.

### Outcomes (trigger × dry-run)

| Trigger                                                | Effective dry-run | Git tag                                                             | npm publish                         | GitHub Release       |
| ------------------------------------------------------ | ----------------- | ------------------------------------------------------------------- | ----------------------------------- | -------------------- |
| **push** `main` (CalVer bumped)                        | `false`           | After publish: `ds-automation/v<version>` on merge commit if absent | Live upload (OIDC + `--provenance`) | After tag if missing |
| **push** `main` (CalVer unchanged)                     | —                 | —                                                                   | Skipped (job gated)                 | —                    |
| **push** `main` (`before` set, prev CalVer unreadable) | `true`            | No                                                                  | `--dry-run` only                    | No                   |
| **push** `main` (`before` missing or null SHA)         | `false`           | After publish: tag on merge commit if absent                        | Live upload (no CalVer compare)     | After tag if missing |
| **workflow_dispatch** `main`, `dry_run: false`         | `false`           | After publish: tag on HEAD if absent                                | Live upload (OIDC + `--provenance`) | After tag if missing |
| **workflow_dispatch** `main`, `dry_run: true`          | `true`            | No; logs intent                                                     | `--dry-run` only                    | No; logs intent      |
| **workflow_dispatch** not on `main`                    | —                 | —                                                                   | Skipped                             | —                    |
| **pull_request**                                       | `true`            | No                                                                  | `--dry-run` only                    | No                   |

Version for dispatch without `version` input comes from `libraries/dal-core/package.json` on the checked-out ref. Existing tags and releases are **not** duplicated: CI skips tag push and `gh release create` when the tag or release already exists.

Release notes list all twelve lockstep packages at the release CalVer and link back to this document.

### What CI runs

The workflow evaluates the CalVer gate right after checkout, **before** `pnpm` / `actions/setup-node` (pnpm cache). Main pushes with an unchanged CalVer therefore skip without install or publish and still exit successfully.

1. Verify every package in the set has the **same** `version` as the release (from input or `libraries/dal-core/package.json`).
2. `pnpm turbo run build` for all twelve lockstep packages (respects dependency order via Turbo).
3. `pnpm --filter @corpdk/dal-core test` and `@corpdk/dal-codegen test` (same coverage as [`.github/workflows/dal.yml`](../../.github/workflows/dal.yml) for libraries).
4. Confirm each package has declaration output after build (publish script enforces **`dist/index.d.ts`** for the four libraries; **`@corpdk/create-ds`** uses **`dist/types-entry.d.ts`** with **`exports["."].import`** → **`./dist/types-entry.js`** while **`bin.create-ds`** stays on **`./dist/index.js`**, so typings and runtime imports are not the CLI side-effect entry). Spot-check packaging: `pnpm --filter @corpdk/dal-core exec npm pack --dry-run` and ensure the tarball lists `.d.ts` files. Library `package.json` must expose types via top-level `"types"` and `exports["."].types` (string-only `exports` breaks TypeScript resolution even when `.d.ts` is in the tarball).
5. `pnpm publish --no-git-checks --tag latest` in dependency order; `--dry-run` when not releasing; live runs add `--provenance`.
6. On live publish only: ensure git tag `ds-automation/v<CalVer>` on the release commit, then `gh release create` with generated notes (`permissions.contents: write`).

Workflow permissions for live publish: `id-token: write` (OIDC token for npm) and `contents: write` (releases and tag push). `actions/setup-node@v7` sets `registry-url: https://registry.npmjs.org` without a static `NODE_AUTH_TOKEN`; npm CLI ≥ 11.15 exchanges the GitHub OIDC token with the registry when trusted publishing is configured.

### Dist-tags (`latest` vs prerelease)

npm assigns a **dist-tag** on every publish. `npm install @corpdk/create-ds` (no `@version`) resolves the version behind the **`latest`** tag.

For semver **prereleases** (CalVer with `-alpha.N`, `-beta.N`, etc.), npm’s default is **not** `latest`: it tags the tarball with the prerelease identifier (e.g. `alpha`). A successful CI publish can therefore upload `2026.10.0-alpha.5` while **`latest` still points at an older build** (e.g. `2026.10.0-alpha.4`) until something moves the tag.

Until the stack ships a stable (non-prerelease) CalVer line, maintainers want **`latest` on every lockstep alpha** so downstream `create-ds` / semver ranges behave predictably. [`.github/scripts/publish-ds-automation.sh`](../../.github/scripts/publish-ds-automation.sh) passes **`--tag latest`** on every live and dry-run publish (local and CI).

**Check tags after a release:**

```bash
npm view @corpdk/create-ds dist-tags
```

**One-time repair** (no republish): point `latest` at the version that already exists on the registry:

```bash
VERSION=2026.10.0-alpha.5   # replace with the CalVer you shipped
for pkg in @corpdk/dal-core @corpdk/pub-sub @corpdk/codegen-cli @corpdk/dal-codegen @corpdk/create-ds; do
  npm dist-tag add "${pkg}@${VERSION}" latest
done
```

Requires npm login with publish access on each package.

---

## Release checklist (maintainers)

1. On a branch: bump **all twelve** `package.json` `version` fields to the same CalVer, update package READMEs as needed, and update [Package Dependencies](../architecture/06-package-dependencies.md) upgrade log if you track releases there.
2. Open a PR to `main` — the workflow runs **dry-run** (build, tests, **`dist/` declaration check**, packaging) on the PR.
3. **First release only:** if any of the twelve lockstep packages are missing on npmjs, complete [First-time bootstrap](#first-time-bootstrap-packages-not-on-npm-yet) (local `npm login` / `NPM_TOKEN`, not OIDC) **before** merge or use break-glass dispatch after bootstrap.
4. **First release only:** merge [`publish-ds-automation.yml`](../../.github/workflows/publish-ds-automation.yml) to `main` if it is not already there — trusted publishing cannot be configured until the workflow exists on the default branch ([After bootstrap](#after-bootstrap) step 2; [E400 troubleshooting](#troubleshooting-e400-trust-setup) rank 2).
5. Confirm [trusted publishing](#configure-trusted-publishing-on-npmjs) is configured on npm for all twelve lockstep packages (one-time per package; only after each package exists on the registry and, on first release, step 4 is satisfied).
6. **Merge to `main`.** CI detects the CalVer bump in `libraries/dal-core`, live-publishes all twelve lockstep packages, creates tag `ds-automation/v<CalVer>`, and opens the GitHub Release. Maintainers do **not** push release tags manually for normal releases.
7. Confirm **Publish DS automation (npm)** succeeded on the merge commit, that the **GitHub Release** for `ds-automation/v<CalVer>` exists, and that `npm view @corpdk/create-ds dist-tags` shows **`latest`** at that CalVer (see [Dist-tags](#dist-tags-latest-vs-prerelease) if not). Optionally `npm pack @corpdk/dal-core@<CalVer> -q && tar -tzf corpdk-dal-core-*.tgz | grep index.d.ts` on a maintainer machine.

**Break-glass:** On `main`, **workflow_dispatch** with `dry_run: false` repeats live publish + tag + release (skips if tag/release already exist). Use only if merge publish failed; do not use from feature branches.

### Local dry-run (no token)

```bash
pnpm install --frozen-lockfile
.github/scripts/publish-ds-automation.sh "$(node -p "require('./libraries/dal-core/package.json').version")" --dry-run
```

### Local publish (maintainer machine)

Use `npm login` or `//registry.npmjs.org/:_authToken=${NPM_TOKEN}` in `~/.npmrc`, then run the script without `--dry-run`. Prefer merge-to-`main` CI releases for auditability and provenance after trusted publishing is configured (see [First-time bootstrap](#first-time-bootstrap-packages-not-on-npm-yet) if the packages are not on npm yet).

---

## Authentication

### First-time bootstrap (packages not on npm yet)

[npm trusted publishers](https://docs.npmjs.com/trusted-publishers) require **each package to already exist on the registry** before you can add a GitHub Actions trusted publisher. The twelve lockstep packages may never have been published (legacy five were first; seven generator packages used B0 bootstrap); do this **once** from a maintainer machine, then complete [After bootstrap](#after-bootstrap) (publish workflow on `main`, then trusted publishing per package), and use CI for every later release.

#### Prerequisites

| Requirement              | Detail                                                                                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **npm org**              | The `@corpdk` organization exists on [npmjs.com](https://www.npmjs.com/org/corpdk).                                                                                                                                                               |
| **Your account**         | You are an npm **org owner** or have **publish** rights on scoped packages under `@corpdk` (team member with read-write, or package owner).                                                                                                       |
| **Monorepo**             | Checkout `main` (or the branch that contains [`.github/scripts/publish-ds-automation.sh`](../../.github/scripts/publish-ds-automation.sh)) with all twelve `package.json` files at the **same** CalVer you intend to ship.                          |
| **Scoped public access** | Each package already has `"publishConfig": { "access": "public" }`. The **first** publish of a scoped package must still pass `--access public` (the publish script does this). Scoped modules default to restricted until you publish as public. |

Do **not** use GitHub Actions OIDC for this step — trusted publishing is configured **after** the initial tarball upload. Pull requests that touch DS automation still run the workflow in **dry-run** mode (build, tests, **`dist/` declaration check**, `npm publish --dry-run`) with **no** registry auth, which validates packaging before bootstrap.

#### One-time publish (recommended: existing script)

From the monorepo root, with Node/pnpm versions matching CI:

```bash
pnpm install --frozen-lockfile
VERSION="$(node -p "require('./libraries/dal-core/package.json').version")"

# Authenticate once (pick one):
npm login --registry=https://registry.npmjs.org
# OR: export NPM_TOKEN=...  and ensure ~/.npmrc contains:
#     //registry.npmjs.org/:_authToken=${NPM_TOKEN}

.github/scripts/publish-ds-automation.sh "${VERSION}"
```

The script verifies lockstep versions, runs `pnpm turbo run build`, the same DAL tests as CI, and **declaration output in `dist/`** (see [What CI runs](#what-ci-runs) step 4), then `pnpm publish --no-git-checks --access public --tag latest` in dependency order:

1. `@corpdk/dal-core`
2. `@corpdk/pub-sub`
3. `@corpdk/codegen-cli`
4. `@corpdk/dal-codegen`
5. `@corpdk/create-ds`

#### One-time publish (manual equivalent)

If you cannot run the script, use the same steps explicitly:

```bash
pnpm install --frozen-lockfile
VERSION="$(node -p "require('./libraries/dal-core/package.json').version")"
# …verify all twelve package.json version fields equal ${VERSION}…

pnpm turbo run build \
  --filter=@corpdk/dal-core \
  --filter=@corpdk/pub-sub \
  --filter=@corpdk/codegen-cli \
  --filter=@corpdk/dal-codegen \
  --filter=@corpdk/create-ds

pnpm --filter @corpdk/dal-core test
pnpm --filter @corpdk/dal-codegen test

# Same declaration paths as publish-ds-automation.sh verify_dist_types
test -f libraries/dal-core/dist/index.d.ts
test -f libraries/pub-sub/dist/index.d.ts
test -f libraries/codegen-cli/dist/index.d.ts
test -f libraries/dal-codegen/dist/index.d.ts
test -f engines/create-ds/dist/types-entry.d.ts

for pkg in @corpdk/dal-core @corpdk/pub-sub @corpdk/codegen-cli @corpdk/dal-codegen @corpdk/create-ds; do
  pnpm --filter "${pkg}" publish --no-git-checks --access public --tag latest
done
```

#### After bootstrap

1. Confirm all twelve lockstep packages appear on npm at the expected version (e.g. `https://www.npmjs.com/package/@corpdk/dal-core`).
2. Merge the publish workflow to `main` if it is not already there — trust setup requires the workflow on the default branch (see [Troubleshooting: E400 trust setup](#troubleshooting-e400-trust-setup)).
3. Configure [trusted publishing](#configure-trusted-publishing-on-npmjs) on **each** package (npmjs UI or the [CLI equivalent](#cli-equivalent) — run **one package at a time** with **`--allow-publish`**; see [E400 troubleshooting](#troubleshooting-e400-trust-setup)).
4. Ship CalVer bumps via PR → merge — live CI publishes use OIDC + `--provenance`, not `NPM_TOKEN`.

Subsequent version bumps still require the same lockstep CalVer edit across all twelve lockstep packages; only the **first** upload must be local/token auth.

### Primary: npm trusted publishing (GitHub Actions OIDC)

CI live publishes use [npm trusted publishers](https://docs.npmjs.com/trusted-publishers) — short-lived OIDC tokens from GitHub Actions, not a long-lived npm token in the workflow.

| Requirement     | Detail                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| GitHub workflow | [`publish-ds-automation.yml`](../../.github/workflows/publish-ds-automation.yml) with `permissions.id-token: write` |
| npm CLI in CI   | ≥ **11.15.0** (workflow runs `npm install -g npm@^11.15.0`)                                                         |
| Registry        | `https://registry.npmjs.org` via `actions/setup-node` `registry-url`                                                |
| Publish flags   | `--tag latest` (all publishes); `--provenance` on live CI publishes only                                            |

Each `@corpdk` package must exist on npmjs before you add a trusted publisher. Trusted publishing is **per package** (repeat for all twelve).

#### Configure trusted publishing on npmjs

For **each** of the twelve lockstep packages below, an npm org owner or package maintainer with publish access:

1. Open [npmjs.com](https://www.npmjs.com/) → sign in → **Packages** → select the package (or go to `https://www.npmjs.com/package/@corpdk/<name>/settings`).
2. Open **Settings** (or **Publishing access** / **Trusted publishers**, depending on npm UI).
3. **Add trusted publisher** → provider **GitHub Actions**.
4. Fill the form with these values (same for every package in the set):

| npm UI field             | Value                                                           |
| ------------------------ | --------------------------------------------------------------- |
| **Organization or user** | `CorpDK`                                                        |
| **Repository**           | `coding-templates`                                              |
| **Workflow filename**    | `publish-ds-automation.yml`                                     |
| **Environment**          | _(leave empty)_ — workflow does not use a GitHub `environment:` |
| **Allowed actions**      | **npm publish** (enable publish; staged publish optional)       |

5. Save. Repeat for:

| Package                      |
| ---------------------------- |
| `@corpdk/dal-core`           |
| `@corpdk/pub-sub`            |
| `@corpdk/codegen-cli`        |
| `@corpdk/dal-codegen`        |
| `@corpdk/create-ds`          |
| `@corpdk/scalar-zod`         |
| `@corpdk/graphql-input-zod`  |
| `@corpdk/graphql-dsl`        |
| `@corpdk/engine-kit`         |
| `@corpdk/graphql-cli-core`   |
| `@corpdk/create-graphql-sdk` |
| `@corpdk/create-graphql-cli` |

The last seven rows apply after [B0 bootstrap](#generator-family--package-bootstrap-phase-b0) placeholders are on the registry.

#### CLI equivalent

Logged-in maintainer; package must already exist on the registry. Omit `--environment` when the workflow has no GitHub `environment:` (true for [`publish-ds-automation.yml`](../../.github/workflows/publish-ds-automation.yml)). Use npm CLI **≥ 11.15** locally and pass **`--allow-publish`** — older CLIs (e.g. 11.12.x) may get **E400** from the registry without explaining the missing permission ([troubleshooting](#troubleshooting-e400-trust-setup)). **CI live publish** also requires npm **≥ 11.15** in the workflow.

Ensure [`publish-ds-automation.yml`](../../.github/workflows/publish-ds-automation.yml) is on the repository **default branch** (`main`) before trust setup — not only on a feature branch.

```bash
npm trust github @corpdk/dal-core \
  --file publish-ds-automation.yml \
  --repository CorpDK/coding-templates \
  --allow-publish \
  -y
# Complete browser 2FA when prompted; then:
npm trust list @corpdk/dal-core
```

If your npm reports `Unknown command: "github"`, use `npm trust github` as above. Repeat for the other four packages (step 5 table) only after browser 2FA completes and the previous `npm trust list` shows a configuration.

**Verify trust configuration** (repeat for each package, or spot-check one):

```bash
npm trust list @corpdk/dal-core
```

Expect a GitHub Actions trusted publisher for workflow `publish-ds-automation.yml` on `CorpDK/coding-templates`. Use `--json` for machine-readable output.

**Verification (CI):** After configuration, merging a CalVer bump to `main` (or a manual `dry_run: false` dispatch on `main`) should publish without `secrets.NPM_TOKEN`. If publish fails with auth errors, confirm the workflow filename matches exactly (including `.yml`), the repo is `CorpDK/coding-templates`, and `id-token: write` is present on the workflow.

#### Troubleshooting: E400 trust setup

Symptoms: `npm trust github` (or `npm github`) returns **`E400 Bad Request`** on `POST .../-/package/@corpdk%2f<name>/trust`, npm opens **browser 2FA** URLs, and **`npm trust list`** shows **no configurations** for any of the twelve lockstep packages. Debug logs often show **401 → web auth 200 → 400** with no response body.

| Rank | Likely cause                                                                                                                                                                                                                                                                             | What to do                                                                                                                                                                                                                              |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | **Missing allowed-action flags** — npm CLI **&lt; 11.15** sends a trust payload **without** `allow-publish` / `allow-stage-publish`; the registry rejects it with **400** and no helpful body ([npm trust docs](https://docs.npmjs.com/cli/v11/commands/npm-trust/)).                    | Upgrade locally: `npm install -g npm@^11.15`. Re-run **one package** with **`--allow-publish`** using the [CLI equivalent](#cli-equivalent). npm **≥ 11.15** may refuse the command client-side if the flag is omitted.                 |
| 2    | **Workflow not on the default branch** — npm/npmjs resolves the workflow file from **`main`**. If [`publish-ds-automation.yml`](../../.github/workflows/publish-ds-automation.yml) is missing there, trust setup or OIDC publish can fail even when the file exists on a feature branch. | Confirm the workflow is on **`main`** before configuring trusted publishing. Verify: `curl -sI 'https://raw.githubusercontent.com/CorpDK/coding-templates/main/.github/workflows/publish-ds-automation.yml'` returns **200** (not 404). |
| 3    | **2FA web auth not finished before the next command** — batch loops fire multiple trust POSTs; only the first gets a clean browser approval.                                                                                                                                             | Run **one package at a time**. Wait until browser 2FA completes and the CLI exits **successfully** before starting the next package. Do not loop all twelve until the first `npm trust list` shows a configuration.                       |
| 4    | **Package not on the registry yet**                                                                                                                                                                                                                                                      | Complete [First-time bootstrap](#first-time-bootstrap-packages-not-on-npm-yet) so each package exists on npmjs before trust setup.                                                                                                      |
| 5    | **Wrong workflow filename or repo**                                                                                                                                                                                                                                                      | Filename must be exactly `publish-ds-automation.yml` (not a path). Repository must be `CorpDK/coding-templates` (case-sensitive).                                                                                                       |

**If CLI keeps failing:** use the [npmjs.com UI](#configure-trusted-publishing-on-npmjs) (same field values; enable **npm publish** under allowed actions). npm does not validate the GitHub workflow at save time — a **404 workflow on `main`** still breaks OIDC publish later even if UI save appears to work.

**Order for this monorepo:** (1) confirm the publish workflow is on **`main`**, (2) bootstrap packages if needed, (3) configure trust **per package** with **`--allow-publish`** and completed 2FA, (4) merge a CalVer bump to `main` or run `workflow_dispatch` with `dry_run: false`.

### Legacy optional: `NPM_TOKEN` (local or emergency)

The **workflow does not read** `NPM_TOKEN`. Long-lived tokens are optional for:

- **Local** releases via `.github/scripts/publish-ds-automation.sh` (export `NPM_TOKEN` or use `npm login`).
- **Emergency** manual publish from a maintainer machine if OIDC or npm registry issues block CI.

If CI used an org **`NPM_TOKEN`** secret only for this workflow, you can remove repository access to that secret after trusted publishing is verified on all twelve lockstep packages. Revoke or disable unused **automation / granular publish tokens** and any **2FA bypass** tokens that existed solely for this pipeline — they are no longer required for GitHub Actions publishes.

| Method                        | When to use                                                              |
| ----------------------------- | ------------------------------------------------------------------------ |
| **Trusted publishing (OIDC)** | All CI live publishes (default)                                          |
| **Granular npm token**        | Local maintainer publish or break-glass only; scope to the twelve lockstep packages |

Ensure the `@corpdk` npm org grants **publish** on the twelve lockstep packages above. `"access": "public"` is already set in each package `publishConfig`.

---

## Related

- [Monorepo Design — Versioning & publishing](../architecture/02-monorepo-design.md#publishing-strategy)
- [DS automation upgrades (`create-ds`)](../developer/ds-automation-upgrades.md)

**Last updated**: November 6, 2026
