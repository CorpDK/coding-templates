export type {
  ArgDescriptor,
  CommandDescriptor,
  EmitCliModulesOptions,
  EmitCliModulesResult,
  FollowUp,
  GuardConfig,
  IncludeExcludeConfig,
  LookupCandidate,
  LookupIndex,
  LookupOverride,
  ManConfig,
  OperationKind,
  PaginationConfig,
  RuntimeConfig,
  SelectionConfig,
  SelectionEmitResult,
  SelectionLeaf,
  SelectionTree,
  SelectionUnion,
  SelectionValue,
  TransportConfig,
  ExtractedOperation,
} from "./types.js";
export { CodegenError } from "./types.js";

export {
  globMatch,
  isDestructiveMutation,
  operationKey,
  resolveCommandNames,
  resolveReservedArgFlag,
  RESERVED_COMMANDS,
  RESERVED_FLAGS,
  toKebabCase,
} from "./naming.js";

export {
  buildCommandNameMap,
  buildLookupIndex,
  chooseLookup,
  forcedStubFields,
  isConnectionField,
  isConnectionType,
  isEntityType,
  lookupCommandForType,
  resolveEntityStubFields,
  validateLookupConfig,
} from "./lookup-index.js";

export { emitSelectionForOperation, findFocusEntity } from "./selection.js";

export { buildOperationDocument, renderSelectionSet } from "./document.js";
export { extractOperations } from "./extract-operations.js";
export { emitCommandsModule, toCommandDescriptors } from "./emit-catalog.js";
export {
  emitSelectionSource,
  selectionExportName,
} from "./emit-selection-source.js";
export { emitMan } from "./emit-man.js";
export { emitTexi } from "./emit-texi.js";
export { emitCliModules } from "./emit-cli-modules.js";
export { emitRuntimeConfigModule } from "./emit-runtime-config.js";
