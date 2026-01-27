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
    ...rest
  } = props;
  const { useItemActions, useBatchActions, useTableActions } = pageContext;
  const tableRef = React.useRef<Table<Record<string, unknown>>>(null);

  const { open: createYaml, close: closeYaml } = useModalAction({
    id: tableKey + "-create",
    modal: YamlModal,
    deps: {
      onOk: () => {},
      title: title,
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

  const toolbarLeft = () => {
    return <div>111</div>;
  };

  const tableActions = useTableActions({
    authKey,
    params,
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
          createYaml();
        },
      },
    ],
  });

  const batchActions = useBatchActions({
    authKey,
    params,
    actions: [
      {
        key: "delete",
        text: t("DELETE"),
        // action: "delete",
        onClick: () => {
          // todo
        },
        props: {
          color: "error",
        },
      },
    ],
  });

  const renderItemActions = useItemActions({
    authKey,
    params,
    actions: [
      {
        key: "editYaml",
        icon: <Pen />,
        text: t("EDIT_YAML"),
        // action: "edit",
        onClick: (_, record) => {
          updateYaml(record);
        },
      },
      {
        key: "delete",
        icon: <Trash />,
        text: t("DELETE"),
        // action: "delete",
        onClick: (_, record) => {
          delYaml(record);
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
        console.log(
          "xxx",
          renderItemActions(info.getValue(), info.row.original),
        );
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
          />
        </Card>
      </Container>
    </PageLayout>
  );
}

const PageTable = wrapperComponentModal(BasePageTable);
export { PageTable };
