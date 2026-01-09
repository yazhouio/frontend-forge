# @frontend-forge/code-export

SystemJS build pipeline (esbuild + SWC + Tailwind) as a reusable package.

Exports:
- `buildOnce({ files, entry, externals, tailwind?, buildTimeoutMs?, childMaxOldSpaceMb?, vendorNodeModules?, rootNodeModules?, workDir? })`
  - Returns `{ js, css, meta }`, rejects if forbidden tokens or missing `System.register`.
- `buildVirtualFiles({ files, entry, externals, ... })`
  - Returns `{ files, meta }` where `files` is a `VirtualFile[]`.
- `CodeExporter`
  - Optional cache/scheduler wrapper around `buildOnce`, suitable for server usage.
- Helpers: `computeBuildKey`, `ALLOWED_FILE_RE`, `safeJoin`, `mkWorkDir`, `rmWorkDir`, `nowMs`, `binPath`, `sha256`.

Notes:
- `vendorNodeModules` is resolved by checking the provided path first, then falling back to legacy `packages/vendor/node_modules`, `vendor/node_modules`, and finally `node_modules`.
- When used by the server, `vendorNodeModules` points to `apps/server/vendor/node_modules` (installed separately).
- If `workDir` is not provided, a temp dir is created and cleaned automatically.
