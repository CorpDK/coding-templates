import { describe, expect, it, vi } from "vitest";
import { DataLoader } from "../dataloader.js";

describe("DataLoader", () => {
  it("batches keys within the same microtask", async () => {
    const batchLoadFn = vi.fn(async (keys: readonly string[]) => {
      return new Map(keys.map((key) => [key, key.toUpperCase()]));
    });
    const loader = new DataLoader(batchLoadFn);

    const [a, b] = await Promise.all([loader.load("a"), loader.load("b")]);
    expect(a).toBe("A");
    expect(b).toBe("B");
    expect(batchLoadFn).toHaveBeenCalledTimes(1);
    expect(batchLoadFn.mock.calls[0]?.[0]).toEqual(["a", "b"]);
  });

  it("returns cached promises for repeated keys", async () => {
    const batchLoadFn = vi.fn(async (keys: readonly number[]) => new Map(keys.map((k) => [k, k * 2])));
    const loader = new DataLoader(batchLoadFn);

    await expect(Promise.all([loader.load(1), loader.load(1)])).resolves.toEqual([2, 2]);
    expect(batchLoadFn).toHaveBeenCalledTimes(1);
  });

  it("rejects when the batch omits a key", async () => {
    const loader = new DataLoader(async () => new Map());
    await expect(loader.load("missing")).rejects.toThrow(/missing from batch result/);
  });

  it("rejects all pending keys when the batch function throws", async () => {
    const loader = new DataLoader(async () => {
      throw new Error("batch failed");
    });
    await expect(loader.load("x")).rejects.toThrow("batch failed");
  });

  it("clears one key or the entire cache", async () => {
    const batchLoadFn = vi.fn(async (keys: readonly string[]) => new Map(keys.map((k) => [k, k])));
    const loader = new DataLoader(batchLoadFn);

    await loader.load("keep");
    loader.clear("keep");
    await loader.load("keep");
    expect(batchLoadFn).toHaveBeenCalledTimes(2);

    await loader.load("all");
    loader.clear();
    await loader.load("all");
    expect(batchLoadFn).toHaveBeenCalledTimes(4);
  });
});
