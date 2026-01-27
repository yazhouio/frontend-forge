import { LruCache } from "./LruCache";
import { createLocalStorageAdapter } from "./storage";
export { useStorage } from "./useStorage";

const adapter = createLocalStorageAdapter();
export const lruCache = new LruCache<string, unknown>({
  max: 100,
  storage: adapter,
  storageKey: "forge-components-cache",
  autoPersist: "deferred",
});
