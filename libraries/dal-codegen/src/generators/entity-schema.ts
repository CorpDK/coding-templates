import {
  GraphQLBoolean,
  GraphQLID,
  GraphQLInputObjectType,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLEnumType,
  GraphQLString,
  GraphQLUnionType,
  type GraphQLFieldConfigMap,
  type GraphQLInputFieldConfigMap,
  type GraphQLInputType,
  type GraphQLNamedType,
  type GraphQLOutputType,
} from "graphql";
import type { ColumnModel, EntityModel, RelationModel } from "../model.js";
import {
  filterForColumn,
  filterableColumns,
  scalarForColumn,
  toSortEnumMember,
  visibleOutputColumns,
} from "./schema-utils.js";
import {
  type SchemaRegistry,
  registryType,
  registryTypeRef,
} from "./schema-registry.js";

export interface EntitySchemaBundle {
  types: GraphQLNamedType[];
  queryFields: GraphQLFieldConfigMap<unknown, unknown>;
  mutationFields: GraphQLFieldConfigMap<unknown, unknown>;
  subscriptionFields: GraphQLFieldConfigMap<unknown, unknown>;
}

function columnOutputType(registry: SchemaRegistry, col: ColumnModel): GraphQLOutputType {
  const scalar = scalarForColumn(col);
  return registryTypeRef(registry, `${scalar}${col.notNull ? "!" : ""}`) as GraphQLOutputType;
}

function columnInputType(
  registry: SchemaRegistry,
  col: ColumnModel,
  required: boolean,
): GraphQLInputType {
  const scalar = scalarForColumn(col);
  return registryTypeRef(registry, `${scalar}${required ? "!" : ""}`) as GraphQLInputType;
}

function buildSortEnum(entity: EntityModel, outputCols: ColumnModel[]): GraphQLEnumType {
  return new GraphQLEnumType({
    name: `${entity.graphqlType}Field`,
    description: `Sortable fields on ${entity.graphqlType}.`,
    values: Object.fromEntries(
      outputCols.map((col) => [
        toSortEnumMember(col.graphqlName),
        { value: toSortEnumMember(col.graphqlName), description: col.comment || undefined },
      ]),
    ),
  });
}

function buildAssociationFilter(
  rel: RelationModel,
  registry: SchemaRegistry,
): GraphQLInputObjectType {
  const name = `${rel.targetGraphqlType}AssociationFilter`;
  const targetFilterName = `${rel.targetGraphqlType}Filter`;
  return new GraphQLInputObjectType({
    name,
    description: `Association filter for ${rel.fieldName} (${rel.kind}).`,
    fields: {
      some: {
        type: registryType(registry, targetFilterName) as GraphQLInputObjectType,
        description: "At least one related row matches.",
      },
      every: {
        type: registryType(registry, targetFilterName) as GraphQLInputObjectType,
        description: "All related rows match.",
      },
      none: {
        type: registryType(registry, targetFilterName) as GraphQLInputObjectType,
        description: "No related rows match.",
      },
    },
  });
}

function buildEntityFilter(
  entity: EntityModel,
  registry: SchemaRegistry,
): GraphQLInputObjectType {
  const filterName = `${entity.graphqlType}Filter`;
  let filterType: GraphQLInputObjectType;

  filterType = new GraphQLInputObjectType({
    name: filterName,
    description: `Filter criteria for ${entity.graphqlType} queries and mutations.`,
    fields: (): GraphQLInputFieldConfigMap => {
      const columnFields: GraphQLInputFieldConfigMap = {};
      for (const col of filterableColumns(entity)) {
        columnFields[col.graphqlName] = {
          type: registryType(registry, filterForColumn(col)) as GraphQLInputObjectType,
          description: col.comment || undefined,
        };
      }
      for (const rel of entity.relations) {
        if (!rel.filterable) continue;
        if (rel.kind === "many-to-one" || rel.kind === "one-to-one") {
          columnFields[rel.fieldName] = {
            type: registryType(registry, `${rel.targetGraphqlType}Filter`) as GraphQLInputObjectType,
            description: `Filter via ${rel.fieldName} relation.`,
          };
        } else if (rel.kind === "one-to-many" || rel.kind === "many-to-many") {
          const assocName = `${rel.targetGraphqlType}AssociationFilter`;
          if (!registry.types.has(assocName)) {
            registry.types.set(assocName, buildAssociationFilter(rel, registry));
          }
          columnFields[rel.fieldName] = {
            type: registryType(registry, assocName) as GraphQLInputObjectType,
            description: `Association filter on ${rel.fieldName}.`,
          };
        }
      }
      return {
        and: {
          type: new GraphQLList(new GraphQLNonNull(filterType)),
          description: "All nested filters must match.",
        },
        or: {
          type: new GraphQLList(new GraphQLNonNull(filterType)),
          description: "At least one nested filter must match.",
        },
        not: {
          type: filterType,
          description: "Negates the nested filter.",
        },
        ...columnFields,
      };
    },
  });

  registry.types.set(filterName, filterType);
  return filterType;
}

