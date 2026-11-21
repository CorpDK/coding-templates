import { parse, validate } from "graphql";
import { describe, expect, it } from "vitest";
import {
  isGraphqlRequestError,
  toGraphqlRequestError,
} from "../src/runtime/normalizeGraphqlResult.js";
import {
  iterateConnection,
  paginateConnection,
} from "../src/runtime/iterateConnection.js";
import { generateGraphqlOperation } from "../src/runtime/generateGraphqlOperation.js";
import { minimalSchema, minimalTypeMap } from "./fixtures/minimalTypeMap.fixture.js";

function itemConnectionBuild(variables: Record<string, unknown>) {
  return generateGraphqlOperation("query", minimalTypeMap.Query!, {
    itemConnection: {
      __args: variables,
      nodes: { id: true },
      pageInfo: { hasNextPage: true, endCursor: true },
    },
  } as import("../src/runtime/generateGraphqlOperation.js").Fields);
}

describe("iterateConnection", () => {
  it("issues a built query for each page", async () => {
    const queries: string[] = [];
    const exec = async (op: { query: string }) => {
      queries.push(op.query);
      return {
        itemConnection: {
          nodes: [{ id: "1" }],
          pageInfo: { hasNextPage: false, endCursor: "c1" },
        },
      };
    };

    const pages: unknown[] = [];
    for await (const node of iterateConnection(exec, {
      field: "itemConnection",
      args: {},
      select: { id: true },
      pageSize: 10,
      build: itemConnectionBuild,
    })) {
      pages.push(node);
    }

    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatch(/itemConnection/);
    const doc = parse(queries[0]!);
    expect(validate(minimalSchema, doc)).toEqual([]);
    expect(pages).toEqual([{ id: "1" }]);
  });

  it("follows forward cursors until hasNextPage is false", async () => {
    const buildArgs: Record<string, unknown>[] = [];
    const build = (variables: Record<string, unknown>) => {
      buildArgs.push({ ...variables });
      return itemConnectionBuild(variables);
    };
    let page = 0;
    const exec = async () => {
      page++;
      return {
        itemConnection: {
          nodes: [{ id: String(page) }],
          pageInfo: {
            hasNextPage: page < 2,
            endCursor: page < 2 ? `c${page}` : null,
          },
        },
      };
    };

    const nodes: string[] = [];
    for await (const row of iterateConnection(exec, {
      field: "itemConnection",
      args: {},
      select: { id: true },
      pageSize: 1,
      build,
    })) {
      nodes.push((row as { id: string }).id);
    }

    expect(nodes).toEqual(["1", "2"]);
    expect(buildArgs[0]).toMatchObject({ first: 1 });
    expect(buildArgs[1]).toMatchObject({ first: 1, after: "c1" });
  });

  it("reads edge nodes when the connection has no nodes field", async () => {
    const exec = async () => ({
      itemConnection: {
        edges: [{ node: { id: "e1" } }, { node: { id: "e2" } }],
        pageInfo: { hasNextPage: false, endCursor: "c1" },
      },
    });

    const collected: unknown[] = [];
    for await (const node of iterateConnection(exec, {
      field: "itemConnection",
      args: {},
      select: { id: true },
      pageSize: 10,
      build: itemConnectionBuild,
    })) {
      collected.push(node);
    }
    expect(collected).toEqual([{ id: "e1" }, { id: "e2" }]);
  });

  it("paginateConnection yields each page with pageNumber", async () => {
    const exec = async () => ({
      itemConnection: {
        nodes: [{ id: "1" }, { id: "2" }],
        pageInfo: { hasNextPage: false, endCursor: "c1" },
      },
    });

    const pages = [];
    for await (const page of paginateConnection(exec, {
      field: "itemConnection",
      args: {},
      select: { id: true },
      pageSize: 10,
      build: itemConnectionBuild,
    })) {
      pages.push(page);
    }

    expect(pages).toEqual([
      {
        nodes: [{ id: "1" }, { id: "2" }],
        pageInfo: { hasNextPage: false, endCursor: "c1" },
        pageNumber: 1,
      },
    ]);
  });

  it("stops after maxPages", async () => {
    let calls = 0;
    const exec = async () => {
      calls++;
      return {
        itemConnection: {
          nodes: [{ id: "1" }],
          pageInfo: { hasNextPage: true, endCursor: `c${calls}` },
        },
      };
    };

    const nodes: unknown[] = [];
    for await (const node of iterateConnection(exec, {
      field: "itemConnection",
      args: {},
      select: { id: true },
      pageSize: 1,
      maxPages: 2,
      build: itemConnectionBuild,
    })) {
      nodes.push(node);
    }
    expect(calls).toBe(2);
    expect(nodes).toHaveLength(2);
  });

  it("throws when the payload is not a connection", async () => {
    await expect(async () => {
      for await (const _ of iterateConnection(
        async () => ({ itemConnection: { nodes: [] } }),
        {
          field: "itemConnection",
          args: {},
          select: { id: true },
          pageSize: 1,
          build: itemConnectionBuild,
        },
      )) {
        /* drain */
      }
    }).rejects.toSatisfy((err: unknown) => isGraphqlRequestError(err));
  });

  it("throws when the server repeats the same paging cursor", async () => {
    const repeatExec = async () => ({
      itemConnection: {
        nodes: [{ id: "1" }],
        pageInfo: { hasNextPage: true, endCursor: "same" },
      },
    });

    await expect(async () => {
      for await (const _ of iterateConnection(repeatExec, {
        field: "itemConnection",
        args: {},
        select: { id: true },
        pageSize: 1,
        build: itemConnectionBuild,
      })) {
        /* page 1 yields; page 2 should reject duplicate cursor */
      }
    }).rejects.toSatisfy((err: unknown) => {
      expect(toGraphqlRequestError(err).message).toMatch(/Repeated connection/);
      return true;
    });
  });

  it("throws when the abort signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(async () => {
      for await (const _ of iterateConnection(
        async () => ({
          itemConnection: {
            nodes: [],
            pageInfo: { hasNextPage: false },
          },
        }),
        {
          field: "itemConnection",
          args: {},
          select: { id: true },
          pageSize: 1,
          signal: controller.signal,
          build: itemConnectionBuild,
        },
      )) {
        /* drain */
      }
    }).rejects.toSatisfy((err: unknown) => isGraphqlRequestError(err));
  });

  it("pages backward when direction is backward", async () => {
    const variables: Record<string, unknown>[] = [];
    const exec = async (op: { variables?: Record<string, unknown> }) => {
      variables.push({ ...(op.variables ?? {}) });
      return {
        itemConnection: {
          nodes: [{ id: "prev" }],
          pageInfo: { hasPreviousPage: false, startCursor: "c0" },
        },
      };
    };

    const build = (vars: Record<string, unknown>) => ({
      query: "query ItemConnectionBackward { itemConnection { nodes { id } } }",
      variables: vars,
    });

    const nodes: unknown[] = [];
    for await (const node of iterateConnection(exec, {
      field: "itemConnection",
      args: { filter: { name: "x" } },
      select: { id: true },
      pageSize: 5,
      direction: "backward",
      build,
    })) {
      nodes.push(node);
    }

    expect(variables[0]).toMatchObject({
      last: 5,
      filter: { name: "x" },
    });
    expect(nodes).toEqual([{ id: "prev" }]);
  });
});
