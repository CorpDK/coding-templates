import {
  toGraphqlRequestError,
  type GraphqlOperation,
} from "@corpdk/graphql-dsl";
import type { CommandDescriptor, RuntimeConfig } from "../codegen/types.js";
import { reportRequestError } from "./errors.js";
import { postOperation } from "./http.js";
import {
  settleResponse,
  type OutputStreams,
  type ResultFormat,
} from "./output.js";
import { walkConnection } from "./paginate.js";
import { streamSubscription } from "./sse.js";
import type { Transport } from "./transport.js";
import type { ArgVariables, GlobalFlags, SdkBindings } from "./types.js";

/**
 * Composes the validated variables with the generated selection through the
 * SDK's `build*` (doc 14 §3.2). Scalar-root fields carry only `__args`.
 */
export function buildOperation(
  op: CommandDescriptor,
  variables: ArgVariables,
  sdk: SdkBindings,
): GraphqlOperation {
  const hasArgs = Object.keys(variables).length > 0;
  const hasSelection = Object.keys(op.selection).length > 0;
  const root = {
    ...(hasArgs ? { __args: variables } : {}),
    ...op.selection,
  };
  const request = { [op.field]: hasArgs || hasSelection ? root : true };
  switch (op.kind) {
    case "query":
      return sdk.buildQuery(request);
    case "mutation":
      return sdk.buildMutation(request);
    case "subscription":
      return sdk.buildSubscription(request);
  }
}

export interface ExecutionContext {
  config: RuntimeConfig;
  sdk: SdkBindings;
  transport: Transport;
  streams: OutputStreams;
  globals: GlobalFlags;
}

async function runUnary(
  operation: GraphqlOperation,
  context: ExecutionContext,
): Promise<number> {
  const { config, transport, streams, globals } = context;
  try {
    const body = await postOperation(transport, operation);
    return settleResponse(
      body,
      config,
      streams,
      { raw: globals.raw, pretty: globals.pretty },
      transport.redact,
      operation.operationName,
    );
  } catch (error_) {
    return reportRequestError(
      streams.stderr,
      toGraphqlRequestError(error_),
      transport.redact,
    );
  }
}

/**
 * Sends one validated command: a single HTTP POST for queries and mutations,
 * an SSE stream for subscriptions, or a paging walk for `--all`.
 */
export async function executeCommand(
  op: CommandDescriptor,
  variables: ArgVariables,
  context: ExecutionContext,
): Promise<number> {
  const { sdk, transport, streams, config, globals } = context;
  const format: ResultFormat = { raw: globals.raw, pretty: globals.pretty };

  if (op.kind === "subscription") {
    return streamSubscription(
      transport,
      buildOperation(op, variables, sdk),
      config,
      streams,
      format,
      { maxEvents: globals.maxEvents, deadlineMs: globals.timeoutMs },
    );
  }
  if (globals.all) {
    return walkConnection(
      op,
      variables,
      (pageVariables) => buildOperation(op, pageVariables, sdk),
      transport,
      config,
      streams,
      { maxPages: globals.maxPages, deadlineMs: globals.timeoutMs },
    );
  }
  return runUnary(buildOperation(op, variables, sdk), context);
}
