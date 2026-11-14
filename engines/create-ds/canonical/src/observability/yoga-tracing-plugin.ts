import { trace, SpanStatusCode, type Span } from "@opentelemetry/api";
import type { Plugin } from "graphql-yoga";
import {
  Kind,
  visit,
  type DocumentNode,
  type OperationDefinitionNode,
  type GraphQLError,
} from "graphql";
import { isOtelEnabled } from "./otel-config.js";

const tracer = trace.getTracer("@corpdk/ds/graphql");

function operationDefinition(
  document: DocumentNode,
  operationName?: string | null,
): OperationDefinitionNode | undefined {
  const ops: OperationDefinitionNode[] = [];
  for (const def of document.definitions) {
    if (def.kind === Kind.OPERATION_DEFINITION) ops.push(def);
  }
  if (ops.length === 0) return undefined;
  if (ops.length === 1) return ops[0];
  if (!operationName) return undefined;
  return ops.find((op) => op.name?.value === operationName);
}

const SENSITIVE_VARIABLE_KEY =
  /password|secret|token|authorization|api[_-]?key|credential|cookie|session/i;

function redactVariableValue(key: string, value: unknown): unknown {
  if (SENSITIVE_VARIABLE_KEY.test(key)) return "[REDACTED]";
  if (Array.isArray(value)) {
    return value.map((entry) =>
      entry !== null && typeof entry === "object"
        ? redactVariables(entry as Record<string, unknown>)
        : entry,
    );
  }
  if (value !== null && typeof value === "object") {
    return redactVariables(value as Record<string, unknown>);
  }
  return value;
}

function redactVariables(
  variables: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(variables)) {
    out[key] = redactVariableValue(key, value);
  }
  return out;
}

function sanitizedVariables(
  variables: Record<string, unknown> | null | undefined,
): string {
  if (!variables || Object.keys(variables).length === 0) return "{}";
  try {
    return JSON.stringify(redactVariables(variables));
  } catch {
    return "[unserializable]";
  }
}

function redactSensitiveLiteralRanges(document: DocumentNode): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  const pushValueLoc = (fieldName: string, loc: { start: number; end: number } | undefined) => {
    if (SENSITIVE_VARIABLE_KEY.test(fieldName) && loc) {
      ranges.push({ start: loc.start, end: loc.end });
    }
  };

  visit(document, {
    Argument(node) {
      pushValueLoc(node.name.value, node.value.loc);
    },
    ObjectField(node) {
      pushValueLoc(node.name.value, node.value.loc);
    },
  });

  return ranges;
}

function sanitizedDocument(document: DocumentNode): string {
  const source = document.loc?.source.body;
  if (!source) return "";

  const ranges = redactSensitiveLiteralRanges(document);
  if (ranges.length === 0) return source;

  ranges.sort((a, b) => b.start - a.start);
  let out = source;
  for (const { start, end } of ranges) {
    out = `${out.slice(0, start)}[REDACTED]${out.slice(end)}`;
  }
  return out;
}

function endSpan(
  span: Span,
  errors?: readonly GraphQLError[],
  unhandled?: Error,
): void {
  if (unhandled) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: unhandled.message,
    });
  } else if (errors?.length) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: errors.map((e) => e.message).join("; "),
    });
  } else {
    span.setStatus({ code: SpanStatusCode.OK });
  }
  span.end();
}

function finishFromResult(
  span: Span,
  result: { errors?: readonly GraphQLError[] } | AsyncIterable<unknown>,
): void {
  if (typeof (result as AsyncIterable<unknown>)[Symbol.asyncIterator] === "function") {
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
    return;
  }
  endSpan(span, (result as { errors?: readonly GraphQLError[] }).errors);
}

/** GraphQL execute spans (when OpenTelemetry is enabled). */
export function yogaTracingPlugin(): Plugin {
  if (!isOtelEnabled()) {
    return {};
  }

  return {
    onExecute({ args }) {
      const op = operationDefinition(args.document, args.operationName);
      const operationType = op?.operation ?? "unknown";
      const operationName =
        args.operationName ?? op?.name?.value ?? "anonymous";

      const span = tracer.startSpan(`graphql ${operationType}`, {
        attributes: {
          "graphql.operation.name": operationName,
          "graphql.operation.type": operationType,
          "graphql.document": sanitizedDocument(args.document),
          "graphql.variables": sanitizedVariables(
            args.variableValues as Record<string, unknown> | null | undefined,
          ),
        },
      });

      return {
        onExecuteDone(payload) {
          const { result } = payload;
          if (result instanceof Promise) {
            void result.then(
              (resolved) => finishFromResult(span, resolved),
              (err: unknown) => {
                const error =
                  err instanceof Error ? err : new Error(String(err));
                span.recordException(error);
                endSpan(span, undefined, error);
              },
            );
            return;
          }
          finishFromResult(span, result);
        },
      };
    },
  };
}
