import React, { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  PageTable,
  getCrdStore,
  TableTd,
  usePageStore,
  useProjectSelect,
  buildSearchObject,
} from "@frontend-forge/forge-components";
import {
  useBatchActions,
  useItemActions,
  useTableActions,
  getActions,
  getLocalTime,
} from "@ks-console/shared";
import { useParams } from "react-router-dom";

const useStore = getCrdStore({
  apiVersion: "v1alpha1",
  kind: "Demo",
  plural: "jsbundles",
  group: "extensions.kubesphere.io",
  kapi: true,
});

const scope = "namespace";
const pageContext = {
  useTableActions: useTableActions,
  useBatchActions: useBatchActions,
  useItemActions: useItemActions,
  getActions: getActions,
  getLocalTime: getLocalTime,
};

const columnsConfig = [
  {
    key: "name",
    title: "NAME",
    render: { type: "text", path: "metadata.name", payload: {} },
  },
  {
    key: "project",
    title: "Project",
    render: {
      type: "text",
      path: `metadata.annotations["meta.helm.sh/release-namespace"]`,
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
        format: (time) => getLocalTime(time).format("YYYY-MM-DD HH:mm:ss"),
      },
    },
  },
];

const columnsMap = (columns: { key: string; title: string; render: any }[]) => {
  return columns.map((column) => {
    return {
      accessorKey: column.key,
      header: t(column.title),
      cell: (info) => {
        return <TableTd meta={column.render} original={info.row.original} />;
      },
    };
  });
};

export function TablePreview() {
  const columns = useMemo<ColumnDef<Record<string, any>>[]>(
    () => columnsMap(columnsConfig),
    [columnsConfig],
  );

  const pageId = "forge-preview-table";
  const page = usePageStore({
    pageId,
    columns,
  });

  const params = useParams();

  const storeQuery = useMemo(() => {
    return buildSearchObject(page, true);
  }, [page]);

  const {
    render: renderProjectSelect,
    params: { namespace },
  } = useProjectSelect(
    {
      cluster: params.cluster,
    },
    {
      enabled: scope === "namespace",
    },
  );

  const {
    data,
    isLoading,
    isValidating,
    mutate: refetch,
    update,
    batchDelete: deleteFn,
    create,
  } = useStore({
    params: {
      ...params,
      namespace,
    },
    query: storeQuery,
  });

  const toolbarLeft = () => {
    if (scope === "namespace") {
      return renderProjectSelect();
    }
    return null;
  };

  console.log("data", data, isLoading, isValidating);
  return (
    <PageTable
      tableKey={pageId}
      title="Table Preview"
      authKey="jobs"
      params={params}
      refetch={refetch}
      toolbarLeft={toolbarLeft}
      pageContext={pageContext}
      columns={columns}
      data={data}
      isLoading={isLoading || isValidating}
      update={update}
      del={deleteFn}
      create={create}
    />
  );
}
