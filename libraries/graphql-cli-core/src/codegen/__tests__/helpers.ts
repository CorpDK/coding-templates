import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildSchema, type GraphQLSchema } from "graphql";

const here = dirname(fileURLToPath(import.meta.url));

export function loadFixtureSchema(name: string): GraphQLSchema {
  const path = join(here, "fixtures", name);
  return buildSchema(readFileSync(path, "utf8"));
}

export function loadDalSchema(): GraphQLSchema {
  return loadFixtureSchema("dal-schema.graphql");
}
