import { StorageAdapter } from './LruCache';

export const createWebStorageAdapter = (storage: Storage): StorageAdapter => ({
  getItem: (key: string) => storage.getItem(key),
  setItem: (key: string, value: string) => storage.setItem(key, value),
  removeItem: (key: string) => storage.removeItem(key),
});

export const createLocalStorageAdapter = (): StorageAdapter | undefined => {
  if (typeof localStorage === 'undefined') {
    return undefined;
  }
  return createWebStorageAdapter(localStorage);
};

export const createSessionStorageAdapter = (): StorageAdapter | undefined => {
  if (typeof sessionStorage === 'undefined') {
    return undefined;
  }
  return createWebStorageAdapter(sessionStorage);
};

export const createMemoryStorageAdapter = (): StorageAdapter => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
};
