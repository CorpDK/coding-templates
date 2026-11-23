import type { GraphqlRequestErrorKind } from "@corpdk/graphql-dsl";

export const EXIT_OK = 0;
export const EXIT_GRAPHQL = 1;
export const EXIT_USAGE = 2;
export const EXIT_VALIDATION = 3;
export const EXIT_TRANSPORT = 4;
export const EXIT_USER_ERRORS = 5;

export function exitCodeForRequestErrorKind(
  kind: GraphqlRequestErrorKind,
): number {
  switch (kind) {
    case "graphql":
      return EXIT_GRAPHQL;
    case "validation":
      return EXIT_VALIDATION;
    case "transport":
      return EXIT_TRANSPORT;
    case "userErrors":
      return EXIT_USER_ERRORS;
    default:
      return EXIT_TRANSPORT;
  }
}