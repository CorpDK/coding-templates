import {
  type GraphQLField,
  type GraphQLObjectType,
  type GraphQLSchema,
  type GraphQLOutputType,
  getNamedType,
  isEnumType,
  isInterfaceType,
  isListType,
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

function forcedStubFieldsFromConfig(
  typeName: string,
  lookupConfig: SelectionConfig["lookup"],
): string[] | null {
  return forcedStubFields(typeName, lookupConfig);
}
import { toKebabCase } from "./naming.js";

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

export function findFocusEntity(
  schema: GraphQLSchema,
  returnType: GraphQLOutputType,
  lookupIndex: LookupIndex,
  lookupConfig: SelectionConfig["lookup"],
  operationField?: string,
): string | null {
  const named = getNamedType(returnType);

  if (isUnionType(named) || isInterfaceType(named)) {
    return null;
  }

  if (isObjectType(named)) {
    if (isEntityType(schema, named.name, lookupIndex, lookupConfig)) {
      return named.name;
    }

    if (isConnectionType(named.name, schema)) {
      const nodes = named.getFields().nodes;
      if (nodes) {
        const item = getNamedType(nodes.type);
        if (isObjectType(item) && isEntityType(schema, item.name, lookupIndex, lookupConfig)) {
          return item.name;
        }
      }
    }

    const payloadLike =
      named.name.endsWith("Payload") ||
      named.name.endsWith("Result") ||
      named.name.endsWith("Connection");
    if (payloadLike) {
      for (const [fieldName, field] of Object.entries(named.getFields())) {
        if (isListType(field.type)) continue;
        const child = getNamedType(field.type);
        if (!isObjectType(child)) continue;
        if (!isEntityType(schema, child.name, lookupIndex, lookupConfig)) continue;

        const typeField =
          child.name.charAt(0).toLowerCase() + child.name.slice(1);
        if (fieldName === typeField) return child.name;
        if (operationField && fieldName === operationField) return child.name;
      }
    }
  }

  return null;
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
  const forced = forcedStubFieldsFromConfig(typeName, ctx.config.lookup);
  if (!command && !forced) return;
  const flags: Record<string, string> = {};
  for (const f of stubFields) {
    flags[f] = `--${toKebabCase(f)}`;
  }
  ctx.followUps.push({
    path,
    type: typeName,
    command: command ?? "",
    flags,
  });
}

function stubSelection(stubFields: string[]): SelectionTree {
  const out: SelectionTree = {};
  for (const f of stubFields) out[f] = true;
  return out;
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

function selectObject(
  ctx: EmitCtx,
  objectType: GraphQLObjectType,
  parentPath: string,
): SelectionTree {
  const typeName = objectType.name;
  const lookupConfig = ctx.config.lookup ?? {};

  if (ctx.pathStack.includes(typeName)) {
    ctx.warnings.push(
      `Cycle at embedded type ${typeName} on operation ${ctx.operationField}; selecting __typename only`,
    );
    return { __typename: true };
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
      return { __typename: true };
    }
  }

  const insideFocus =
    ctx.insideFocusEntity || typeName === ctx.focusEntity;
  const childCtx: EmitCtx = {
    ...ctx,
    pathStack: [...ctx.pathStack, typeName],
    wrapperDepth,
    insideFocusEntity: insideFocus,
    parentPath,
  };

  const tree: SelectionTree = {};
  const atOperationRoot = parentPath === "" && !ctx.insideFocusEntity;

  const connectionRoot =
    isConnectionType(typeName, ctx.schema) && parentPath === "";
  const connectionMode = ctx.config.connection ?? "nodes";

  for (const [fieldName, field] of Object.entries(objectType.getFields())) {
    const fieldPath = parentPath ? `${parentPath}.${fieldName}` : fieldName;

    if (
      connectionRoot &&
      ((fieldName === "edges" && connectionMode === "nodes") ||
        (fieldName === "nodes" && connectionMode === "edges"))
    ) {
      continue;
    }

    if (fieldHasRequiredArgs(field) && !atOperationRoot) continue;

    if (isLeafType(field.type)) {
      tree[fieldName] = true;
      continue;
    }

    const expandOverride = ctx.expandFields.has(fieldName);

    if (isConnectionField(ctx.schema, field) && parentPath !== "") {
      if (!expandOverride) {
        ctx.warnings.push(
          `Nested connection "${fieldPath}" skipped on ${ctx.operationField}`,
        );
        continue;
      }
    }

    if (isConnectionField(ctx.schema, field)) {
      tree[fieldName] = selectConnection(childCtx, field, fieldPath);
      continue;
    }

    const named = getNamedType(field.type);
  const list = isListType(field.type);

    if (isUnionType(named) || isInterfaceType(named)) {
      tree[fieldName] = selectAbstract(
        { ...childCtx, parentPath: fieldPath },
        named,
      );
      continue;
    }

    if (!isObjectType(named)) continue;

    const entity = isEntityType(
      ctx.schema,
      named.name,
      ctx.lookupIndex,
      lookupConfig,
    );

    if (entity) {
      const forcedStub = forcedStubFieldsFromConfig(
        named.name,
        lookupConfig,
      );
      const stubFields = resolveEntityStubFields(
        ctx.schema,
        named.name,
        ctx.lookupIndex,
        lookupConfig,
      );

      const reachingFocus = named.name === ctx.focusEntity;
      const forceExpand =
        expandOverride && ctx.operationField in (ctx.config.overrides ?? {});

      if (forcedStub && !reachingFocus && !forceExpand) {
        tree[fieldName] = stubSelection(forcedStub);
        pushFollowUp(ctx, fieldPath, named.name, forcedStub);
      } else if (insideFocus && !forceExpand) {
        tree[fieldName] = stubSelection(stubFields);
        pushFollowUp(ctx, fieldPath, named.name, stubFields);
      } else if (reachingFocus || forceExpand) {
        tree[fieldName] = selectObject(
          { ...childCtx, insideFocusEntity: true, parentPath: fieldPath },
          named,
          fieldPath,
        );
      } else {
        tree[fieldName] = stubSelection(stubFields);
        pushFollowUp(ctx, fieldPath, named.name, stubFields);
      }
      void list;
      continue;
    }

    tree[fieldName] = selectObject(
      { ...childCtx, parentPath: fieldPath },
      named,
      fieldPath,
    );
  }

  return tree;
}

function selectConnection(
  ctx: EmitCtx,
  field: GraphQLField<unknown, unknown>,
  fieldPath: string,
): SelectionTree {
  const connectionType = getNamedType(field.type) as GraphQLObjectType;
  const conn: SelectionTree = {};
  const mode = ctx.config.connection ?? "nodes";

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
  } else if (mode === "edges" && connectionType.getFields().edges) {
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

  for (const [name, cf] of Object.entries(connectionType.getFields())) {
    if (name === "nodes" || name === "edges") continue;
    if (isLeafType(cf.type)) {
      conn[name] = true;
    } else {
      const cn = getNamedType(cf.type);
      if (isObjectType(cn)) {
        conn[name] = selectObject(
          { ...ctx, parentPath: `${fieldPath}.${name}` },
          cn,
          `${fieldPath}.${name}`,
        );
      }
    }
  }

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
    insideFocusEntity:
      isObjectType(named) && focusEntity === named.name,
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