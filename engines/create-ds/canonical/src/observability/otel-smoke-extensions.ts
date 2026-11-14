/** Dev-only GraphQL fields for OTel integration smoke tests (literal redaction, execute rejection). */
export const otelSmokeTestEnabled =
  process.env.DS_OTEL_SMOKE_TEST === "true";

export const otelSmokeTypeDefs = /* GraphQL */ `
  extend type Query {
    """Returns ok when OTel smoke test mode is enabled; password arg exercises literal redaction."""
    otelSmoke(password: String!): String!
    """Resolver returns a rejected Promise to verify graphql span ERROR status."""
    otelSmokeFault: String!
  }
`;

export const otelSmokeResolvers = {
  Query: {
    otelSmoke: () => "ok",
    otelSmokeFault: () =>
      Promise.reject(new Error("DS OTel smoke fault injection")),
  },
};
