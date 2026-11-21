import {
  type GraphQLField,
  type GraphQLObjectType,
  type GraphQLSchema,
  type GraphQLOutputType,
  getNamedType,
  isEnumType,
  isInterfaceType,
  isNonNullType,
  isObjectType,
  isScalarType,
  isUnionType,
} from "graphql";
import type {
  FollowUp,
  LookupIndex,
  SelectionConfig,
  SelectionEmitResult,
  SelectionTree,
} from "./types.js";
import {
  forcedStubFields,
  isConnectionField,
  isConnectionType,
  isEntityType,
  lookupCommandForType,
  resolveEntityStubFields,
} from "./lookup-index.js";
import { toKebabCase } from "./naming.js";
import { findFocusEntity } from "./selection-focus.js";

export { findFocusEntity } from "./selection-focus.js";

interface EmitCtx {
  schema: GraphQLSchema;
  lookupIndex: LookupIndex;
  config: SelectionConfig;
  operationField: string;
  focusEntity: string | null;
  expandFields: Set<string>;
  warnings: string[];
  followUps: FollowUp[];
  pathStack: string[];
  wrapperDepth: number;
  insideFocusEntity: boolean;
  parentPath: string;
}

function resolvedConfig(config?: SelectionConfig): SelectionConfig {
  return {
    policy: "relation-ids",
    connection: config?.connection ?? "nodes",
    maxWrapperDepth: config?.maxWrapperDepth ?? 4,
    lookup: config?.lookup ?? {},
    overrides: config?.overrides ?? {},
  };
}

function isLeafType(type: GraphQLOutputType): boolean {
  const named = getNamedType(type);
  return isScalarType(named) || isEnumType(named);
}

function fieldHasRequiredArgs(field: GraphQLField<unknown, unknown>): boolean {
  return field.args.some(
    (a) => isNonNullType(a.type) && a.defaultValue === undefined,
  );
}

function pushFollowUp(
  ctx: EmitCtx,
  path: string,
  typeName: string,
  stubFields: string[],
): void {
  const command = lookupCommandForType(
    ctx.schema,
    typeName,
    ctx.lookupIndex,
    ctx.config.lookup,
  );
  if (!command?.trim()) return;
  const flags: Record<string, string> = {};
  for (const f of stubFields) {
    flags[f] = `--${toKebabCase(f)}`;
  }
  ctx.followUps.push({
    path,
    type: typeName,
    command,
    flags,
  });
}

function stubSelection(stubFields: string[]): SelectionTree {
  const out: SelectionTree = {};
  for (const f of stubFields) out[f] = true;
  return out;
}

function skipRelayOpposite(
  connectionRoot: boolean,
  fieldName: string,
  connectionMode: NonNullable<SelectionConfig["connection"]>,
): boolean {
  if (!connectionRoot) return false;
  return (
    (fieldName === "edges" && connectionMode === "nodes") ||
    (fieldName === "nodes" && connectionMode === "edges")
  );
}

function selectEntityReference(
  ctx: EmitCtx,
  childCtx: EmitCtx,
  fieldPath: string,
  entityType: GraphQLObjectType,
  lookupConfig: SelectionConfig["lookup"],
  expandOverride: boolean,
): SelectionTree {
  const forcedStub = forcedStubFields(entityType.name, lookupConfig);
  const stubFields = resolveEntityStubFields(
    ctx.schema,
    entityType.name,
    ctx.lookupIndex,
    lookupConfig,
  );
  const reachingFocus = entityType.name === ctx.focusEntity;
  const forceExpand =
    expandOverride && ctx.operationField in (ctx.config.overrides ?? {});

  if (reachingFocus || forceExpand) {
    return selectObject(
      { ...childCtx, insideFocusEntity: true, parentPath: fieldPath },
      entityType,
      fieldPath,
    );
  }

  const stub = forcedStub && !reachingFocus ? forcedStub : stubFields;
  pushFollowUp(ctx, fieldPath, entityType.name, stub);
  return stubSelection(stub);
}

function selectAbstract(
  ctx: EmitCtx,
  type: import("graphql").GraphQLAbstractType,
): SelectionTree {
  const tree: SelectionTree = { __typename: true };
  for (const pt of ctx.schema.getPossibleTypes(type)) {
    const fragKey = `on_${pt.name}`;
    tree[fragKey] = selectObject(
      { ...ctx, insideFocusEntity: ctx.focusEntity === pt.name },
      pt,
      ctx.parentPath,
    );
  }
  return tree;
}

