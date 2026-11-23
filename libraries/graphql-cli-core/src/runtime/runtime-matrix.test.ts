import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { CommandDescriptor } from "../codegen/types.js";
import { describeJson } from "./catalog.js";
import { runCli } from "./run-cli.js";
import {
  baseSdk,
  captureIo,
  deleteItemCmd,
  harnessConfig,
} from "./__tests__/harness.js";

const failFetch = vi.fn(async () => {
  throw new Error("fetch must not run");
});

describe("runCli matrix (doc 14 §12)", () => {
  it("destructive without --confirm exits 2 and never calls fetch", async () => {
    const { streams, stderr } = captureIo();
    const code = await runCli({
      catalog: { "delete-item": deleteItemCmd },
      config: harnessConfig,
      sdk: baseSdk(),
      argv: ["node", "cli", "delete-item", "--id", "1"],
      fetchImpl: failFetch as unknown as typeof fetch,
      ...streams,
      isTTY: { stdin: false, stdout: false },
    });
    expect(code).toBe(2);
    expect(failFetch).not.toHaveBeenCalled();
    expect(stderr.join("")).toContain('"error":"usage"');
  });

  it("validation failure exits 3 with no fetch", async () => {
    const createCmd: CommandDescriptor = {
      command: "create-item",
      kind: "mutation",
      field: "createItem",
      destructive: false,
      followUps: [],
      args: [
        {
          name: "input",
          flag: "--input",
          graphqlType: "ItemInput!",
          kind: "input",
          list: false,
          required: true,
          inputZodSchemaName: "ItemInput",
        },
      ],
      selection: { item: { id: true }, userErrors: { message: true } },
    };
    const schema = z.object({ name: z.string().min(1) });
    const sdk = baseSdk({
      validation: {
        inputZodSchemas: { ItemInput: schema },
        scalarZodSchemas: {},
        safeParseGraphqlInput: (name, value) => {
          const parsed = schema.safeParse(value);
          return parsed.success
            ? { ok: true as const, data: parsed.data }
            : {
                ok: false as const,
                issues: parsed.error.issues.map((i) => ({
                  path: i.path.map(String),
                  message: i.message,
                  code: i.code,
                })),
              };
        },
        safeParseOptionalGraphqlInput: () => ({ ok: true, data: undefined }),
        safeParseGraphqlInputList: () => ({ ok: true, data: [] }),
        safeParseOptionalGraphqlInputList: () => ({ ok: true, data: [] }),
        safeParseGraphqlScalar: () => ({ ok: true, data: "x" }),
      },
    });
    const { streams, stderr } = captureIo();
    const code = await runCli({
      catalog: { "create-item": createCmd },
      config: harnessConfig,
      sdk,
      argv: ["node", "cli", "create-item", "--input", '{"name":""}'],
      fetchImpl: failFetch as unknown as typeof fetch,
      ...streams,
      isTTY: { stdin: false, stdout: false },
    });
    expect(code).toBe(3);
    expect(failFetch).not.toHaveBeenCalled();
    expect(stderr.join("")).toContain('"error":"validation"');
  });

  it("merges --vars-file under flag overrides (§4.3)", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-vars-"));
    const file = path.join(dir, "vars.json");
    fs.writeFileSync(file, JSON.stringify({ name: "from-file" }));
    const hello: CommandDescriptor = {
      command: "hello",
      kind: "query",
      field: "hello",
      destructive: false,
      followUps: [],
      args: [
        {
          name: "name",
          flag: "--name",
          graphqlType: "String",
          kind: "scalar",
          list: false,
          required: false,
        },
      ],
      selection: {},
    };
    const seen: Record<string, unknown>[] = [];
    const fetchImpl = vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as {
        variables?: Record<string, unknown>;
      };
      seen.push(body.variables ?? {});
      return new Response(JSON.stringify({ data: { hello: "ok" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const { streams } = captureIo();
    await runCli({
      catalog: { hello },
      config: harnessConfig,
      sdk: baseSdk(),
      argv: [
        "node",
        "cli",
        "hello",
        "--vars-file",
        file,
        "--name",
        "from-flag",
      ],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      ...streams,
      isTTY: { stdin: false, stdout: false },
    });
    expect(seen[0]?.name).toBe("from-flag");
  });

  it("maps GraphQL errors to exit 1", async () => {
    const hello: CommandDescriptor = {
      command: "hello",
      kind: "query",
      field: "hello",
      destructive: false,
      followUps: [],
      args: [],
      selection: {},
    };
    const fetchImpl = vi.fn(async () =>
      Response.json({
        errors: [{ message: "boom" }],
        data: { hello: null },
      }),
    );
    const { streams, stderr } = captureIo();
    const code = await runCli({
      catalog: { hello },
      config: harnessConfig,
      sdk: baseSdk(),
      argv: ["node", "cli", "hello"],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      ...streams,
      isTTY: { stdin: false, stdout: false },
    });
    expect(code).toBe(1);
    expect(stderr.join("")).toContain('"error":"graphql"');
  });

  it("maps mutation userErrors to exit 5", async () => {
    const createCmd: CommandDescriptor = {
      command: "create-item",
      kind: "mutation",
      field: "createItem",
      destructive: false,
      followUps: [],
      args: [],
      selection: { item: { id: true }, userErrors: { message: true } },
    };
    const fetchImpl = vi.fn(async () =>
      Response.json({
        data: {
          createItem: {
            item: null,
            userErrors: [{ message: "bad", field: ["name"], code: "INVALID" }],
          },
        },
      }),
    );
    const { streams, stderr } = captureIo();
    const code = await runCli({
      catalog: { "create-item": createCmd },
      config: harnessConfig,
      sdk: baseSdk(),
      argv: ["node", "cli", "create-item"],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      ...streams,
      isTTY: { stdin: false, stdout: false },
    });
    expect(code).toBe(5);
    expect(stderr.join("")).toContain('"error":"userErrors"');
  });

  it("redacts bearer token from transport errors", async () => {
    const token = "super-secret-token-value";
    const hello: CommandDescriptor = {
      command: "hello",
      kind: "query",
      field: "hello",
      destructive: false,
      followUps: [],
      args: [],
      selection: {},
    };
    const fetchImpl = vi.fn(async () =>
      Response.json(
        { errors: [{ message: `failed auth ${token}` }] },
        { status: 500 },
      ),
    );
    const { streams, stderr } = captureIo();
    const code = await runCli({
      catalog: { hello },
      config: harnessConfig,
      sdk: baseSdk(),
      argv: ["node", "cli", "hello"],
      env: { ...process.env, GRAPHQL_TOKEN: token },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      ...streams,
      isTTY: { stdin: false, stdout: false },
    });
    expect(code).toBe(4);
    const err = stderr.join("");
    expect(err).not.toContain(token);
    expect(err).toContain("<redacted>");
  });

  it("describe --json emits JSON Schema for z.lazy inputs", () => {
    type Filter = { and?: Filter[]; name?: string };
    const FilterSchema: z.ZodType<Filter> = z.lazy(() =>
      z.object({
        name: z.string().optional(),
        and: z.array(FilterSchema).optional(),
      }),
    );
    const cmd: CommandDescriptor = {
      command: "items",
      kind: "query",
      field: "items",
      destructive: false,
      followUps: [],
      args: [
        {
          name: "filter",
          flag: "--filter",
          graphqlType: "ItemFilter",
          kind: "input",
          list: false,
          required: false,
          inputZodSchemaName: "ItemFilter",
        },
      ],
      selection: {},
    };
    const payload = describeJson(cmd, {
      inputZodSchemas: { ItemFilter: FilterSchema },
      scalarZodSchemas: {},
      safeParseGraphqlInput: () => ({ ok: true, data: {} }),
      safeParseOptionalGraphqlInput: () => ({ ok: true, data: {} }),
      safeParseGraphqlInputList: () => ({ ok: true, data: [] }),
      safeParseOptionalGraphqlInputList: () => ({ ok: true, data: [] }),
      safeParseGraphqlScalar: () => ({ ok: true, data: "x" }),
    }) as { args: { jsonSchema?: unknown }[] };
    expect(payload.args[0]?.jsonSchema).toBeTruthy();
    expect(JSON.stringify(payload.args[0]?.jsonSchema)).toContain("and");
  });

  it("rejects --interactive when CI is set", async () => {
    const { streams, stderr } = captureIo();
    const loadPrompts = vi.fn(async () => {
      throw new Error("@clack/prompts should not load");
    });
    const code = await runCli({
      catalog: {},
      config: harnessConfig,
      sdk: baseSdk(),
      argv: ["node", "cli", "--interactive"],
      loadPrompts,
      env: { CI: "true" },
      fetchImpl: failFetch as unknown as typeof fetch,
      ...streams,
      isTTY: { stdin: true, stdout: true },
    });
    expect(code).toBe(2);
    expect(loadPrompts).not.toHaveBeenCalled();
    expect(stderr.join("")).toContain("Interactive mode");
  });

  it("does not load prompts on a normal operation", async () => {
    const hello: CommandDescriptor = {
      command: "hello",
      kind: "query",
      field: "hello",
      destructive: false,
      followUps: [],
      args: [],
      selection: {},
    };
    const loadPrompts = vi.fn(async () => {
      throw new Error("@clack/prompts should not load");
    });
    const fetchImpl = vi.fn(async () =>
      Response.json({ data: { hello: "ok" } }),
    );
    const { streams } = captureIo();
    await runCli({
      catalog: { hello },
      config: harnessConfig,
      sdk: baseSdk(),
      argv: ["node", "cli", "hello"],
      loadPrompts,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      ...streams,
      isTTY: { stdin: false, stdout: false },
    });
    expect(loadPrompts).not.toHaveBeenCalled();
  });
});