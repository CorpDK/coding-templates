import type { LinkedField, LinkedType } from "./types.js";
import { isVariableRef } from "./variableRef.js";

export interface Args {
  [arg: string]: unknown | undefined;
}

export interface Fields {
  __name?: string;
  __aliases?: Record<string, Fields>;
  [field: string]: Request | string | Record<string, Fields> | undefined;
}

export type Request = boolean | number | Fields;

export interface VariableTyping {
  value: unknown;
  typing?: [LinkedType, string];
}

export interface Variables {
  [name: string]: VariableTyping;
}

export interface OperationContext {
  root: LinkedType;
  varCounter: number;
  variables: Variables;
  fragmentCounter: number;
  fragments: string[];
  /** Named variables from define* (already declared in the operation header). */
  namedVariables?: Record<string, VariableTyping>;
}

export interface GraphqlOperation {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

const RESERVED = new Set([
  "__scalar",
  "__name",
  "__aliases",
  "__args",
  "__include",
  "__skip",
]);

function resolveArgValue(
  value: unknown,
  ctx: OperationContext,
  argTyping: [LinkedType, string],
): string {
  if (isVariableRef(value)) {
    const name = value.name;
    if (!name) throw new Error("variable reference is missing a name");
    const declared = ctx.namedVariables?.[name];
    if (declared) {
      if (!declared.typing) {
        declared.typing = argTyping;
      } else {
        assertCompatibleType(declared.typing[1], argTyping[1], name);
      }
      return `$${name}`;
    }
    ctx.variables[name] = { value: undefined, typing: argTyping };
    return `$${name}`;
  }
  ctx.varCounter++;
  const varName = `v${ctx.varCounter}`;
  ctx.variables[varName] = { value, typing: argTyping };
  return `$${varName}`;
}

function assertCompatibleType(
  declared: string,
  expected: string,
  varName: string,
): void {
  const normalize = (s: string) => s.replace(/!/g, "").trim();
  if (normalize(declared) !== normalize(expected)) {
    throw new Error(
      `variable \`${varName}\` is declared as \`${declared}\` but used where \`${expected}\` is required`,
    );
  }
}

function parseFieldDirectives(
  request: Fields,
  ctx: OperationContext,
): { directives: string; body: Fields } {
  let includeExpr: string | undefined;
  let skipExpr: string | undefined;
  const body = { ...request };
  if ("__include" in body) {
    const cond = body.__include;
    delete body.__include;
    includeExpr = directiveCondition(cond, ctx, "Boolean!");
  }
  if ("__skip" in body) {
    const cond = body.__skip;
    delete body.__skip;
    skipExpr = directiveCondition(cond, ctx, "Boolean!");
  }
  const directives = [
    includeExpr ? `@include(if:${includeExpr})` : "",
    skipExpr ? `@skip(if:${skipExpr})` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return { directives, body };
}

function directiveCondition(
  cond: unknown,
  ctx: OperationContext,
  gqlType: string,
): string {
  if (isVariableRef(cond)) {
    const name = cond.name;
    if (!name) throw new Error("directive variable is missing a name");
    if (ctx.namedVariables?.[name]) {
      const declared = ctx.namedVariables[name];
      if (!declared.typing) {
        declared.typing = [
          { name: "Boolean", scalar: ["Boolean"] } as LinkedType,
          gqlType,
        ];
      } else {
        assertCompatibleType(declared.typing[1], gqlType, name);
      }
    } else {
      ctx.variables[name] = {
        value: undefined,
        typing: [{ name: "Boolean", scalar: ["Boolean"] } as LinkedType, gqlType],
      };
    }
    return `$${name}`;
  }
  ctx.varCounter++;
  const varName = `v${ctx.varCounter}`;
  ctx.variables[varName] = {
    value: cond,
    typing: [{ name: "Boolean", scalar: ["Boolean"] } as LinkedType, gqlType],
  };
  return `$${varName}`;
}

const parseRequest = (
  request: Request | undefined,
  ctx: OperationContext,
  path: string[],
  alias?: string,
): string => {
  if (typeof request === "object" && "__args" in request) {
    const args = request.__args as Args;
    const fields: Request = { ...request };
    delete (fields as Fields).__args;
    const argNames = Object.keys(args);

    if (argNames.length === 0) {
      return parseRequest(fields, ctx, path, alias);
    }

    const field = getFieldFromPath(ctx.root, path);

    const argStrings = argNames.map((argName) => {
      const typing = field.args?.[argName];
      if (!typing) {
        throw new Error(
          `no typing defined for argument \`${argName}\` in path \`${path.join(".")}\``,
        );
      }
      return `${argName}:${resolveArgValue(args[argName], ctx, typing)}`;
    });
    const argPart = `(${argStrings.join(",")})`;
    const tail = parseRequest(fields, ctx, path, alias);
    if (alias) {
      const fieldName = path[path.length - 1] ?? "";
      return `${alias}:${fieldName}${argPart}${tail}`;
    }
    return `${argPart}${tail}`;
  }

  if (typeof request === "object" && request !== null && Object.keys(request).length > 0) {
    const fields = request as Fields;

    if ("__aliases" in fields && fields.__aliases) {
      const aliasBlocks = Object.entries(fields.__aliases).flatMap(
        ([aliasName, aliasFields]) => {
          const innerKeys = Object.keys(aliasFields).filter(
            (k) => !RESERVED.has(k) && aliasFields[k],
          );
          if (innerKeys.length !== 1) {
            throw new Error(
              `alias \`${aliasName}\` must select exactly one field, got ${innerKeys.length}`,
            );
          }
          const innerField = innerKeys[0]!;
          return parseRequest(
            aliasFields[innerField] as Request,
            ctx,
            [...path, innerField],
            aliasName,
          );
        },
      );
      const withoutAliases = { ...fields };
      delete withoutAliases.__aliases;
      const rest = parseRequest(withoutAliases, ctx, path);
      if (rest.startsWith("{") && rest.endsWith("}")) {
        const inner = rest.slice(1, -1);
        return `{${inner}${inner && aliasBlocks.length ? "," : ""}${aliasBlocks.join(",")}}`;
      }
      return `{${aliasBlocks.join(",")}}`;
    }

    const fieldNames = Object.keys(fields).filter(
      (k) => Boolean(fields[k]) && !RESERVED.has(k),
    );

    if (fieldNames.length === 0) {
      throw new Error(`field selection should not be empty: ${path.join(".")}`);
    }

    const type =
      path.length > 0 ? getFieldFromPath(ctx.root, path).type : ctx.root;
    const scalarFields = type.scalar;

    let scalarFieldsFragment: string | undefined;

    if (fieldNames.includes("__scalar")) {
      const falsyFieldNames = new Set(
        Object.keys(fields).filter((k) => !fields[k]),
      );
      if (scalarFields?.length) {
        ctx.fragmentCounter++;
        scalarFieldsFragment = `f${ctx.fragmentCounter}`;
        ctx.fragments.push(
          `fragment ${scalarFieldsFragment} on ${type.name}{${scalarFields
            .filter((f) => !falsyFieldNames.has(f))
            .join(",")}}`,
        );
      }
    }

    const fieldsSelection = fieldNames
      .filter((f) => f !== "__scalar")
      .map((f) => {
        const child = fields[f] as Request;
        let directives = "";
        const parsed =
          typeof child === "object" && child !== null && !Array.isArray(child)
            ? (() => {
                const split = parseFieldDirectives(child as Fields, ctx);
                directives = split.directives;
                return parseRequest(split.body, ctx, [...path, f]);
              })()
            : parseRequest(child, ctx, [...path, f]);
        if (f.startsWith("on_")) {
          ctx.fragmentCounter++;
          const implementationFragment = `f${ctx.fragmentCounter}`;
          const typeMatch = f.match(/^on_(.+)/);
          if (!typeMatch?.[1]) throw new Error("inline fragment match failed");
          ctx.fragments.push(
            `fragment ${implementationFragment} on ${typeMatch[1]}${parsed}`,
          );
          return `...${implementationFragment}`;
        }
        return directives ? `${f} ${directives}${parsed}` : `${f}${parsed}`;
      })
      .concat(scalarFieldsFragment ? [`...${scalarFieldsFragment}`] : [])
      .join(",");

    return `{${fieldsSelection}}`;
  }

  return "";
};

export const generateGraphqlOperation = (
  operation: "query" | "mutation" | "subscription",
  root: LinkedType,
  fields?: Fields,
  options?: { namedVariables?: Record<string, VariableTyping> },
): GraphqlOperation => {
  const ctx: OperationContext = {
    root,
    varCounter: 0,
    variables: {},
    fragmentCounter: 0,
    fragments: [],
    namedVariables: options?.namedVariables,
  };

  const result = parseRequest(fields, ctx, []);

  const declared = options?.namedVariables ?? {};
  const hoisted = { ...ctx.variables };

  const allVarNames = new Set([
    ...Object.keys(declared),
    ...Object.keys(hoisted),
  ]);

  const varsString =
    allVarNames.size > 0
      ? `(${[...allVarNames]
          .map((name) => {
            const typing =
              declared[name]?.typing ?? hoisted[name]?.typing;
            if (!typing) {
              if (declared[name]) {
                throw new Error(
                  `variable \`${name}\` was declared but not used in the operation`,
                );
              }
              throw new Error(`missing type for variable $${name}`);
            }
            return `$${name}:${typing[1]}`;
          })
          .join(",")})`
      : "";

  const operationName = fields?.__name ?? "";

  const variables: Record<string, unknown> = {};
  for (const name of allVarNames) {
    if (declared[name]) {
      variables[name] = declared[name].value;
    } else if (hoisted[name]) {
      variables[name] = hoisted[name].value;
    }
  }

  return {
    query: [
      `${operation} ${operationName}${varsString}${result}`,
      ...ctx.fragments,
    ].join(","),
    variables: Object.keys(variables).length > 0 ? variables : undefined,
    ...(operationName ? { operationName: String(operationName) } : {}),
  };
};

export const getFieldFromPath = (
  root: LinkedType | undefined,
  path: string[],
): LinkedField => {
  let current: LinkedField | undefined;

  if (!root) throw new Error("root type is not provided");
  if (path.length === 0) throw new Error("path is empty");

  for (const f of path) {
    const type = current ? current.type : root;

    if (!type.fields)
      throw new Error(`type \`${type.name}\` does not have fields`);

    const possibleTypes = Object.keys(type.fields)
      .filter((i) => i.startsWith("on_"))
      .reduce<LinkedType[]>(
        (types, fieldName) => {
          const field = type.fields?.[fieldName];
          if (field) types.push(field.type);
          return types;
        },
        [type],
      );

    let field: LinkedField | null = null;

    for (const t of possibleTypes) {
      const found = t.fields?.[f];
      if (found) field = found;
    }

    if (!field)
      throw new Error(`type \`${type.name}\` does not have a field \`${f}\``);

    current = field;
  }

  return current as LinkedField;
};