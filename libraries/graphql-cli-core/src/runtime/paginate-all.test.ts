import { describe, expect, it, vi } from "vitest";
import type { CommandDescriptor } from "../codegen/types.js";
import { runCli } from "./run-cli.js";
import { baseSdk, captureIo, harnessConfig } from "./__tests__/harness.js";

const connectionCmd: CommandDescriptor = {
  command: "item-connection",
  kind: "query",
  field: "itemConnection",
  destructive: false,
  paginated: { direction: "forward", nodes: "nodes" },
  followUps: [],
  args: [
    {
      name: "first",
      flag: "--first",
      graphqlType: "Int",
      kind: "scalar",
      list: false,
      required: false,
    },
    {
      name: "after",
      flag: "--after",
      graphqlType: "String",
      kind: "scalar",
      list: false,
      required: false,
    },
  ],
  selection: {
    nodes: { id: true, name: true },
    pageInfo: { hasNextPage: true, endCursor: true },
  },
};

function pagedFetch(pages: { id: string; name?: string }[][]) {
  let call = 0;
  return vi.fn(async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as {
      variables?: { after?: string };
    };
    const index = body.variables?.after ? Number(body.variables.after.slice(1)) : 0;
    const nodes = pages[index] ?? [];
    const hasNext = index + 1 < pages.length;
    const endCursor = hasNext ? `c${index + 1}` : null;
    call++;
    return Response.json({
      data: {
        itemConnection: {
          nodes,
          pageInfo: { hasNextPage: hasNext, endCursor },
        },
      },
    });
  });
}

describe("--all paging", () => {
  it("prints every node once as NDJSON across three pages", async () => {
    const fetchImpl = pagedFetch([
      [{ id: "a", name: "A" }, { id: "b", name: "B" }],
      [{ id: "c", name: "C" }],
      [],
    ]);
    const { streams, stdout } = captureIo();
    const code = await runCli({
      catalog: { "item-connection": connectionCmd },
      config: harnessConfig,
      sdk: baseSdk(),
      argv: ["node", "cli", "item-connection", "--all", "--first", "2"],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      ...streams,
      isTTY: { stdin: false, stdout: false },
    });
    expect(code).toBe(0);
    const lines = stdout.join("").trim().split("\n").filter(Boolean);
    expect(lines).toHaveLength(3);
    expect(lines.map((line) => JSON.parse(line).id)).toEqual(["a", "b", "c"]);
  });

  it("stops after --max-pages", async () => {
    const fetchImpl = pagedFetch([
      [{ id: "a", name: "A" }],
      [{ id: "b", name: "B" }],
      [{ id: "c", name: "C" }],
    ]);
    const { streams, stdout } = captureIo();
    await runCli({
      catalog: { "item-connection": connectionCmd },
      config: harnessConfig,
      sdk: baseSdk(),
      argv: [
        "node",
        "cli",
        "item-connection",
        "--all",
        "--first",
        "1",
        "--max-pages",
        "2",
      ],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      ...streams,
      isTTY: { stdin: false, stdout: false },
    });
    const lines = stdout.join("").trim().split("\n").filter(Boolean);
    expect(lines).toHaveLength(2);
  });

  it("exits 2 for --all on a non-paginated command", async () => {
    const hello: CommandDescriptor = {
      command: "hello",
      kind: "query",
      field: "hello",
      destructive: false,
      followUps: [],
      args: [],
      selection: {},
    };
    const { streams, stderr } = captureIo();
    const code = await runCli({
      catalog: { hello },
      config: harnessConfig,
      sdk: baseSdk(),
      argv: ["node", "cli", "hello", "--all"],
      fetchImpl: vi.fn() as unknown as typeof fetch,
      ...streams,
      isTTY: { stdin: false, stdout: false },
    });
    expect(code).toBe(2);
    expect(stderr.join("")).toContain('"error":"usage"');
  });
});