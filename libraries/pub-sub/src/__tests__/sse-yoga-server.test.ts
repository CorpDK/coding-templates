import { createSchema } from "graphql-yoga";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSseYogaHttpServer,
  listenSseYogaHttpServer,
} from "../index.js";

const schema = createSchema({
  typeDefs: /* GraphQL */ `
    type Query {
      ping: String!
    }
  `,
  resolvers: {
    Query: {
      ping: () => "pong",
    },
  },
});

function listen(server: ReturnType<typeof createSseYogaHttpServer>): Promise<number> {
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address === "object") {
        resolve(address.port);
        return;
      }
      reject(new Error("server did not bind to a port"));
    });
  });
}

function close(server: ReturnType<typeof createSseYogaHttpServer>): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

describe("createSseYogaHttpServer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("serves GraphQL queries over HTTP on /graphql", async () => {
    const server = createSseYogaHttpServer(schema);
    const port = await listen(server);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/graphql`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: "{ ping }" }),
      });
      expect(response.ok).toBe(true);
      const body = (await response.json()) as { data?: { ping?: string } };
      expect(body.data?.ping).toBe("pong");
    } finally {
      await close(server);
    }
  });
});

describe("listenSseYogaHttpServer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("listens on an ephemeral port, logs extra startup lines, and serves GraphQL", async () => {
    const server = createSseYogaHttpServer(schema);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const extraStartupLines = ["extra-line-a", "extra-line-b"];
    await new Promise<void>((resolve, reject) => {
      server.once("listening", () => resolve());
      server.once("error", reject);
      listenSseYogaHttpServer(server, 0, "@corpdk/test-ds", extraStartupLines);
    });
    try {
      const address = server.address();
      const boundPort =
        address && typeof address === "object" ? address.port : 0;
      expect(boundPort).not.toBe(0);
      const response = await fetch(`http://127.0.0.1:${boundPort}/graphql`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: "{ ping }" }),
      });
      expect(response.ok).toBe(true);
      const body = (await response.json()) as { data?: { ping?: string } };
      expect(body.data?.ping).toBe("pong");
      for (const line of extraStartupLines) {
        expect(log.mock.calls.some((call) => call[0] === line)).toBe(true);
      }
    } finally {
      await close(server);
    }
  });
});
