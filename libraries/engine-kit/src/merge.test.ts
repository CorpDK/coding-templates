import { describe, expect, it } from "vitest";
import { mergePackageJson, mergeYamlConfig } from "./merge.js";

describe("mergePackageJson", () => {
  const owned = new Set(["@corpdk/dal-core", "@corpdk/dal-codegen"]);

  it("bumps owned deps and preserves consumer extras", () => {
    const template = {
      dependencies: {
        "@corpdk/dal-core": "1.0.0",
        "@corpdk/pub-sub": "1.0.0",
      },
    };
    const consumer = {
      name: "@acme/ds",
      dependencies: {
        "@corpdk/dal-core": "0.9.0",
        lodash: "4.0.0",
      },
    };
    const merged = mergePackageJson(consumer, template, { owned });
    expect(merged.name).toBe("@acme/ds");
    expect(merged.dependencies?.["@corpdk/dal-core"]).toBe("1.0.0");
    expect(merged.dependencies?.lodash).toBe("4.0.0");
    expect(merged.dependencies?.["@corpdk/pub-sub"]).toBe("1.0.0");
  });

  it("removes deps in removed set", () => {
    const template = {
      dependencies: {
        "@graphql-codegen/client-preset": "4.0.0",
        "@corpdk/dal-core": "1.0.0",
      },
    };
    const consumer = { dependencies: { extra: "1" } };
    const merged = mergePackageJson(consumer, template, {
      removed: new Set(["@graphql-codegen/client-preset"]),
    });
    expect(merged.dependencies?.["@graphql-codegen/client-preset"]).toBeUndefined();
  });

  it("rewrites workspace deps when releaseVersion set", () => {
    const template = {
      dependencies: { "@corpdk/dal-core": "workspace:*" },
    };
    const merged = mergePackageJson({}, template, { releaseVersion: "2026.11.0" });
    expect(merged.dependencies?.["@corpdk/dal-core"]).toBe("^2026.11.0");
  });
});

describe("mergeYamlConfig", () => {
  it("deep-merges maps with consumer leaves winning", () => {
    const template = {
      dal: { postgres: { host: "localhost" }, features: { x: 1 } },
      version: 1,
    };
    const consumer = {
      dal: { postgres: { port: 5432 }, features: { y: 2 } },
    };
    const merged = mergeYamlConfig(template, consumer) as Record<string, unknown>;
    const dal = merged.dal as Record<string, unknown>;
    const postgres = dal.postgres as Record<string, unknown>;
    expect(postgres.host).toBe("localhost");
    expect(postgres.port).toBe(5432);
  });

  it("uses consumer array wholesale", () => {
    const merged = mergeYamlConfig({ items: [1, 2] }, { items: [3] });
    expect(merged).toEqual({ items: [3] });
  });
});