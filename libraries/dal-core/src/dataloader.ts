/** Minimal per-request DataLoader — batches keys within the same event-loop tick. */
export class DataLoader<K, V> {
  private queue: K[] = [];
  private readonly resolvers = new Map<
    K,
    { resolve: (value: V) => void; reject: (err: unknown) => void }
  >();
  private scheduled = false;

  constructor(
    private readonly batchLoadFn: (keys: readonly K[]) => Promise<Map<K, V>>,
    private readonly cache = new Map<K, Promise<V>>(),
  ) {}

  load(key: K): Promise<V> {
    const cached = this.cache.get(key);
    if (cached) return cached;

    const promise = new Promise<V>((resolve, reject) => {
      this.queue.push(key);
      this.resolvers.set(key, { resolve, reject });
      if (!this.scheduled) {
        this.scheduled = true;
        queueMicrotask(() => {
          void this.dispatch();
        });
      }
    });
    this.cache.set(key, promise);
    return promise;
  }

  private async dispatch(): Promise<void> {
    this.scheduled = false;
    const keys = [...this.queue];
    const resolvers = new Map(this.resolvers);
    this.queue = [];
    this.resolvers.clear();

    if (keys.length === 0) return;

    try {
      const result = await this.batchLoadFn(keys);
      for (const key of keys) {
        const resolver = resolvers.get(key);
        if (!resolver) continue;
        if (!result.has(key)) {
          resolver.reject(new Error("DataLoader key missing from batch result"));
          continue;
        }
        resolver.resolve(result.get(key)!);
      }
    } catch (err) {
      for (const key of keys) {
        resolvers.get(key)?.reject(err);
      }
    }
  }

  clear(key?: K): void {
    if (key !== undefined) {
      this.cache.delete(key);
      return;
    }
    this.cache.clear();
  }
}
