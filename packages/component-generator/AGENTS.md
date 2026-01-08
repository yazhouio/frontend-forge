# Repository Guidelines

## Project Structure & Module Organization
- `src/engine/` contains the core pipeline (schema validation, action graph handling, code generation).
- `src/nodes/` holds node definitions and helpers consumed by the engine.
- `src/dataSource/` defines data source types and interfaces; `src/datasources/` contains registry or built-in entries.
- `src/interfaces.ts` and `src/constants.ts` provide shared types and constants.
- `spec/` is for design notes and architecture docs (for example, `spec/Action_Graph.md`).
- `index.ts` and `src/index.ts` are the current entrypoints/placeholders for exports.

## Build, Test, and Development Commands
- `pnpm install` installs dependencies from `package.json`.
- `pnpm build` compiles TypeScript to `dist/` via `tsc`.
- `pnpm clean` removes the `dist/` output directory.

## Coding Style & Naming Conventions
- TypeScript with ES module imports; follow existing formatting in `src/engine/Engine.ts` (2-space indentation, semicolons).
- `PascalCase` for classes and types, `camelCase` for functions/variables, and `SCREAMING_SNAKE_CASE` for exported constants.
- File names reflect intent: `PascalCase.ts` for class-centric modules and `camelCase.ts` for utilities; keep consistency within each folder.

## Testing Guidelines
- No automated test framework is configured yet.
- When adding tests, prefer `*.test.ts` or `*.spec.ts` either colocated with the source file or under a new `tests/` directory, and document the command in `package.json`.

## Commit & Pull Request Guidelines
- Commit messages follow Conventional Commits (examples: `feat: add data source registry`, `refactor: simplify hook collector`).
- PRs should include: a concise summary, affected files or modules (for example, `src/engine/actionGraph.ts`), and updates to `spec/` when behavior or schema changes.
- If changes affect generated output, include a brief before/after snippet or a minimal example in the PR description.
