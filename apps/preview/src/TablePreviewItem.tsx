import {
  PageTable,
  TableTd,
  useRuntimeContext,
  buildSearchObject,
  getCrdStore,
  usePageStore,
  useProjectSelect,
} from "@frontend-forge/forge-components";
import {
  getActions,
  getLocalTime,
  useBatchActions,
  useItemActions,
  useTableActions,
} from "@ks-console/shared";
import * as React from "react";
import { useMemo } from "react";
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
const useStore = getCrdStore({
  apiVersion: "v1alpha1",
  kind: "Demo",
  plural: "jsbundles",
  group: "extensions.kubesphere.io",
  kapi: true,
});
const pageContext = {
  useTableActions: useTableActions,
  useBatchActions: useBatchActions,
  useItemActions: useItemActions,
  getActions: getActions,
  getLocalTime: getLocalTime,
};
const useCrdPageState = (columns, storeOptions = undefined) => {
  const pageId = "forge-preview-table";
  const page = usePageStore({
    pageId,
    columns,
  });
  const runtime = useRuntimeContext();
  const params = runtime?.params || {};
  const storeQuery = useMemo(() => buildSearchObject(page, true), [page]);
  const scope = "namespace";
  const {
    render: renderProjectSelect,
    params: { namespace: selectNamespace },
  } = useProjectSelect(
    {
      cluster: params.cluster,
    },
    {
      enabled: scope === "namespace",
    },
  );
  const namespace = scope === "namespace" ? selectNamespace : undefined;
  const toolbarLeft = () => {
    if (scope === "namespace") {
      return renderProjectSelect();
    }
    return null;
  };
  const storeParams = {
    ...params,
    namespace,
  };
  const store = useStore(
    {
      params: storeParams,
      query: storeQuery,
    },
    storeOptions,
  );
  return {
    params,
    toolbarLeft,
    pageContext,
    data: store.data,
    loading: Boolean(store.isLoading || store.isValidating),
    refetch: store.mutate,
    update: store.update,
    del: store.batchDelete,
    create: store.create,
  };
};
function CrdTable(props) {
  const { columns: columnsColumns } = useCrdColumns();
  const {
    params: pageStateParams,
    refetch: pageStateRefetch,
    toolbarLeft: pageStateToolbarLeft,
    pageContext: pageStatePageContext,
    data: pageStateData,
    loading: pageStateLoading,
    update: pageStateUpdate,
    del: pageStateDel,
    create: pageStateCreate,
  } = useCrdPageState(columnsColumns);
  return (
    <PageTable
      tableKey={"forge-preview-table"}
      title={"Table Preview"}
      authKey={"jobs"}
      params={pageStateParams}
      refetch={pageStateRefetch}
      toolbarLeft={pageStateToolbarLeft}
      pageContext={pageStatePageContext}
      columns={columnsColumns}
      data={pageStateData}
      isLoading={pageStateLoading ?? false}
      update={pageStateUpdate}
      del={pageStateDel}
      create={pageStateCreate}
    />
  );
}
export default CrdTable;
