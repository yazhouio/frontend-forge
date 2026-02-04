import * as React from "react";
import { Card, notify, Checkbox, Center } from "@kubed/components";
import { BaseTable } from "../Table";
import { Container, PageLayout, PageTitle } from "./index.styles";
import {
  useModalAction,
  usePageStoreState,
  usePageStoreTable,
  wrapperComponentModal,
} from "../../hooks";
import { YamlModal } from "./YamlModal";
import { Pen, Trash } from "@kubed/icons";
import { DeleteConfirmModal } from "../DeleteConfirm";
import { Row, RowData, Table } from "@tanstack/react-table";
import { useRuntimeContext } from "../../runtime";
import { get } from "es-toolkit/compat";

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    renderCell?: {
      type: string;
      path: string;
      payload: { link: string } | Record<string, any>;
    };
  }
}

export const defaultCheckboxColumn = {
  id: "_selector",
  meta: {
    th: {
      width: 42,
      align: "center",
    },
  },
  header: ({ table }: { table: Table<any> }) => {
    const isAllSelected = table.getIsAllRowsSelected();
    const isSomeSelected = table.getIsSomeRowsSelected();

    return (
      <Checkbox
        checked={isAllSelected}
        indeterminate={isSomeSelected}
        onChange={(e) => {
          // Support toggle behavior:
          // - Unselected state → click → Select all
          // - Indeterminate state → click → Select all
          // - All selected state → click → Deselect all
          if (isAllSelected) {
            // Currently all selected, deselect all
            table.toggleAllRowsSelected(false);
          } else {
            // Currently none or some selected, select all
            table.toggleAllRowsSelected(true);
          }
        }}
      />
    );
  },
  cell: ({ row }: { row: Row<any> }) => (
    <Center>
      <Checkbox
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onChange={row.getToggleSelectedHandler()}
      />
    </Center>
  ),
} as const;

function BasePageTable(props) {
  const {
    tableKey,
    refetch,
    title,
    authKey,
    params,
    create,
    update,
    del,
    pageContext,
    columns,
    toolbarLeft,
    ...rest
  } = props;
  const { useItemActions, useBatchActions, useTableActions } = pageContext;
  const runtime = useRuntimeContext();
  const t = runtime?.capabilities?.t ?? ((d: string) => d);
  const tableRef = React.useRef<Table<Record<string, unknown>>>(null);
  const resolvedParams = params ?? {};

  const pageTableController = usePageStoreTable(tableKey);
  const { open: createYaml, close: closeYaml } = useModalAction({
    id: tableKey + "-create",
    modal: YamlModal,
    deps: {
      title: title,
      initialValue: "",
    },
  });

  const { open: updateYaml, close: closeUpdateYaml } = useModalAction({
    id: tableKey + "-update",
    modal: YamlModal,
  });

  const { open: delYaml, close: closeDelYaml } = useModalAction({
    id: tableKey + "-del",
    modal: DeleteConfirmModal,
    deps: {
      onOk: () => {},
      onCancel: () => {},
      type: title,
    },
  });

  const tableActions = useTableActions({
    authKey,
    params: resolvedParams,
    actions: [
      {
        key: "create",
        text: t("CREATE"),
        // action: "create",
        props: {
          color: "secondary",
          shadow: true,
        },
        onClick: () => {
          createYaml({
            onCancel: closeYaml,
            onOk: async (data) => {
              await create(params, data);
              notify.success(t("CREATE_SUCCESSFUL"));
            },
          });
        },
      },
    ],
  });

  const batchActions = useBatchActions({
    authKey,
    params: resolvedParams,
    actions: [
      {
        key: "delete",
        text: t("DELETE"),
        // action: "delete",
        onClick: () => {
          const selectedRows = tableRef.current?.getSelectedRowModel().rows;
          if (!selectedRows) {
            return;
          }
          const resource = selectedRows.map((row) =>
            get(row.original, "metadata.name"),
          ) as string[];
          delYaml({
            onCancel: closeDelYaml,
            resource,
            onOk: async () => {
              await del(resource.map((name) => ({ ...params, name })));
              tableRef.current?.resetRowSelection(true);
              notify.success(t("DELETE_SUCCESSFUL"));
              closeDelYaml();
            },
          });
        },
        props: {
          color: "error",
        },
      },
    ],
  });

  const renderItemActions = useItemActions({
    authKey,
    params: resolvedParams,
    actions: [
      {
        key: "editYaml",
        icon: <Pen />,
        text: t("EDIT_YAML"),
        // action: "edit",
        onClick: (_, record) => {
          updateYaml({
            onCancel: closeUpdateYaml,
            initialValue: record,
            title: t("EDIT_YAML"),
            onOk: async (data) => {
              await update(
                { ...params, name: get(data, "metadata.name") },
                data,
              );
              notify.success(t("UPDATE_SUCCESSFUL"));
            },
          });
        },
      },
      {
        key: "delete",
        icon: <Trash />,
        text: t("DELETE"),
        // action: "delete",
        onClick: (_, record) => {
          const name = get(record, "metadata.name");
          delYaml({
            onCancel: closeDelYaml,
            resource: [name],
            onOk: async () => {
              await del([{ ...params, name }]);
              tableRef.current?.resetRowSelection(true);
              notify.success(t("DELETE_SUCCESSFUL"));
              closeDelYaml();
            },
          });
        },
      },
    ],
  });

  const tableMeta = {
    tableName: tableKey,
    refetch: refetch,
    getProps: {
      table: () => {
        return {
          stickyHeader: true,
          tableWrapperClassName: "table",
        };
      },
      toolbar: () => ({
        toolbarLeft: toolbarLeft(),
        batchActions: batchActions(),
        toolbarRight: tableActions(),
      }),
      filters: () => {
        return {
          simpleMode: false,
          suggestions: [
            {
              key: "name",
              label: t("NAME"),
            },
          ],
        };
      },
    },
  };

  const tableColumns = [
    defaultCheckboxColumn,
    ...columns,
    {
      accessorKey: "actions",
      header: "",
      meta: {
        th: {
          width: 100,
        },
      },
      cell: (info) => {
        return renderItemActions(info.getValue(), info.row.original);
      },
    },
  ];

  return (
    <PageLayout>
      <PageTitle>{title}</PageTitle>
      <Container>
        <Card padding={0}>
          <BaseTable
            {...rest}
            ref={tableRef}
            tableMeta={tableMeta}
            columns={tableColumns}
            page={pageTableController}
          />
        </Card>
      </Container>
    </PageLayout>
  );
}

const PageTable = wrapperComponentModal(BasePageTable);
export { PageTable };
