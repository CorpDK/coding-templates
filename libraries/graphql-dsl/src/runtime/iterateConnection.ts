import type { GraphqlOperation } from "./generateGraphqlOperation.js";
import { toGraphqlRequestError } from "./normalizeGraphqlResult.js";

export interface PageInfo {
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  startCursor?: string | null;
  endCursor?: string | null;
}

export interface ConnectionPage<Node> {
  nodes: Node[];
  pageInfo: PageInfo;
  pageNumber: number;
}

export interface IterateConnectionOptions<
  Field extends string,
  Args extends Record<string, unknown>,
  NodeSel,
> {
  field: Field;
  args: Args;
  select: NodeSel;
  pageSize: number;
  direction?: "forward" | "backward";
  maxPages?: number;
  signal?: AbortSignal;
}

export type ConnectionExec = (op: GraphqlOperation) => Promise<unknown>;

function connectionShape(data: unknown, field: string): {
  nodes?: unknown[];
  edges?: { cursor?: string; node?: unknown }[];
  pageInfo?: PageInfo;
} | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;
  const conn = root[field];
  if (!conn || typeof conn !== "object") return null;
  return conn as {
    nodes?: unknown[];
    edges?: { cursor?: string; node?: unknown }[];
    pageInfo?: PageInfo;
  };
}

export async function* iterateConnection<
  Field extends string,
  Args extends Record<string, unknown>,
  Node,
>(
  exec: ConnectionExec,
  options: IterateConnectionOptions<Field, Args, unknown>,
): AsyncGenerator<Node> {
  let after: string | undefined;
  let before: string | undefined;
  let pageNumber = 0;
  const seenCursors = new Set<string>();
  const direction = options.direction ?? "forward";
  const maxPages = options.maxPages ?? Number.POSITIVE_INFINITY;

  while (pageNumber < maxPages) {
    if (options.signal?.aborted) {
      throw toGraphqlRequestError(new DOMException("Aborted", "AbortError"));
    }

    const paging =
      direction === "forward"
        ? { first: options.pageSize, after }
        : { last: options.pageSize, before };

    const op: GraphqlOperation = {
      query: "",
      variables: { ...options.args, ...paging },
    };

    const raw = await exec(op);
    pageNumber++;

    const conn = connectionShape(raw, options.field);
    if (!conn?.pageInfo) {
      throw toGraphqlRequestError(new Error("Response is not a connection"));
    }

    const items =
      conn.nodes ??
      conn.edges?.map((e) => e.node).filter((n) => n !== undefined) ??
      [];

    for (const item of items) {
      yield item as Node;
    }

    const cursor =
      direction === "forward"
        ? conn.pageInfo.endCursor
        : conn.pageInfo.startCursor;

    const hasMore =
      direction === "forward"
        ? conn.pageInfo.hasNextPage
        : conn.pageInfo.hasPreviousPage;

    if (!hasMore || cursor == null) break;

    if (seenCursors.has(cursor)) {
      throw toGraphqlRequestError(
        new Error("Repeated connection cursor from server"),
      );
    }
    seenCursors.add(cursor);

    if (direction === "forward") after = cursor;
    else before = cursor;
  }
}

export async function* paginateConnection<
  Field extends string,
  Args extends Record<string, unknown>,
  Node,
>(
  exec: ConnectionExec,
  options: IterateConnectionOptions<Field, Args, unknown>,
): AsyncGenerator<ConnectionPage<Node>> {
  let after: string | undefined;
  let before: string | undefined;
  let pageNumber = 0;
  const seenCursors = new Set<string>();
  const direction = options.direction ?? "forward";
  const maxPages = options.maxPages ?? Number.POSITIVE_INFINITY;

  while (pageNumber < maxPages) {
    if (options.signal?.aborted) {
      throw toGraphqlRequestError(new DOMException("Aborted", "AbortError"));
    }

    const paging =
      direction === "forward"
        ? { first: options.pageSize, after }
        : { last: options.pageSize, before };

    const op: GraphqlOperation = { query: "", variables: { ...options.args, ...paging } };
    const raw = await exec(op);
    pageNumber++;

    const conn = connectionShape(raw, options.field);
    if (!conn?.pageInfo) {
      throw toGraphqlRequestError(new Error("Response is not a connection"));
    }

    const nodes = (
      conn.nodes ??
      conn.edges?.map((e) => e.node).filter((n) => n !== undefined) ??
      []
    ) as Node[];

    yield { nodes, pageInfo: conn.pageInfo, pageNumber };

    const cursor =
      direction === "forward"
        ? conn.pageInfo.endCursor
        : conn.pageInfo.startCursor;
    const hasMore =
      direction === "forward"
        ? conn.pageInfo.hasNextPage
        : conn.pageInfo.hasPreviousPage;

    if (!hasMore || cursor == null) break;
    if (seenCursors.has(cursor)) {
      throw toGraphqlRequestError(
        new Error("Repeated connection cursor from server"),
      );
    }
    seenCursors.add(cursor);
    if (direction === "forward") after = cursor;
    else before = cursor;
  }
}