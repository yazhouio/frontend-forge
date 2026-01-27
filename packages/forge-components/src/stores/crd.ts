import useSWR from "swr";
import { PathParams, Store } from "./interfaces";
import { get, set } from "es-toolkit/compat";
import qs from "qs";
import { getUrlHof } from "./utils";
import { PublicConfiguration } from "swr/_internal";

const fetchHandler = {
  get: (url: string, query?: string) => {
    return fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      ...(query && { search: query }),
    });
  },
  post: (url: string, body: any) => {
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  },
  put: async (url: string, body: any, noGetDetail = false) => {
    if (!noGetDetail) {
      const data = await fetchHandler.get(url).then((res) => res.json());
      const resourceVersion = get(data, "metadata.resourceVersion");
      if (resourceVersion) {
        set(body, "metadata.resourceVersion", resourceVersion);
      }
    }
    return fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  },
  delete: (url: string) => {
    return fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });
  },
};

export const getCrdStore = (store: Store) => {
  return function useStore(
    {
      params,
      query,
      k8sVersion,
    }: {
      params?: PathParams;
      query?: Record<string, any>;
      k8sVersion?: string;
    },
    options?: Partial<PublicConfiguration>
  ) {
    const url = getUrlHof(store, k8sVersion)(params || {});
    console.log("url", url);
    const queryString = query ? qs.stringify(query, { skipNulls: true }) : "";
    const key = [url, queryString];

    const swr = useSWR(key, () => fetchHandler.get(url, queryString), options);
    const create = async (params: PathParams, body: any) => {
      const createUrl = getUrlHof(store, k8sVersion)(params);
      const res = await fetchHandler.post(createUrl, body);
      swr.mutate();
      return res;
    };
    const update = async (
      params: PathParams,
      body: any,
      noGetDetail = false,
    ) => {
      const updateUrl = getUrlHof(store, k8sVersion)(params);
      const res = await fetchHandler.put(updateUrl, body, noGetDetail);
      swr.mutate();
      return res;
    };
    const del = async (params: PathParams, resolve = true) => {
      const deleteUrl = getUrlHof(store, k8sVersion)(params);
      const res = await fetchHandler.delete(deleteUrl);
      if (resolve) {
        swr.mutate();
      } else {
        swr.mutate(null, false);
      }
      return res;
    };
    return { ...swr, create, update, delete: del };
  };
};
