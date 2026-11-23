import {
  getNamedType,
  GraphQLField,
  GraphQLInterfaceType,
  GraphQLObjectType,
  isEnumType,
  isInterfaceType,
  isNonNullType,
  isScalarType,
} from "graphql";
import {
  argumentComment,
  fieldComment,
  typeComment,
} from "../common/comment.js";
import { RenderContext } from "../common/RenderContext.js";

import { requestTypeName } from "./requestTypeName.js";
import { sortKeys } from "../common/support.js";
import { renderTyping } from "../common/renderTyping.js";

const INDENTATION = "    ";

export const objectType = (
  type: GraphQLObjectType | GraphQLInterfaceType,
  ctx: RenderContext,
) => {
  let fields = type.getFields();

  if (ctx.config?.sortProperties) {
    fields = sortKeys(fields);
  }

  let fieldStrings = Object.keys(fields).map((fieldName) => {
    const field = fields[fieldName];

    const types: string[] = [];
    const resolvedType = getNamedType(field.type);
    const resolvable = !(
      isEnumType(resolvedType) || isScalarType(resolvedType)
    );
    const argsPresent = field.args.length > 0;
    const argsString = toArgsString(type.name, field, ctx);
    const argsOptional = field.args.every(
      (a) => !isNonNullType(a.type) || a.defaultValue != null,
    );

    if (argsPresent) {
      if (resolvable) {
        types.push(
          `(${requestTypeName(resolvedType)} & { __args${
            argsOptional ? "?" : ""
          }: ${argsString} })`,
        );
      } else {
        // Directive-optional __args on scalar roots is tracked in UPSTREAM.md (genql baseline).
        types.push(`{ __args: ${argsString} }`);
      }
      // if (resolvable) {
      //     types.push(`[${argsString},${requestTypeName(resolvedType)}]`)
      // } else {
      //     types.push(`[${argsString}]`)
      // }
    }

    if (argsOptional && !resolvable) {
      types.push("boolean | number");
    }
    if (!argsPresent && resolvable) {
      types.push(requestTypeName(resolvedType));
    }

    return `${fieldComment(field)}${field.name}?: ${types.join(" | ")}`;
  });

  if (isInterfaceType(type) && ctx.schema) {
    let interfaceProperties = ctx.schema
      .getPossibleTypes(type)
      .map((t) => `on_${t.name}?: ${requestTypeName(t)}`);
    if (ctx.config?.sortProperties) {
      interfaceProperties = interfaceProperties.sort((a, b) =>
        a.localeCompare(b),
      );
    }
    fieldStrings = fieldStrings.concat(interfaceProperties);
  }

  fieldStrings.push(
    "__typename?: boolean | number",
    "__scalar?: boolean | number",
  );

  if (
    ctx.schema &&
    (type === ctx.schema.getQueryType() ||
      type === ctx.schema.getMutationType() ||
      type === ctx.schema.getSubscriptionType())
  ) {
    fieldStrings.push(
      `__aliases?: { [alias: string]: ExactlyOneField<Omit<${requestTypeName(type)}, "__name" | "__aliases" | "__scalar" | "__typename">> }`,
    );
  }

  // add indentation
  fieldStrings = fieldStrings.map((x) =>
    x
      .split("\n")
      .filter(Boolean)
      .map((l) => INDENTATION + l)
      .join("\n"),
  );

  ctx.addCodeBlock(
    `${typeComment(type)}export interface ${requestTypeName(
      type,
    )}{\n${fieldStrings.join("\n")}\n}`,
  );
};

function l1ArgsTypeName(
  parentTypeName: string,
  fieldName: string,
  typesNamespace: string,
): string {
  const cap = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
  return `${typesNamespace}.${parentTypeName}${cap}Args`;
}

export const toArgsString = (
  parentTypeName: string,
  field: GraphQLField<unknown, unknown, unknown>,
  ctx: RenderContext,
) => {
  const typesNamespace = ctx.config?.typesNamespace ?? "Types";
  if (ctx.config?.typesImport) {
    return l1ArgsTypeName(parentTypeName, field.name, typesNamespace);
  }
  const fields = field.args
    .map(
      (a) =>
        `${argumentComment(a)}${a.name}${
          isNonNullType(a.type) && a.defaultValue == null ? ":" : "?:"
        } ${renderTyping(a.type)}`,
    )
    .join(", ");
  return `{${fields}}`;
};
