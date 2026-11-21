import { describe, it, expect } from "vitest";
import type { FieldsSelection } from "../src/runtime/typeSelection.js";

describe("FieldsSelection over L1-style unions", () => {
  it("makes @include-selected fields optional", () => {
    type Item = { id: string; tags: string[] };
    type Result = FieldsSelection<
      Item,
      { id: 1; tags: { __include: boolean } }
    >;
    const withTags: Result = { id: "1", tags: ["a"] };
    const without: Result = { id: "1", tags: undefined };
    expect(withTags.id).toBe("1");
    expect(without.id).toBe("1");
  });
});