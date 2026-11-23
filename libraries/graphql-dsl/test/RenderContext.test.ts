import { describe, expect, it } from "vitest";
import { RenderContext } from "../src/codegen/render/common/RenderContext.js";

describe("RenderContext", () => {
  it("emits deduplicated type namespace imports in typescript mode", () => {
    const ctx = new RenderContext();
    ctx.addTypeNamespaceImport("../schema-types.js", "Types");
    ctx.addTypeNamespaceImport("../schema-types.js", "Types");
    ctx.addCodeBlock("export const marker = true;");
    const code = ctx.toCode("typescript");
    expect(code).toContain(
      "import type * as Types from '../schema-types.js';",
    );
    expect(code?.match(/import type \* as Types/g)?.length).toBe(1);
    expect(code).toContain("export const marker = true;");
  });

  it("reuses import aliases for identical named imports", () => {
    const ctx = new RenderContext();
    const first = ctx.addImport("mod", false, "Thing");
    const second = ctx.addImport("mod", false, "Thing");
    expect(first).toBe(second);
    ctx.addCodeBlock("export {}");
    const code = ctx.toCode("typescript");
    expect(code).toContain("Thing");
    expect(code).toMatch(/as a1/);
  });

  it("emits default and named imports", () => {
    const ctx = new RenderContext();
    const defaultAlias = ctx.addImport("./lodash.js", true);
    ctx.addImport("./helpers.js", false, "Bar", undefined, true);
    expect(defaultAlias).toBe("a1");
    ctx.addCodeBlock("export const x = 1;");
    const code = ctx.toCode("typescript");
    expect(code).toContain("import a1 from './lodash.js'");
    expect(code).toContain("{Bar} from './helpers.js'");
  });

  it("joins body blocks without parser formatting", () => {
    const ctx = new RenderContext();
    ctx.addCodeBlock("a");
    ctx.addCodeBlock("b");
    expect(ctx.toCode()).toBe("ab");
  });
});