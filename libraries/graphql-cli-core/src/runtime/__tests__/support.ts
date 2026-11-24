import { Readable, Writable } from "node:stream";
import { vi, type Mock } from "vitest";
import { runCli } from "../run-cli.js";
import type { RunCliOptions } from "../types.js";
import { fixtureCatalog, fixtureConfig } from "./fixture-sdk/catalog.js";
import { fixtureSdk } from "./fixture-sdk/index.js";

export const ENDPOINT = "http://api.test/graphql";

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
  /** Parsed NDJSON lines of stdout. */
  lines: unknown[];
  /** Parsed JSON object on stderr (undefined when empty). */
  error: Record<string, unknown> | undefined;
  fetchMock: Mock<typeof fetch>;
}

export interface RunOptions extends Partial<RunCliOptions> {
  stdinText?: string;
}

function collector(): { stream: Writable; text(): string } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, done) {
      chunks.push(String(chunk));
      done();
    },
  });
  return { stream, text: () => chunks.join("") };
}

/** A `fetch` that fails the test when called (the no-request guarantee). */
export const forbiddenFetch: typeof fetch = () => {
  throw new Error("fetch must not be called in this test");
};

/** Runs the fixture CLI with captured I/O and a stubbed `fetch`. */
export async function run(
  args: string[],
  fetchImpl: typeof fetch = forbiddenFetch,
  options: RunOptions = {},
): Promise<RunResult> {
  const out = collector();
  const err = collector();
  const fetchMock = vi.fn<typeof fetch>(fetchImpl);
  const { stdinText, ...rest } = options;

  const code = await runCli({
    catalog: fixtureCatalog,
    config: fixtureConfig,
    sdk: fixtureSdk,
    argv: ["node", "fixture-cli", ...args],
    env: { FIXTURE_HTTP_URL: ENDPOINT },
    fetchImpl: fetchMock,
    stdin: Readable.from(stdinText === undefined ? [] : [stdinText]),
    stdout: out.stream,
    stderr: err.stream,
    isTTY: { stdin: false, stdout: false },
    ...rest,
  });

  const stdout = out.text();
  const stderr = err.text();
  return {
    code,
    stdout,
    stderr,
    lines: stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as unknown),
    error: stderr.trim()
      ? (JSON.parse(stderr.trim()) as Record<string, unknown>)
      : undefined,
    fetchMock,
  };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Sequential JSON responses; the last one repeats if requests outnumber them. */
export function respondWith(...bodies: unknown[]): typeof fetch {
  let index = 0;
  return (async () =>
    jsonResponse(bodies[Math.min(index++, bodies.length - 1)])) as typeof fetch;
}

/** Parsed body and headers of the nth request made through the mock. */
export function sentRequest(
  result: RunResult,
  call = 0,
): { query: string; variables: Record<string, unknown>; headers: Headers } {
  const [, init] = result.fetchMock.mock.calls[call]!;
  const body = JSON.parse(String(init?.body)) as {
    query: string;
    variables: Record<string, unknown>;
  };
  return { ...body, headers: new Headers(init?.headers) };
}

export function sseResponse(frames: string[], status = 200): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const frame of frames) controller.enqueue(encoder.encode(frame));
        controller.close();
      },
    }),
    { status, headers: { "content-type": "text/event-stream" } },
  );
}

/** SSE response that stays open (like an idle subscription) until aborted. */
export function openSseResponse(
  frames: string[],
  signal: AbortSignal | null | undefined,
): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const frame of frames) controller.enqueue(encoder.encode(frame));
        signal?.addEventListener("abort", () => {
          controller.error(new DOMException("Aborted", "AbortError"));
        });
      },
    }),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );
}

export function nextFrame(payload: unknown): string {
  return `event: next\ndata: ${JSON.stringify(payload)}\n\n`;
}

export const COMPLETE_FRAME = "event: complete\ndata:\n\n";
