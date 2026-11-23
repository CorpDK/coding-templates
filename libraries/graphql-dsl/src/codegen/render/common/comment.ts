import {
  GraphQLArgument,
  GraphQLEnumValue,
  GraphQLField,
  GraphQLInputField,
  GraphQLNamedType,
} from "graphql";

const escapeCommentClose = (s: string) => s.replaceAll("*/", String.raw`*\/`);

export const comment = (comment: {
  text?: string | null;
  deprecated?: string | null;
}) => {
  const lines: string[] = [];

  if (comment.deprecated) {
    lines.push(
      `@deprecated ${escapeCommentClose(comment.deprecated.replace(/\s/g, " "))}`,
    );
  }

  if (comment.text) {
    lines.push(...comment.text.split("\n").map(escapeCommentClose));
  }

  if (lines.length === 0) return "";
  if (lines.length === 1) {
    return `\n/** ${lines[0]} */\n`;
  }
  const body = lines.map((l) => ` * ${l}`).join("\n");
  return `\n/**\n${body}\n */\n`;
};

export const typeComment = (type: GraphQLNamedType) =>
  comment({
    text: type.description,
  });

export const fieldComment = (
  field: GraphQLEnumValue | GraphQLField<any, any, any>,
) =>
  comment({
    deprecated: field.deprecationReason,
    text: field.description,
  });

export const argumentComment = (arg: GraphQLArgument | GraphQLInputField) =>
  comment({
    text: arg.description,
  });
