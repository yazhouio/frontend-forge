# @frontend-forge/component-generator

组件树（schema）到 TSX 代码的生成器，负责将页面配置解析为可运行的 React 组件代码。

## 快速使用
```ts
import { ComponentGenerator } from '@frontend-forge/component-generator';

const generator = new ComponentGenerator();
generator.registerNode({
  id: 'Layout',
  schema: { templateInputs: {} },
  generateCode: {
    imports: [],
    stats: [],
    jsx: '<div><__ENGINE_CHILDREN__ /></div>',
  },
});
const code = generator.generatePageCode({
  meta: { id: 'page-1', name: 'Sample', path: '/sample' },
  root: { id: 'root', type: 'Layout', props: {}, children: [] },
  context: {},
});

console.log(code);
```

## 缓存（可选）
默认不启用缓存。你可以开启内置的内存 LRU 缓存来加速相同 schema 的重复生成：

```ts
import { ComponentGenerator } from '@frontend-forge/component-generator';

const generator = new ComponentGenerator({
  cache: { maxEntries: 50 },
});
```

## 核心概念
- `PageConfig`：页面 schema，包含 `meta`、`root`、`context` 等字段。
- `NodeDefinition`：描述一个节点如何生成代码（imports/stats/jsx）。
- `DataSourceDefinition`：描述一个数据源的代码生成方式。
- `NodeRegistry`/`DataSourceRegistry`：注册表，用于管理节点与数据源定义。
- `SchemaValidator`：对 schema 做结构校验。
- `Engine`：将 schema 转换为 `CodeFragment`。
- `CodeGenerator`：把 `CodeFragment` 组装成最终 TSX 代码。

## Runtime 绑定
通过 `binding.target = "runtime"` 访问运行时上下文：

```json
{ "type": "binding", "target": "runtime", "path": "page.id", "defaultValue": "Unknown" }
```

## 注册自定义节点
```ts
import { ComponentGenerator } from '@frontend-forge/component-generator';

const generator = new ComponentGenerator();
generator.registerNode({
  id: 'Text',
  schema: {
    templateInputs: {
      TEXT: { type: 'string' },
    },
  },
  generateCode: {
    imports: [],
    stats: [],
    jsx: '<span>{props.TEXT}</span>',
  },
});
```

## 默认节点与数据源
`ComponentGenerator` 不再内置默认节点与数据源，请按需手动注册。
仓库中的 `src/examples/` 提供了可复用的示例定义。

## 目录说明
- `src/engine/`：解析、校验、依赖图与代码拼装逻辑
- `src/examples/nodes.ts`：内置示例节点定义（`src/nodes/index.ts` 兼容导出）
- `src/examples/datasources.ts`：内置示例数据源定义（`src/datasources/index.ts` 兼容导出）
- `src/examples/demo.ts`：示例与调试入口

## 进度与计划
- [x] import 合并
- [x] stat 收集、提升、排序
- [ ] dataSource 支持完善
- [ ] binding 支持
- [x] context 支持
- [x] event 支持
- [ ] JSON Schema 完善和验证
