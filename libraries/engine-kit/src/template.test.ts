import { describe, expect, it } from "vitest";
import { initialCalVer, engineRootFromImportMeta } from "./template.js";
import { fileURLToPath } from "node:url";

describe("template helpers", () => {
  it("initialCalVer uses UTC month", () => {
    expect(initialCalVer(new Date("2026-03-15T12:00:00Z"))).toBe("2026.3.0");
  });

  it("engineRootFromImportMeta resolves package root", () => {
    const root = engineRootFromImportMeta(import.meta.url);
    expect(root.endsWith("engine-kit")).toBe(true);
    expect(fileURLToPath(import.meta.url).includes(root)).toBe(true);
  });
});
