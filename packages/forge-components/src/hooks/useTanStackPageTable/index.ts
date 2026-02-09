import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type TableMeta,
  type TableOptions,
} from "@tanstack/react-table";
import { PageStore } from "../useTanStackPageStore";
import React from "react";

export function usePageTable<T>({
  data,
  columns,
  page,
  tableMeta,
  tableOptions,
}: {
  data: T[];
  columns: ColumnDef<T>[];
  page: PageStore;
  tableMeta: TableMeta<T>;
  tableOptions?: Partial<TableOptions<T>> & { loading?: boolean };
}) {
  const state = React.useMemo(() => {
    return {
      columnFilters: page.table.columnFilters,
      sorting: page.table.sorting,
      columnVisibility: page.table.columnVisibility,
      pagination: page.pagination,
    };
  }, [page.table, page.pagination]);

  return useReactTable({
    data,
    columns,
    state,
    onColumnFiltersChange: page.setColumnFilters,
    onSortingChange: page.setSorting,
    onColumnVisibilityChange: page.setColumnVisibility,
    onPaginationChange: page.setPagination,
    getCoreRowModel: getCoreRowModel(),
    manualFiltering: true,
    manualSorting: true,
    manualPagination: true,
    ...(tableOptions ?? {}),
    meta: {
      enable: {
        pagination: true,
        toolbar: true,
        visible: true,
        filters: true,
      },
      ...tableMeta,
    } as TableMeta<T>,
  });
}
