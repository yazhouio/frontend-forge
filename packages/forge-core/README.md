# @frontend-forge/forge-core

Orchestrator that wires manifest-based project generation and SystemJS build.

Current capabilities:
- `ForgeCore` provides a build API (`core.build(body)`) suitable for HTTP handlers, with injected cache + scheduler.
- `forgeProject` can generate project files in-memory and optionally stream them via an injected writer.
- Build step consumes in-memory files and invokes `@frontend-forge/code-export` to emit SystemJS output (no disk roundtrip in core).

Planned extensions:
- Configurable archive/export formats.
- Pluggable component-generator defaults.
- Richer build caching/skip logic.
