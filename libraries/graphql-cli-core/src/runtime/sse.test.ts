import { describe, expect, it, vi } from "vitest";
import type { CommandDescriptor } from "../codegen/types.js";
import { runCli } from "./run-cli.js";
import { baseSdk, captureIo, harnessConfig } from "./__tests__/harness.js";

const pingSub: CommandDescriptor = {
  command: "ping",
  kind: "subscription",
  field: "ping",
  destructive: false,
  followUps: [],
  args: [],
  selection: {},
};

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("GraphQL-over-SSE", () => {
  it("streams NDJSON until --max-events", async () => {
    const body = [
      'event: next\ndata: {"data":{"ping":"one"}}\n\n',
      'event: next\ndata: {"data":{"ping":"two"}}\n\n',
      "event: complete\ndata: {}\n\n",
    ];
    const fetchImpl = vi.fn(async () => sseResponse(body));
    const { streams, stdout } = captureIo();
    const code = await runCli({
      catalog: { ping: pingSub },
      config: harnessConfig,
      sdk: baseSdk(),
      argv: ["node", "cli", "ping", "--max-events", "2"],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      ...streams,
      isTTY: { stdin: false, stdout: false },
    });
    expect(code).toBe(0);
    const lines = stdout.join("").trim().split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });
});
