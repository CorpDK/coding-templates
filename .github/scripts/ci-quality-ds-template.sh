#!/usr/bin/env bash
# Monorepo CI quality for templates/ds (@corpdk/ds) — not npm-published, not in PUBLISH_ORDER.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

pnpm turbo run build --filter=@corpdk/ds
pnpm --filter @corpdk/ds entity:lint