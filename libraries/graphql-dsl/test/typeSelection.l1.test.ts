import { describe, it, expect } from "vitest";
import type { FieldsSelection } from "../src/runtime/typeSelection.js";

describe("FieldsSelection alias keys (R-01)", () => {
  it("adds alias names to the result shape", () => {
    type Query = {
      items: { id: string; name: string }[];
      hello: string;
    };
    type Sel = {
      __aliases: {
        archived: { items: { id: 1 } };
      };
      items: { id: 1 };
    };
    type Result = FieldsSelection<Query, Sel>;
    const row: Result = {
      archived: [{ id: "a" }],
      items: [{ id: "b" }],
    };
    expect(row.archived[0]?.id).toBe("a");
    expect(row.items[0]?.id).toBe("b");
  });
});

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
