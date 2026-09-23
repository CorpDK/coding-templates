import type { EntityModel } from "../model.js";

function targetRepoBasename(rel: EntityModel["relations"][number], entities: EntityModel[]): string {
  const target = entities.find((e) => e.exportName === rel.targetExportName);
  return target?.fieldBasename ?? rel.targetExportName;
}

function generateLoaderSetup(entities: EntityModel[]): string {
  const setupLines: string[] = [];

  for (const entity of entities) {
    for (const rel of entity.relations) {
      const loaderKey = `${entity.fieldBasename}_${rel.fieldName}`;

      if ((rel.kind === "many-to-one" || rel.kind === "one-to-one") && rel.ownerFkDrizzleKey) {
        const targetRepo = targetRepoBasename(rel, entities);
        setupLines.push(`  ctxRef.loaders.${loaderKey} = new DataLoader<string, unknown>(async (ids) => {
    const rows = await ctxRef.repositories.${targetRepo}.findByIds([...ids]);
    const map = new Map<string, unknown>();
    for (const row of rows) map.set(row.id as string, row);
    return map;
  });`);
      } else if (rel.kind === "one-to-many") {
        const childRepo = targetRepoBasename(rel, entities);
        const parentType = entity.graphqlType;
        setupLines.push(`  ctxRef.loaders.${loaderKey} = new DataLoader<string, unknown[]>(async (parentIds) => {
    const grouped = await ctxRef.repositories.${childRepo}.findBy${parentType}Ids([...parentIds]);
    const map = new Map<string, unknown[]>();
    for (const pid of parentIds) map.set(pid, grouped.get(pid) ?? []);
    return map;
  });`);
      } else if (rel.kind === "many-to-many") {
        const targetType = rel.targetGraphqlType;
        setupLines.push(`  ctxRef.loaders.${loaderKey} = new DataLoader<string, unknown[]>(async (parentIds) => {
    const grouped = await ctxRef.repositories.${entity.fieldBasename}.find${targetType}sBy${entity.graphqlType}Ids([...parentIds]);
    const map = new Map<string, unknown[]>();
    for (const pid of parentIds) map.set(pid, grouped.get(pid) ?? []);
    return map;
  });`);
      } else if (rel.kind === "one-to-one" && !rel.ownerFkDrizzleKey) {
        const childRepo = targetRepoBasename(rel, entities);
        const parentType = entity.graphqlType;
        setupLines.push(`  ctxRef.loaders.${loaderKey} = new DataLoader<string, unknown>(async (parentIds) => {
    const grouped = await ctxRef.repositories.${childRepo}.findOneBy${parentType}Ids([...parentIds]);
    const map = new Map<string, unknown>();
    for (const pid of parentIds) map.set(pid, grouped.get(pid) ?? null);
    return map;
  });`);
      }
    }
  }

  return setupLines.join("\n\n");
}

function generateFieldResolvers(entities: EntityModel[]): string {
  const blocks: string[] = [];

  for (const entity of entities) {
    if (entity.relations.length === 0) continue;
    const resolverFields: string[] = [];

    for (const rel of entity.relations) {
      const loaderKey = `${entity.fieldBasename}_${rel.fieldName}`;
      if (rel.kind === "many-to-one" || rel.kind === "one-to-one") {
        const fkField =
          rel.ownerFkGraphqlName ??
          entity.columns.find((c) => c.drizzleKey === rel.ownerFkDrizzleKey)?.graphqlName;
        if (!fkField && rel.kind === "many-to-one") continue;
        if (rel.kind === "one-to-one" && !fkField) {
          resolverFields.push(`    ${rel.fieldName}: (parent: Record<string, unknown>, _: unknown, ctx: DalContext) =>
      ctx.loaders.${loaderKey}!.load(parent.id as string),`);
          continue;
        }
        resolverFields.push(`    ${rel.fieldName}: (parent: Record<string, unknown>, _: unknown, ctx: DalContext) => {
      const fk = parent.${fkField} as string | null | undefined;
      if (fk == null) return null;
      return ctx.loaders.${loaderKey}!.load(fk);
    },`);
      } else if (rel.kind === "one-to-many" || rel.kind === "many-to-many") {
        resolverFields.push(`    ${rel.fieldName}: (parent: Record<string, unknown>, _: unknown, ctx: DalContext) => {
      const id = parent.id as string;
      return ctx.loaders.${loaderKey}!.load(id);
    },`);
      }
    }

    if (resolverFields.length === 0) continue;
    blocks.push(`  ${entity.graphqlType}: {
${resolverFields.join("\n")}
  },`);
  }

  return blocks.join("\n\n");
}