function objectSelectionGuard(
  ctx: EmitCtx,
  typeName: string,
  lookupConfig: SelectionConfig["lookup"],
): { stop: SelectionTree } | { childCtx: EmitCtx } {
  if (ctx.pathStack.includes(typeName)) {
    ctx.warnings.push(
      `Cycle at embedded type ${typeName} on operation ${ctx.operationField}; selecting __typename only`,
    );
    return { stop: { __typename: true } };
  }

  const isEmbedded = !isEntityType(
    ctx.schema,
    typeName,
    ctx.lookupIndex,
    lookupConfig,
  );
  const maxDepth = ctx.config.maxWrapperDepth ?? 4;
  let wrapperDepth = ctx.wrapperDepth;
  if (isEmbedded) {
    wrapperDepth += 1;
    if (wrapperDepth > maxDepth) {
      ctx.warnings.push(
        `maxWrapperDepth (${maxDepth}) exceeded at ${typeName} on ${ctx.operationField}; selecting __typename only`,
      );
      return { stop: { __typename: true } };
    }
  }

  const insideFocus = ctx.insideFocusEntity || typeName === ctx.focusEntity;
  return {
    childCtx: {
      ...ctx,
      pathStack: [...ctx.pathStack, typeName],
      wrapperDepth,
      insideFocusEntity: insideFocus,
      parentPath: ctx.parentPath,
    },
  };
}

type AppendObjectFieldInput = {
  ctx: EmitCtx;
  childCtx: EmitCtx;
  tree: SelectionTree;
  parentPath: string;
  fieldName: string;
  field: GraphQLField<unknown, unknown>;
  atOperationRoot: boolean;
  connectionRoot: boolean;
  connectionMode: NonNullable<SelectionConfig["connection"]>;
  lookupConfig: SelectionConfig["lookup"];
};

function appendOneObjectField(input: AppendObjectFieldInput): void {
  const {
    ctx,
    childCtx,
    tree,
    parentPath,
    fieldName,
    field,
    atOperationRoot,
    connectionRoot,
    connectionMode,
    lookupConfig,
  } = input;
  const fieldPath = parentPath ? `${parentPath}.${fieldName}` : fieldName;

  if (skipRelayOpposite(connectionRoot, fieldName, connectionMode)) return;
  if (fieldHasRequiredArgs(field) && !atOperationRoot) return;

  if (isLeafType(field.type)) {
    tree[fieldName] = true;
    return;
  }

  const expandOverride = ctx.expandFields.has(fieldName);

  if (isConnectionField(ctx.schema, field) && parentPath !== "") {
    if (!expandOverride) {
      ctx.warnings.push(
        `Nested connection "${fieldPath}" skipped on ${ctx.operationField}`,
      );
      return;
    }
  }

  if (isConnectionField(ctx.schema, field)) {
    tree[fieldName] = selectConnection(childCtx, field, fieldPath);
    return;
  }

  const named = getNamedType(field.type);

  if (isUnionType(named) || isInterfaceType(named)) {
    tree[fieldName] = selectAbstract(
      { ...childCtx, parentPath: fieldPath },
      named,
    );
    return;
  }

  if (!isObjectType(named)) return;

  if (isEntityType(ctx.schema, named.name, ctx.lookupIndex, lookupConfig)) {
    tree[fieldName] = selectEntityReference(
      ctx,
      childCtx,
      fieldPath,
      named,
      lookupConfig,
      expandOverride,
    );
    return;
  }

  tree[fieldName] = selectObject(
    { ...childCtx, parentPath: fieldPath },
    named,
    fieldPath,
  );
}

