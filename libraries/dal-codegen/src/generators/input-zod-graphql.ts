import {
  emitGraphqlInputZodBlocks as emitBlocks,
  type GraphqlInputZodEmit,
} from "@corpdk/graphql-input-zod/codegen";
import type { EntityModel } from "../model.js";
import { buildDalGraphQLSchema } from "./schema-builder.js";
import { DAL_SCALAR_ZOD_BY_NAME } from "./input-zod-scalars.js";

export type { GraphqlInputZodEmit };

export function entityCreateUpdateSkipSet(
  entities: EntityModel[],
): Set<string> {
  const skip = new Set<string>();
  for (const entity of entities) {
    skip.add(`${entity.graphqlType}CreateInput`);
    if (entity.auditProfile === "full") {
      skip.add(`${entity.graphqlType}UpdateInput`);
    }
  }
  return skip;
}

/** DAL wiring: spec emitter with inline DAL scalar refs and PG built-in overrides (R-10). */
export function emitGraphqlInputZodBlocks(
  entities: EntityModel[],
  skipTypeNames: ReadonlySet<string>,
): GraphqlInputZodEmit {
  const schema = buildDalGraphQLSchema(entities);
  return emitBlocks(schema, {
    scalars: DAL_SCALAR_ZOD_BY_NAME,
    builtinScalars: {
      ID: "z.string().uuid()",
      Int: "zPgInt32",
      Float: "zPgReal",
    },
    scalarReferences: "inline",
    skipTypeNames,
  });
}
