import fs from 'fs';
import path from 'path';
import { LRUCache } from 'lru-cache';
import { CACHE_DIR, CACHE_MAX_ITEMS } from './config.mjs';

fs.mkdirSync(CACHE_DIR, { recursive: true });

const memCache = new LRUCache({
  max: CACHE_MAX_ITEMS
});

function cachePathForKey(key) {
  return path.join(CACHE_DIR, `${key}.json`);
}

function readDiskCache(key) {
  const p = cachePathForKey(key);
  if (!fs.existsSync(p)) return null;
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return null;
    return obj;
  } catch {
    return null;
  }
}

function writeDiskCacheAtomic(key, value) {
  const p = cachePathForKey(key);
  const tmp = `${p}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(value), 'utf8');
  fs.renameSync(tmp, p);
}

export function getCache(key) {
  const hitMem = memCache.get(key);
  if (hitMem) return { hit: 'memory', value: hitMem };

  const hitDisk = readDiskCache(key);
  if (hitDisk) {
    memCache.set(key, hitDisk);
    return { hit: 'disk', value: hitDisk };
  }

  return { hit: null, value: null };
}

export function setCache(key, value) {
  writeDiskCacheAtomic(key, value);
  memCache.set(key, value);
}
