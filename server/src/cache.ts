import fs from 'fs';
import path from 'path';
import { LRUCache } from 'lru-cache';
import { CACHE_DIR, CACHE_MAX_ITEMS } from './config.js';
import type { CacheHit, CacheValue } from './types.js';

fs.mkdirSync(CACHE_DIR, { recursive: true });

const memCache = new LRUCache<string, CacheValue>({
  max: CACHE_MAX_ITEMS
});

function cachePathForKey(key: string): string {
  return path.join(CACHE_DIR, `${key}.json`);
}

function readDiskCache(key: string): CacheValue | null {
  const p = cachePathForKey(key);
  if (!fs.existsSync(p)) return null;
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return null;
    return obj as CacheValue;
  } catch {
    return null;
  }
}

function writeDiskCacheAtomic(key: string, value: CacheValue): void {
  const p = cachePathForKey(key);
  const tmp = `${p}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(value), 'utf8');
  fs.renameSync(tmp, p);
}

export function getCache(key: string): { hit: CacheHit; value: CacheValue | null } {
  const hitMem = memCache.get(key);
  if (hitMem) return { hit: 'memory', value: hitMem };

  const hitDisk = readDiskCache(key);
  if (hitDisk) {
    memCache.set(key, hitDisk);
    return { hit: 'disk', value: hitDisk };
  }

  return { hit: null, value: null };
}

export function setCache(key: string, value: CacheValue): void {
  writeDiskCacheAtomic(key, value);
  memCache.set(key, value);
}
