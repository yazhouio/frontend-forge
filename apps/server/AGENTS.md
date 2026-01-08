# Repository Guidelines

## Project Structure & Module Organization
- `src/` TypeScript source for the Fastify server (`server.ts`), config (`config.ts`), cache (`cache.ts`), CLI helper (`projectCli.ts`), and shared types (`types.ts`).
- `dist/` build output from `tsc` (created by `pnpm build` or `pnpm start`).
- `examples/` sample inputs like `manifest.sample.json`.
- `test.json` and `test.sh` manual build smoke test assets.
- `Dockerfile` for container builds; `README.md` documents API and env vars.

## Build, Test, and Development Commands
- `pnpm install` install dependencies (preferred package manager).
- `pnpm dev` run the server with hot reload via `tsx watch`.
- `pnpm build` compile TypeScript to `dist/`.
- `pnpm start` build then run `node dist/server.js`.
- `pnpm project:debug` run the project CLI against local sources.
- `./test.sh` send a `/build` request using `test.json` (expects server on `127.0.0.1:3000`) and writes `dist/index.js`.

## Coding Style & Naming Conventions
- TypeScript, ESM (`"type": "module"`). Use `import`/`export` and include `.js` extensions in relative imports.
- Indentation is 2 spaces; prefer single quotes and trailing commas like existing files.
- Use `camelCase` for variables/functions, `PascalCase` for types/interfaces, and `lowerCamelCase` for file names.

## Testing Guidelines
- No automated unit test runner is configured. Use `./test.sh` for a manual integration check and verify `/build` responses contain `System.register`.
- If you add tests, include a script in `package.json` and document how to run it here.

## Commit & Pull Request Guidelines
- Recent history uses Conventional Commit prefixes (`feat:`, `fix:`, `refactor:`); prefer that format.
- PRs should include: a short summary, rationale, how you tested (`pnpm build`, `./test.sh`, etc.), and any API or env var changes.
- Update `README.md` when `/build` contract, env vars, or Docker behavior changes.

## Configuration & Runtime Notes
- Key env vars live in `src/config.ts` (e.g., `PORT`, `CACHE_DIR`, `CONCURRENCY`, `BUILD_TIMEOUT_MS`).
- Defaults target local development (`0.0.0.0:3000`, `.cache`), so document any changes to defaults.
