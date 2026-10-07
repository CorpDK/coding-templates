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

