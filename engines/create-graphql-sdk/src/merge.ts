import {
  assertValidSchema,
  buildASTSchema,
  parse,
  print,
  type DocumentNode,
  type GraphQLSchema,
} from "graphql";
import { mergeTypeDefs } from "@graphql-tools/merge";
import { SNAPSHOT_HEADER } from "./constants.js";
import type { SdlUnit } from "./schema-load.js";

export function parseSdlUnits(units: SdlUnit[]): DocumentNode[] {
  const typeDefs: DocumentNode[] = [];
  for (const unit of units) {
    try {
      typeDefs.push(parse(unit.body));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new SyntaxError(`${unit.label}: ${msg}`);
    }
  }
  return typeDefs;
}

export function mergeSdlUnits(
  units: SdlUnit[],
  options?: { sort?: boolean; throwOnConflict?: boolean },
): string {
  const typeDefs = parseSdlUnits(units);
  const merged = mergeTypeDefs(typeDefs, {
    sort: options?.sort ?? true,
    throwOnConflict: options?.throwOnConflict ?? true,
  });
  const body = print(merged);
  return `${SNAPSHOT_HEADER}${body}`;
}

export function buildSchemaFromSnapshot(sdl: string): GraphQLSchema {
  const body = sdl.replace(/^#.*\n+/, "");
  const schema = buildASTSchema(parse(body));
  assertValidSchema(schema);
  return schema;
}

export function ensureQueryRoot(schema: GraphQLSchema): void {
  if (!schema.getQueryType()) {
    throw new Error("Merged schema has no Query root type");
  }
}
