import React, { useState } from "react";

import { concat, debounce, get } from "es-toolkit/compat";
import { Select } from "@kubed/components";
import { useNamespaceStoreInfinite } from "../stores/namespace";

const KUBE_CLUSTER_SELECTED_NAMESPACE = "kube-cluster-selected-namespace";
const useLocalNamespace = (defaultNamespace = "") => {
  const [namespace, setNamespace] = React.useState<string | undefined>(
    defaultNamespace ||
      localStorage.getItem(KUBE_CLUSTER_SELECTED_NAMESPACE) ||
      "",
  );

  React.useEffect(() => {
    if (namespace) {
      localStorage.setItem(KUBE_CLUSTER_SELECTED_NAMESPACE, namespace);
    } else {
      localStorage.removeItem(KUBE_CLUSTER_SELECTED_NAMESPACE);
    }
  }, [namespace]);

  return { namespace, setNamespace };
};

export const useProjectSelect = ({ cluster }: { cluster: string }) => {
  const [search, setSearch] = useState("");
  const { namespace: project, setNamespace: setProject } =
    useLocalNamespace("");
  console.log("search", search);
  const {
    data: projectList,
    loading: projectLoading,
    fetchNext: fetchNextPage,
    hasNext: hasNextPage,
  } = useNamespaceStoreInfinite({
    params: { cluster },
    search: {
      name: search,
      labelSelector:
        "kubefed.io/managed!=true, kubesphere.io/kubefed-host-namespace!=true",
    },
  });
  const projectOptions = React.useMemo(() => {
    const projectListDefault = (projectList ?? []).map((_project) => ({
      label: get(_project, "metadata.name"),
      value: get(_project, "metadata.name"),
    }));

    return concat({ label: t("ALL_PROJECTS"), value: "" }, projectListDefault);
  }, [projectList]);
  const onUserScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!hasNextPage) {
      return;
    }
    //@ts-ignore
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollTop + clientHeight - scrollHeight >= 0) {
      fetchNextPage();
    }
  };

  console.log("projectList", projectList);
  const onSearch = debounce((val: string) => setSearch(val), 500);

  const handleChangeProject = (value: string) => {
    setProject(value === undefined ? "" : value);
  };

  const render = () => {
    return (
      <Select
        key={cluster}
        style={{ width: 200 }}
        showSearch
        options={projectOptions}
        onPopupScroll={debounce(onUserScroll, 500)}
        onSearch={onSearch}
        onChange={handleChangeProject}
        loading={projectLoading}
        value={project}
        allowClear={true}
      />
    );
  };
  const params = React.useMemo<{ namespace?: string }>(
    () => ({
      namespace: project,
    }),
    [project],
  );
  const paramsRef = React.useRef<{ namespace?: string }>({
    namespace: project,
  });

  return {
    render,
    params,
    paramsRef,
  };
};
