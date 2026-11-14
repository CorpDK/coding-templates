import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { copyDir } from "./fs.js";

describe("copyDir", () => {
  let tmp: string;

  afterEach(async () => {
    if (tmp) await fs.rm(tmp, { recursive: true, force: true });
  });

  it("honors exclude segments from caller root", async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ek-fs-"));
    const src = path.join(tmp, "src");
    const dest = path.join(tmp, "dest");
    await fs.mkdir(path.join(src, "src", "generated"), { recursive: true });
    await fs.writeFile(path.join(src, "ok.txt"), "ok", "utf8");
    await fs.writeFile(
      path.join(src, "src", "generated", "skip.ts"),
      "x",
      "utf8",
    );

    await copyDir(src, dest, { exclude: ["src", "generated"] });
    expect(await fs.stat(path.join(dest, "ok.txt"))).toBeDefined();
    await expect(
      fs.stat(path.join(dest, "src", "generated", "skip.ts")),
    ).rejects.toThrow();
  });

  it("throws when requireSource and source missing", async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ek-fs-"));
    await expect(
      copyDir(path.join(tmp, "nope"), path.join(tmp, "dest")),
    ).rejects.toThrow(/not found/);
  });
});
