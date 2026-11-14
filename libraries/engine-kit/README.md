# @corpdk/engine-kit

Shared CLI, filesystem, merge, upgrade, canonical, and publish-order helpers for `create-ds`, `create-graphql-sdk`, and `create-graphql-cli`.

Design: [doc 15 — Generator engine family](../docs/developer/15-create-ds-generator-integration.md#113-corpdkengine-kit).

## Modules

| Module | Exports |
| ------ | ------- |
| `fs` | `pathExists`, `readJson`, `writeJson`, `copyDir` (caller-provided `exclude`, `requireSource`) |
| `merge` | `mergePackageJson`, `mergeYamlConfig` (deep map merge) |
| `template` | `resolveCanonical`, `readEngineRelease`, `initialCalVer`, `engineRootFromImportMeta` |
| `upgrade` | `runUpgradePlan`, `writeEngineVersion` |
| `canonical` | `syncCanonical`, `checkCanonical` |
| `publish` | `checkPublishOrder`, `DS_AUTOMATION_PUBLISH_ORDER` |
| `cli` | `parseEngineCli`, `runEngineCli` (§11.2 exit codes) |

## Scripts

```bash
pnpm --filter @corpdk/engine-kit build
pnpm --filter @corpdk/engine-kit test
pnpm --filter @corpdk/engine-kit check:publish-order   # after build
```

The publish-order guard runs in [`.github/scripts/publish-ds-automation.sh`](../../.github/scripts/publish-ds-automation.sh) before lockstep publish.

## Dependencies

Runtime: `@clack/prompts`, `yaml` only.