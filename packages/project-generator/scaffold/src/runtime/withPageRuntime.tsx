import * as React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  RuntimeProvider,
  type RuntimeContextInfo,
} from '@frontend-forge/forge-components';
import { RuntimePageInfo } from './types';

export function withPageRuntime<P>(
  Page: React.ComponentType<P>,
  page: RuntimePageInfo
): React.FC<P> {
  return function RuntimeWrappedPage(props: P) {
    const location = useLocation();
    const navigate = useNavigate();
    const params = useParams();

    const runtime = React.useMemo<RuntimeContextInfo>(
      () => ({
        page: {
          id: page.id,
          params,
        },
        route: {
          current: location.pathname,
          params,
          query: Object.fromEntries(new URLSearchParams(location.search)),
        },
        location: {
          pathname: location.pathname,
          search: location.search,
          hash: location.hash,
        },
        navigation: {
          navigate,
          goBack: () => navigate(-1),
        },
        permissions: page.permissions,
        features: page.features,
        meta: page.meta,
      }),
      [location, navigate, params]
    );

    return (
      <RuntimeProvider value={runtime}>
        <Page {...props} />
      </RuntimeProvider>
    );
  };
}
