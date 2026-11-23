import type { ArgDescriptor } from "../codegen/types.js";

/** `[Item!]!` → `Item`. */
export function baseGraphqlType(graphqlType: string): string {
  return graphqlType.replaceAll(/[![\]]/g, "");
}

/** Catalog flags are stored without the dashes; tolerate either spelling. */
export function flagName(arg: ArgDescriptor): string {
  return arg.flag.replace(/^--/, "");
}

export function displayFlag(arg: ArgDescriptor): string {
  return `--${flagName(arg)}`;
}

export function kebabToCamel(flag: string): string {
  return flag.replaceAll(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/** A scalar `Boolean` argument (not a list) accepts bare `--flag` / `--no-flag`. */
export function isBooleanArg(arg: ArgDescriptor): boolean {
  return (
    !arg.list &&
    arg.kind === "scalar" &&
    baseGraphqlType(arg.graphqlType) === "Boolean"
  );
}
