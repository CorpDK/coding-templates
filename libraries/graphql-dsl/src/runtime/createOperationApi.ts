import type { LinkedType } from "./types.js";
import {
  generateGraphqlOperation,
  type Fields,
  type GraphqlOperation,
  type VariableTyping,
} from "./generateGraphqlOperation.js";
import type { BuiltOperation } from "./builtOperation.js";
import { isVariableRef, v, type VariableRef } from "./variableRef.js";

export type { VariableRef };
export { v };

export interface DefineOperationOptions<
  V extends Record<string, VariableRef<unknown>>,
  S,
> {
  name: string;
  variables?: V;
  select: (vars: VarMap<V>) => S;
}

type VarMap<V extends Record<string, VariableRef<unknown>>> = {
  [K in keyof V]: VariableRef<V[K] extends VariableRef<infer T> ? T : unknown>;
};

export interface OperationApi<RootSel, Root extends LinkedType> {
  build(
    fields: RootSel & { __name?: string; __aliases?: Record<string, Fields> },
  ): GraphqlOperation;
  define<
    V extends Record<string, VariableRef<unknown>>,
    S extends Fields,
  >(
    options: DefineOperationOptions<V, S>,
  ): BuiltOperation<unknown, VariablesMap<V>>;
}

type VariablesMap<V extends Record<string, VariableRef<unknown>>> = {
  [K in keyof V]: V[K] extends VariableRef<infer T> ? T : unknown;
};

export function createOperationApi<RootSel, Root extends LinkedType>(
  operation: "query" | "mutation" | "subscription",
  root: Root,
  bindResult: <S extends Fields>(
    op: GraphqlOperation,
    selection: S,
  ) => BuiltOperation<unknown, undefined>,
): OperationApi<RootSel, Root> {
  const build = (
    fields: RootSel & { __name?: string; __aliases?: Record<string, Fields> },
  ) => generateGraphqlOperation(operation, root, fields as Fields);

  const define = <
    V extends Record<string, VariableRef<unknown>>,
    S extends Fields,
  >(
    options: DefineOperationOptions<V, S>,
  ): BuiltOperation<unknown, VariablesMap<V>> => {
    const vars = options.variables ?? ({} as V);
    const varMap = Object.fromEntries(
      Object.keys(vars).map((k) => [k, { ...v(), name: k }]),
    ) as VarMap<V>;

    const namedVariables: Record<string, VariableTyping> = {};
    for (const key of Object.keys(vars)) {
      const placeholder = vars[key]!;
      namedVariables[key] = {
        value: undefined,
        typing: [{ name: key, scalar: [] } as LinkedType, "String"],
      };
      void placeholder;
    }

    const selection = options.select(varMap) as Fields;
    selection.__name = options.name;

    const op = generateGraphqlOperation(operation, root, selection, {
      namedVariables,
    });

    return bindResult(op, selection) as unknown as BuiltOperation<
      unknown,
      VariablesMap<V>
    >;
  };

  return { build, define };
}