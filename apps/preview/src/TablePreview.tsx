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

export function TablePreview() {
  const columns = useMemo<ColumnDef<Record<string, any>>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("NAME"),
        cell: (info) => {
          return (
            <TableTd
              meta={{ type: "text", path: "metadata.name", payload: {} }}
              original={info.row.original}
            />
          );
        },
        // enableHiding: true,
      },
      {
        accessorKey: "project",
        enableHiding: true,
        header: "Project",
        cell: (info) => {
          return (
            <TableTd
              meta={{
                type: "text",
                path: `metadata.annotations["meta.helm.sh/release-namespace"]`,
                payload: {},
              }}
              original={info.row.original}
            />
          );
        },
      },
      {
        accessorKey: "updatedAt",
        header: t("UPDATED_AT"),
        cell: (info) => {
          return (
            <TableTd
              meta={{
                type: "time",
                path: "metadata.creationTimestamp",
                payload: {
                  format: (time) =>
                    getLocalTime(time).format("YYYY-MM-DD HH:mm:ss"),
                },
              }}
              original={info.row.original}
            />
          );
        },
        enableHiding: true,
      },
    ],
    [],
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
