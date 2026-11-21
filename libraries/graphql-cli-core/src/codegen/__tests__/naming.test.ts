import { describe, expect, it } from "vitest";
import { buildSchema } from "graphql";
import {
  emitCliModules,
  resolveCommandNames,
  resolveReservedArgFlag,
} from "../index.js";

describe("naming collisions", () => {
  it("prefixes mutation when query shares a field name", () => {
    const warnings: string[] = [];
    const names = resolveCommandNames(
      [
        { field: "refresh", kind: "query" },
        { field: "refresh", kind: "mutation" },
      ],
      warnings,
    );
    expect(names.get("query:refresh")).toBe("refresh");
    expect(names.get("mutation:refresh")).toBe("mutate-refresh");
  });

  it("renames reserved command names", () => {
    const warnings: string[] = [];
    const names = resolveCommandNames(
      [{ field: "help", kind: "query" }],
      warnings,
    );
    expect(names.get("query:help")).toBe("query-help");
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("mangles reserved arg flags", () => {
    const warnings: string[] = [];
    expect(resolveReservedArgFlag("endpoint", warnings)).toBe("arg-endpoint");
    expect(warnings[0]).toContain("reserved");
  });

  it("emitCliModules resolves cross-root collisions", () => {
    const schema = buildSchema(`
      type Query { refresh: String }
      type Mutation { refresh: String }
    `);
    const { commands } = emitCliModules(schema, { man: { enabled: false } });
    const q = commands.find((c) => c.kind === "query")!;
    const m = commands.find((c) => c.kind === "mutation")!;
    expect(q.command).toBe("refresh");
    expect(m.command).toBe("mutate-refresh");
  });
});
