import * as React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  RuntimeProvider,
  type RuntimeContextInfo,
} from "@frontend-forge/forge-components";
import {
  getActions,
  getLocalTime,
  useBatchActions,
  useItemActions,
  useTableActions,
} from "@ks-console/shared";
import { RuntimePageInfo } from "./types";
import { usePageRuntimeRouter } from "./routerHook";

const pageContext = {
  useTableActions: useTableActions,
  useBatchActions: useBatchActions,
  useItemActions: useItemActions,
  getActions: getActions,
  getLocalTime: getLocalTime,
};
export function withPageRuntime<P>(
  Page: React.ComponentType<P>,
  page: RuntimePageInfo,
): React.FC<P> {
  return function RuntimeWrappedPage(props: P) {
    const route = usePageRuntimeRouter();

    const runtime = React.useMemo<RuntimeContextInfo>(
      () => ({
        ...route,
        page: {
          id: page.id,
        },
        capabilities: pageContext,
      }),
      [route, page],
    );

    return (
      <RuntimeProvider value={runtime}>
        <Page {...props} />
      </RuntimeProvider>
    );
  };
}
