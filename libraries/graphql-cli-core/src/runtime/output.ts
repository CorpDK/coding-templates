import { normalizeGraphqlResult } from "@corpdk/graphql-dsl";
import type { RuntimeConfig } from "../codegen/types.js";
import { reportRequestError } from "./errors.js";
import { EXIT_OK } from "./exit-codes.js";
import type { GraphqlResponse } from "./http.js";

export interface OutputStreams {
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
}

export interface ResultFormat {
  /** Print the whole response instead of `data`. */
  raw: boolean;
  /** Indent JSON (single-document output only; NDJSON is never indented). */
  pretty: boolean;
}

export function writeJson(
  stdout: NodeJS.WritableStream,
  value: unknown,
  pretty: boolean,
): void {
  stdout.write(`${JSON.stringify(value, null, pretty ? 2 : undefined)}\n`);
}

/**
 * Normalises one GraphQL response through the SDK (doc 14 §4.4), prints what
 * belongs on stdout, reports failures on stderr, and returns the exit code.
 */
export function settleResponse(
  body: GraphqlResponse,
  config: RuntimeConfig,
  streams: OutputStreams,
  format: ResultFormat,
  redact: (text: string) => string,
  operationName?: string,
): number {
  const userErrorsFields = config.output.failOnUserErrors
    ? config.output.userErrorsFields
    : [];
  const normalized = normalizeGraphqlResult(body, {
    operationName,
    userErrorsFields,
  });

  if (normalized.ok) {
    writeJson(streams.stdout, format.raw ? body : normalized.data, format.pretty);
    return EXIT_OK;
  }

  const { error } = normalized;
  if (error.kind === "graphql" || error.kind === "userErrors") {
    const printable = format.raw ? body : body.data;
    if (printable !== undefined && printable !== null) {
      writeJson(streams.stdout, printable, format.pretty);
    }
  }
  return reportRequestError(streams.stderr, error, redact);
}
