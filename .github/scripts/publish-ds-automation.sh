#!/usr/bin/env bash
# Publish the lockstep DS automation package set to npmjs (public @corpdk scope).
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
  if [[ -z "${NPM_TOKEN:-}" ]]; then
    echo "NPM_TOKEN is not set; refusing live publish." >&2
    exit 1
  fi
  echo "Publishing to registry.npmjs.org…"
fi

for name in "${PUBLISH_ORDER[@]}"; do
  echo "--- ${name} ---"
  pnpm --filter "${name}" publish "${publish_flags[@]}"
done

echo "Done."
