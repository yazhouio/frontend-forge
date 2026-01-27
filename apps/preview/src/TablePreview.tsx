import React, { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageTable } from "@frontend-forge/forge-components";
import {
  useBatchActions,
  useItemActions,
  useTableActions,
  getActions,
} from "@ks-console/shared";

type PreviewRow = {
  uid: string;
  name: string;
  status: string;
  owner: string;
  updatedAt: string;
};

const pageContext = {
  useTableActions: useTableActions,
  useBatchActions: useBatchActions,
  useItemActions: useItemActions,
  getActions: getActions,
};

export function TablePreview() {
  const rows = useMemo<PreviewRow[]>(
    () => [
      {
        uid: "ff-001",
        name: "Aurora Pipeline",
        status: "Active",
        owner: "Forge Team",
        updatedAt: "2026-01-20",
      },
      {
        uid: "ff-002",
        name: "Nebula Audit",
        status: "Paused",
        owner: "Observability",
        updatedAt: "2026-01-18",
      },
      {
        uid: "ff-003",
        name: "Vortex Gateway",
        status: "Draft",
        owner: "Platform",
        updatedAt: "2026-01-12",
      },
    ],
    [],
  );

  const columns = useMemo<ColumnDef<PreviewRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: (info) => info.getValue(),
        enableHiding: true,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: (info) => info.getValue(),
        enableHiding: true,
      },
      {
        accessorKey: "owner",
        header: "Owner",
        cell: (info) => info.getValue(),
        enableHiding: true,
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: (info) => info.getValue(),
        enableHiding: true,
      },
    ],
    [],
  );

  const data = useMemo(
    () => ({
      data: rows,
      total: rows.length,
    }),
    [rows],
  );

  const [actions, setActions] = React.useState([]);

  React.useEffect(() => {
    const actions = getActions({
      module: "jobs",
      cluster: "host",
    });
    setActions(actions);
  }, []);

  const toolbarLeft = () => {
    return <div>111</div>;
  };

  return (
    <PageTable
      tableKey="forge-preview-table"
      title="Table Preview"
      authKey="jobs"
      params={{
        cluster: "host",
      }}
      refetch={() => {}}
      toolbarLeft={toolbarLeft}
      pageContext={pageContext}
      columns={columns}
      data={data}
      isLoading={false}
    />
  );
}
