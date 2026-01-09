export type ComponentGeneratorCacheHit = string | null;

export type ComponentGeneratorCacheResult = {
  hit: ComponentGeneratorCacheHit;
  value: string | null;
};

export type ComponentGeneratorCache = {
  get: (key: string) => ComponentGeneratorCacheResult;
  set: (key: string, value: string) => void;
  clear?: () => void;
};

export type ComponentGeneratorCacheOptions = {
  maxEntries?: number;
};

export const DEFAULT_CACHE_MAX_ENTRIES = 50;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

type StableJsonResult = string | undefined | null;

function stableJsonStringifyInner(
  value: unknown,
  seen: WeakSet<object>
): StableJsonResult {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "number":
      return Number.isFinite(value) ? String(value) : "null";
    case "boolean":
      return value ? "true" : "false";
    case "undefined":
      return undefined;
    case "bigint":
      return null;
    case "function":
    case "symbol":
      return undefined;
    case "object":
      break;
    default:
      return null;
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) return null;
    seen.add(value);
    const parts: string[] = [];
    for (const item of value) {
      const result = stableJsonStringifyInner(item, seen);
      if (result === null) {
        seen.delete(value);
        return null;
      }
      parts.push(result ?? "null");
    }
    seen.delete(value);
    return `[${parts.join(",")}]`;
  }

  if (!isPlainObject(value)) return null;
  if (seen.has(value)) return null;
  seen.add(value);

  const keys = Object.keys(value).sort();
  const parts: string[] = [];
  for (const key of keys) {
    const item = value[key];
    const result = stableJsonStringifyInner(item, seen);
    if (result === null) {
      seen.delete(value);
      return null;
    }
    if (result === undefined) continue;
    parts.push(`${JSON.stringify(key)}:${result}`);
  }

  seen.delete(value);
  return `{${parts.join(",")}}`;
}

export function stableJsonStringify(value: unknown): string | null {
  const seen = new WeakSet<object>();
  const result = stableJsonStringifyInner(value, seen);
  if (!result) return null;
  return result;
}

export function computeSchemaCacheKey(schema: unknown): string | null {
  return stableJsonStringify({ v: 1, schema });
}

function normalizeMaxEntries(maxEntries: unknown): number {
  if (typeof maxEntries !== "number" || !Number.isFinite(maxEntries)) {
    return DEFAULT_CACHE_MAX_ENTRIES;
  }
  return Math.max(0, Math.floor(maxEntries));
}

export function createInMemoryCache(
  options: ComponentGeneratorCacheOptions = {}
): ComponentGeneratorCache {
  const maxEntries = normalizeMaxEntries(options.maxEntries);
  const store = new Map<string, string>();

  const touch = (key: string, value: string) => {
    store.delete(key);
    store.set(key, value);
  };

  const evictIfNeeded = () => {
    if (maxEntries <= 0) return;
    while (store.size > maxEntries) {
      const oldest = store.keys().next().value as string | undefined;
      if (oldest === undefined) return;
      store.delete(oldest);
    }
  };

  return {
    get: (key) => {
      const value = store.get(key);
      if (value === undefined) return { hit: null, value: null };
      touch(key, value);
      return { hit: "memory", value };
    },
    set: (key, value) => {
      if (maxEntries <= 0) return;
      touch(key, value);
      evictIfNeeded();
    },
    clear: () => {
      store.clear();
    },
  };
}

