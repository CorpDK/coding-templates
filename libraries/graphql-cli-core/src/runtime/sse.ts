import {
  toGraphqlRequestError,
  type GraphqlOperation,
  type GraphqlRequestError,
} from "@corpdk/graphql-dsl";
import type { RuntimeConfig } from "../codegen/types.js";
import { reportRequestError } from "./errors.js";
import { EXIT_OK } from "./exit-codes.js";
import { withHeader } from "./headers.js";
import { requestBody, type GraphqlResponse } from "./http.js";
import {
  settleResponse,
  type OutputStreams,
  type ResultFormat,
} from "./output.js";
import { createStopSignal } from "./signals.js";
import { transportFailure, type Transport } from "./transport.js";

export interface SseEvent {
  event: string;
  data: string;
}

/**
 * Incremental parser for the `text/event-stream` framing used by GraphQL over
 * SSE (distinct-connections mode). Hand-written; no client library (doc 14 §15).
 */
export function createSseParser(onEvent: (event: SseEvent) => void): {
  push(chunk: string): void;
  end(): void;
} {
  let buffer = "";

  const dispatch = (block: string): void => {
    let event = "message";
    const data: string[] = [];
    for (const line of block.split("\n")) {
      if (line === "" || line.startsWith(":")) continue;
      const colon = line.indexOf(":");
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? "" : line.slice(colon + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "event") event = value;
      else if (field === "data") data.push(value);
    }
    if (data.length > 0 || event !== "message") {
      onEvent({ event, data: data.join("\n") });
    }
  };

  const drain = (final: boolean): void => {
    buffer = buffer.replaceAll("\r\n", "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      dispatch(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
    }
    if (final && buffer.trim() !== "") dispatch(buffer);
    if (final) buffer = "";
  };

  return {
    push(chunk) {
      buffer += chunk;
      drain(false);
    },
    end() {
      drain(true);
    },
  };
}

export interface SubscriptionOptions {
  maxEvents?: number;
  /** Stop (exit 0) after this long; set only when `--timeout-ms` was given. */
  deadlineMs?: number;
}

type EventOutcome = { done: false } | { done: true; code: number };

type SubscriptionState = { outcome: EventOutcome; received: number };

type SubscriptionEventContext = {
  state: SubscriptionState;
  fail: (error: GraphqlRequestError) => number;
  config: RuntimeConfig;
  streams: OutputStreams;
  format: ResultFormat;
  redact: Transport["redact"];
  maxEvents: number | undefined;
};

function onSubscriptionSseEvent(event: SseEvent, ctx: SubscriptionEventContext): void {
  const { state } = ctx;
  if (state.outcome.done) return;
  if (event.event === "complete") {
    state.outcome = { done: true, code: EXIT_OK };
    return;
  }
  if (event.event === "error") {
    state.outcome = {
      done: true,
      code: ctx.fail(transportFailure(`SSE stream error: ${event.data}`)),
    };
    return;
  }
  if (event.event !== "next") return;

  let body: GraphqlResponse;
  try {
    body = JSON.parse(event.data) as GraphqlResponse;
  } catch {
    state.outcome = {
      done: true,
      code: ctx.fail(transportFailure("SSE event carried invalid JSON")),
    };
    return;
  }
  const code = settleResponse(
    body,
    ctx.config,
    ctx.streams,
    { raw: ctx.format.raw, pretty: false },
    ctx.redact,
  );
  state.received += 1;
  if (code !== EXIT_OK) state.outcome = { done: true, code };
  else if (ctx.maxEvents !== undefined && state.received >= ctx.maxEvents) {
    state.outcome = { done: true, code: EXIT_OK };
  }
}

async function openSubscriptionResponse(
  transport: Transport,
  operation: GraphqlOperation,
  signal: AbortSignal,
  fail: (error: GraphqlRequestError) => number,
): Promise<Response | number> {
  const headers = withHeader(
    await transport.headers(),
    "Accept",
    "text/event-stream",
  );
  const response = await transport.fetchImpl(transport.endpoint, {
    method: "POST",
    headers,
    body: requestBody(operation),
    signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return fail(
      transportFailure(
        `HTTP ${response.status} ${response.statusText}`.trim() +
          (text ? `: ${text.slice(0, 200)}` : ""),
        { status: response.status },
      ),
    );
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream") || !response.body) {
    return fail(
      transportFailure(
        `Expected text/event-stream, received ${contentType || "no content type"}`,
        { status: response.status },
      ),
    );
  }
  return response;
}

async function readSseUntilSettled(
  body: ReadableStream<Uint8Array>,
  handle: (event: SseEvent) => void,
  settled: () => number | undefined,
): Promise<number | undefined> {
  const parser = createSseParser(handle);
  const decoder = new TextDecoder();
  const reader = body.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (value) parser.push(decoder.decode(value, { stream: true }));
    const code = settled();
    if (code !== undefined) return code;
    if (done) break;
  }
  parser.push(decoder.decode());
  parser.end();
  return settled();
}

/** Streams one subscription over SSE; every stop condition exits 0. */
export async function streamSubscription(
  transport: Transport,
  operation: GraphqlOperation,
  config: RuntimeConfig,
  streams: OutputStreams,
  format: ResultFormat,
  options: SubscriptionOptions,
): Promise<number> {
  const stop = createStopSignal(options.deadlineMs);
  const closeRequest = new AbortController();
  const signal = AbortSignal.any([stop.signal, closeRequest.signal]);
  const fail = (error: GraphqlRequestError): number =>
    reportRequestError(streams.stderr, error, transport.redact);

  try {
    const opened = await openSubscriptionResponse(
      transport,
      operation,
      signal,
      fail,
    );
    if (typeof opened === "number") return opened;

    const state: SubscriptionState = { outcome: { done: false }, received: 0 };
    const ctx: SubscriptionEventContext = {
      state,
      fail,
      config,
      streams,
      format,
      redact: transport.redact,
      maxEvents: options.maxEvents,
    };
    const handle = (event: SseEvent): void => onSubscriptionSseEvent(event, ctx);
    const settled = (): number | undefined =>
      state.outcome.done ? state.outcome.code : undefined;

    const code = await readSseUntilSettled(opened.body!, handle, settled);
    if (code !== undefined) return code;
    return stop.signal.aborted
      ? EXIT_OK
      : fail(transportFailure("SSE stream ended without a complete event"));
  } catch (error_) {
    if (stop.signal.aborted) return EXIT_OK;
    return fail(toGraphqlRequestError(error_));
  } finally {
    closeRequest.abort();
    stop.dispose();
  }
}
