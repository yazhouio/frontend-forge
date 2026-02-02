import {
  PageTable,
  getCrdStore,
  useRuntimeContext,
  TableTd,
  usePageStore,
  buildSearchObject,
  useProjectSelect,
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
const useCrdColumns = () => {
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
    },
  ];
  const columns = useMemo(
    () =>
      columnsConfig.map((column) => ({
        accessorKey: column.key,
        header: column.title,
        cell: (info) => (
          <TableTd meta={column.render} original={info.row.original} />
        ),
      })),
    [columnsConfig],
  );
  return {
    columns,
  };
};
const useCrdPageStore = (columns) => {
  const pageId = "forge-preview-table";
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
const useCrdProjectSelect = (params) => {
  const scope = "namespace";
  const enabled = scope === "namespace";
  const projectSelect = useProjectSelect(
    {
      cluster: params.cluster,
    },
    {
      enabled,
    },
  );
  const namespace = enabled ? projectSelect.params?.namespace : undefined;
  return {
    params: {
      cluster: params.cluster,
      namespace,
    },
    namespace,
    toolbarLeft: enabled ? projectSelect.render : null,
  };
};
const useCrdStore = (storeHook, params, namespace, storeQuery) => {
  const store = storeHook({
    params: {
      ...params,
      namespace,
    },
    query: storeQuery,
  });
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
function TablePreviewItem(props) {
  const { params: runtimeParamsParams } = useCrdRuntimeParams();
  const {
    toolbarLeft: projectSelectToolbarLeft,
    namespace: projectSelectNamespace,
  } = useCrdProjectSelect(runtimeParamsParams);
  const { pageContext: pageContextPageContext } = useCrdPageContext();
  const { columns: columnsColumns } = useCrdColumns();
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
    runtimeParamsParams,
    projectSelectNamespace,
    pageStoreStoreQuery,
  );
  return (
    <PageTable
      tableKey={"forge-preview-table"}
      title={"Table Preview"}
      authKey={"jobs"}
      params={runtimeParamsParams}
      refetch={storeRefetch}
      toolbarLeft={projectSelectToolbarLeft}
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
export default TablePreviewItem;
