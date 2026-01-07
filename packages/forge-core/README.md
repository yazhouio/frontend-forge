# @frontend-forge/forge-core

Orchestrator that wires manifest-based project generation and SystemJS build.

Current capabilities:
- `forgeProject` wraps `@frontend-forge/project-generator` to materialize a scaffolded project on disk.
- Optional build step will read generated files and invoke `@frontend-forge/code-export` to emit SystemJS output.

Planned extensions:
- Configurable archive/export formats.
- Pluggable component-generator defaults.
- Richer build caching/skip logic.
