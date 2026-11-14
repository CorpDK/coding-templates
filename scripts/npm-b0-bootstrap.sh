#!/usr/bin/env bash
# B0 npm bootstrap (one-time): publish lockstep CalVer placeholders (--tag bootstrap), deprecate, npm trust.
#
# Run from a real terminal (not through redacted agent output) so npm can print
# https://www.npmjs.com/auth/cli/... links when EOTP is required.
#
# Requires: npm >= 11.15, npm whoami, @corpdk publish + org 2FA.
# publish-ds-automation.yml must exist on GitHub default branch (main) before trust.
#
# Usage:
#   ./scripts/npm-b0-bootstrap.sh              # all steps (npm handles 2FA per command)
#   ./scripts/npm-b0-bootstrap.sh --pause      # extra Enter prompt before each step
#   ./scripts/npm-b0-bootstrap.sh --publish-only
#   ./scripts/npm-b0-bootstrap.sh --post-publish   # deprecate + trust (after publish)
#   ./scripts/npm-b0-bootstrap.sh --trust-only       # trust only (no deprecate)
#   ./scripts/npm-b0-bootstrap.sh --verify-only
#   ./scripts/npm-b0-bootstrap.sh --from @corpdk/graphql-dsl
#
# Optional: export NPM_OTP=123456 before running to pass --otp on every npm command
# (you still may need a fresh code per command if npm asks again).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DEPRECATE_MSG='Placeholder with no code; use a CalVer release'
# npm often returns 404 for npm view briefly after a successful publish
REGISTRY_WAIT_MAX="${REGISTRY_WAIT_MAX:-36}"
REGISTRY_WAIT_SECS="${REGISTRY_WAIT_SECS:-10}"

PKG_DIRS=(
  libraries/scalar-zod
  libraries/graphql-input-zod
  libraries/graphql-dsl
  libraries/engine-kit
  libraries/graphql-cli-core
  engines/create-graphql-sdk
  engines/create-graphql-cli
)

DO_PUBLISH=1
DO_DEPRECATE=1
DO_TRUST=1
DO_VERIFY=0
DO_PAUSE=0
START_FROM=""

usage() {
  sed -n '1,22p' "$0" | tail -n +2
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h | --help) usage 0 ;;
    --publish-only)
      DO_DEPRECATE=0
      DO_TRUST=0
      ;;
    --post-publish)
      DO_PUBLISH=0
      ;;
    --trust-only)
      DO_PUBLISH=0
      DO_DEPRECATE=0
      ;;
    --verify-only)
      DO_PUBLISH=0
      DO_DEPRECATE=0
      DO_TRUST=0
      DO_VERIFY=1
      ;;
    --pause)
      DO_PAUSE=1
      ;;
    --from)
      shift
      START_FROM="${1:?--from requires package name, e.g. @corpdk/graphql-dsl}"
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage 1
      ;;
  esac
  shift
done

if [[ "$DO_VERIFY" -eq 1 ]]; then
  DO_PUBLISH=0
  DO_DEPRECATE=0
  DO_TRUST=0
fi

if ! npm whoami --registry=https://registry.npmjs.org >/dev/null 2>&1; then
  echo "npm whoami failed. Run: npm login --registry=https://registry.npmjs.org" >&2
  exit 1
fi

echo "npm user: $(npm whoami --registry=https://registry.npmjs.org)"
echo "npm version: $(npm --version)"

NPM_MAJOR="$(npm --version | cut -d. -f1)"
NPM_MINOR="$(npm --version | cut -d. -f2)"
if [[ "$DO_TRUST" -eq 1 ]] && { [[ "$NPM_MAJOR" -lt 11 ]] || { [[ "$NPM_MAJOR" -eq 11 ]] && [[ "$NPM_MINOR" -lt 15 ]]; }; }; then
  echo "npm >= 11.15 required for npm trust; got $(npm --version)" >&2
  exit 1
fi

otp_args() {
  if [[ -n "${NPM_OTP:-}" ]]; then
    printf -- '--otp=%s' "$NPM_OTP"
  fi
}

maybe_pause() {
  [[ "$DO_PAUSE" -eq 1 ]] || return 0
  local label="$1"
  echo ""
  echo ">>> ${label} (press Enter when ready)"
  read -r _
}

pkg_version() {
  local dir="$1"
  node -p "require('./${dir}/package.json').version"
}

wait_for_pkg_version() {
  local name="$1"
  local version="$2"
  local i
  if npm view "${name}@${version}" version >/dev/null 2>&1; then
    return 0
  fi
  echo "Waiting for ${name}@${version} to appear on the registry (up to $((REGISTRY_WAIT_MAX * REGISTRY_WAIT_SECS))s)..."
  for ((i = 1; i <= REGISTRY_WAIT_MAX; i++)); do
    if npm view "${name}@${version}" version >/dev/null 2>&1; then
      echo "  visible after ${i} attempt(s)"
      return 0
    fi
    sleep "$REGISTRY_WAIT_SECS"
  done
  echo "  timed out waiting for ${name}@${version}" >&2
  return 1
}

