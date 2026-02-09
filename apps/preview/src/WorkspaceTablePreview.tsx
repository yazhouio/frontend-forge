import { getCrdStore, RuntimeProvider } from "@frontend-forge/forge-components";
import {
  buildCreateActionGuard,
  getActions,
  getLocalTime,
  useBatchActions,
  useItemActions,
  useTableActions,
  useWorkspaceProjectSelect,
} from "@ks-console/shared";
import { usePageRuntimeRouter } from "./routerHook";
import WorkspaceTablePreviewItem from "./WorkspaceTablePreviewItem";

const pageContext = {
  useTableActions: (config) =>
    useTableActions({
      ...config,
      actions: config.actions.map((item) => {
        return {
          ...item,
          ...buildCreateActionGuard({
            params: config.params,
          }),
          action: item.action,
        };
      }),
    }),
  useBatchActions: useBatchActions,
  useItemActions: useItemActions,
  getActions: getActions,
  getLocalTime: getLocalTime,
  useWorkspaceProjectSelect: useWorkspaceProjectSelect,
  t: (d) => "xx" + d,
};

export function WorkspaceTablePreview() {
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
      <WorkspaceTablePreviewItem />
    </RuntimeProvider>
  );
}
