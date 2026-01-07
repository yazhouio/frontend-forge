# @frontend-forge/vendor

Vendored runtime dependencies (React ecosystem helpers, polyfills, etc.) exposed as a workspace package so the build pipeline can resolve them from a stable location.

Used by the SystemJS build step to locate `node_modules` for externals without pulling them into the generated bundle.
