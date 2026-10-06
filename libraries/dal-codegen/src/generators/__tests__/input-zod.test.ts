import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadEntities } from "../../model.js";
import { generateInputZodModule } from "../input-zod.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const schemaRel = "src/__tests__/fixtures/phase5-schema";

describe("generateInputZodModule", () => {
  it("emits create/update Zod schemas for business columns", async () => {
    const entities = await loadEntities(join(packageRoot, schemaRel), false);
    const source = generateInputZodModule(entities);
    expect(source).toContain('import { z } from "zod"');
    expect(source).toContain("inputZodSchemas");
    expect(source).toMatch(/CreateInputSchema = z\.object\(/);
    const fullEntity = entities.find((e) => e.auditProfile === "full");
    if (fullEntity) {
      expect(source).toContain(`${fullEntity.graphqlType}UpdateInputSchema`);
    }
  });
});
