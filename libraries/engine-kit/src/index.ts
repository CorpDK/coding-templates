export {
  EXIT_SUCCESS,
  EXIT_TOOL,
  EXIT_USAGE,
  EXIT_VALIDATION,
  type EngineExitCode,
  type EngineResult,
  type Reporter,
} from "./types.js";

export {
  copyDir,
  pathExists,
  readJson,
  writeJson,
  type CopyDirOptions,
} from "./fs.js";

export {
  mergePackageJson,
  mergeYamlConfig,
  type MergePackageJsonOptions,
} from "./merge.js";

export {
  engineRootFromImportMeta,
  initialCalVer,
  isBundledCanonical,
  readEngineRelease,
  resolveCanonical,
  type ResolveCanonicalOptions,
} from "./template.js";

export {
  runUpgradePlan,
  writeEngineVersion,
  type RunUpgradePlanOptions,
  type UpgradeMergeHandler,
  type UpgradePlanResult,
} from "./upgrade.js";

export {
  checkCanonical,
  syncCanonical,
  type CanonicalCheckOptions,
  type CanonicalCheckResult,
  type CanonicalSyncOptions,
} from "./canonical.js";

export {
  checkPublishOrder,
  DS_AUTOMATION_PACKAGE_JSON_PATH,
  DS_AUTOMATION_PUBLISH_ORDER,
  DS_AUTOMATION_TRUSTED_PACKAGES,
  type PackageRef,
  type PublishOrderGuardOptions,
  type PublishOrderGuardResult,
} from "./publish.js";

export {
  parseEngineCli,
  runEngineCli,
  runEngineCli as defineEngineCli,
  type DefineEngineCliOptions,
  type EngineCommandDef,
  type EngineCommandHandler,
  type ParsedEngineCli,
} from "./cli.js";