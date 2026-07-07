interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

/** Minimal in-memory TTL cache — no external dependency, entries expire lazily on read. */
export class TtlCache<K, V> {
  private readonly entries = new Map<K, CacheEntry<V>>();

  constructor(private readonly defaultTtlMs: number) {}

  get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: K, value: V, ttlMs = this.defaultTtlMs): void {
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: K): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  /** Drops every entry whose TTL has already elapsed — call periodically to bound memory use. */
  sweep(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  get size(): number {
    return this.entries.size;
  }
}
