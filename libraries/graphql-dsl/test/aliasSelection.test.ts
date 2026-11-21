import { describe, expect, it } from "vitest";
import type { ExactlyOneField } from "../src/runtime/aliasSelection.js";

describe("ExactlyOneField (R-01)", () => {
  it("allows a single field in an alias entry", () => {
    type Root = { items: { id: boolean }; hello: boolean };
    type Entry = ExactlyOneField<Root>;
    const ok: Entry = { items: { id: true } };
    expect(ok.items).toBeDefined();
  });

  it("rejects alias entries with two fields", () => {
    type Root = { items: { id: boolean }; hello: boolean };
    type Entry = ExactlyOneField<Root>;
    // @ts-expect-error R-01: each alias selects exactly one field
    const bad: Entry = { items: { id: true }, hello: true };
    expect(bad).toBeDefined();
  });
});