import { GraphQLScalarType } from "graphql";
import { GraphQLIP, GraphQLMAC } from "graphql-scalars";

/** graphql-scalars@1.26 exports `GraphQLIP` / `GraphQLMAC` only — no CIDR scalar. */
export { GraphQLIP, GraphQLMAC };

export function guildParseIP(value: unknown): string {
  return GraphQLIP.parseValue(value);
}

export function guildSerializeIP(value: unknown): string {
  return GraphQLIP.serialize(value);
}

export function guildParseMAC(value: unknown): string {
  return GraphQLMAC.parseValue(value);
}

export function guildSerializeMAC(value: unknown): string {
  return GraphQLMAC.serialize(value);
}

/**
 * DAL SDL uses PG-oriented names (`Inet`, `MacAddr`); wire logic comes from graphql-scalars (`IP`, `MAC`).
 */
export function guildScalarForDalName(
  guild: GraphQLScalarType<string, string>,
  name: string,
  description: string,
): GraphQLScalarType<string, string> {
  return new GraphQLScalarType({
    name,
    description,
    serialize: (value) => guild.serialize(value),
    parseValue: (value) => guild.parseValue(value),
    parseLiteral: (node, variables) => guild.parseLiteral(node, variables),
    extensions: guild.extensions,
  });
}
