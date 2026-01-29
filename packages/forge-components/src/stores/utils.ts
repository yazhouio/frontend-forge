import semver from "semver";
import { PathParams, Store } from "./interfaces";

export function isK8sVersionAbove(target: string, version: string): boolean {
  return semver.gte(version, target);
}

export const getApiVersion = (store: Store, k8sVersion?: string) => {
  if (Array.isArray(store.apiVersion)) {
    if (store.apiVersion.length === 0) {
      throw new Error("No api version found");
    }
    if (!k8sVersion) {
      return store.apiVersion[0].apiVersion;
    }
    let index = 0;
    while (index < store.apiVersion.length) {
      const condition = store.apiVersion[index];
      if (isK8sVersionAbove(condition.k8sVersion, k8sVersion)) {
        return condition.apiVersion;
      }
      index++;
    }
    throw new Error("No matching api version found");
  } else {
    return store.apiVersion;
  }
};

export const getUrlHof =
  (store: Store, k8sVersion?: string) => (params: PathParams) => {
    const apiVersion = getApiVersion(store, k8sVersion);
    const namespacePath = params.namespace
      ? `/namespaces/${params.namespace}/`
      : "";
    const namePath = params.name ? `/${params.name}` : "";
    const path = `/${store.kapi ? "kapis" : "apis"}/${
      store.group
    }/${apiVersion}/${namespacePath}${store.plural}${namePath}`;
    if (params.cluster) {
      return `/clusters/${params.cluster}${path}`;
    } else {
      return path;
    }
  };
