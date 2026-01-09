# @frontend-forge/vendor

Vendored runtime dependencies (React ecosystem helpers, polyfills, etc.) stored under `apps/server/vendor` and installed separately from the pnpm workspace.

Install with:
```bash
npm --prefix apps/server/vendor install --production
```

Used by the SystemJS build step to locate `node_modules` for externals without pulling them into the generated bundle.
