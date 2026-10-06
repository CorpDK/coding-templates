import { describe, expect, it } from "vitest";
import { generateInputZodModule } from "../input-zod.js";
import { itemFixture } from "./sdl.fixture.js";

describe("generateInputZodModule", () => {
  it("emits create/update, filter, sort, and shared filter operators", () => {
    const source = generateInputZodModule([itemFixture]);

    expect(source).toContain("ItemCreateInputSchema");
    expect(source).toContain("ItemUpdateInputSchema");
    expect(source).toContain("ItemFilterSchema");
    expect(source).toContain("ItemSortInputSchema");
    expect(source).toContain("StringFilterSchema");
    expect(source).toContain("BooleanFilterSchema");
    expect(source).toContain("z.lazy(() =>");
    expect(source).toMatch(/ItemCreateInput: ItemCreateInputSchema/);
    expect(source).toMatch(/ItemFilter: ItemFilterSchema/);
    expect(source).toContain("parseOptionalGraphqlInput");
    expect(source).toContain("parseGraphqlInputList");
  });

  it("applies column constraint hints on create inputs", () => {
    const withLength: typeof itemFixture = {
      ...itemFixture,
      columns: itemFixture.columns.map((col) =>
        col.graphqlName === "name" ? { ...col, minLength: 2, maxLength: 80 } : col,
      ),
    };
    const source = generateInputZodModule([withLength]);
    expect(source).toContain("name: z.string().min(2).max(80),");
  });
});
