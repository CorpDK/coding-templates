import {
  iterateConnection,
  normalizeGraphqlResult,
  toGraphqlRequestError,
  type ConnectionExec,
  type GraphqlOperation,
} from "@corpdk/graphql-dsl";
import type { CommandDescriptor, RuntimeConfig } from "../codegen/types.js";
import { reportRequestError } from "./errors.js";
import { EXIT_OK } from "./exit-codes.js";
import { postOperation } from "./http.js";
import { writeJson, type OutputStreams } from "./output.js";
import { createStopSignal } from "./signals.js";
import type { Transport } from "./transport.js";
import type { ArgVariables } from "./types.js";

export interface PaginateOptions {
  maxPages?: number;
  /** Total deadline (exit 0); set only when `--timeout-ms` was given. */
  deadlineMs?: number;
}

type Build = (variables: ArgVariables) => GraphqlOperation;

function dropUndefined(values: Record<string, unknown>): ArgVariables {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  );
}

function pagingDirection(
  op: CommandDescriptor,
  variables: ArgVariables,
): "forward" | "backward" {
  if (variables.last !== undefined || variables.before !== undefined) {
    return "backward";
  }
  if (variables.first !== undefined || variables.after !== undefined) {
    return "forward";
  }
  return op.paginated?.direction === "backward" ? "backward" : "forward";
}

function pageSizeFor(variables: ArgVariables, config: RuntimeConfig): number {
  const requested = variables.first ?? variables.last;
  return typeof requested === "number"
    ? requested
    : config.pagination.defaultPageSize;
}

/**
 * `--all`: walks a Relay root connection with the SDK paginator and prints
 * every node as one NDJSON line the moment its page arrives (doc 14 §4.10).
 * End of data, `--max-pages`, the total deadline and SIGINT/SIGTERM exit 0;
 * errors keep the lines already written and follow the §4.4 exit mapping.
 */
export async function walkConnection(
  op: CommandDescriptor,
  variables: ArgVariables,
  build: Build,
  transport: Transport,
  config: RuntimeConfig,
  streams: OutputStreams,
  options: PaginateOptions,
): Promise<number> {
  const stop = createStopSignal(options.deadlineMs);
  const direction = pagingDirection(op, variables);
  const userErrorsFields = config.output.failOnUserErrors
    ? config.output.userErrorsFields
    : [];

  const exec: ConnectionExec = async (operation) => {
    const body = await postOperation(transport, operation, stop.signal);
    const normalized = normalizeGraphqlResult(body, {
      operationName: operation.operationName,
      userErrorsFields,
    });
    if (!normalized.ok) throw normalized.error;
    return normalized.data;
  };

  const buildPage = (
    pageVariables: Record<string, unknown>,
  ): GraphqlOperation => {
    const merged: ArgVariables = {
      ...variables,
      ...dropUndefined(pageVariables),
    };
    // A user-supplied opposite page-size argument would conflict with the walk.
    delete merged[direction === "forward" ? "last" : "first"];
    return build(merged);
  };

  try {
    for await (const node of iterateConnection(exec, {
      field: op.field,
      args: variables,
      select: op.selection,
      pageSize: pageSizeFor(variables, config),
      direction,
      maxPages: options.maxPages,
      signal: stop.signal,
      build: buildPage,
    })) {
      writeJson(streams.stdout, node, false);
    }
    return EXIT_OK;
  } catch (error_) {
    if (stop.signal.aborted) return EXIT_OK;
    return reportRequestError(
      streams.stderr,
      toGraphqlRequestError(error_),
      transport.redact,
    );
  } finally {
    stop.dispose();
  }
}
