import type { ZodError, ZodType } from "zod";

export interface GraphqlInputIssue {
  path: (string | number)[];
  message: string;
  code: string;
}

export type GraphqlInputParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; issues: GraphqlInputIssue[] };

export class GraphqlInputValidationError extends Error {
  readonly kind = "validation" as const;
  readonly issues: GraphqlInputIssue[];

  constructor(issues: GraphqlInputIssue[]) {
    super(issues.map((i) => i.message).join("; "));
    this.name = "GraphqlInputValidationError";
    this.issues = issues;
  }
}

export function zodErrorToIssues(error: ZodError): GraphqlInputIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.filter((p): p is string | number => typeof p === "string" || typeof p === "number"),
    message: issue.message,
    code: issue.code,
  }));
}

export type InputParserRegistry = Record<string, ZodType>;