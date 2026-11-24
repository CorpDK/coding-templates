import { Readable } from "node:stream";
import type { CommandDescriptor, RuntimeConfig } from "../../codegen/types.js";
import type { SdkBindings } from "../types.js";

export const harnessConfig: RuntimeConfig = {
  bin: "test-cli",
  transport: {
    httpUrlEnv: "GRAPHQL_HTTP_URL",
    defaultUrl: "http://127.0.0.1:9/graphql",
    tokenEnv: "GRAPHQL_TOKEN",
    headersEnv: "GRAPHQL_HEADERS_JSON",
    timeoutMs: 5000,
  },
  guard: { destructive: ["delete*"] },
  output: { userErrorsFields: ["userErrors"], failOnUserErrors: true },
  pagination: { defaultPageSize: 2 },
};

export function captureIo(): {
  stdout: string[];
  stderr: string[];
  streams: {
    stdout: NodeJS.WritableStream;
    stderr: NodeJS.WritableStream;
    stdin: NodeJS.ReadableStream;
  };
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const write =
    (buf: string[]) =>
    (chunk: string | Uint8Array): boolean => {
      buf.push(String(chunk));
      return true;
    };
  const stdin = Readable.from([]);
  return {
    stdout,
    stderr,
    streams: {
      stdin,
      stdout: { write: write(stdout) } as NodeJS.WritableStream,
      stderr: { write: write(stderr) } as NodeJS.WritableStream,
    },
  };
}

export function baseSdk(overrides?: Partial<SdkBindings>): SdkBindings {
  const passthrough = (sel: Record<string, unknown>) => {
    const field = Object.keys(sel)[0];
    const root = sel[field] as { __args?: Record<string, unknown> } | undefined;
    return {
      query: `query { ${field} }`,
      variables: root?.__args,
      operationName: field,
    };
  };
  const base: SdkBindings = {
    buildQuery: passthrough,
    buildMutation: passthrough,
    buildSubscription: passthrough,
    validation: {
      inputZodSchemas: {},
      scalarZodSchemas: {},
      safeParseGraphqlInput: () => ({ ok: true, data: {} }),
      safeParseOptionalGraphqlInput: () => ({ ok: true, data: undefined }),
      safeParseGraphqlInputList: () => ({ ok: true, data: [] }),
      safeParseOptionalGraphqlInputList: () => ({ ok: true, data: [] }),
      safeParseGraphqlScalar: () => ({ ok: true, data: "ok" }),
    },
  };
  return { ...base, ...overrides };
}

export const deleteItemCmd: CommandDescriptor = {
  command: "delete-item",
  kind: "mutation",
  field: "deleteItem",
  destructive: true,
  followUps: [],
  args: [
    {
      name: "id",
      flag: "--id",
      graphqlType: "ID!",
      kind: "scalar",
      list: false,
      required: true,
    },
  ],
  selection: {},
};
