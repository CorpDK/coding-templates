#!/usr/bin/env bash
# Shared lockstep CalVer package list and version helpers for CI gates and publish-ds-automation.sh.
# Canonical order: docs/developer/15-create-ds-generator-integration.md §4.3

if [[ -z "${LOCKSTEP_CALVER_SOURCED:-}" ]]; then
  LOCKSTEP_CALVER_SOURCED=1

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

  # Version at the current working tree for one lockstep package.
  lockstep_version_worktree() {
    local filter="$1"
    local path
    path="$(package_json_path "${filter}")" || return 1
    node -p "require('./${path}').version"
  }

  # Version at git ref for one package path (empty string if unreadable).
  lockstep_version_at_ref() {
    local git_ref="$1"
    local json_path="$2"
    git show "${git_ref}:${json_path}" 2>/dev/null \
      | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).version" \
      || true
  }

  # Echo "changed" if any lockstep package version differs between git_ref and worktree.
  # Echo "unchanged" if all readable pairs match.
  # Echo "unreadable" if git_ref is set but at least one prior version could not be read.
  lockstep_calver_compare() {
    local git_ref="${1:-}"
    local status="unchanged"
    local any_prev_readable=false

    if [[ -z "${git_ref}" ]]; then
      echo "unchanged"
      return 0
    fi

    for name in "${PUBLISH_ORDER[@]}"; do
      local path curr prev
      path="$(package_json_path "${name}")" || return 1
      curr="$(lockstep_version_worktree "${name}")"
      prev="$(lockstep_version_at_ref "${git_ref}" "${path}")"
      if [[ -n "${prev}" ]]; then
        any_prev_readable=true
        if [[ "${prev}" != "${curr}" ]]; then
          echo "changed"
          return 0
        fi
      fi
    done

    if [[ "${any_prev_readable}" == "false" ]]; then
      echo "unreadable"
      return 0
    fi

    echo "${status}"
  }

  # Canonical release CalVer: dal-core on worktree (publish script asserts all packages match).
  lockstep_canonical_version() {
    lockstep_version_worktree "@corpdk/dal-core"
  }
fi