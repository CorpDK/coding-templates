# npm publish — DS automation packages

CI workflow and release process for the **lockstep CalVer** DS automation stack on [npmjs](https://www.npmjs.org/) (`@corpdk`, public). DS **templates** (`templates/ds`, `templates/ds-sdk`, etc.) remain **Artifactory-only**; see [Monorepo Design — Publishing](../architecture/02-monorepo-design.md#publishing-strategy).

---

## Package set (npmjs)

These five packages ship together at the same CalVer (e.g. `2026.10.0-alpha.2`):

| Order | Package               | Path                    | Role                                      |
| ----- | --------------------- | ----------------------- | ----------------------------------------- |
| 1     | `@corpdk/dal-core`    | `libraries/dal-core`    | DAL types, filters, scalars, error taxonomy |
| 2     | `@corpdk/pub-sub`     | `libraries/pub-sub`     | GraphQL pub/sub factory (DAL DS runtime)  |
| 3     | `@corpdk/codegen-cli` | `libraries/codegen-cli` | GraphQL codegen plugin for resolver/SDK   |
| 4     | `@corpdk/dal-codegen` | `libraries/dal-codegen` | `dal-codegen` / `dal-entity-lint` CLIs    |
| 5     | `@corpdk/create-ds`   | `engines/create-ds`     | Scaffold + upgrade CLI for DAL DS apps    |

**Not in this pipeline:** `@corpdk/create-app`, UI packages, `eslint-config`, or any `templates/*` (Artifactory). `@corpdk/ds` in the monorepo is a template, not an npm consumer package for this release unit.

**Rationale:** Minimal set required to run DAL automation outside the monorepo — libraries + CLIs that `create-ds init` / `upgrade` pin via CalVer. Lockstep versioning avoids incompatible `@corpdk/dal-core` / `@corpdk/dal-codegen` pairs in downstream apps.

---

## Workflow

| Item | Value |
| ---- | ----- |
| File | [`.github/workflows/publish-ds-automation.yml`](../../.github/workflows/publish-ds-automation.yml) |
| Script | [`.github/scripts/publish-ds-automation.sh`](../../.github/scripts/publish-ds-automation.sh) |

### Triggers

Path filters include all five package trees (source, `package.json`, README), plus the workflow and publish script. Unrelated commits on `main` do not run this workflow.

| Trigger | Behavior |
| ------- | -------- |
| **push** to **`main`** (paths above) | **Live publish** when `libraries/dal-core/package.json` **version changed** vs the previous commit on `main`. CI creates tag `ds-automation/v<CalVer>`, publishes via OIDC, then creates a **GitHub Release**. If CalVer is unchanged (e.g. README-only), the run exits without publish. |
| **pull_request** → `main` (paths above) | Always **dry-run** (build, tests, `npm publish --dry-run`; no npm auth, no tag, no release) |
| **workflow_dispatch** on **`main` only** | **Dry-run defaults to true**. `dry_run: false` on `main` is a break-glass live publish (same tag + release behavior). Dispatch from other branches is ignored. |

**Never live-publish** from feature branches, pull requests, or manual dispatch off `main`.

Dry-run never needs npm auth, never creates git tags or GitHub Releases, and logs what would happen on a live run.

### Outcomes (trigger × dry-run)

| Trigger | Effective dry-run | Git tag | npm publish | GitHub Release |
| ------- | ----------------- | ------- | ----------- | -------------- |
| **push** `main` (CalVer bumped) | `false` | `ds-automation/v<version>` pushed from merge commit if absent | Live upload (OIDC + `--provenance`) | Created after publish if missing |
| **push** `main` (CalVer unchanged) | — | — | Skipped (job gated) | — |
| **workflow_dispatch** `main`, `dry_run: false` | `false` | Tag pushed from HEAD if absent | Live upload (OIDC + `--provenance`) | Created after publish if missing |
| **workflow_dispatch** `main`, `dry_run: true` | `true` | No; logs intent | `--dry-run` only | No; logs intent |
| **workflow_dispatch** not on `main` | — | — | Skipped | — |
| **pull_request** | `true` | No | `--dry-run` only | No |

Version for dispatch without `version` input comes from `libraries/dal-core/package.json` on the checked-out ref. Existing tags and releases are **not** duplicated: CI skips tag push and `gh release create` when the tag or release already exists.

Release notes list all five packages at the release CalVer and link back to this document.

### What CI runs

1. Verify every package in the set has the **same** `version` as the release (from input or `libraries/dal-core/package.json`).
2. `pnpm turbo run build` for all five packages (respects dependency order via Turbo).
3. `pnpm --filter @corpdk/dal-core test` and `@corpdk/dal-codegen test` (same coverage as [`.github/workflows/dal.yml`](../../.github/workflows/dal.yml) for libraries).
4. `pnpm publish --no-git-checks` in dependency order; `--dry-run` when not releasing; live runs add `--provenance`.
5. On live publish only: ensure git tag `ds-automation/v<CalVer>` on the release commit, then `gh release create` with generated notes (`permissions.contents: write`).

Workflow permissions for live publish: `id-token: write` (OIDC token for npm) and `contents: write` (releases and tag push). `actions/setup-node@v7` sets `registry-url: https://registry.npmjs.org` without a static `NODE_AUTH_TOKEN`; npm CLI ≥ 11.15 exchanges the GitHub OIDC token with the registry when trusted publishing is configured.

---

## Release checklist (maintainers)

1. On a branch: bump **all five** `package.json` `version` fields to the same CalVer, update package READMEs as needed, and update [Package Dependencies](../architecture/06-package-dependencies.md) upgrade log if you track releases there.
2. Open a PR to `main` — the workflow runs **dry-run** (build, tests, packaging) on the PR.
3. **First release only:** if any of the five packages are missing on npmjs, complete [First-time bootstrap](#first-time-bootstrap-packages-not-on-npm-yet) (local `npm login` / `NPM_TOKEN`, not OIDC) **before** merge or use break-glass dispatch after bootstrap.
4. Confirm [trusted publishing](#configure-trusted-publishing-on-npmjs) is configured on npm for all five packages (one-time per package; only after each package exists on the registry).
5. **Merge to `main`.** CI detects the CalVer bump in `libraries/dal-core`, live-publishes all five packages, creates tag `ds-automation/v<CalVer>`, and opens the GitHub Release. Maintainers do **not** push release tags manually for normal releases.
6. Confirm **Publish DS automation (npm)** succeeded on the merge commit and that the **GitHub Release** for `ds-automation/v<CalVer>` exists.

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

[npm trusted publishers](https://docs.npmjs.com/trusted-publishers) require **each package to already exist on the registry** before you can add a GitHub Actions trusted publisher. The five DS automation packages may never have been published; do this **once** from a maintainer machine, then configure trusted publishing and use CI for every later release.

#### Prerequisites

| Requirement | Detail |
| ----------- | ------ |
| **npm org** | The `@corpdk` organization exists on [npmjs.com](https://www.npmjs.com/org/corpdk). |
| **Your account** | You are an npm **org owner** or have **publish** rights on scoped packages under `@corpdk` (team member with read-write, or package owner). |
| **Monorepo** | Checkout `main` (or the branch that contains [`.github/scripts/publish-ds-automation.sh`](../../.github/scripts/publish-ds-automation.sh)) with all five `package.json` files at the **same** CalVer you intend to ship. |
| **Scoped public access** | Each package already has `"publishConfig": { "access": "public" }`. The **first** publish of a scoped package must still pass `--access public` (the publish script does this). Scoped modules default to restricted until you publish as public. |

Do **not** use GitHub Actions OIDC for this step — trusted publishing is configured **after** the initial tarball upload. Pull requests that touch DS automation still run the workflow in **dry-run** mode (build, tests, `npm publish --dry-run`) with **no** registry auth, which validates packaging before bootstrap.

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

The script verifies lockstep versions, runs `pnpm turbo run build` and the same DAL tests as CI, then `pnpm publish --no-git-checks --access public` in dependency order:

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
# …verify all five package.json version fields equal ${VERSION}…

pnpm turbo run build \
  --filter=@corpdk/dal-core \
  --filter=@corpdk/pub-sub \
  --filter=@corpdk/codegen-cli \
  --filter=@corpdk/dal-codegen \
  --filter=@corpdk/create-ds

pnpm --filter @corpdk/dal-core test
pnpm --filter @corpdk/dal-codegen test

for pkg in @corpdk/dal-core @corpdk/pub-sub @corpdk/codegen-cli @corpdk/dal-codegen @corpdk/create-ds; do
  pnpm --filter "${pkg}" publish --no-git-checks --access public
done
```

#### After bootstrap

1. Confirm all five packages appear on npm at the expected version (e.g. `https://www.npmjs.com/package/@corpdk/dal-core`).
2. Configure [trusted publishing](#configure-trusted-publishing-on-npmjs) on **each** package (UI or `npm github` / `npm trust github` loop below).
3. Merge the publish workflow to `main` if it is not already there, then ship CalVer bumps via PR → merge — live CI publishes use OIDC + `--provenance`, not `NPM_TOKEN`.

Subsequent version bumps still require the same lockstep CalVer edit across all five packages; only the **first** upload must be local/token auth.

### Primary: npm trusted publishing (GitHub Actions OIDC)

CI live publishes use [npm trusted publishers](https://docs.npmjs.com/trusted-publishers) — short-lived OIDC tokens from GitHub Actions, not a long-lived npm token in the workflow.

| Requirement | Detail |
| ----------- | ------ |
| GitHub workflow | [`publish-ds-automation.yml`](../../.github/workflows/publish-ds-automation.yml) with `permissions.id-token: write` |
| npm CLI in CI | ≥ **11.15.0** (workflow runs `npm install -g npm@^11.15.0`) |
| Registry | `https://registry.npmjs.org` via `actions/setup-node` `registry-url` |
| Publish flags | `--provenance` on live CI publishes |

Each `@corpdk` package must exist on npmjs before you add a trusted publisher. Trusted publishing is **per package** (repeat for all five).

#### Configure trusted publishing on npmjs

For **each** of the five packages below, an npm org owner or package maintainer with publish access:

1. Open [npmjs.com](https://www.npmjs.com/) → sign in → **Packages** → select the package (or go to `https://www.npmjs.com/package/@corpdk/<name>/settings`).
2. Open **Settings** (or **Publishing access** / **Trusted publishers**, depending on npm UI).
3. **Add trusted publisher** → provider **GitHub Actions**.
4. Fill the form with these values (same for every package in the set):

| npm UI field | Value |
| ------------ | ----- |
| **Organization or user** | `CorpDK` |
| **Repository** | `coding-templates` |
| **Workflow filename** | `publish-ds-automation.yml` |
| **Environment** | *(leave empty)* — workflow does not use a GitHub `environment:` |
| **Allowed actions** | **npm publish** (enable publish; staged publish optional) |

5. Save. Repeat for:

| Package |
| ------- |
| `@corpdk/dal-core` |
| `@corpdk/pub-sub` |
| `@corpdk/codegen-cli` |
| `@corpdk/dal-codegen` |
| `@corpdk/create-ds` |

**CLI equivalent** (logged-in maintainer, package must already exist on the registry). Omit `--environment` when the workflow has no GitHub `environment:` (true for [`publish-ds-automation.yml`](../../.github/workflows/publish-ds-automation.yml)). Run `npm github --help` or `npm trust --help` on your machine — npm **11.12.x** exposes this as `npm trust github` (no `--allow-publish` flag); npm **≥11.15** adds optional `--allow-publish` / `--allow-stage-publish` for staged publish. **CI live publish** still requires npm CLI **≥11.15** in the workflow; older npm is fine for this one-time trust setup.

```bash
for pkg in @corpdk/dal-core @corpdk/pub-sub @corpdk/codegen-cli @corpdk/dal-codegen @corpdk/create-ds; do
  npm github "$pkg" \
    --file publish-ds-automation.yml \
    --repository CorpDK/coding-templates \
    -y
done
```

If your npm reports `Unknown command: "github"`, use the same flags with `npm trust github` instead of `npm github`.

**Verify trust configuration** (repeat for each package, or spot-check one):

```bash
npm trust list @corpdk/dal-core
```

Expect a GitHub Actions trusted publisher for workflow `publish-ds-automation.yml` on `CorpDK/coding-templates`. Use `--json` for machine-readable output.

**Verification (CI):** After configuration, merging a CalVer bump to `main` (or a manual `dry_run: false` dispatch on `main`) should publish without `secrets.NPM_TOKEN`. If publish fails with auth errors, confirm the workflow filename matches exactly (including `.yml`), the repo is `CorpDK/coding-templates`, and `id-token: write` is present on the workflow.

### Legacy optional: `NPM_TOKEN` (local or emergency)

The **workflow does not read** `NPM_TOKEN`. Long-lived tokens are optional for:

- **Local** releases via `.github/scripts/publish-ds-automation.sh` (export `NPM_TOKEN` or use `npm login`).
- **Emergency** manual publish from a maintainer machine if OIDC or npm registry issues block CI.

If CI used an org **`NPM_TOKEN`** secret only for this workflow, you can remove repository access to that secret after trusted publishing is verified on all five packages. Revoke or disable unused **automation / granular publish tokens** and any **2FA bypass** tokens that existed solely for this pipeline — they are no longer required for GitHub Actions publishes.

| Method | When to use |
| ------ | ----------- |
| **Trusted publishing (OIDC)** | All CI live publishes (default) |
| **Granular npm token** | Local maintainer publish or break-glass only; scope to the five packages |

Ensure the `@corpdk` npm org grants **publish** on the five packages above. `"access": "public"` is already set in each package `publishConfig`.

---

## Related

- [Monorepo Design — Versioning & publishing](../architecture/02-monorepo-design.md#publishing-strategy)
- [DS automation upgrades (`create-ds`)](../developer/ds-automation-upgrades.md)

**Last updated**: October 5, 2026
