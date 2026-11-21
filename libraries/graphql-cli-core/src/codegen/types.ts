import type { GraphQLOutputType } from "graphql";

export type OperationKind = "query" | "mutation" | "subscription";

export interface IncludeExcludeConfig {
  queries: string[];
  mutations: string[];
  subscriptions: string[];
}

export type LookupOverride = string | { fields: string[] };

export interface SelectionConfig {
  policy: "relation-ids";
  connection?: "nodes" | "edges";
  maxWrapperDepth?: number;
  lookup?: Record<string, LookupOverride>;
  overrides?: Record<string, { expand?: string[] }>;
}

export interface GuardConfig {
  destructive: string[];
}

export interface TransportConfig {
  httpUrlEnv?: string;
  defaultUrl?: string;
  tokenEnv?: string;
  headersEnv?: string;
  timeoutMs?: number;
}

export interface OutputConfig {
  userErrorsFields?: string[];
  failOnUserErrors?: boolean;
}

export interface ManConfig {
  enabled?: boolean;
}

export interface CommandsConfig {
  warnAbove?: number;
}

export interface PaginationConfig {
  defaultPageSize?: number;
}

export interface EmitCliModulesOptions {
  selection?: SelectionConfig;
  include?: IncludeExcludeConfig;
  exclude?: IncludeExcludeConfig;
  guard?: GuardConfig;
  transport?: TransportConfig;
  output?: OutputConfig;
  pagination?: PaginationConfig;
  commands?: CommandsConfig;
  man?: ManConfig;
  bin?: string;
  packageName?: string;
  packageVersion?: string;
}

export interface ArgDescriptor {
  name: string;
  flag: string;
  graphqlType: string;
  kind: "scalar" | "enum" | "input";
  list: boolean;
  required: boolean;
  defaultValue?: unknown;
  enumValues?: string[];
  inputZodSchemaName?: string;
  scalarZodSchemaName?: string;
  scalarWire?: "string" | "json";
  description?: string;
}

export interface FollowUp {
  path: string;
  type: string;
  command: string;
  flags: Record<string, string>;
}

export interface CommandDescriptor {
  command: string;
  kind: OperationKind;
  field: string;
  description?: string;
  deprecated?: string;
  destructive: boolean;
  paginated?: {
    direction: "forward" | "backward" | "both";
    nodes: "nodes" | "edges";
  };
  followUps: FollowUp[];
  args: ArgDescriptor[];
  selection: SelectionTree;
}

export interface RuntimeConfig {
  transport: Required<Pick<TransportConfig, "httpUrlEnv">> &
    Omit<TransportConfig, "httpUrlEnv">;
  guard: GuardConfig;
  output: Required<
    Pick<OutputConfig, "userErrorsFields" | "failOnUserErrors">
  > &
    OutputConfig;
  pagination: Required<Pick<PaginationConfig, "defaultPageSize">> &
    PaginationConfig;
  bin: string;
  packageName?: string;
}

export type SelectionLeaf = true;

export interface SelectionTree {
  [field: string]: SelectionLeaf | SelectionTree | SelectionUnion;
}

export interface SelectionUnion extends SelectionTree {
  __typename: true;
  [key: `on_${string}`]: SelectionTree;
}

export type SelectionValue = SelectionLeaf | SelectionTree | SelectionUnion;

export interface SelectionEmitResult {
  selection: SelectionTree;
  followUps: FollowUp[];
  warnings: string[];
}

export interface ExtractedOperation {
  kind: OperationKind;
  field: string;
  command: string;
  description?: string;
  deprecated?: string;
  destructive: boolean;
  paginated: CommandDescriptor["paginated"];
  args: ArgDescriptor[];
  returnType: GraphQLOutputType;
  selection: SelectionTree;
  followUps: FollowUp[];
  warnings: string[];
}

export interface EmitCliModulesResult {
  commands: CommandDescriptor[];
  /** Generated `src/generated/commands.ts` source. */
  commandsSource: string;
  runtimeConfig: RuntimeConfig;
  selections: Record<string, string>;
  man?: string;
  texi?: string;
  warnings: string[];
}

export interface LookupCandidate {
  fieldName: string;
  typeName: string;
  requiredArgs: { argName: string; fieldName: string; typeName: string }[];
}

export interface LookupIndex {
  byType: Map<string, LookupCandidate[]>;
  commandByField: Map<string, string>;
}

export class CodegenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodegenError";
  }
}
