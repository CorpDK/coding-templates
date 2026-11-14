import { describe, expect, it } from "vitest";
import {
  checkPublishOrder,
  DS_AUTOMATION_PACKAGE_JSON_PATH,
  DS_AUTOMATION_PUBLISH_ORDER,
  DS_AUTOMATION_TRUSTED_PACKAGES,
} from "./publish.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

describe("checkPublishOrder", () => {
  it("matches monorepo PUBLISH_ORDER to dependency topology", async () => {
    const result = await checkPublishOrder({
      repoRoot,
      publishOrder: DS_AUTOMATION_PUBLISH_ORDER,
      packageJsonPath: (name) => DS_AUTOMATION_PACKAGE_JSON_PATH[name] ?? "",
      trustedPackages: DS_AUTOMATION_TRUSTED_PACKAGES,
    });
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("fails when order is shuffled", async () => {
    const badOrder = [...DS_AUTOMATION_PUBLISH_ORDER].reverse();
    const result = await checkPublishOrder({
      repoRoot,
      publishOrder: badOrder,
      packageJsonPath: (name) => DS_AUTOMATION_PACKAGE_JSON_PATH[name] ?? "",
      trustedPackages: DS_AUTOMATION_TRUSTED_PACKAGES,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("mismatch"))).toBe(true);
  });

  it("fails when trusted manifest references a package outside PUBLISH_ORDER", async () => {
    const result = await checkPublishOrder({
      repoRoot,
      publishOrder: DS_AUTOMATION_PUBLISH_ORDER,
      packageJsonPath: (name) => DS_AUTOMATION_PACKAGE_JSON_PATH[name] ?? "",
      trustedPackages: ["@corpdk/not-in-order"],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("Trusted-publisher"))).toBe(
      true,
    );
  });
});
