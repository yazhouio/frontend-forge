export interface InfiniteQueryOptions<T> {
  data: T[];
  fetchNext(): void;
  hasNext: boolean;
  loading: boolean;
  reset(): void;
}

export type PageResult<T> = {
  items: T[];
  page: number;
  limit: number;
  total?: number;
};

export type InfiniteSWRSourceOptions<T> = {
  key: string | unknown[];
  fetcher: (params: {
    page: number;
    limit: number;
    [key: string]: any;
  }) => Promise<PageResult<T>>;
  limit?: number;
  enabled?: boolean;
};
