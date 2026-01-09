# FrontendForge

KubeSphere v4 插件构建服务。

## Monorepo 布局
- `apps/server`：HTTP/CLI 入口（Fastify 服务、缓存/队列等）
- `packages/project-generator`：根据 manifest + 组件代码生成项目骨架
- `packages/component-generator`：从组件树生成 TSX 代码（仍在演进）
- `packages/code-export`：SystemJS 构建管线包
- `packages/forge-core`：编排层（项目生成 + 构建）
- `apps/server/vendor`：构建阶段需要的第三方依赖集合（独立安装）
- `spec/`：设计与接口草稿
