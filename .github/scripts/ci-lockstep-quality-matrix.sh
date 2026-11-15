#!/usr/bin/env bash
# Emit JSON array of lockstep package names for ci.yml quality matrix (fromJson).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# shellcheck source=lockstep-calver.sh
source "${ROOT}/.github/scripts/lockstep-calver.sh"

printf '%s\n' "${PUBLISH_ORDER[@]}" | node -e "
const fs = require('node:fs');
const lines = fs.readFileSync(0, 'utf8').trim().split('\n').filter(Boolean);
process.stdout.write(JSON.stringify(lines));
"