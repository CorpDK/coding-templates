import fs from "node:fs/promises";
import path from "node:path";
import {
  emitCliModules,
  emitRuntimeConfigModule,
} from "@corpdk/graphql-cli-core/codegen";
import { EXIT_TOOL, EXIT_SUCCESS, type EngineResult } from "@corpdk/engine-kit";
import { engineResult } from "./engine-result.js";
import {
  configToEmitOptions,
  readCliConfig,
  type CliConfigYaml,
} from "./cli-config.js";
import {
  assertSdkValidationExport,
  resolveSdkSnapshot,
  SdkResolveError,
} from "./sdk-resolve.js";

export type GenerateOptions = {
  packageDir: string;
  check?: boolean;
};

function generatedHeader(sha256: string): string {
  return [
    "// @generated — do not edit manually",
    `// sdk-snapshot-sha256: ${sha256}`,
    "",
  ].join("\n");
}

type PlannedFile = { path: string; content: string };

async function checkPlannedFiles(
  packageDir: string,
  planned: PlannedFile[],
): Promise<EngineResult | undefined> {
  const results = await Promise.all(
    planned.map(async (file) => {
      let existing = "";
      try {
        existing = await fs.readFile(file.path, "utf8");
      } catch {
        return engineResult({
          exitCode: 1,
          message: `Drift: missing ${path.relative(packageDir, file.path)}`,
        });
      }
      if (existing !== file.content) {
        return engineResult({
          exitCode: 1,
          message: `Drift: ${path.relative(packageDir, file.path)} would change`,
        });
      }
      return undefined;
    }),
  );
  return results.find((result) => result !== undefined);
}

async function writePlannedFiles(planned: PlannedFile[]): Promise<void> {
  await Promise.all(
    planned.map(async (file) => {
      await fs.mkdir(path.dirname(file.path), { recursive: true });
      await fs.writeFile(file.path, file.content, "utf8");
    }),
  );
}

export async function runGenerate(options: GenerateOptions): Promise<EngineResult> {
  const { packageDir, check } = options;
  try {
    const config = await readCliConfig(packageDir);
    const sdkPath = path.resolve(packageDir, config.sdk.path);
    await assertSdkValidationExport(sdkPath);
    const { schema, sha256 } = await resolveSdkSnapshot(sdkPath);

    const pkgJsonPath = path.join(packageDir, "package.json");
    const pkg = JSON.parse(await fs.readFile(pkgJsonPath, "utf8")) as {
      version?: string;
    };

    const emitted = emitCliModules(
      schema,
      configToEmitOptions(config, pkg.version),
    );

    const genDir = path.join(packageDir, "src", "generated");
    const commandsPath = path.join(genDir, "commands.ts");
    const runtimeConfigPath = path.join(genDir, "runtime-config.ts");
    const header = generatedHeader(sha256);
    const commandsSource = `${header}${emitted.commandsSource}`;
    const runtimeSource = emitRuntimeConfigModule(emitted.runtimeConfig);

    const planned: { path: string; content: string }[] = [
      { path: commandsPath, content: commandsSource },
      { path: runtimeConfigPath, content: runtimeSource },
    ];

    for (const [command, source] of Object.entries(emitted.selections)) {
      planned.push({
        path: path.join(genDir, "selections", `${command}.ts`),
        content: `// @generated — do not edit manually\n${source}`,
      });
    }

    if (emitted.man) {
      planned.push({
        path: path.join(genDir, "man", `${config.bin}.1`),
        content: emitted.man,
      });
    }
    if (emitted.texi) {
      planned.push({
        path: path.join(genDir, "info", `${config.bin}.texi`),
        content: emitted.texi,
      });
    }

    if (check) {
      const drift = await checkPlannedFiles(packageDir, planned);
      if (drift) return drift;
      return engineResult({ exitCode: EXIT_SUCCESS });
    }

    await writePlannedFiles(planned);

    for (const warning of emitted.warnings) {
      console.warn(warning);
    }

    return engineResult({
      exitCode: EXIT_SUCCESS,
      changedFiles: planned.map((f) => path.relative(packageDir, f.path)),
    });
  } catch (err) {
    if (err instanceof SdkResolveError) {
      return engineResult({ exitCode: 1, message: err.message });
    }
    const message = err instanceof Error ? err.message : String(err);
    return engineResult({ exitCode: EXIT_TOOL, message });
  }
}

export function defaultCliConfig(input: {
  name: string;
  bin: string;
  sdkPackage: string;
  sdkPath: string;
}): CliConfigYaml {
  return {
    apiVersion: "corpdk.dev/graphql-cli/v1",
    package: input.name,
    bin: input.bin,
    sdk: { package: input.sdkPackage, path: input.sdkPath },
    transport: {
      httpUrlEnv: "GRAPHQL_HTTP_URL",
      defaultUrl: "http://localhost:4000/graphql",
      tokenEnv: "GRAPHQL_TOKEN",
      headersEnv: "GRAPHQL_HEADERS_JSON",
      timeoutMs: 30_000,
    },
    selection: {
      policy: "relation-ids",
      connection: "nodes",
      maxWrapperDepth: 4,
      lookup: {},
      overrides: {},
    },
    pagination: { defaultPageSize: 50 },
    include: { queries: [], mutations: [], subscriptions: [] },
    exclude: { queries: [], mutations: [], subscriptions: [] },
    commands: { warnAbove: 200 },
    guard: {
      destructive: ["delete*", "bulkDelete*", "bulkUpdate*ByFilter"],
    },
    output: { userErrorsFields: ["userErrors"], failOnUserErrors: true },
    man: { enabled: true },
  };
}