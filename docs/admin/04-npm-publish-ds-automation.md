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
| **Git tag** `ds-automation/v<CalVer>` | Live publish when `NPM_TOKEN` is configured (e.g. `ds-automation/v2026.10.0-alpha.1`); creates a **GitHub Release** for that tag after npm publish |
| **workflow_dispatch** | Manual run; **dry-run defaults to true**. With `dry_run: false` and `NPM_TOKEN`, creates the tag from **HEAD** if missing, publishes, then creates the GitHub Release |
| **pull_request** (paths under DS automation + workflow) | Always **dry-run** (validates build, tests, and publish packaging) |

If `NPM_TOKEN` is absent, tag and manual runs still execute but **force dry-run** so forks and PRs never upload. Dry-run never creates git tags or GitHub Releases; it logs what would happen.

### Outcomes (trigger × dry-run)

| Trigger | Effective dry-run | Git tag | npm publish | GitHub Release |
| ------- | ----------------- | ------- | ----------- | -------------- |
| Tag push `ds-automation/v*` | `false` (if `NPM_TOKEN` set) | Already on ref; not recreated | Live upload | Created after publish if missing |
| Tag push | forced `true` (no `NPM_TOKEN`) | Unchanged | `--dry-run` only | No |
| **workflow_dispatch** `dry_run: false` | `false` (if `NPM_TOKEN` set) | `ds-automation/v<version>` pushed from HEAD if absent | Live upload | Created after publish if missing |
| **workflow_dispatch** `dry_run: true` | `true` | No; logs intent | `--dry-run` only | No; logs intent |
| **pull_request** | `true` | No | `--dry-run` only | No |

Version for dispatch without `version` input comes from `libraries/dal-core/package.json` on the checked-out ref. Existing tags and releases are **not** duplicated: CI skips tag push and `gh release create` when the tag or release already exists.

Release notes list all five packages at the release CalVer and link back to this document.

### What CI runs

1. Verify every package in the set has the **same** `version` as the release (from tag, input, or `libraries/dal-core/package.json`).
2. `pnpm turbo run build` for all five packages (respects dependency order via Turbo).
3. `pnpm --filter @corpdk/dal-core test` and `@corpdk/dal-codegen test` (same coverage as [`.github/workflows/dal.yml`](../../.github/workflows/dal.yml) for libraries).
4. `pnpm publish --no-git-checks` in dependency order; `--dry-run` when not releasing.
5. On live publish only: ensure git tag `ds-automation/v<CalVer>` (manual dispatch from HEAD if missing), then `gh release create` with generated notes (`permissions.contents: write`).

---

## Release checklist (maintainers)

1. Bump **all five** `package.json` `version` fields to the same CalVer (and update [Package Dependencies](../architecture/06-package-dependencies.md) upgrade log if you track releases there).
2. Merge to `main`.
3. Either push a tag — `git tag ds-automation/v2026.10.0-alpha.1 && git push origin ds-automation/v2026.10.0-alpha.1` — or run **workflow_dispatch** on `main` with `dry_run: false` (CI creates the same tag from HEAD when absent).
4. Confirm the **Publish DS automation (npm)** workflow succeeded on GitHub Actions and that the matching **GitHub Release** exists under Releases.

### Local dry-run (no token)

```bash
pnpm install --frozen-lockfile
.github/scripts/publish-ds-automation.sh "$(node -p "require('./libraries/dal-core/package.json').version")" --dry-run
```

### Local publish (maintainer machine)

Configure `//registry.npmjs.org/:_authToken=${NPM_TOKEN}` in `~/.npmrc`, then omit `--dry-run`. Prefer CI tag releases for auditability.

---

## Authentication

### GitHub (CI secret)

Store the npm token in GitHub as an **organization secret**, not a repository-only secret, so the same credential can be linked to multiple publish repos without duplication.

| Step | Action |
| ---- | ------ |
| 1 | GitHub → **CorpDK** org → **Settings** → **Secrets and variables** → **Actions** → **New organization secret** |
| 2 | Name: **`NPM_TOKEN`** (must match the workflow reference `secrets.NPM_TOKEN`) |
| 3 | Value: npm automation token (see [npm token](#npm-token-value) below) — never commit tokens or paste them into issues or docs |
| 4 | **Repository access**: **Selected repositories** → add **`coding-templates`**. To reuse the secret elsewhere, add each repo that runs an npm publish workflow the same way |

Linked repositories see org secrets identically to repo secrets in Actions: `${{ secrets.NPM_TOKEN }}`. **No workflow YAML change** is required when moving from a repo secret to an org secret with the same name. Forks and repos without access do not receive the secret; tag/manual runs then **force dry-run** (see [Triggers](#triggers)).

### npm token value

| Method | Setup | Notes |
| ------ | ------ | ----- |
| **Granular token** (recommended) | [npmjs.com](https://www.npmjs.com/) → Access Tokens → **Granular** → **Publish** scoped to the five `@corpdk` packages in this doc (or the narrowest `@corpdk` scope your org allows) | Prefer least privilege over a full org-wide publish token; rotate on a schedule |
| **OIDC / provenance** (optional later) | `permissions: id-token: write` + npm trusted publishing on the org | Not required for the current workflow; add when CorpDK enables npm OIDC |

Ensure the `@corpdk` npm org grants the token **publish** on the five packages above. `"access": "public"` is already set in each package `publishConfig`. The workflow wires auth via `actions/setup-node` (registry URL) and `~/.npmrc` when not in dry-run mode.

---

## Related

- [Monorepo Design — Versioning & publishing](../architecture/02-monorepo-design.md#publishing-strategy)
- [DS automation upgrades (`create-ds`)](../developer/ds-automation-upgrades.md)

**Last updated**: October 5, 2026
