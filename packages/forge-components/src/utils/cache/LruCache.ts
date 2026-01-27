export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

type Serializer<V> = (value: V) => string;
type Deserializer<V> = (raw: string) => V;

export interface LruCacheOptions<V> {
  max: number;
  storage?: StorageAdapter;
  storageKey?: string;
  serialize?: Serializer<V>;
  deserialize?: Deserializer<V>;
  autoPersist?: 'immediate' | 'deferred' | false;
}

type PersistedState<K extends string> = {
  v: 1;
  entries: Array<[K, string]>;
};

export class LruCache<K extends string, V> {
  private readonly max: number;
  private readonly storage?: StorageAdapter;
  private readonly storageKey: string;
  private readonly serialize: Serializer<V>;
  private readonly deserialize: Deserializer<V>;
  private readonly autoPersist: 'immediate' | 'deferred' | false;
  private persistScheduled = false;
  private readonly cache = new Map<K, V>();

  constructor(options: LruCacheOptions<V>) {
    this.max = Math.max(0, Math.floor(options.max));
    this.storage = options.storage;
    this.storageKey = options.storageKey ?? 'lru-cache';
    this.serialize = options.serialize ?? JSON.stringify;
    this.deserialize = options.deserialize ?? JSON.parse;
    this.autoPersist = options.autoPersist ?? 'deferred';
  }

  get size(): number {
    return this.cache.size;
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }
    const value = this.cache.get(key)!;
    this.touch(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.max === 0) {
      return;
    }
    this.touch(key, value);
    this.evictIfNeeded();
    this.maybePersist();
  }

  delete(key: K): boolean {
    const removed = this.cache.delete(key);
    if (removed) {
      this.maybePersist();
    }
    return removed;
  }

  clear(): void {
    this.cache.clear();
    if (this.storage) {
      this.storage.removeItem(this.storageKey);
    }
  }

  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  values(): V[] {
    return Array.from(this.cache.values());
  }

  entries(): Array<[K, V]> {
    return Array.from(this.cache.entries());
  }

  // Storage is only for cold start + best-effort persistence.
  hydrate(): void {
    this.loadFromStorage();
  }

  persist(): void {
    if (!this.storage) {
      return;
    }
    try {
      const entries: Array<[K, string]> = [];
      for (const [key, value] of this.cache.entries()) {
        entries.push([key, this.serialize(value)]);
      }
      const payload: PersistedState<K> = { v: 1, entries };
      this.storage.setItem(this.storageKey, JSON.stringify(payload));
    } catch {
      // Best-effort only; ignore storage/serialization failures.
    }
  }

  private loadFromStorage(): void {
    if (!this.storage) {
      return;
    }
    const raw = this.storage.getItem(this.storageKey);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as PersistedState<K>;
      if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.entries)) {
        return;
      }
      this.cache.clear();
      for (const [key, serialized] of parsed.entries) {
        this.cache.set(key, this.deserialize(serialized));
      }
      this.evictIfNeeded();
    } catch {
      this.storage.removeItem(this.storageKey);
    }
  }

  private touch(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, value);
  }

  private evictIfNeeded(): void {
    while (this.cache.size > this.max) {
      const oldestKey = this.cache.keys().next().value as K | undefined;
      if (oldestKey === undefined) {
        return;
      }
      this.cache.delete(oldestKey);
    }
  }

  private maybePersist(): void {
    if (!this.storage || this.autoPersist === false) {
      return;
    }
    if (this.autoPersist === 'immediate') {
      this.persist();
      return;
    }
    this.schedulePersist();
  }

  private schedulePersist(): void {
    if (!this.storage || this.persistScheduled) {
      return;
    }
    this.persistScheduled = true;
    queueMicrotask(() => {
      try {
        this.persist();
      } finally {
        this.persistScheduled = false;
      }
    });
  }
}
