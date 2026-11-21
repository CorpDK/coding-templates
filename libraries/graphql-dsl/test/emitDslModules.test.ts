import { parse, validate } from "graphql";
import { describe, expect, it } from "vitest";
import { emitDslModules } from "../src/codegen/emitDslModules.js";
import { generateGraphqlOperation } from "../src/runtime/generateGraphqlOperation.js";
import { linkTypeMap } from "../src/runtime/linkTypeMap.js";
import { minimalSchema } from "./fixtures/minimalTypeMap.js";

describe("emitDslModules", () => {
  it("emits a type map that can print a valid operation", () => {
    const out = emitDslModules(minimalSchema, {
      typesImport: "../schema-types.js",
      customScalars: ["JSON"],
    });
    const linked = linkTypeMap(
      JSON.parse(out.typeMap.replace(/^export default /, "")),
    );
    expect(linked.JSON?.name).toBe("JSON");

    const op = generateGraphqlOperation("query", linked.Query!, {
      hello: { __args: { name: "world" } },
    });
    const doc = parse(op.query);
    expect(validate(minimalSchema, doc)).toEqual([]);
  });
});