export function buildEntitySchema(
  entity: EntityModel,
  registry: SchemaRegistry,
  options?: { scalarsOnly?: boolean },
): EntitySchemaBundle {
  const outputCols = visibleOutputColumns(entity);
  const businessCols = entity.columns.filter((c) => c.isBusiness);
  const types: GraphQLNamedType[] = [];

  const objectType = new GraphQLObjectType({
    name: entity.graphqlType,
    description: entity.tableComment || undefined,
    fields: () => {
      const scalarFields = Object.fromEntries(
        outputCols.map((col) => [
          col.graphqlName,
          {
            type: columnOutputType(registry, col),
            description: col.comment || undefined,
          },
        ]),
      );
      if (options?.scalarsOnly) return scalarFields;
      const navFields = Object.fromEntries(
        (entity.relations ?? []).map((rel) => {
          const targetType = registryType(registry, rel.targetGraphqlType);
          const outputType = rel.navigationList
            ? new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(targetType)))
            : rel.navigationNullable
              ? targetType
              : new GraphQLNonNull(targetType);
          return [
            rel.fieldName,
            {
              type: outputType as GraphQLOutputType,
              description: `Navigate to related ${rel.targetGraphqlType}.`,
            },
          ];
        }),
      );
      return { ...scalarFields, ...navFields };
    },
  });
  types.push(objectType);

  if (options?.scalarsOnly) {
    return { types, queryFields: {}, mutationFields: {}, subscriptionFields: {} };
  }

  const sortEnum = buildSortEnum(entity, outputCols);
  types.push(sortEnum);

  const sortInput = new GraphQLInputObjectType({
    name: `${entity.graphqlType}SortInput`,
    description: `Sort specification for ${entity.graphqlType} list queries.`,
    fields: {
      field: { type: new GraphQLNonNull(sortEnum) },
      direction: {
        type: registry.sortDirection,
        defaultValue: "ASC",
        description: "Sort direction; defaults to ascending.",
      },
    },
  });
  types.push(sortInput);

  const filterInput = buildEntityFilter(entity, registry);
  types.push(filterInput);

  const createInput = new GraphQLInputObjectType({
    name: `${entity.graphqlType}CreateInput`,
    description: `Input for creating a new ${entity.graphqlType}.`,
    fields: Object.fromEntries(
      businessCols.map((col) => [
        col.graphqlName,
        {
          type: columnInputType(registry, col, col.notNull && !col.hasDefault),
          description: col.comment || undefined,
          ...(col.kind === "enum" && col.defaultValue !== undefined ?
            { defaultValue: col.defaultValue }
          : {}),
        },
      ]),
    ),
  });
  types.push(createInput);

  let updateInput: GraphQLInputObjectType | undefined;
  if (entity.auditProfile === "full") {
    updateInput = new GraphQLInputObjectType({
      name: `${entity.graphqlType}UpdateInput`,
      description: `Input for updating an existing ${entity.graphqlType}; all fields optional.`,
      fields: Object.fromEntries(
        businessCols.map((col) => [
          col.graphqlName,
          {
            type: columnInputType(registry, col, false),
            description: col.comment || undefined,
          },
        ]),
      ),
    });
    types.push(updateInput);
  }

  const edgeType = new GraphQLObjectType({
    name: `${entity.graphqlType}Edge`,
    description: `Edge wrapper for ${entity.graphqlType} connection pagination.`,
    fields: {
      node: { type: new GraphQLNonNull(objectType) },
      cursor: { type: new GraphQLNonNull(GraphQLString) },
    },
  });
  types.push(edgeType);

  const connectionType = new GraphQLObjectType({
    name: `${entity.graphqlType}Connection`,
    description: `Relay-style connection for paginated ${entity.listField} queries.`,
    fields: {
      edges: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(edgeType))) },
      nodes: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(objectType))) },
      pageInfo: { type: new GraphQLNonNull(registry.pageInfo) },
    },
  });
  types.push(connectionType);

  const createPayload = new GraphQLObjectType({
    name: `Create${entity.graphqlType}Payload`,
    description: `Result of create${entity.graphqlType} mutation.`,
    fields: {
      [entity.fieldBasename]: { type: objectType },
      userErrors: {
        type: new GraphQLNonNull(
          new GraphQLList(new GraphQLNonNull(registry.mutationUserError)),
        ),
      },
    },
  });
  types.push(createPayload);

  const updatePayload = new GraphQLObjectType({
    name: `Update${entity.graphqlType}Payload`,
    description: `Result of update${entity.graphqlType} mutation.`,
    fields: {
      [entity.fieldBasename]: { type: objectType },
      userErrors: {
        type: new GraphQLNonNull(
          new GraphQLList(new GraphQLNonNull(registry.mutationUserError)),
        ),
      },
    },
  });
  types.push(updatePayload);

  const deletePayload = new GraphQLObjectType({
    name: `Delete${entity.graphqlType}Payload`,
    description: `Result of delete${entity.graphqlType} mutation.`,
    fields: {
      success: { type: new GraphQLNonNull(GraphQLBoolean) },
      userErrors: {
        type: new GraphQLNonNull(
          new GraphQLList(new GraphQLNonNull(registry.mutationUserError)),
        ),
      },
    },
  });
  types.push(deletePayload);

  const changeEvent = new GraphQLObjectType({
    name: `${entity.graphqlType}ChangeEvent`,
    description: `Change notification payload for ${entity.fieldBasename} subscriptions.`,
    fields: {
      operation: { type: new GraphQLNonNull(registry.changeOperation) },
      ids: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLID))) },
      isTruncated: { type: new GraphQLNonNull(GraphQLBoolean) },
      count: { type: new GraphQLNonNull(GraphQLInt) },
    },
  });
  types.push(changeEvent);

  const aggregateType = new GraphQLObjectType({
    name: `${entity.graphqlType}Aggregate`,
    description: `Aggregate metrics for ${entity.graphqlType}.`,
    fields: {
      count: { type: new GraphQLNonNull(GraphQLInt) },
    },
  });
  types.push(aggregateType);

  const includeDeletedArg = {
    type: GraphQLBoolean,
    description: "When true, include soft-deleted rows.",
  };

  const queryFields: GraphQLFieldConfigMap<unknown, unknown> = {
    [entity.listField]: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(objectType))),
      description: `Returns ${entity.listField} matching the filter.`,
      args: {
        filter: { type: filterInput },
        sort: { type: new GraphQLList(new GraphQLNonNull(sortInput)) },
        limit: { type: GraphQLInt, defaultValue: 100 },
        includeDeleted: includeDeletedArg,
      },
    },
    [entity.fieldBasename]: {
      type: objectType,
      description: `Returns a single ${entity.fieldBasename} by ID.`,
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
        includeDeleted: includeDeletedArg,
      },
    },
    [`${entity.fieldBasename}Connection`]: {
      type: new GraphQLNonNull(connectionType),
      description: `Relay connection for paginated ${entity.listField} queries.`,
      args: {
        filter: { type: filterInput },
        sort: { type: new GraphQLList(new GraphQLNonNull(sortInput)) },
        first: { type: GraphQLInt },
        after: { type: GraphQLString },
        last: { type: GraphQLInt },
        before: { type: GraphQLString },
        includeDeleted: includeDeletedArg,
      },
    },
    [`${entity.listField}Count`]: {
      type: new GraphQLNonNull(GraphQLInt),
      description: `Count of ${entity.listField} matching the filter.`,
      args: {
        filter: { type: filterInput },
        includeDeleted: includeDeletedArg,
      },
    },
    [`${entity.fieldBasename}Aggregate`]: {
      type: new GraphQLNonNull(aggregateType),
      description: `Aggregate metrics for ${entity.listField} matching the filter.`,
      args: {
        filter: { type: filterInput },
        includeDeleted: includeDeletedArg,
      },
    },
  };

  const mutationFields: GraphQLFieldConfigMap<unknown, unknown> = {
    [`create${entity.graphqlType}`]: {
      type: new GraphQLNonNull(createPayload),
      description: `Creates a new ${entity.graphqlType}.`,
      args: {
        input: { type: new GraphQLNonNull(createInput) },
      },
    },
    [`delete${entity.graphqlType}`]: {
      type: new GraphQLNonNull(deletePayload),
      description: `Deletes an ${entity.graphqlType} by ID.`,
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
      },
    },
  };

  if (updateInput) {
    mutationFields[`update${entity.graphqlType}`] = {
      type: new GraphQLNonNull(updatePayload),
      description: `Updates an existing ${entity.graphqlType} by ID.`,
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
        input: { type: new GraphQLNonNull(updateInput) },
      },
    };
  }

  const listPayload = new GraphQLObjectType({
    name: `${entity.graphqlType}ListPayload`,
    description: `Bulk create/update success payload for ${entity.graphqlType}.`,
    fields: {
      items: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(objectType))) },
    },
  });
  types.push(listPayload);

  const bulkDeleteCountPayload = new GraphQLObjectType({
    name: `BulkDelete${entity.graphqlType}CountPayload`,
    description: `Bulk delete success count for ${entity.graphqlType}.`,
    fields: {
      count: { type: new GraphQLNonNull(GraphQLInt) },
    },
  });
  types.push(bulkDeleteCountPayload);

  const bulkCreateUnion = new GraphQLUnionType({
    name: `BulkCreate${entity.graphqlType}Result`,
    description: `Bulk create result for ${entity.graphqlType}.`,
    types: [listPayload, registry.bulkMutationResult],
    resolveType: (value: { items?: unknown[]; successCount?: number }) =>
      value.items ? `${entity.graphqlType}ListPayload` : "BulkMutationResult",
  });
  types.push(bulkCreateUnion);

  const bulkUpdateUnion = new GraphQLUnionType({
    name: `BulkUpdate${entity.graphqlType}Result`,
    description: `Bulk update result for ${entity.graphqlType}.`,
    types: [listPayload, registry.bulkMutationResult],
    resolveType: (value: { items?: unknown[]; successCount?: number }) =>
      value.items ? `${entity.graphqlType}ListPayload` : "BulkMutationResult",
  });
  types.push(bulkUpdateUnion);

  const bulkDeleteUnion = new GraphQLUnionType({
    name: `BulkDelete${entity.graphqlType}Result`,
    description: `Bulk delete result for ${entity.graphqlType}.`,
    types: [bulkDeleteCountPayload, registry.bulkMutationResult],
    resolveType: (value: { count?: number; successCount?: number }) =>
      value.count != null ? `BulkDelete${entity.graphqlType}CountPayload` : "BulkMutationResult",
  });
  types.push(bulkDeleteUnion);

  if (updateInput) {
    const updateEntry = new GraphQLInputObjectType({
      name: `${entity.graphqlType}UpdateEntry`,
      description: `Single row update entry for bulk update.`,
      fields: {
        id: { type: new GraphQLNonNull(GraphQLID) },
        input: { type: new GraphQLNonNull(updateInput) },
      },
    });
    types.push(updateEntry);

    mutationFields[`bulkUpdate${entity.graphqlType}`] = {
      type: new GraphQLNonNull(bulkUpdateUnion),
      description: `Bulk update ${entity.listField} by ID list.`,
      args: {
        updates: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(updateEntry))) },
        atomic: { type: GraphQLBoolean },
      },
    };

    mutationFields[`bulkUpdate${entity.graphqlType}ByFilter`] = {
      type: new GraphQLNonNull(registry.bulkMutationResult),
      description: `Bulk update ${entity.listField} matching filter (always atomic).`,
      args: {
        filter: { type: new GraphQLNonNull(filterInput) },
        input: { type: new GraphQLNonNull(updateInput) },
        confirmUpdateAll: { type: GraphQLBoolean },
      },
    };
  }

  mutationFields[`bulkCreate${entity.graphqlType}`] = {
    type: new GraphQLNonNull(bulkCreateUnion),
    description: `Bulk create ${entity.listField}.`,
    args: {
      inputs: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(createInput))) },
      atomic: { type: GraphQLBoolean },
    },
  };

  mutationFields[`bulkDelete${entity.graphqlType}`] = {
    type: new GraphQLNonNull(bulkDeleteUnion),
    description: `Bulk delete ${entity.listField} by ID list.`,
    args: {
      ids: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLID))) },
      atomic: { type: GraphQLBoolean },
    },
  };

  mutationFields[`bulkDelete${entity.graphqlType}ByFilter`] = {
    type: new GraphQLNonNull(registry.bulkMutationResult),
    description: `Bulk delete ${entity.listField} matching filter (always atomic).`,
    args: {
      filter: { type: new GraphQLNonNull(filterInput) },
      confirmDeleteAll: { type: GraphQLBoolean },
    },
  };

  const subscriptionFields: GraphQLFieldConfigMap<unknown, unknown> = {
    [`${entity.fieldBasename}Changed`]: {
      type: new GraphQLNonNull(changeEvent),
      description: `Subscribe to ${entity.fieldBasename} create/update/delete events.`,
      args: {
        subscribeTo: {
          type: new GraphQLList(new GraphQLNonNull(registry.changeOperation)),
        },
      },
    },
  };

  return { types, queryFields, mutationFields, subscriptionFields };
}
