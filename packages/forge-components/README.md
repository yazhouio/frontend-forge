# @frontend-forge/forge-components

React component library for the Frontend Forge pipeline.

## Usage

```tsx
import { ForgeButton } from "@frontend-forge/forge-components";

export function Demo() {
  return <ForgeButton variant="ghost">Hello</ForgeButton>;
}
```

## Runtime context

```tsx
import {
  RuntimeProvider,
  type RuntimeContextInfo,
  useRuntimeContext,
} from "@frontend-forge/forge-components";

const runtime: RuntimeContextInfo = {
  page: { id: "page-demo" },
  route: { current: "/", params: {}, query: {} },
  location: { pathname: "/", search: "", hash: "" },
  navigation: { navigate: () => {}, goBack: () => {} },
};

function Page() {
  const runtime = useRuntimeContext();
  return <div>{runtime.page.id}</div>;
}

export function PageWithRuntime() {
  return (
    <RuntimeProvider value={runtime}>
      <Page />
    </RuntimeProvider>
  );
}
```

For react-router v6 integration, use the `withPageRuntime` helper from
the project generator scaffold.

## Notes

- The build outputs ESM and keeps `react`/`react-dom` as peer dependencies.
- Style tokens use class names like `ff-button` for consumers to theme.
