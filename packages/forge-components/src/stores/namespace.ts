import { PublicConfiguration } from "swr/_internal";
import { useInfiniteQuery } from "../hooks/useInfiniteQuery/swr";
import { fetchHandler, getCrdStore } from "./crd";
import { PathParams } from "./interfaces";
import { getUrlHof } from "./utils";

const store = {
  apiVersion: "v1beta1",
  kind: "Namespace",
  plural: "namespaces",
  group: "tenant.kubesphere.io",
  kapi: true,
};

export const useNamespaceStore = getCrdStore(store);

export const useNamespaceStoreInfinite = (
  {
    params,
    search,
  }: {
    params: PathParams;
    search?: Record<string, any>;
  },
  swrOptions?: Partial<PublicConfiguration>,
) => {
  const url = getUrlHof(store)(params);
  console.log("url", url, params, search);
  return useInfiniteQuery(
    {
      key: ["namespace-infinite", url, search],
      fetcher: async (query) => {
        const resp = await fetchHandler.get(
          url,
          { ...search, ...query },
          store.kapi,
        );
        console.log("resp", resp);
        return {
          items: resp.data ?? [],
          total: resp.total,
          page: query.page,
          limit: query.limit,
        };
      },
    },
    swrOptions,
  );
};