wait_for_package() {
  local name="$1"
  local i
  if npm view "${name}" name >/dev/null 2>&1; then
    return 0
  fi
  echo "Waiting for package ${name} on the registry..."
  for ((i = 1; i <= REGISTRY_WAIT_MAX; i++)); do
    if npm view "${name}" name >/dev/null 2>&1; then
      return 0
    fi
    sleep "$REGISTRY_WAIT_SECS"
  done
  return 1
}

npm_publish_pkg() {
  local dir="$1"
  local otp
  otp="$(otp_args)"
  # shellcheck disable=SC2086
  (cd "$dir" && npm publish --access public --tag bootstrap ${otp:+$otp})
}

npm_deprecate_pkg() {
  local name="$1"
  local version="$2"
  local otp
  otp="$(otp_args)"
  # shellcheck disable=SC2086
  npm deprecate "${name}@${version}" "${DEPRECATE_MSG}" ${otp:+$otp}
}

npm_trust_pkg() {
  local name="$1"
  npm trust github "${name}" \
    --file publish-ds-automation.yml \
    --repository CorpDK/coding-templates \
    --allow-publish \
    -y
  npm trust list "${name}"
}

is_deprecated() {
  local name="$1"
  local version="$2"
  npm view "${name}@${version}" deprecated 2>/dev/null | grep -q .
}

verify_pkg() {
  local name="$1"
  local version="$2"
  local ok=0
  if npm view "${name}@${version}" version >/dev/null 2>&1; then
    echo "  [ok] ${name}@${version} on registry"
  else
    echo "  [FAIL] ${name}@${version} missing on registry"
    ok=1
  fi
  if npm trust list "${name}" 2>/dev/null | grep -q publish-ds-automation.yml; then
    echo "  [ok] trusted publisher publish-ds-automation.yml"
  else
    echo "  [FAIL] trust not configured for ${name}"
    ok=1
  fi
  return "$ok"
}

skipped=1
if [[ -n "$START_FROM" ]]; then
  skipped=0
fi

failures=0

EXPECTED_VERSION="$(pkg_version "${PKG_DIRS[0]}")"
for dir in "${PKG_DIRS[@]}"; do
  v="$(pkg_version "$dir")"
  if [[ "$v" != "$EXPECTED_VERSION" ]]; then
    echo "Version mismatch: ${dir} is ${v}, expected ${EXPECTED_VERSION}" >&2
    exit 1
  fi
done
echo "B0 placeholder version (lockstep): ${EXPECTED_VERSION}"

for dir in "${PKG_DIRS[@]}"; do
  name="$(node -p "require('./${dir}/package.json').name")"
  version="$(pkg_version "$dir")"

  if [[ "$skipped" -eq 0 ]] && [[ "$name" != "$START_FROM" ]]; then
    continue
  fi
  skipped=1

  published_now=0

  echo ""
  echo "======== ${name} (${dir}) ========"

  if [[ "$DO_PUBLISH" -eq 1 ]]; then
    if npm view "${name}@${version}" version >/dev/null 2>&1; then
      echo "Publish: already on registry"
    else
      maybe_pause "Publish ${name}"
      if ! npm_publish_pkg "$dir"; then
        echo "Publish failed for ${name}. Fix 2FA and re-run with: $0 --publish-only --from ${name}" >&2
        failures=$((failures + 1))
        continue
      fi
      published_now=1
      echo "Published ${name}@${version} (tag: bootstrap)"
    fi
  fi

  if [[ "$DO_DEPRECATE" -eq 1 ]]; then
    if ! wait_for_pkg_version "$name" "$version"; then
      echo "Deprecate: skipped (version not on registry yet)" >&2
      failures=$((failures + 1))
    elif is_deprecated "$name" "$version"; then
      echo "Deprecate: already deprecated"
    else
      maybe_pause "Deprecate ${name}@${version}"
      if ! npm_deprecate_pkg "$name" "$version"; then
        echo "Deprecate failed for ${name}" >&2
        failures=$((failures + 1))
      else
        echo "Deprecated ${name}@${version}"
      fi
    fi
  fi

  if [[ "$DO_TRUST" -eq 1 ]]; then
    if npm trust list "${name}" 2>/dev/null | grep -q publish-ds-automation.yml; then
      echo "Trust: already configured"
    elif ! wait_for_package "$name"; then
      echo "Trust: skipped (package not on registry yet)" >&2
      failures=$((failures + 1))
    else
      maybe_pause "npm trust github ${name}"
      if ! npm_trust_pkg "$name"; then
        echo "Trust failed for ${name}. Re-run: $0 --trust-only --from ${name}" >&2
        failures=$((failures + 1))
        continue
      fi
    fi
  fi
done

if [[ "$DO_VERIFY" -eq 1 ]]; then
  echo ""
  echo "======== Verification ========"
  for dir in "${PKG_DIRS[@]}"; do
    name="$(node -p "require('./${dir}/package.json').name")"
    version="$(pkg_version "$dir")"
    verify_pkg "$name" "$version" || failures=$((failures + 1))
  done
fi

echo ""
if [[ "$failures" -eq 0 ]]; then
  echo "B0 npm bootstrap finished OK (${#PKG_DIRS[@]} packages)."
else
  echo "B0 npm bootstrap finished with ${failures} failure(s). Use --from to resume." >&2
  exit 1
fi