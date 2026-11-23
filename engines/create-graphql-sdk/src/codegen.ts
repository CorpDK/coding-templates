import fs from "node:fs/promises";
import path from "node:path";
import { emitDslModules } from "@corpdk/graphql-dsl/codegen";
import { emitGraphqlInputZodBlocks } from "@corpdk/graphql-input-zod/codegen";
import { buildSchemaFromSnapshot } from "./merge.js";
import { stripSnapshotHeader } from "./diff.js";
import {
  buildScalarRegistrySource,
  customLeafScalars,
  l1ScalarMap,
  listCustomScalars,
  scalarEmitterMap,
} from "./scalars.js";
import { readSdkConfig, snapshotPath, type SdkConfig } from "./sdk-config.js";
import { SNAPSHOT_HEADER } from "./constants.js";

async function readSnapshotSdl(
  packageDir: string,
  config: SdkConfig,
): Promise<string> {
  const snap = snapshotPath(packageDir, config);
  const raw = await fs.readFile(snap, "utf8");
  return stripSnapshotHeader(raw);
}

export async function runCodegen(packageDir: string): Promise<string[]> {
  const dir = path.resolve(packageDir);
  const config = await readSdkConfig(dir);
  const snap = snapshotPath(dir, config);
  const sdl = await readSnapshotSdl(dir, config);
  const schema = buildSchemaFromSnapshot(`${SNAPSHOT_HEADER}${sdl}`);
  const customNames = listCustomScalars(schema);
  const generatedDir = path.join(dir, "src", "generated");
  const dslDir = path.join(generatedDir, "dsl");
  await fs.mkdir(dslDir, { recursive: true });

  const changed: string[] = [];
  const l1Rel = "src/generated/schema-types.ts";
  const l1Scalars = l1ScalarMap(config, customNames);
  const { codegen } = await import("@graphql-codegen/core");
  const { plugin: typescriptPlugin } = await import(
    "@graphql-codegen/typescript"
  );
  const { getCachedDocumentNodeFromSchema } = await import(
    "@graphql-codegen/plugin-helpers"
  );
  const l1Config = {
    enumsAsTypes: true,
    nonOptionalTypename: true,
    scalars: l1Scalars,
    skipTypename: false,
  };
  const l1Body = await codegen({
    filename: l1Rel,
    schema: getCachedDocumentNodeFromSchema(schema),
    documents: [],
    config: l1Config,
    plugins: [
      {
        typescript: {},
      },
    ],
    pluginMap: {
      typescript: { plugin: typescriptPlugin },
    },
  });
  const l1Out = path.join(dir, l1Rel);
  await fs.writeFile(l1Out, l1Body, "utf8");
  changed.push(l1Rel);

  const leafScalars = customLeafScalars(config);
  const dsl = emitDslModules(schema, {
    typesImport: "../schema-types.js",
    customScalars: leafScalars,
    sortProperties: true,
  });
  const selectionsPath = path.join(dslDir, "selections.ts");
  const typeMapPath = path.join(dslDir, "type-map.ts");
  const indexPath = path.join(dslDir, "index.ts");
  await fs.writeFile(selectionsPath, dsl.selections, "utf8");
  await fs.writeFile(typeMapPath, dsl.typeMap, "utf8");
  await fs.writeFile(indexPath, dsl.index, "utf8");
  changed.push(
    path.relative(dir, selectionsPath),
    path.relative(dir, typeMapPath),
    path.relative(dir, indexPath),
  );

  const validationEnabled = config.validation?.enabled !== false;
  if (validationEnabled) {
    const scalarRegistry = buildScalarRegistrySource(config);
    const scalarRegistryPath = path.join(generatedDir, "scalar-registry.ts");
    if (scalarRegistry) {
      await fs.writeFile(scalarRegistryPath, scalarRegistry.source, "utf8");
      changed.push(path.relative(dir, scalarRegistryPath));
    }

    const scalarMap = scalarEmitterMap(config, customNames);
    const builtinScalars = config.validation?.builtinScalars ?? {};
    const emitted = emitGraphqlInputZodBlocks(schema, {
      scalars: scalarMap,
      builtinScalars,
      scalarReferences: "registry",
      preamble: 'import { z } from "zod";',
    });

    const schemasPath = path.join(generatedDir, "input-schemas.ts");
    const schemaBody = emitted.schemaBlocks.join("\n\n");
    await fs.writeFile(schemasPath, schemaBody, "utf8");
    changed.push(path.relative(dir, schemasPath));

    const registryImports = emitted.registryNames
      .map((name) => `${name}Schema`)
      .join(", ");
    const registryEntries = emitted.registryNames
      .map((name) => `  ${name}: ${name}Schema,`)
      .join("\n");
    const registryPath = path.join(generatedDir, "input-registry.ts");
    const registrySource =
      emitted.registryNames.length > 0
        ? `import { ${registryImports} } from "./input-schemas.js";

export const inputZodSchemas = {
${registryEntries}
} as const;
export type InputZodSchemaName = keyof typeof inputZodSchemas;
`
        : `export const inputZodSchemas = {} as const;
export type InputZodSchemaName = keyof typeof inputZodSchemas;
`;
    await fs.writeFile(registryPath, registrySource, "utf8");
    changed.push(path.relative(dir, registryPath));
  }

  return changed;
}