# Repository Guidelines

## Project Structure & Module Organization
- Monorepo managed by `pnpm` workspaces (`apps/*`, `packages/*`).
- `apps/server/` Fastify-based build service + CLI entrypoints; see `apps/server/src/`.
- `packages/forge-core/` orchestration layer that stitches project generation and build.
- `packages/project-generator/` scaffolding + manifest-driven project generation (`scaffold/`, `src/`).
- `packages/code-export/` build pipeline helpers (esbuild/SWC/Tailwind).
- `packages/component-generator/` component tree to TSX generator (evolving).
- `packages/vendor/` vendored runtime dependencies for build outputs.
- `spec/` design/interface drafts (may be empty).

## Build, Test, and Development Commands
- `pnpm install` install workspace dependencies at the repo root.
- `pnpm --filter @frontend-forge/server dev` run the server with hot reload (`tsx watch`).
- `pnpm --filter @frontend-forge/server build` compile the server to `apps/server/dist/`.
- `pnpm --filter @frontend-forge/server start` build then run `node dist/server.js`.
- `pnpm -r run build` build all packages that define a `build` script.
- `apps/server/test.sh` send a `/build` request using `apps/server/test.json` (expects `127.0.0.1:3000`).

## Coding Style & Naming Conventions
- TypeScript, Node ESM in most packages (`"type": "module"`). Use `import`/`export`.
- Keep 2-space indentation and semicolons; follow the local file’s quote style.
- For ESM relative imports in the server, include `.js` extensions.
- Naming: `camelCase` variables/functions, `PascalCase` types/classes, kebab-case package names.
- No lint/format tooling is configured at the root; keep changes consistent with nearby code.

## Testing Guidelines
- No automated test runner is configured for the workspace.
- Use `apps/server/test.sh` as a manual integration check for the `/build` endpoint.
- If you add tests, add a `test` script in the relevant package and document it here.

## Commit & Pull Request Guidelines
- Recent history mixes sentence-style commits and Conventional Commits; prefer `feat:`, `fix:`, `refactor:` when possible.
- Keep commit subjects short and imperative (e.g., `fix: guard invalid paths`).
- PRs should include: summary, rationale, how you tested, and any API/env var changes.
- Update package READMEs (e.g., `apps/server/README.md`) when API or CLI behavior changes.

## Configuration & Runtime Notes
- Server runtime defaults and env vars live in `apps/server/src/config.ts`.
- Temporary build output is written under `.tmp/`; do not commit generated files.
