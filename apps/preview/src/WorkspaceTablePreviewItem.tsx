import {
  PageTable,
  TableTd,
  useRuntimeContext,
  buildSearchObject,
  getCrdStore,
  usePageStore,
} from "@frontend-forge/forge-components";
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
const useStore = getCrdStore({
  apiVersion: "v1alpha1",
  kind: "Demo",
  plural: "jsbundles",
  group: "extensions.kubesphere.io",
  kapi: true,
});
const useCrdPageState = (columns, storeOptions = undefined) => {
  const pageId = "workspace-forge-preview-table";
  const page = usePageStore({
    pageId,
    columns,
  });
  const runtime = useRuntimeContext();
  const params = runtime?.route?.params || {};
  const pageContext = runtime?.capabilities;
  const storeQuery = useMemo(() => buildSearchObject(page, true), [page]);
  const useWorkspaceProjectSelectHook = useMemo(
    () => pageContext?.useWorkspaceProjectSelect || (() => ({})),
    [pageContext],
  );
  const {
    render: renderProjectSelect,
    params: { cluster, namespace },
  } = useWorkspaceProjectSelectHook({
    workspace: params.workspace,
  });
  const resolvedOptions =
    storeOptions &&
    Object.prototype.hasOwnProperty.call(storeOptions, "enabled")
      ? storeOptions
      : {
          ...(storeOptions || {}),
          enabled: Boolean(namespace),
        };
  const store = useStore(
    {
      params: {
        ...params,
        namespace,
        cluster,
      },
      query: storeQuery,
    },
    resolvedOptions,
  );
  return {
    params: {
      ...params,
      namespace,
      cluster,
    },
    toolbarLeft: renderProjectSelect,
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
  console.log("pageStateParams", pageStateParams);
  return (
    <PageTable
      tableKey={"workspace-forge-preview-table"}
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