export function generateResolvers(entities: EntityModel[]): string {
  const queryFields: string[] = [];
  const mutationFields: string[] = [];
  const subscriptionFields: string[] = [];

  for (const entity of entities) {
    const E = entity.graphqlType;
    const e = entity.fieldBasename;
    const list = entity.listField;
    const full = entity.auditProfile === "full";
    const topic = `${e.toUpperCase()}_CHANGED`;

    queryFields.push(`    ${list}: (_: unknown, args: Record<string, unknown>, ctx: DalContext, info: GraphQLResolveInfo) =>
      ctx.repositories.${e}.list(
        {
          filter: args.filter as never,
          sort: args.sort as never,
          limit: args.limit as number | null,
          includeDeleted: args.includeDeleted as boolean | null,
        },
        info,
      ),

    ${e}: (_: unknown, args: { id: string; includeDeleted?: boolean | null }, ctx: DalContext, info: GraphQLResolveInfo) =>
      ctx.repositories.${e}.findById(args.id, { includeDeleted: args.includeDeleted }, info),

    ${e}Connection: (_: unknown, args: Record<string, unknown>, ctx: DalContext, info: GraphQLResolveInfo) =>
      ctx.repositories.${e}.listConnection(
        {
          filter: args.filter as never,
          sort: args.sort as never,
          first: args.first as number | null,
          after: args.after as string | null,
          last: args.last as number | null,
          before: args.before as string | null,
          includeDeleted: args.includeDeleted as boolean | null,
        },
        info,
      ),

    ${list}Count: (_: unknown, args: Record<string, unknown>, ctx: DalContext) =>
      ctx.repositories.${e}.count({
        filter: args.filter as never,
        includeDeleted: args.includeDeleted as boolean | null,
      }),

    ${e}Aggregate: async (_: unknown, args: Record<string, unknown>, ctx: DalContext) => ({
      count: await ctx.repositories.${e}.count({
        filter: args.filter as never,
        includeDeleted: args.includeDeleted as boolean | null,
      }),
    }),`);

    mutationFields.push(`    create${E}: async (_: unknown, args: { input: Record<string, unknown> }, ctx: DalContext) => {
      const result = await ctx.repositories.${e}.create(args.input as never, { actorId: ctx.actorId });
      if (result.${e} && result.userErrors.length === 0) {
        const event = ctx.repositories.${e}.toChangeEvent("CREATED", [result.${e}.id]);
        ctx.pubsub.publish("${topic}", { ${e}Changed: event });
      }
      return result;
    },

    bulkCreate${E}: async (_: unknown, args: { inputs: Record<string, unknown>[]; atomic?: boolean | null }, ctx: DalContext) => {
      const result = await ctx.repositories.${e}.bulkCreate(args.inputs as never, { actorId: ctx.actorId }, args.atomic);
      if ("items" in result && result.items.length > 0) {
        const event = ctx.repositories.${e}.toChangeEvent("CREATED", result.items.map((row) => row.id));
        ctx.pubsub.publish("${topic}", { ${e}Changed: event });
      } else if ("successCount" in result && result.successCount > 0 && "matchedIds" in result) {
        const matchedIds = result.matchedIds;
        if (matchedIds.length > 0) {
          const event = ctx.repositories.${e}.toChangeEvent("CREATED", matchedIds);
          ctx.pubsub.publish("${topic}", { ${e}Changed: event });
        }
      }
      return result;
    },

    bulkDelete${E}: async (_: unknown, args: { ids: string[]; atomic?: boolean | null }, ctx: DalContext) => {
      const result = await ctx.repositories.${e}.bulkDelete(args.ids, { actorId: ctx.actorId }, args.atomic);
      if ("count" in result && result.count > 0) {
        const event = ctx.repositories.${e}.toChangeEvent("DELETED", args.ids);
        ctx.pubsub.publish("${topic}", { ${e}Changed: event });
      } else if ("successCount" in result && result.successCount > 0 && "matchedIds" in result) {
        const matchedIds = result.matchedIds;
        if (matchedIds.length > 0) {
          const event = ctx.repositories.${e}.toChangeEvent("DELETED", matchedIds);
          ctx.pubsub.publish("${topic}", { ${e}Changed: event });
        }
      }
      return result;
    },

    bulkDelete${E}ByFilter: async (_: unknown, args: { filter: Record<string, unknown>; confirmDeleteAll?: boolean | null }, ctx: DalContext) => {
      const result = await ctx.repositories.${e}.bulkDeleteByFilter(args.filter as never, { actorId: ctx.actorId }, args.confirmDeleteAll);
      const matchedIds = "matchedIds" in result ? result.matchedIds : undefined;
      if (result.successCount > 0 && matchedIds && matchedIds.length > 0) {
        const event = ctx.repositories.${e}.toChangeEvent("DELETED", matchedIds);
        ctx.pubsub.publish("${topic}", { ${e}Changed: event });
      }
      return result;
    },`);

    if (full) {
      mutationFields.push(`    update${E}: async (_: unknown, args: { id: string; input: Record<string, unknown> }, ctx: DalContext) => {
      const result = await ctx.repositories.${e}.update(args.id, args.input as never, { actorId: ctx.actorId });
      if (result.${e} && result.userErrors.length === 0) {
        const event = ctx.repositories.${e}.toChangeEvent("UPDATED", [result.${e}.id]);
        ctx.pubsub.publish("${topic}", { ${e}Changed: event });
      }
      return result;
    },

    bulkUpdate${E}: async (_: unknown, args: { updates: Array<{ id: string; input: Record<string, unknown> }>; atomic?: boolean | null }, ctx: DalContext) => {
      const result = await ctx.repositories.${e}.bulkUpdate(args.updates as never, { actorId: ctx.actorId }, args.atomic);
      if ("items" in result && result.items.length > 0) {
        const event = ctx.repositories.${e}.toChangeEvent("UPDATED", result.items.map((row) => row.id));
        ctx.pubsub.publish("${topic}", { ${e}Changed: event });
      } else if ("successCount" in result && result.successCount > 0 && "matchedIds" in result) {
        const matchedIds = result.matchedIds;
        if (matchedIds.length > 0) {
          const event = ctx.repositories.${e}.toChangeEvent("UPDATED", matchedIds);
          ctx.pubsub.publish("${topic}", { ${e}Changed: event });
        }
      }
      return result;
    },

    bulkUpdate${E}ByFilter: async (_: unknown, args: { filter: Record<string, unknown>; input: Record<string, unknown>; confirmUpdateAll?: boolean | null }, ctx: DalContext) => {
      const result = await ctx.repositories.${e}.bulkUpdateByFilter(args.filter as never, args.input as never, { actorId: ctx.actorId }, args.confirmUpdateAll);
      const matchedIds = "matchedIds" in result ? result.matchedIds : undefined;
      if (result.successCount > 0 && matchedIds && matchedIds.length > 0) {
        const event = ctx.repositories.${e}.toChangeEvent("UPDATED", matchedIds);
        ctx.pubsub.publish("${topic}", { ${e}Changed: event });
      }
      return result;
    },`);
    }

    mutationFields.push(`    delete${E}: async (_: unknown, args: { id: string }, ctx: DalContext) => {
      const result = await ctx.repositories.${e}.delete(args.id, { actorId: ctx.actorId });
      if (result.success && result.userErrors.length === 0) {
        const event = ctx.repositories.${e}.toChangeEvent("DELETED", [args.id]);
        ctx.pubsub.publish("${topic}", { ${e}Changed: event });
      }
      return result;
    },`);

    subscriptionFields.push(`    ${e}Changed: {
      subscribe: async function* (_: unknown, args: { subscribeTo?: string[] | null }, ctx: DalContext) {
        const allowed =
          args.subscribeTo?.length ? new Set(args.subscribeTo) : null;
        for await (const payload of ctx.pubsub.subscribe("${topic}")) {
          const event = payload.${e}Changed;
          if (allowed === null || allowed.has(event.operation)) {
            yield payload;
          }
        }
      },
    },`);
  }

  const loaderSetup = generateLoaderSetup(entities);
  const fieldResolvers = generateFieldResolvers(entities);

  const repoImports =
    entities.length === 0
      ? ""
      : `import {\n${entities.map((e) => `  Generated${e.graphqlType}Repository,`).join("\n")}\n} from "../repositories/index.js";`;

  const repoTypeFields = entities
    .map((e) => `    ${e.fieldBasename}: Generated${e.graphqlType}Repository;`)
    .join("\n");

  const repoInitFields = entities
    .map((e) => `    ${e.fieldBasename}: new Generated${e.graphqlType}Repository(),`)
    .join("\n");

  const scalarBlock = `  DateTime: {
    serialize: (v: unknown) => (v instanceof Date ? v.toISOString() : v),
    parseValue: (v: unknown) => {
      if (typeof v !== "string") throw new TypeError("DateTime must be a string");
      return v;
    },
    parseLiteral: (ast: { kind: string; value?: string }) => {
      if (ast.kind !== Kind.STRING) throw new TypeError("DateTime must be a string");
      return ast.value ?? "";
    },
  },`;

  return `// AUTO-GENERATED by @corpdk/dal-codegen — do not edit
import { Kind, type GraphQLResolveInfo } from "graphql";
import { DataLoader } from "@corpdk/dal-core";
import type { PubSub } from "../generated-pubsub.js";
${repoImports}

export interface DalContext {
  actorId: string | null;
  pubsub: PubSub;
  repositories: {
${repoTypeFields}
  };
  loaders: Record<string, DataLoader<string, unknown> | DataLoader<string, unknown[]>>;
}

export interface CreateDalContextOptions {
  /** Actor ID from auth context; null uses repository "system" fallback. */
  actorId?: string | null;
}

export function createDalContext(pubsub: PubSub, options?: CreateDalContextOptions): DalContext {
  const repositories = {
${repoInitFields}
  };
  const ctxRef = {
    actorId: options?.actorId ?? null,
    pubsub,
    repositories,
    loaders: {} as DalContext["loaders"],
  } as DalContext;

${loaderSetup}

  return ctxRef;
}

export const generatedResolvers = {
${scalarBlock}
  Query: {
    hello: (_: unknown, args: { name?: string | null }): string =>
      \`Hello, \${args.name ?? "world"}!\`,

    status: (): { ok: boolean; timestamp: string } => ({
      ok: true,
      timestamp: new Date().toISOString(),
    }),

${queryFields.join("\n\n")}
  },
  Mutation: {
    ping: (
      _: unknown,
      args: { message: string },
      ctx: DalContext,
    ): { message: string; timestamp: string } => {
      const result = { message: args.message, timestamp: new Date().toISOString() };
      ctx.pubsub.publish("PING_SENT", { pingSent: result });
      return result;
    },

${mutationFields.join("\n\n")}
  },
  Subscription: {
    pingSent: {
      subscribe: (_: unknown, _args: unknown, ctx: DalContext) =>
        ctx.pubsub.subscribe("PING_SENT"),
    },

${subscriptionFields.join("\n\n")}
  },

${fieldResolvers}
};
`;
}
