import { describe, expect, it } from "vitest";
import { buildSchema } from "graphql";
import { emitCliModules } from "../index.js";

const SDL = `
type Query { hello(name: String): String! }
`;

describe("man/texi emitters", () => {
  it("uses GRAPHQL_HTTP_URL and --vars-file, not DS_HTTP_URL", () => {
    const schema = buildSchema(SDL);
    const { man, texi } = emitCliModules(schema, {
      bin: "ds-cli",
      man: { enabled: true },
    });
    expect(man).toContain("GRAPHQL_HTTP_URL");
    expect(texi).toContain("GRAPHQL_HTTP_URL");
    expect(man).not.toContain("DS_HTTP_URL");
    expect(texi).not.toContain("DS_WS_URL");
    expect(man).toContain("\\-\\-vars\\-file");
    expect(texi).toContain("--vars-file");
    expect(man).not.toMatch(/\-\-input <file/);
  });
});
