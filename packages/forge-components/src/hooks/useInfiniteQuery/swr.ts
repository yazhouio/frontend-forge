import useSWRInfinite from "swr/infinite";
import { useMemo } from "react";
import {
  InfiniteQueryOptions,
  InfiniteSWRSourceOptions,
  PageResult,
} from "./interfaces";
import { PublicConfiguration } from "swr/_internal";

export function useInfiniteQuery<T>(
  options: InfiniteSWRSourceOptions<T>,
  swrOptions?: Partial<PublicConfiguration>,
): InfiniteQueryOptions<T> {
  const { key, fetcher, limit = 10, enabled = true, ...rest } = options;
  const getItems = (page?: PageResult<T> | { data?: T[] }) =>
    page?.items ?? page?.data ?? [];

  const { data, size, setSize, isValidating } = useSWRInfinite<PageResult<T>>(
    (index, previousPageData) => {
      console.log(index, previousPageData, enabled, "index, previousPageData");
      if (!enabled) return null;

      if (previousPageData && getItems(previousPageData).length < limit) {
        return null;
      }

      return [
        key,
        {
          page: index + 1,
          limit,
        },
        rest,
      ];
    },
    (_, params, extra) => fetcher({ ...(extra ?? {}), ...(params ?? {}) }),
    swrOptions,
  );

  console.log("data xxx", data);
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
