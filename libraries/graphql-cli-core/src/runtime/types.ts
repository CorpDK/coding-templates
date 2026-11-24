import type { ZodType } from "zod";
import type { GraphqlInputParseResult } from "@corpdk/graphql-input-zod";
import type { GraphqlOperation } from "@corpdk/graphql-dsl";
import type { CommandDescriptor, RuntimeConfig } from "../codegen/types.js";

/** Variables collected for one operation, keyed by GraphQL argument name. */
export type ArgVariables = Record<string, unknown>;

/**
 * The shape `runCli` expects from `<sdk>/validation` (doc 14 §3.5).
 * Method syntax keeps the parameter check bivariant so SDKs with narrower
 * generated signatures remain assignable.
 */
export interface SdkValidationBindings {
  inputZodSchemas: Record<string, ZodType>;
  scalarZodSchemas: Record<string, ZodType>;
  safeParseGraphqlInput(
    name: string,
    value: unknown,
  ): GraphqlInputParseResult<unknown>;
  safeParseOptionalGraphqlInput(
    name: string,
    value: unknown,
  ): GraphqlInputParseResult<unknown>;
  safeParseGraphqlInputList(
    name: string,
    value: unknown,
  ): GraphqlInputParseResult<unknown>;
  safeParseOptionalGraphqlInputList(
    name: string,
    value: unknown,
  ): GraphqlInputParseResult<unknown>;
  safeParseGraphqlScalar(
    name: string,
    value: unknown,
  ): GraphqlInputParseResult<unknown>;
}

/**
 * Structural binding to a `create-graphql-sdk` package (doc 14 §3.2): the three
 * `build*` functions plus the `./validation` exports. Method syntax is
 * deliberate; SDK `build*` functions accept narrowly typed selection roots.
 */
export interface SdkBindings {
  buildQuery(selection: Record<string, unknown>): GraphqlOperation;
  buildMutation(selection: Record<string, unknown>): GraphqlOperation;
  buildSubscription(selection: Record<string, unknown>): GraphqlOperation;
  validation: SdkValidationBindings;
}

/** User-owned extension module (`src/extensions/index.ts`). */
export interface CliExtensions {
  /** Async header provider; called before every HTTP request and SSE connect. */
  headers?: (context: {
    endpoint: string;
  }) => Promise<Record<string, string>> | Record<string, string>;
  [key: string]: unknown;
}

/** Subset of `@clack/prompts` used by interactive mode (injectable for tests). */
export type PromptsModule = Pick<
  typeof import("@clack/prompts"),
  | "intro"
  | "outro"
  | "cancel"
  | "isCancel"
  | "log"
  | "note"
  | "select"
  | "autocomplete"
  | "text"
  | "confirm"
>;

export interface TtyState {
  stdin: boolean;
  stdout: boolean;
}

export interface RunCliOptions {
  catalog: Record<string, CommandDescriptor>;
  config: RuntimeConfig;
  sdk: SdkBindings;
  extensions?: CliExtensions;
  /** Full `process.argv` (default); the first two entries are skipped. */
  argv?: readonly string[];
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  stdin?: NodeJS.ReadableStream;
  stdout?: NodeJS.WritableStream;
  stderr?: NodeJS.WritableStream;
  /** TTY detection override; defaults to `process.stdin/stdout.isTTY`. */
  isTTY?: TtyState;
  packageVersion?: string;
  /** Loader for `@clack/prompts`; defaults to a dynamic `import()`. */
  loadPrompts?: () => Promise<PromptsModule>;
}

/** Global flags shared by every command (doc 14 §4.1). */
export interface GlobalFlags {
  varsFile?: string;
  endpoint?: string;
  timeoutMs?: number;
  maxEvents?: number;
  all: boolean;
  maxPages?: number;
  confirm: boolean;
  interactive: boolean;
  pretty: boolean;
  raw: boolean;
  help: boolean;
  version: boolean;
}

/** Resolved I/O and environment shared by all runtime stages. */
export interface RuntimeIo {
  env: NodeJS.ProcessEnv;
  fetchImpl: typeof fetch;
  stdin: NodeJS.ReadableStream;
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
  isTTY: TtyState;
}
