import { RuntimeProvider } from "@frontend-forge/forge-components";
import {
  getActions,
  getLocalTime,
  useBatchActions,
  useItemActions,
  useTableActions,
} from "@ks-console/shared";
import TablePreviewItem from "./TablePreviewItem";
import { usePageRuntimeRouter } from "./routerHook";

const pageContext = {
  useTableActions: useTableActions,
  useBatchActions: useBatchActions,
  useItemActions: useItemActions,
  getActions: getActions,
  getLocalTime: getLocalTime,
};

export function TablePreview() {
  const route = usePageRuntimeRouter();

  return (
    <RuntimeProvider
      value={{
        ...route,
        page: {
          id: "workspace-table-preview",
        },
        capabilities: pageContext,
      }}
    >
      <TablePreviewItem />
    </RuntimeProvider>
  );
}
