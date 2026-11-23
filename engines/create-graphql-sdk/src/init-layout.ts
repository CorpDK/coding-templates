import fs from "node:fs/promises";
import path from "node:path";
import {
  copyDir,
  mergePackageJson,
  pathExists,
  readJson,
  writeJson,
} from "@corpdk/engine-kit";
import {
  COPY_TEMPLATE_EXCLUDE,
  CORP_DK_OWNED,
  DAL_SCALAR_PRESET,
  initialScaffoldCalVer,
} from "./constants.js";
import {
  engineStarterDir,
  isBundledCanonicalTemplate,
  readCreateGraphqlSdkReleaseVersion,
} from "./template.js";
import { inferSchemaKind } from "./schema-load.js";
import {
  defaultSdkConfig,
  writeSdkConfig,
  type SchemaSource,
  type SdkConfig,
} from "./sdk-config.js";
import type { InitOptions } from "./init.js";

export async function ensureEmptyTarget(
  targetDir: string,
): Promise<string | null> {
  if (!(await pathExists(targetDir))) {
    return null;
  }
  const entries = await fs.readdir(targetDir);
  if (entries.length > 0) {
    return `Init target is not empty: ${targetDir}`;
  }
  return null;
}

function relativeSchemaPath(fromDir: string, absPath: string): string {
  return path.relative(fromDir, path.resolve(absPath)).split(path.sep).join("/");
}

export function buildSchemaSources(
  options: InitOptions,
  targetDir: string,
): SchemaSource[] {
  if (options.demoSchema) {
    return [
      {
        kind: "graphqls",
        paths: ["schema/sources"],
      },
    ];
  }
  return options.schema.map((schemaPath) => {
    const kind = inferSchemaKind(schemaPath);
    if (kind === "typeDefs") {
      return {
        kind: "typeDefs",
        path: relativeSchemaPath(targetDir, schemaPath),
      };
    }
    return {
      kind: "graphqls",
      paths: [relativeSchemaPath(targetDir, schemaPath)],
    };
  });
}

function isScaffoldInsideRepo(repoRoot: string, targetDir: string): boolean {
  const rel = path.relative(path.resolve(repoRoot), path.resolve(targetDir));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function tsconfigExtendsFromRepoRoot(
  repoRoot: string,
  targetDir: string,
): string {
  const relFromRoot = path.relative(repoRoot, targetDir);
  const depth = relFromRoot
    .split(path.sep)
    .filter((segment) => segment && segment !== ".").length;
  return `${"../".repeat(depth)}tsconfig.node.json`;
}

async function patchScaffoldTsconfig(
  repoRoot: string,
  targetDir: string,
): Promise<void> {
  const tsconfigPath = path.join(targetDir, "tsconfig.json");
  if (!(await pathExists(tsconfigPath))) {
    return;
  }
  const tsconfig = await readJson<{ extends?: string }>(tsconfigPath);
  tsconfig.extends = tsconfigExtendsFromRepoRoot(repoRoot, targetDir);
  await writeJson(tsconfigPath, tsconfig);
}

export async function applyScaffoldLayout(
  options: InitOptions,
  repoRoot: string,
  templateDir: string,
  targetDir: string,
): Promise<void> {
  await fs.mkdir(targetDir, { recursive: true });
  await copyDir(templateDir, targetDir, {
    exclude: [...COPY_TEMPLATE_EXCLUDE],
    skipIfExists: false,
  });

  const releaseVersion =
    isBundledCanonicalTemplate(templateDir) &&
    !isScaffoldInsideRepo(repoRoot, targetDir)
      ? await readCreateGraphqlSdkReleaseVersion()
      : undefined;

  const templatePkg = await readJson<Record<string, unknown>>(
    path.join(templateDir, "package.json"),
  );
  const merged = mergePackageJson(
    {
      name: options.name,
      version: initialScaffoldCalVer(),
      license: "MIT",
    },
    templatePkg as Parameters<typeof mergePackageJson>[1],
    {
      owned: CORP_DK_OWNED,
      releaseVersion,
    },
  );
  await writeJson(path.join(targetDir, "package.json"), merged);

  const config: SdkConfig = {
    ...defaultSdkConfig(options.name),
    schema: {
      ...defaultSdkConfig(options.name).schema,
      sources: buildSchemaSources(options, targetDir),
    },
  };

  if (options.scalarPreset === "dal") {
    config.scalars = { ...DAL_SCALAR_PRESET };
  }

  if (options.demoSchema) {
    const starterSchema = path.join(engineStarterDir(), "schema");
    await copyDir(starterSchema, path.join(targetDir, "schema", "sources"));
  }

  await writeSdkConfig(targetDir, config);
  await patchScaffoldTsconfig(repoRoot, targetDir);
}