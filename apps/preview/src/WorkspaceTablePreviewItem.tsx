import {
  PageTable,
  getCrdStore,
  useRuntimeContext,
  TableTd,
  usePageStore,
  buildSearchObject,
} from "@frontend-forge/forge-components";
import * as React from "react";
import { useMemo } from "react";
const useCrdStoreFactory = getCrdStore({
  apiVersion: "v1alpha1",
  kind: "Demo",
  plural: "jsbundles",
  group: "extensions.kubesphere.io",
  kapi: true,
});
const useCrdRuntimeParams = () => {
  const runtime = useRuntimeContext();
  return {
    params: runtime?.route?.params || {},
  };
};
const columnsConfig = [
  {
    key: "name",
    title: "NAME",
    render: {
      type: "text",
      path: "metadata.name",
      payload: {},
    },
  },
  {
    key: "project",
    title: "Project",
    render: {
      type: "text",
      path: 'metadata.annotations["meta.helm.sh/release-namespace"]',
      payload: {},
    },
    enableHiding: true,
  },
  {
    key: "updatedAt",
    title: "UPDATED_AT",
    render: {
      type: "time",
      path: "metadata.creationTimestamp",
      payload: {
        format: "local-datetime",
      },
    },
    enableHiding: true,
  },
];
const useCrdColumns = () => {
  const runtime = useRuntimeContext();
  const cap = runtime?.capabilities || {};
  const t = cap.t ?? ((d) => d);
  const columns = useMemo(
    () =>
      columnsConfig.map((column) => {
        const { key, title, render, ...rest } = column;
        return {
          accessorKey: key,
          header: t(title),
          cell: (info) => (
            <TableTd meta={render} original={info.row.original} />
          ),
          ...rest,
        };
      }),
    [columnsConfig],
  );
  return {
    columns,
  };
};
const useCrdPageStore = (columns) => {
  const pageId = "workspace-forge-preview-table";
  const page = usePageStore({
    pageId,
    columns,
  });
  const storeQuery = useMemo(() => buildSearchObject(page, true), [page]);
  return {
    page,
    storeQuery,
  };
};
const useWorkspaceProjectSelectHook = (params) => {
  const runtime = useRuntimeContext();
  const cap = runtime?.capabilities || {};
  const useWorkspaceProjectSelect =
    cap.useWorkspaceProjectSelect ||
    (() => ({
      render: null,
      params: {},
    }));
  const projectSelect = useWorkspaceProjectSelect({
    workspace: params.workspace,
    showAll: false,
  });
  const cluster = projectSelect.params?.cluster;
  const namespace = projectSelect.params?.namespace;
  return {
    params: {
      cluster,
      namespace,
    },
    namespace,
    cluster,
    toolbarLeft: projectSelect.render,
  };
};
const useMergedParams = (baseParams, extraParams) => {
  return {
    params: {
      ...(baseParams || {}),
      ...(extraParams || {}),
    },
  };
};
const useCrdStore = (storeHook, params, namespace, storeQuery, options) => {
  const store = storeHook(
    {
      params: {
        ...params,
        namespace,
      },
      query: storeQuery,
    },
    options,
  );
  return {
    data: store.data,
    loading: Boolean(store.isLoading || store.isValidating),
    refetch: store.mutate,
    update: store.update,
    del: store.batchDelete,
    create: store.create,
  };
};
const useCrdPageContext = () => {
  const runtime = useRuntimeContext();
  const cap = runtime?.capabilities || {};
  return {
    pageContext: {
      useTableActions: cap.useTableActions,
      useBatchActions: cap.useBatchActions,
      useItemActions: cap.useItemActions,
      getActions: cap.getActions,
      getLocalTime: cap.getLocalTime,
    },
  };
};
function CrdTable(props) {
  const { pageContext: pageContextPageContext } = useCrdPageContext();
  const { columns: columnsColumns } = useCrdColumns();
  const { params: runtimeParamsParams } = useCrdRuntimeParams();
  const {
    toolbarLeft: workspaceProjectSelectToolbarLeft,
    params: workspaceProjectSelectParams,
    namespace: workspaceProjectSelectNamespace,
  } = useWorkspaceProjectSelectHook(runtimeParamsParams);
  const { params: mergedParamsParams } = useMergedParams(
    runtimeParamsParams,
    workspaceProjectSelectParams,
  );
  const { storeQuery: pageStoreStoreQuery } = useCrdPageStore(columnsColumns);
  const {
    refetch: storeRefetch,
    data: storeData,
    loading: storeLoading,
    update: storeUpdate,
    del: storeDel,
    create: storeCreate,
  } = useCrdStore(
    useCrdStoreFactory,
    mergedParamsParams,
    workspaceProjectSelectNamespace,
    pageStoreStoreQuery,
    {
      enabled: Boolean(workspaceProjectSelectParams.namespace),
    },
  );
  return (
    <PageTable
      tableKey={"workspace-forge-preview-table"}
      title={"Table Preview"}
      authKey={"jobs"}
      params={mergedParamsParams}
      refetch={storeRefetch}
      toolbarLeft={workspaceProjectSelectToolbarLeft}
      pageContext={pageContextPageContext}
      columns={columnsColumns}
      data={storeData}
      isLoading={storeLoading ?? false}
      update={storeUpdate}
      del={storeDel}
      create={storeCreate}
    />
  );
}
export default CrdTable;
