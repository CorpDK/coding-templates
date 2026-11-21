import { describe, expect, it } from "vitest";
import { emitDslModules } from "../src/codegen/emitDslModules.js";
import { minimalSchema } from "./fixtures/minimalTypeMap.js";

describe("emitDslModules", () => {
  it("emits L1-tagged selections and a type map", () => {
    const out = emitDslModules(minimalSchema, {
      typesImport: "../schema-types.js",
      customScalars: [],
    });
    expect(out.selections).toContain("QuerySelection");
    expect(out.selections).toContain("Types.QueryHelloArgs");
    expect(out.typeMap).toMatch(/^export default \{/);
    expect(out.index).toContain("ConnectionField");
    expect(out.index).toContain("buildQuery");
  });
});