function selectObject(
  ctx: EmitCtx,
  objectType: GraphQLObjectType,
  parentPath: string,
): SelectionTree {
  const typeName = objectType.name;
  const lookupConfig = ctx.config.lookup ?? {};
  const guarded = objectSelectionGuard(
    { ...ctx, parentPath },
    typeName,
    lookupConfig,
  );
  if ("stop" in guarded) return guarded.stop;

  const childCtx = { ...guarded.childCtx, parentPath };
  const tree: SelectionTree = {};
  const atOperationRoot = parentPath === "" && !ctx.insideFocusEntity;
  const connectionRoot =
    isConnectionType(typeName, ctx.schema) && parentPath === "";
  const connectionMode = ctx.config.connection ?? "nodes";

  for (const [fieldName, field] of Object.entries(objectType.getFields())) {
    appendOneObjectField({
      ctx,
      childCtx,
      tree,
      parentPath,
      fieldName,
      field,
      atOperationRoot,
      connectionRoot,
      connectionMode,
      lookupConfig,
    });
  }

  return tree;
}

function fillConnectionPrimary(
  ctx: EmitCtx,
  conn: SelectionTree,
  connectionType: GraphQLObjectType,
  fieldPath: string,
  mode: NonNullable<SelectionConfig["connection"]>,
): void {
  if (mode === "nodes" && connectionType.getFields().nodes) {
    const nodes = connectionType.getFields().nodes;
    const itemType = getNamedType(nodes.type);
    if (isObjectType(itemType)) {
      conn.nodes = selectObject(
        {
          ...ctx,
          insideFocusEntity: ctx.focusEntity === itemType.name,
          parentPath: `${fieldPath}.nodes`,
        },
        itemType,
        `${fieldPath}.nodes`,
      );
    }
    return;
  }
  if (mode === "edges" && connectionType.getFields().edges) {
    const edges = connectionType.getFields().edges;
    const edgeType = getNamedType(edges.type);
    if (isObjectType(edgeType)) {
      conn.edges = selectObject(
        { ...ctx, parentPath: `${fieldPath}.edges` },
        edgeType,
        `${fieldPath}.edges`,
      );
    }
  }
}

function fillConnectionScalars(
  ctx: EmitCtx,
  conn: SelectionTree,
  connectionType: GraphQLObjectType,
  fieldPath: string,
): void {
  for (const [name, cf] of Object.entries(connectionType.getFields())) {
    if (name === "nodes" || name === "edges") continue;
    if (isLeafType(cf.type)) {
      conn[name] = true;
      continue;
    }
    const cn = getNamedType(cf.type);
    if (!isObjectType(cn)) continue;
    conn[name] = selectObject(
      { ...ctx, parentPath: `${fieldPath}.${name}` },
      cn,
      `${fieldPath}.${name}`,
    );
  }
}

function selectConnection(
  ctx: EmitCtx,
  field: GraphQLField<unknown, unknown>,
  fieldPath: string,
): SelectionTree {
  const connectionType = getNamedType(field.type) as GraphQLObjectType;
  const conn: SelectionTree = {};
  const mode = ctx.config.connection ?? "nodes";
  fillConnectionPrimary(ctx, conn, connectionType, fieldPath, mode);
  fillConnectionScalars(ctx, conn, connectionType, fieldPath);
  return conn;
}

export function emitSelectionForOperation(
  schema: GraphQLSchema,
  lookupIndex: LookupIndex,
  operationField: string,
  returnType: GraphQLOutputType,
  config?: SelectionConfig,
): SelectionEmitResult {
  const merged = resolvedConfig(config);
  const warnings: string[] = [];
  const followUps: FollowUp[] = [];
  const expandFields = new Set(
    merged.overrides?.[operationField]?.expand ?? [],
  );
  const focusEntity = findFocusEntity(
    schema,
    returnType,
    lookupIndex,
    merged.lookup,
    operationField,
  );

  const named = getNamedType(returnType);
  if (isScalarType(named) || isEnumType(named)) {
    return { selection: {}, followUps, warnings };
  }

  const ctx: EmitCtx = {
    schema,
    lookupIndex,
    config: merged,
    operationField,
    focusEntity,
    expandFields,
    warnings,
    followUps,
    pathStack: [],
    wrapperDepth: 0,
    insideFocusEntity: isObjectType(named) && focusEntity === named.name,
    parentPath: "",
  };

  let selection: SelectionTree;
  if (isUnionType(named) || isInterfaceType(named)) {
    selection = selectAbstract(ctx, named);
  } else if (isObjectType(named)) {
    selection = selectObject(ctx, named, "");
  } else {
    selection = {};
  }

  return { selection, followUps, warnings };
}
