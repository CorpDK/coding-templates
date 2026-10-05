#!/usr/bin/env bash
# Publish the lockstep DS automation package set to npmjs (public @corpdk scope).
# Git tag ds-automation/v<CalVer> and GitHub Release are created by CI on live main publish, not here.
# Live CI publish runs only on push to main when libraries/dal-core CalVer changed (see workflow).
#
# First time the packages are not on npm yet: use this script locally with npm login or
# NPM_TOKEN (not GitHub OIDC). See docs/admin/04-npm-publish-ds-automation.md
# § "First-time bootstrap (packages not on npm yet)" before configuring trusted publishers.
#
# Usage: publish-ds-automation.sh <expected-version> [--dry-run]
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <expected-version> [--dry-run]" >&2
  exit 1
fi

EXPECTED_VERSION="$1"
DRY_RUN=false
if [[ "${2:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

# Dependency order: leaves first, then dal-codegen (workspace dep on dal-core), then create-ds.
PUBLISH_ORDER=(
  "@corpdk/dal-core"
  "@corpdk/pub-sub"
  "@corpdk/codegen-cli"
  "@corpdk/dal-codegen"
  "@corpdk/create-ds"
)

echo "Verifying lockstep version ${EXPECTED_VERSION} on DS automation packages…"

verify_version() {
  local filter="$1"
  local dir
  dir="$(pnpm pkg get name --filter "${filter}" --json 2>/dev/null | head -1 || true)"
  local path
  case "${filter}" in
    @corpdk/dal-core) path="libraries/dal-core/package.json" ;;
    @corpdk/pub-sub) path="libraries/pub-sub/package.json" ;;
    @corpdk/codegen-cli) path="libraries/codegen-cli/package.json" ;;
    @corpdk/dal-codegen) path="libraries/dal-codegen/package.json" ;;
    @corpdk/create-ds) path="engines/create-ds/package.json" ;;
    *)
      echo "Unknown package: ${filter}" >&2
      exit 1
      ;;
  esac
  actual="$(node -p "require('./${path}').version")"
  if [[ "${actual}" != "${EXPECTED_VERSION}" ]]; then
    echo "Version mismatch: ${filter} is ${actual}, expected ${EXPECTED_VERSION}" >&2
    exit 1
  fi
}

for name in "${PUBLISH_ORDER[@]}"; do
  verify_version "${name}"
done

echo "Building DS automation packages…"
pnpm turbo run build \
  --filter=@corpdk/dal-core \
  --filter=@corpdk/pub-sub \
  --filter=@corpdk/codegen-cli \
  --filter=@corpdk/dal-codegen \
  --filter=@corpdk/create-ds

echo "Running DAL unit tests…"
pnpm --filter @corpdk/dal-core test
pnpm --filter @corpdk/dal-codegen test

publish_flags=(--no-git-checks --access public)
if [[ "${DRY_RUN}" == true ]]; then
  publish_flags+=(--dry-run)
  echo "Dry run: npm publish will not upload tarballs."
else
  echo "Publishing to registry.npmjs.org…"
  if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
    echo "Auth: npm trusted publishing (GitHub Actions OIDC)."
    publish_flags+=(--provenance)
  elif [[ -n "${NPM_TOKEN:-}" ]]; then
    echo "Auth: NPM_TOKEN (local maintainer fallback)."
  elif ! npm whoami --registry=https://registry.npmjs.org >/dev/null 2>&1; then
    echo "Not logged in to npm and NPM_TOKEN unset; refusing live publish." >&2
    echo "Use --dry-run, npm login, or export NPM_TOKEN for local releases." >&2
    exit 1
  fi
fi

for name in "${PUBLISH_ORDER[@]}"; do
  echo "--- ${name} ---"
  pnpm --filter "${name}" publish "${publish_flags[@]}"
done

echo "Done."
