import * as React from "react";
import { Card, notify, Checkbox, Center } from "@kubed/components";
import { BaseTable } from "../Table";
import { Container, PageLayout, PageTitle } from "./index.styles";
import { useModalAction, wrapperComponentModal } from "../../hooks";
import { YamlModal } from "./YamlModal";
import { Pen, Trash } from "@kubed/icons";
import { DeleteConfirmModal } from "../DeleteConfirm";
import { Row, Table } from "@tanstack/react-table";

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
  const tableRef = React.useRef<Table<Record<string, unknown>>>(null);
  const resolvedParams = params ?? {};

  const { open: createYaml, close: closeYaml } = useModalAction({
    id: tableKey + "-create",
    modal: YamlModal,
    deps: {
      onOk: () => {},
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
          const resource = selectedRows.map(
            (row) => row.original.name,
          ) as string[];
          delYaml({
            onCancel: closeDelYaml,
            resource,
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
          });
        },
      },
      {
        key: "delete",
        icon: <Trash />,
        text: t("DELETE"),
        // action: "delete",
        onClick: (_, record) => {
          console.log("record", record);
          delYaml({
            onCancel: closeDelYaml,
            resource: [record.name],
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

  console.log("wwwxxxxww", tableMeta, tableRef.current);
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
          />
        </Card>
      </Container>
    </PageLayout>
  );
}

const PageTable = wrapperComponentModal(BasePageTable);
export { PageTable };
