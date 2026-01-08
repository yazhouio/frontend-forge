# @frontend-forge/project-generator

Generates a KubeSphere extension project from a manifest plus page code provider.

Current behavior (moved from the original server implementation):
- Validates manifest (routes/menus/locales/pages/build) and normalizes fields.
- Renders the `scaffold/` template, package.json/routes/locales/pages.
- Accepts a `componentGenerator(page, manifest)` callback to inject per-page TSX.

Notes:
- Template assets live in `scaffold/`; keep this folder when publishing.
- CLI usage in `apps/server/src/projectCli.ts` consumes this package via workspace.
- `build`/`archive` options are stubbed; they surface warnings only.

Additional API:
- `generateProjectFiles(manifest, { componentGenerator, ... })` returns `{ files, warnings }` for in-memory generation (`files` is `VirtualFile[]`).
- Writing files to disk is handled by the caller (CLI/server/etc).
