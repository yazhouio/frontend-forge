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
import { useRuntimeContext, withPageRuntime } from "@frontend-forge/forge-components";

function Page() {
  const runtime = useRuntimeContext();
  return <div>{runtime.page.id}</div>;
}

export default withPageRuntime(Page, { id: "page-demo" });
```

## Notes

- The build outputs ESM and keeps `react`/`react-dom` as peer dependencies.
- Style tokens use class names like `ff-button` for consumers to theme.
