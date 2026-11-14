#!/usr/bin/env bash
# Publish the lockstep DS automation package set to npmjs (public @corpdk scope).
# Git tag ds-automation/v<CalVer> and GitHub Release are created by CI on live main publish, not here.
# Repair stale latest without republish: npm dist-tag add @corpdk/<pkg>@<CalVer> latest (see admin doc § dist-tags).
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

echo "Verifying DS automation publish order…"
pnpm --filter @corpdk/engine-kit build
pnpm --filter @corpdk/engine-kit test
node "${ROOT}/libraries/engine-kit/dist/bin/check-publish-order.js"
pnpm --filter @corpdk/create-ds build
node "${ROOT}/engines/create-ds/dist/scripts/check-canonical.js"

# Canonical order: docs/developer/15-create-ds-generator-integration.md §4.3
PUBLISH_ORDER=(
  "@corpdk/graphql-dsl"
  "@corpdk/scalar-zod"
  "@corpdk/dal-core"
  "@corpdk/pub-sub"
  "@corpdk/graphql-input-zod"
  "@corpdk/dal-codegen"
  "@corpdk/engine-kit"
  "@corpdk/graphql-cli-core"
  "@corpdk/create-graphql-sdk"
  "@corpdk/create-graphql-cli"
  "@corpdk/codegen-cli"
  "@corpdk/create-ds"
)

package_json_path() {
  case "$1" in
    @corpdk/graphql-dsl) echo "libraries/graphql-dsl/package.json" ;;
    @corpdk/scalar-zod) echo "libraries/scalar-zod/package.json" ;;
    @corpdk/dal-core) echo "libraries/dal-core/package.json" ;;
    @corpdk/pub-sub) echo "libraries/pub-sub/package.json" ;;
    @corpdk/graphql-input-zod) echo "libraries/graphql-input-zod/package.json" ;;
    @corpdk/dal-codegen) echo "libraries/dal-codegen/package.json" ;;
    @corpdk/engine-kit) echo "libraries/engine-kit/package.json" ;;
    @corpdk/graphql-cli-core) echo "libraries/graphql-cli-core/package.json" ;;
    @corpdk/create-graphql-sdk) echo "engines/create-graphql-sdk/package.json" ;;
    @corpdk/create-graphql-cli) echo "engines/create-graphql-cli/package.json" ;;
    @corpdk/codegen-cli) echo "libraries/codegen-cli/package.json" ;;
    @corpdk/create-ds) echo "engines/create-ds/package.json" ;;
    *)
      echo "Unknown package: $1" >&2
      return 1
      ;;
  esac
}

package_rel_dir() {
  local path
  path="$(package_json_path "$1")" || return 1
  dirname "${path}"
}

dist_types_file() {
  case "$1" in
    @corpdk/create-ds | @corpdk/create-graphql-sdk | @corpdk/create-graphql-cli)
      echo "dist/types-entry.d.ts"
      ;;
    *)
      echo "dist/index.d.ts"
      ;;
  esac
}

echo "Verifying lockstep version ${EXPECTED_VERSION} on DS automation packages…"

verify_version() {
  local filter="$1"
  local path
  path="$(package_json_path "${filter}")" || exit 1
  actual="$(node -p "require('./${path}').version")"
  if [[ "${actual}" != "${EXPECTED_VERSION}" ]]; then
    echo "Version mismatch: ${filter} is ${actual}, expected ${EXPECTED_VERSION}" >&2
    exit 1
  fi
}

for name in "${PUBLISH_ORDER[@]}"; do
  verify_version "${name}"
done

build_filters=()
for name in "${PUBLISH_ORDER[@]}"; do
  build_filters+=(--filter="${name}")
done

echo "Building DS automation packages…"
pnpm turbo run build "${build_filters[@]}"

echo "Running DAL unit tests…"
pnpm --filter @corpdk/dal-core test
pnpm --filter @corpdk/dal-codegen test

echo "Verifying TypeScript declarations in dist/…"
verify_dist_types() {
  local filter="$1"
  local rel types_file
  rel="$(package_rel_dir "${filter}")" || exit 1
  types_file="$(dist_types_file "${filter}")"
  if [[ ! -f "${ROOT}/${rel}/${types_file}" ]]; then
    echo "Missing ${rel}/${types_file} — build must emit declarations before publish." >&2
    exit 1
  fi
}

for name in "${PUBLISH_ORDER[@]}"; do
  verify_dist_types "${name}"
done

# Prerelease CalVer (e.g. 2026.10.0-alpha.N) would otherwise get dist-tag "alpha", not "latest".
publish_flags=(--no-git-checks --access public --tag latest)
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