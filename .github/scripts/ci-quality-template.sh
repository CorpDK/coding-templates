#!/usr/bin/env bash
# Monorepo CI quality for templates/* workspace packages (Artifactory/private — not in PUBLISH_ORDER).
#
# Usage: ci-quality-template.sh <@corpdk/template-pkg>
#
# Default: turbo build with workspace dependencies (filter="pkg...").
# Add a new template: append a matrix row in ci.yml quality-templates, then extend the case below.
#
# Examples for future rows:
#   @corpdk/ui     — build-only unless you add a test or lint script hook here
#   @corpdk/ds-no-sql — same pattern as other templates/ds-* variants
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <@corpdk/template-pkg>" >&2
  exit 1
fi

FILTER="$1"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "Building template ${FILTER} and workspace dependencies…"
pnpm turbo run build --filter="${FILTER}..."

case "${FILTER}" in
  @corpdk/ds)
    echo "Running DAL entity design lint for ${FILTER}…"
    pnpm --filter @corpdk/ds entity:lint
    ;;
  *)
    echo "No template-specific quality hooks for ${FILTER}; build-only."
    ;;
esac
