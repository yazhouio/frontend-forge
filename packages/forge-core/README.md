# @frontend-forge/forge-core

Unified entry for Frontend Forge low-code toolchain.

`forge-core` provides a stable, high-level API to generate, build, and export low-code projects.

It orchestrates:

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
component.registerNode(LayoutNode);
component.registerNode(CardNode);

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

## Public API (Stable)

### ForgeCore

```ts
new ForgeCore(options: {
  componentGenerator: ComponentGenerator;
  projectGenerator: ProjectGenerator;
  codeExporter?: CodeExporter;
});
```

### generatePageCode

```ts
forge.generatePageCode(pageSchema);
```

Generate code for a single page schema.

### generateProjectFiles

```ts
forge.generateProjectFiles(projectManifest);
```

Generate project files without building.

### buildVirtualFiles

```ts
forge.buildVirtualFiles(files);
```

Compile virtual files using the configured build backend.

### buildProject

```ts
forge.buildProject(manifest, { build: true });
```

High-level one-shot API.

### emit helpers

```ts
forge.emitToFileSystem(files, dir);
forge.emitToTar(files);
forge.emitToTarGz(files);
forge.emitToZip(files);
```

Note: `emitToZip` is a placeholder and throws until implemented.

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

## Non-goals

- No UI runtime
- No framework lock-in
- No file system dependency
- No build tool configuration

## Mental Model

- component-generator: schema → code
- project-generator: code → project
- code-export: project → artifact
- forge-core: tie everything together
