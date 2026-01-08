好，这里我给你一份**“已经定型、可直接落库”的完整设计更新版**，以及一份**可以直接放到 `@frontend-forge/forge-core/README.md` 的导出与使用说明**。
我会把「设计原则」和「README 面向用户的说法」**严格区分**，避免以后你自己都绕晕。

---

# 一、完整设计（Finalized Architecture）

## 1. 总体定位（最终版）

> **forge-core 是低代码编译工具链的“规范化入口（Facade + Contract）”。**
>
> * 它 *不实现* 编译能力
> * 它 *不定义* DSL / Node
> * 它 *不耦合* esbuild / swc
>
> 它只做三件事：
>
> 1. **定义 pipeline 语义**
> 2. **编排 generators**
> 3. **对外承诺稳定 API**

---

## 2. 最终分层模型（请以此为“真相图”）

```
┌────────────────────────────────────┐
│            User / CLI / Server     │
└────────────────────────────────────┘
                │
                ▼
┌────────────────────────────────────┐
│          forge-core (Facade)        │  ← 稳定 API
│  - pipeline orchestration           │
│  - VirtualFile contract             │
└────────────────────────────────────┘
        │                │
        ▼                ▼
┌──────────────┐  ┌────────────────┐
│ component-   │  │ project-        │
│ generator    │  │ generator       │
│              │  │                │
│ PageSchema → │  │ Manifest →      │
│ CodeFragment │  │ VirtualFiles    │
└──────────────┘  └────────────────┘
                │
                ▼
        ┌────────────────┐
        │ code-export    │
        │                │
        │ VirtualFiles → │
        │ BuiltFiles     │
        └────────────────┘
```

---

## 3. 各 package 的**最终职责声明**

### 3.1 component-generator

> **Schema Compiler**

**职责（不可越界）**

* 定义 Node / DataSource / ActionGraph
* Page Schema → CodeFragment / JS code
* Schema 校验 / binding / hooks 收集

**明确不做**

* ❌ 项目结构
* ❌ 文件系统
* ❌ 打包 / 压缩

---

### 3.2 project-generator

> **Project Scaffold Generator**

**职责**

* Project Manifest → VirtualFile[]
* 页面代码只是“内容来源之一”

**明确不做**

* ❌ AST / codegen
* ❌ 编译
* ❌ 写磁盘

---

### 3.3 code-export

> **Build Backend**

**职责**

* VirtualFile[] → VirtualFile[]
* esbuild / swc / tailwind / bundling

**明确不做**

* ❌ Schema
* ❌ Node
* ❌ 项目模板

---

### 3.4 forge-core（最终定义）

> **Pipeline Orchestrator & Public Contract**

**职责**

* 定义 pipeline 阶段
* 聚合 generator
* 暴露稳定 API
* 提供 IO helpers（可选）

**不允许出现**

* NodeDefinition
* Babel / esbuild 参数
* Schema 细节

---

## 4. API 分层策略（最终定稿）

### ✅ 你**必须**暴露 generators

### ❗ 但**必须分层暴露**

| 层级       | 面向对象     | 包入口                                   | 稳定性   |
| -------- | -------- | ------------------------------------- | ----- |
| Public   | 80% 用户   | `@frontend-forge/forge-core`          | ⭐⭐⭐⭐⭐ |
| Advanced | 插件 / IDE | `@frontend-forge/forge-core/advanced` | ⭐⭐⭐   |
| Internal | 内部       | 各 package /internal                   | ❌     |

---

# 二、Forge Core – README（可直接使用）

下面这部分，你可以 **原封不动放进 README**。

---

## @frontend-forge/forge-core

> Unified entry for Frontend Forge low-code toolchain.

`forge-core` provides a **stable, high-level API** to generate, build, and export low-code projects.

It orchestrates:

* `component-generator` – page schema → code
* `project-generator` – project manifest → virtual files
* `code-export` – build backend

---

## Installation

```bash
pnpm add @frontend-forge/forge-core
```

---

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

await forge.emitToFileSystem(files, './dist');
```

---

## Public API (Stable)

### ForgeCore

```ts
new ForgeCore(options: {
  componentGenerator: ComponentGenerator;
  projectGenerator: ProjectGenerator;
  codeExporter?: CodeExporter;
});
```

---

### generatePageCode

```ts
forge.generatePageCode(pageSchema);
```

Generate code for a single page schema.

---

### generateProjectFiles

```ts
forge.generateProjectFiles(projectManifest);
```

Generate project files without building.

---

### buildVirtualFiles

```ts
forge.buildVirtualFiles(files);
```

Compile virtual files using the configured build backend.

---

### buildProject

```ts
forge.buildProject(manifest, { build: true });
```

High-level one-shot API.

---

### emit helpers

```ts
forge.emitToFileSystem(files, dir);
forge.emitToTar(files);
forge.emitToZip(files);
```

---

## Advanced API

```ts
import {
  ComponentGenerator,
  ProjectGenerator,
  CodeExporter,
} from '@frontend-forge/forge-core/advanced';
```

> ⚠️ Advanced APIs are intended for:
>
> * IDE / editor integration
> * Plugin authors
> * Custom pipelines
>
> These APIs are **less stable** than the public ForgeCore API.

---

## Design Principles

* ForgeCore defines **workflow**, not implementation
* VirtualFile is the primary intermediate representation
* Generators are composable, not hidden
* Public API stability is prioritized over internal flexibility

---

## Non-goals

* No UI runtime
* No framework lock-in
* No file system dependency
* No build tool configuration

---

## Mental Model

> * component-generator: *schema → code*
> * project-generator: *code → project*
> * code-export: *project → artifact*
> * forge-core: *tie everything together*

---

# 三、给你一句“架构护城河级”的总结

> **forge-core 不是“功能库”，
> 而是“低代码编译规范”。**

只要你守住：

* **VirtualFile 是唯一中间态**
* **core 不定义 DSL**
* **generators 可单独使用，但不抢主入口**



