# @frontend-forge/forge-core

Unified entry for the Frontend Forge low-code toolchain.

`forge-core` provides a stable, high-level API to generate, build, and export low-code projects. It orchestrates:

- `component-generator` – page schema → code
- `project-generator` – project manifest → virtual files
- `code-export` – build backend

## Installation

```bash
pnpm add @frontend-forge/forge-core
```

## Quick Start

```ts
import { ForgeCore } from '@frontend-forge/forge-core';
import {
  ComponentGenerator,
  ProjectGenerator,
  CodeExporter,
} from '@frontend-forge/forge-core/advanced';

const component = new ComponentGenerator();
component.registerNode({
  id: 'Layout',
  schema: { templateInputs: {} },
  generateCode: {
    imports: [],
    stats: [],
    jsx: '<div><__ENGINE_CHILDREN__ /></div>',
  },
});
const project = new ProjectGenerator();
const exporter = new CodeExporter();

const forge = new ForgeCore({
  componentGenerator: component,
  projectGenerator: project,
  codeExporter: exporter,
});

const files = await forge.buildProject(manifest, { build: true });
forge.emitToFileSystem(files, './dist');
```

## Core Concepts

- **VirtualFile**: `{ path, content }` is the shared intermediate format.
- **Page renderer**: a callback that turns a page schema into TSX.
- **Build step**: optional; only available when `codeExporter` is provided.

## Public API (Stable)

### `new ForgeCore(options)`

```ts
new ForgeCore({
  componentGenerator,
  projectGenerator,
  codeExporter,
});
```

### `generatePageCode(schema)`

Generate code for a single page schema.

### `generateProjectFiles(manifest, options?)`

Generate project files without building. If `options.pageRenderer` is omitted,
ForgeCore derives it from the `componentGenerator`.

### `buildVirtualFiles(files)`

Compile virtual files using the configured build backend. Throws if
`codeExporter` is not provided.

### `buildProject(manifest, { build })`

High-level one-shot API. When `build: true`, it generates files and compiles them.

### Emit helpers

```ts
forge.emitToFileSystem(files, dir);
forge.emitToTar(files);
forge.emitToTarGz(files);
```

These helpers validate file paths to prevent path traversal.

## Errors

All validation errors are surfaced as `ForgeError` with a `statusCode` to
support server usage and HTTP error mapping.

## Advanced API

```ts
import {
  ComponentGenerator,
  ProjectGenerator,
  CodeExporter,
} from '@frontend-forge/forge-core/advanced';
```

Advanced APIs are intended for:

- IDE / editor integration
- Plugin authors
- Custom pipelines

These APIs are less stable than the public ForgeCore API.

## Design Principles

- ForgeCore defines workflow, not implementation
- VirtualFile is the primary intermediate representation
- Generators are composable, not hidden
- Public API stability is prioritized over internal flexibility

## Mental Model

- component-generator: schema → code
- project-generator: code → project
- code-export: project → artifact
- forge-core: tie everything together
