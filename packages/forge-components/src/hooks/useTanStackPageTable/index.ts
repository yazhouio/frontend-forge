import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type VisibilityState,
  type PaginationState,
  type SortingState,
  type TableMeta,
  type TableOptions,
} from "@tanstack/react-table";

type Updater<T> = T | ((prev: T) => T);

export type PageTableController = {
  table: {
    columnFilters: ColumnFiltersState;
    sorting: SortingState;
    columnVisibility: VisibilityState;
  };
  pagination: PaginationState;
  setColumnFilters: (updater: Updater<ColumnFiltersState>) => void;
  setSorting: (updater: Updater<SortingState>) => void;
  setColumnVisibility: (updater: Updater<VisibilityState>) => void;
  setPagination: (updater: Updater<PaginationState>) => void;
};

export function usePageTable<T>({
  data,
  columns,
  page,
  tableMeta,
  tableOptions,
}: {
  data: T[];
  columns: ColumnDef<T>[];
  page: PageTableController;
  tableMeta: TableMeta<T>;
  tableOptions?: Partial<TableOptions<T>> & { loading?: boolean };
}) {
  return useReactTable({
    data,
    columns,
    state: {
      columnFilters: page.table.columnFilters,
      sorting: page.table.sorting,
      columnVisibility: page.table.columnVisibility,
      pagination: page.pagination,
    },
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
