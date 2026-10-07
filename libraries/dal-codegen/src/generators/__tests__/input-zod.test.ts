import { describe, expect, it } from "vitest";
import type { EntityModel } from "../../model.js";
import { generateInputZodModule } from "../input-zod.js";
import { DAL_SCALAR_ZOD_BY_NAME } from "../input-zod-scalars.js";
import { itemFixture } from "./sdl.fixture.js";

const eventFixture: EntityModel = {
  ...itemFixture,
  exportName: "events",
  tableName: "events",
  graphqlType: "Event",
  fieldBasename: "event",
  listField: "events",
  columns: [
    ...itemFixture.columns,
    {
      drizzleKey: "startsAt",
      physicalName: "starts_at",
      graphqlName: "startsAt",
      kind: "timestamptz",
      notNull: true,
      hasDefault: false,
      comment: "Event start instant (UTC).",
      isServerManaged: false,
      isBusiness: true,
    },
  ],
};

describe("input-zod generation", () => {
  it("maps DAL custom scalars to dalScalarZod expressions", () => {
    expect(DAL_SCALAR_ZOD_BY_NAME.DateTime).toBe("dalScalarZod.DateTime");
    expect(DAL_SCALAR_ZOD_BY_NAME.IntervalMs).toBe("dalScalarZod.IntervalMs");
  });

  it("imports dalScalarZod and emits scalar-aligned filter/create fields", () => {
    const source = generateInputZodModule([eventFixture]);
    expect(source).toContain("dalScalarZod");
    expect(source).toContain("from \"@corpdk/dal-core\"");
    expect(source).toContain("dalScalarZod.DateTime");
    expect(source).not.toMatch(/DateTime:\s*z\.string\(\)/);
    expect(source).toContain("z.string().uuid()");
    expect(source).toContain("startsAt: dalScalarZod.DateTime");
  });
});
