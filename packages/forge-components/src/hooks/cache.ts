type CacheKey = string;

class SimpleLruCache<T> {
  private max: number;
  private store: Map<CacheKey, T>;

  constructor(max = 50) {
    this.max = max;
    this.store = new Map();
  }

  get(key: CacheKey): T | undefined {
    if (!this.store.has(key)) return undefined;
    const value = this.store.get(key);
    // Refresh key order.
    this.store.delete(key);
    if (value !== undefined) {
      this.store.set(key, value);
    }
    return value;
  }

  set(key: CacheKey, value: T) {
    if (this.store.has(key)) {
      this.store.delete(key);
    }
    this.store.set(key, value);
    if (this.store.size > this.max) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) {
        this.store.delete(oldestKey);
      }
    }
  }

  delete(key: CacheKey) {
    this.store.delete(key);
  }
}

export const lruCache = new SimpleLruCache<unknown>(100);
