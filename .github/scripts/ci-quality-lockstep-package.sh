#!/usr/bin/env bash
# Monorepo CI quality for one lockstep npm package in PUBLISH_ORDER.
# Usage: ci-quality-lockstep-package.sh <@corpdk/package-name>
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <@corpdk/package-name>" >&2
  exit 1
fi

FILTER="$1"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

# shellcheck source=lockstep-calver.sh
source "${ROOT}/.github/scripts/lockstep-calver.sh"

path="$(package_json_path "${FILTER}")" || exit 1

echo "Building ${FILTER} and workspace dependencies…"
pnpm turbo run build --filter="${FILTER}..."

if node -e "const s=require('./${path}').scripts; if (!s || !s.test) process.exit(1)"; then
  echo "Running tests for ${FILTER}…"
  pnpm --filter "${FILTER}" test
else
  echo "No test script for ${FILTER}; build-only."
fi

if [[ "${FILTER}" == "@corpdk/create-ds" ]]; then
  echo "Running create-ds canonical drift check…"
  node "${ROOT}/engines/create-ds/dist/scripts/check-canonical.js"
fi

if [[ "${FILTER}" == "@corpdk/graphql-dsl" ]]; then
  echo "Running graphql-dsl self-containment guard (R-42)…"
  node "${ROOT}/libraries/graphql-dsl/scripts/check-self-contained.mjs"
fi
