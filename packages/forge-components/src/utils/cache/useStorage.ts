import React from 'react';
import { lruCache } from './index';

export const useStorage = <T>(
  key: string,
  defaultValue?: T,
  localSave = false,
): [T | undefined, React.Dispatch<React.SetStateAction<T | undefined>>] => {
  const [value, setValue] = React.useState<T | undefined>(() => {
    if (!localSave) return defaultValue;

    const cached = lruCache.get(key);
    if (cached !== undefined) {
      return cached as T;
    }
    return defaultValue;
  });

  React.useEffect(() => {
    if (!localSave) return;
    if (value !== undefined && lruCache.get(key) === undefined) {
      lruCache.set(key, value);
    }
  }, [key, localSave]);

  React.useEffect(() => {
    if (!localSave) return;
    lruCache.set(key, value);
  }, [key, value, localSave]);

  return [value, setValue];
};
