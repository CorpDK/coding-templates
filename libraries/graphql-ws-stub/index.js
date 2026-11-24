/**
 * Placeholder for root `pnpm.overrides.graphql-ws`. This monorepo uses SSE only.
 * Exports the symbols optional tooling (e.g. graphql-codegen) may import at load time.
 */
export function createClient() {
  throw new Error(
    "graphql-ws is stubbed in this monorepo; use GraphQL over SSE instead.",
  );
}

export default { createClient };
