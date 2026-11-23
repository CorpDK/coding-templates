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
  build: (variables: Record<string, unknown>) => GraphqlOperation;
}

export type ConnectionExec = (op: GraphqlOperation) => Promise<unknown>;

type Direction = "forward" | "backward";

type ConnectionPayload = {
  nodes?: unknown[];
  edges?: { cursor?: string; node?: unknown }[];
  pageInfo?: PageInfo;
};

function connectionShape(
  data: unknown,
  field: string,
): ConnectionPayload | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;
  const conn = root[field];
  if (!conn || typeof conn !== "object") return null;
  return conn as ConnectionPayload;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw toGraphqlRequestError(new DOMException("Aborted", "AbortError"));
  }
}

function pagingArgs(
  direction: Direction,
  pageSize: number,
  after?: string,
  before?: string,
): Record<string, unknown> {
  return direction === "forward"
    ? { first: pageSize, after }
    : { last: pageSize, before };
}

function connectionNodes(conn: ConnectionPayload): unknown[] {
  return (
    conn.nodes ??
    conn.edges?.map((e) => e.node).filter((n) => n !== undefined) ??
    []
  );
}

function directionalCursor(
  conn: ConnectionPayload,
  direction: Direction,
): string | null | undefined {
  return direction === "forward"
    ? conn.pageInfo?.endCursor
    : conn.pageInfo?.startCursor;
}

function hasMorePages(conn: ConnectionPayload, direction: Direction): boolean {
  return direction === "forward"
    ? Boolean(conn.pageInfo?.hasNextPage)
    : Boolean(conn.pageInfo?.hasPreviousPage);
}

function trackCursor(
  cursor: string,
  seenCursors: Set<string>,
): string | undefined {
  if (seenCursors.has(cursor)) {
    throw toGraphqlRequestError(
      new Error("Repeated connection cursor from server"),
    );
  }
  seenCursors.add(cursor);
  return cursor;
}

interface PagingState {
  after?: string;
  before?: string;
}

async function loadConnectionPage(
  exec: ConnectionExec,
  options: IterateConnectionOptions<string, Record<string, unknown>, unknown>,
  direction: Direction,
  paging: PagingState,
): Promise<ConnectionPayload> {
  const variables = {
    ...options.args,
    ...pagingArgs(
      direction,
      options.pageSize,
      paging.after,
      paging.before,
    ),
  };
  const raw = await exec(options.build(variables));
  const conn = connectionShape(raw, options.field);
  if (!conn?.pageInfo) {
    throw toGraphqlRequestError(new Error("Response is not a connection"));
  }
  return conn;
}

function advancePaging(
  direction: Direction,
  cursor: string,
  paging: PagingState,
): void {
  if (direction === "forward") paging.after = cursor;
  else paging.before = cursor;
}

async function* walkConnectionPages(
  exec: ConnectionExec,
  options: IterateConnectionOptions<string, Record<string, unknown>, unknown>,
): AsyncGenerator<{ conn: ConnectionPayload; pageNumber: number }> {
  const direction = options.direction ?? "forward";
  const maxPages = options.maxPages ?? Number.POSITIVE_INFINITY;
  const seenCursors = new Set<string>();
  const paging: PagingState = {};
  let pageNumber = 0;

  while (pageNumber < maxPages) {
    throwIfAborted(options.signal);
    const conn = await loadConnectionPage(exec, options, direction, paging);
    pageNumber++;
    yield { conn, pageNumber };

    const cursor = directionalCursor(conn, direction);
    if (!hasMorePages(conn, direction) || cursor == null) break;

    const next = trackCursor(cursor, seenCursors);
    if (next) advancePaging(direction, next, paging);
  }
}

export async function* iterateConnection<
  Field extends string,
  Args extends Record<string, unknown>,
  Node,
>(
  exec: ConnectionExec,
  options: IterateConnectionOptions<Field, Args, unknown>,
): AsyncGenerator<Node> {
  for await (const { conn } of walkConnectionPages(exec, options)) {
    for (const item of connectionNodes(conn)) {
      yield item as Node;
    }
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
  for await (const { conn, pageNumber } of walkConnectionPages(exec, options)) {
    const nodes = connectionNodes(conn) as Node[];
    yield { nodes, pageInfo: conn.pageInfo!, pageNumber };
  }
}