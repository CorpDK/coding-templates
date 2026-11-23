import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runEngineCli } from "@corpdk/engine-kit";
import { emitCliModules } from "@corpdk/graphql-cli-core/codegen";
import { runGenerate } from "./generate.js";
import { readCliConfig, configToEmitOptions } from "./cli-config.js";
import { resolveSdkSnapshot } from "./sdk-resolve.js";
import { CREATE_GRAPHQL_CLI_HELP } from "./constants.js";
import { CREATE_GRAPHQL_CLI_ENGINE_ROOT } from "./constants.js";

const FIXTURE_SDK = path.resolve(
  fileURLToPath(
    new URL(
      "../../../libraries/graphql-cli-core/test-fixtures/minimal-sdk",
      import.meta.url,
    ),
  ),
);

describe("create-graphql-cli engine", () => {
  it("prints version with exit 0", async () => {
    const code = await runEngineCli({
      name: "create-graphql-cli",
      version: "0.0.0-test",
      help: CREATE_GRAPHQL_CLI_HELP,
      commands: [],
      argv: ["node", "cli", "--version"],
    });
    expect(code).toBe(0);
  });

  it("generate writes catalog from fixture SDK", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-gen-"));
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "@test/cli", version: "0.0.1" }, null, 2),
    );
    fs.writeFileSync(
      path.join(dir, "cli.config.yaml"),
      [
        "apiVersion: corpdk.dev/graphql-cli/v1",
        'package: "@test/cli"',
        "bin: test-cli",
        "sdk:",
        `  package: "@corpdk/fixture-cli-sdk"`,
        `  path: ${path.relative(dir, FIXTURE_SDK)}`,
        "transport:",
        "  httpUrlEnv: GRAPHQL_HTTP_URL",
        "selection:",
        "  policy: relation-ids",
        "include:",
        "  queries: []",
        "  mutations: []",
        "  subscriptions: []",
        "exclude:",
        "  queries: []",
        "  mutations: []",
        "  subscriptions: []",
        "guard:",
        "  destructive: []",
        "output:",
        "  userErrorsFields: [userErrors]",
        "  failOnUserErrors: true",
        "pagination:",
        "  defaultPageSize: 50",
      ].join("\n"),
    );

    const result = await runGenerate({ packageDir: dir });
    expect(result.exitCode).toBe(0);

    const config = await readCliConfig(dir);
    const sdkPath = path.resolve(dir, config.sdk.path);
    const { schema, sha256 } = await resolveSdkSnapshot(sdkPath);
    const oracle = emitCliModules(
      schema,
      configToEmitOptions(config, "0.0.1"),
    );
    const expectedKeys = oracle.commands.map((cmd) => cmd.command).sort();

    const commandsPath = path.join(dir, "src/generated/commands.ts");
    const header = fs.readFileSync(commandsPath, "utf8").split("\n", 3);
    expect(header[1]).toBe(`// sdk-snapshot-sha256: ${sha256}`);

    const { catalog } = (await import(
      pathToFileURL(commandsPath).href
    )) as {
      catalog: Record<string, unknown>;
    };
    expect(Object.keys(catalog).sort()).toEqual(expectedKeys);
  });

  it("generate --check fails when snapshot drift would occur", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-check-"));
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "@test/cli", version: "0.0.1" }, null, 2),
    );
    fs.writeFileSync(
      path.join(dir, "cli.config.yaml"),
      [
        "apiVersion: corpdk.dev/graphql-cli/v1",
        'package: "@test/cli"',
        "bin: test-cli",
        "sdk:",
        '  package: "@corpdk/fixture-cli-sdk"',
        `  path: ${path.relative(dir, FIXTURE_SDK)}`,
        "transport:",
        "  httpUrlEnv: GRAPHQL_HTTP_URL",
        "selection:",
        "  policy: relation-ids",
        "include:",
        "  queries: []",
        "  mutations: []",
        "  subscriptions: []",
        "exclude:",
        "  queries: []",
        "  mutations: []",
        "  subscriptions: []",
        "guard:",
        "  destructive: []",
        "output:",
        "  userErrorsFields: [userErrors]",
        "  failOnUserErrors: true",
        "pagination:",
        "  defaultPageSize: 50",
      ].join("\n"),
    );
    const generated = path.join(dir, "src/generated/commands.ts");
    fs.mkdirSync(path.dirname(generated), { recursive: true });
    fs.writeFileSync(generated, "// stale");
    const check = await runGenerate({ packageDir: dir, check: true });
    expect(check.exitCode).toBe(1);
    void CREATE_GRAPHQL_CLI_ENGINE_ROOT;
  });
});