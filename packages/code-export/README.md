# @frontend-forge/code-export

SystemJS build pipeline (esbuild + SWC + Tailwind) as a reusable package.

Exports:
- `buildOnce({ files, entry, externals, tailwind?, buildTimeoutMs?, childMaxOldSpaceMb?, vendorNodeModules?, rootNodeModules?, workDir? })`
  - Returns `{ js, css, meta }`, rejects if forbidden tokens or missing `System.register`.
- Helpers: `computeBuildKey`, `ALLOWED_FILE_RE`, `safeJoin`, `mkWorkDir`, `rmWorkDir`, `nowMs`, `binPath`, `sha256`.

Notes:
- `vendorNodeModules` defaults to locating `packages/vendor/node_modules` (workspace path) with fallbacks to `vendor/node_modules` or `node_modules`.
- If `workDir` is not provided, a temp dir is created and cleaned automatically.
