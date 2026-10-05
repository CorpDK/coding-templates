# npm publish — DS automation packages

CI workflow and release process for the **lockstep CalVer** DS automation stack on [npmjs](https://www.npmjs.org/) (`@corpdk`, public). DS **templates** (`templates/ds`, `templates/ds-sdk`, etc.) remain **Artifactory-only**; see [Monorepo Design — Publishing](../architecture/02-monorepo-design.md#publishing-strategy).

---

## Package set (npmjs)

These five packages ship together at the same CalVer (e.g. `2026.10.0-alpha.1`):

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

| Trigger | Behavior |
| ------- | -------- |
| **Git tag** `ds-automation/v<CalVer>` | **Live publish** via npm trusted publishing (OIDC); creates a **GitHub Release** for that tag after npm publish |
| **workflow_dispatch** | Manual run; **dry-run defaults to true**. With `dry_run: false`, creates the tag from **HEAD** if missing, publishes via OIDC, then creates the GitHub Release |
| **pull_request** (paths under DS automation + workflow) | Always **dry-run** (validates build, tests, and publish packaging) |

Dry-run never needs npm auth, never creates git tags or GitHub Releases, and logs what would happen on a live run.

### Outcomes (trigger × dry-run)

| Trigger | Effective dry-run | Git tag | npm publish | GitHub Release |
| ------- | ----------------- | ------- | ----------- | -------------- |
| Tag push `ds-automation/v*` | `false` | Already on ref; not recreated | Live upload (OIDC + `--provenance`) | Created after publish if missing |
| **workflow_dispatch** `dry_run: false` | `false` | `ds-automation/v<version>` pushed from HEAD if absent | Live upload (OIDC + `--provenance`) | Created after publish if missing |
| **workflow_dispatch** `dry_run: true` | `true` | No; logs intent | `--dry-run` only | No; logs intent |
| **pull_request** | `true` | No | `--dry-run` only | No |

Version for dispatch without `version` input comes from `libraries/dal-core/package.json` on the checked-out ref. Existing tags and releases are **not** duplicated: CI skips tag push and `gh release create` when the tag or release already exists.

Release notes list all five packages at the release CalVer and link back to this document.

### What CI runs

1. Verify every package in the set has the **same** `version` as the release (from tag, input, or `libraries/dal-core/package.json`).
2. `pnpm turbo run build` for all five packages (respects dependency order via Turbo).
3. `pnpm --filter @corpdk/dal-core test` and `@corpdk/dal-codegen test` (same coverage as [`.github/workflows/dal.yml`](../../.github/workflows/dal.yml) for libraries).
4. `pnpm publish --no-git-checks` in dependency order; `--dry-run` when not releasing; live runs add `--provenance`.
5. On live publish only: ensure git tag `ds-automation/v<CalVer>` (manual dispatch from HEAD if missing), then `gh release create` with generated notes (`permissions.contents: write`).

Workflow permissions for live publish: `id-token: write` (OIDC token for npm) and `contents: write` (releases and tag push). `actions/setup-node@v7` sets `registry-url: https://registry.npmjs.org` without a static `NODE_AUTH_TOKEN`; npm CLI ≥ 11.15 exchanges the GitHub OIDC token with the registry when trusted publishing is configured.

---

## Release checklist (maintainers)

1. Bump **all five** `package.json` `version` fields to the same CalVer (and update [Package Dependencies](../architecture/06-package-dependencies.md) upgrade log if you track releases there).
2. Merge to `main`.
3. Confirm [trusted publishing](#configure-trusted-publishing-on-npmjs) is configured on npm for all five packages (one-time per package).
4. Either push a tag — `git tag ds-automation/v2026.10.0-alpha.1 && git push origin ds-automation/v2026.10.0-alpha.1` — or run **workflow_dispatch** on `main` with `dry_run: false` (CI creates the same tag from HEAD when absent).
5. Confirm the **Publish DS automation (npm)** workflow succeeded on GitHub Actions and that the matching **GitHub Release** exists under Releases.

### Local dry-run (no token)

```bash
pnpm install --frozen-lockfile
.github/scripts/publish-ds-automation.sh "$(node -p "require('./libraries/dal-core/package.json').version")" --dry-run
```

### Local publish (maintainer machine)

Use `npm login` or `//registry.npmjs.org/:_authToken=${NPM_TOKEN}` in `~/.npmrc`, then run the script without `--dry-run`. Prefer CI tag releases for auditability and provenance.

---

## Authentication

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

**CLI equivalent** (logged-in maintainer, package must already exist on the registry):

```bash
for pkg in @corpdk/dal-core @corpdk/pub-sub @corpdk/codegen-cli @corpdk/dal-codegen @corpdk/create-ds; do
  npm trust github "$pkg" \
    --file publish-ds-automation.yml \
    --repository CorpDK/coding-templates \
    --allow-publish \
    -y
done
```

**Verification:** After configuration, a tag push or manual `dry_run: false` run on `CorpDK/coding-templates` should publish without `secrets.NPM_TOKEN`. If publish fails with auth errors, confirm the workflow filename matches exactly (including `.yml`), the repo is `CorpDK/coding-templates`, and `id-token: write` is present on the workflow.

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
