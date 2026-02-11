import useSWRInfinite, { type SWRInfiniteConfiguration } from "swr/infinite";
import { useMemo } from "react";
import {
  InfiniteQueryOptions,
  InfiniteSWRSourceOptions,
  PageResult,
} from "./interfaces";

export function useInfiniteQuery<T>(
  options: InfiniteSWRSourceOptions<T>,
  swrOptions: Omit<SWRInfiniteConfiguration<PageResult<T>>, "fetcher"> & {
    enabled?: boolean;
  } = { enabled: true },
): InfiniteQueryOptions<T> {
  const { key, fetcher, limit = 10, ...rest } = options;
  const { enabled = true, ...restOptions } = swrOptions;
  const getItems = (page?: PageResult<T>) => page?.items ?? [];

  type InfiniteKey = readonly [
    InfiniteSWRSourceOptions<T>["key"],
    { page: number; limit: number },
    Record<string, any>?,
  ];

  const { data, size, setSize, isValidating } = useSWRInfinite<PageResult<T>>(
    (index, previousPageData) => {
      if (!enabled) return null;

      if (previousPageData && getItems(previousPageData).length < limit) {
        return null;
      }

      return enabled
        ? ([
            key,
            {
              page: index + 1,
              limit,
            },
            rest,
          ] as const)
        : null;
    },
    (args) => {
      const [, params, extra] = args as InfiniteKey;
      const requestParams = {
        ...(extra ?? {}),
        ...params,
      } as { [key: string]: any; page: number; limit: number };
      return fetcher(requestParams);
    },
    restOptions,
  );

  const flatData = useMemo(
    () => data?.flatMap((p) => getItems(p)) ?? [],
    [data],
  );

  const hasNext = useMemo(() => {
    if (!data || data.length === 0) return false;

    const last = data[data.length - 1];
    const lastItems = getItems(last);

    if (typeof last.total === "number") {
      return last.page * last.limit < last.total;
    }

    return lastItems.length === limit;
  }, [data, limit]);

  const loading = isValidating && size > (data?.length ?? 0);

  return {
    data: flatData,
    fetchNext: () => setSize(size + 1),
    hasNext,
    loading,
    reset: () => setSize(1),
  };
}
