import type { GraphqlRequestError } from "@corpdk/graphql-dsl";
import { exitCodeForRequestErrorKind, EXIT_USAGE } from "./exit-codes.js";

/** Raised by the CLI itself before any request is sent (exit 2). */
export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

/** One pre-flight validation problem, reported as `issues[]` on stderr. */
export interface CliValidationIssue {
  arg: string;
  path: (string | number)[];
  message: string;
  code: string;
}

export type CliErrorPayload =
  | { error: "usage"; message: string }
  | { error: "validation"; issues: readonly unknown[] }
  | { error: "graphql"; errors: readonly unknown[] }
  | { error: "transport"; status?: number; message: string }
  | { error: "userErrors"; userErrors: readonly unknown[] };

/** stderr is always exactly one JSON object per line (doc 14 §4.4). */
export function writeCliError(
  stderr: NodeJS.WritableStream,
  payload: CliErrorPayload,
): void {
  stderr.write(`${JSON.stringify(payload)}\n`);
}

function redactUnknown(
  value: unknown,
  redact: (text: string) => string,
): unknown {
  if (typeof value === "string") {
    return redact(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactUnknown(item, redact));
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        redactUnknown(nested, redact),
      ]),
    );
  }
  return value;
}

export function reportUsageError(
  stderr: NodeJS.WritableStream,
  message: string,
): number {
  writeCliError(stderr, { error: "usage", message });
  return EXIT_USAGE;
}

/**
 * Maps a normalised SDK error to its stderr payload and exit code. `redact`
 * scrubs secrets from free-text messages before they are written.
 */
export function reportRequestError(
  stderr: NodeJS.WritableStream,
  error: GraphqlRequestError,
  redact: (text: string) => string,
): number {
  switch (error.kind) {
    case "graphql":
      writeCliError(stderr, {
        error: "graphql",
        errors: redactUnknown(error.errors, redact) as readonly unknown[],
      });
      break;
    case "userErrors":
      writeCliError(stderr, {
        error: "userErrors",
        userErrors: redactUnknown(
          error.userErrors,
          redact,
        ) as readonly unknown[],
      });
      break;
    case "validation":
      writeCliError(stderr, {
        error: "validation",
        issues: redactUnknown(error.issues, redact) as readonly unknown[],
      });
      break;
    case "transport":
      writeCliError(stderr, {
        error: "transport",
        ...(error.status === undefined ? {} : { status: error.status }),
        message: redact(error.message),
      });
      break;
  }
  return exitCodeForRequestErrorKind(error.kind);
}
