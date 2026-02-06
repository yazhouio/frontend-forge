# Frontend Forge 控制面与构建面版本规划

## 1. 背景与目标

Frontend Forge 旨在通过 Kubernetes 风格的声明式资源（CRD / CR），驱动前端扩展能力的生成、构建与交付。
系统核心目标包括：

- 使用 **声明式对象** 描述前端扩展能力
- 通过 **Scene** 抽象将领域语义转化为前端工程产物
- 自动生成、构建并交付 **可加载的 JS Bundle**
- 支持未来多租户、RBAC、插件化扩展

鉴于系统复杂度与落地节奏，本项目采用 **分阶段演进策略**。

---

## 2. 总体演进策略

| 维度     | v1                 | v2                          |
| -------- | ------------------ | --------------------------- |
| 控制面   | Node.js 内部实现   | Kubernetes Controller       |
| 构建面   | Node.js            | Node.js                     |
| 中间产物 | JSBundle（直接）   | Scene ConfigMap -> JSBundle |
| CRD 角色 | 构建输入           | 用户意图                    |
| 架构目标 | 快速落地、验证链路 | 平台化、可演进              |

---

## 3. v1 版本规划（快速落地版）

### 3.1 版本目标

v1 的核心目标是：

> **以最小系统复杂度，跑通 CR → Scene → 构建 → JSBundle → 前端加载 的完整链路**

在该阶段：

- 架构允许“不完全 k8s 原教旨”
- Node.js 同时承担 **控制面 + 构建面**
- 用于验证 Scene 抽象、生成逻辑与构建流水线的可行性

---

### 3.2 架构概览（v1）

```text
CR (FrontendIntegration / FrontendProject)
        ↓  HTTP
Node.js Builder Service
        ├─ 解析 CR
        ├─ 创建 Scene[]
        ├─ Scene → ProjectConfig
        ├─ 构建 & 压缩 JS
        ├─ 创建 JSBundle
        └─ 对外提供 HTTP
```

---

### 3.3 Node.js 职责（v1）

Node.js 作为**唯一工作负载**，承担以下职责：

#### 1. HTTP 接口

- 提供 HTTP API 接受 CR（JSON/YAML）
- CR 可来源于：
  - kubectl proxy
  - controller-less webhook
  - 平台后端

#### 2. CR 解析与校验

- 校验 CR spec 基本合法性
- 根据 `integration.type` 选择 Scene 模板
- 生成内部 `Scene[]`

---

#### 3. Scene 生成与构建

- Scene → PageConfig / ProjectConfig
- 调用构建流水线：
  - 代码生成
  - bundle
  - 最终压缩

---

#### 4. JSBundle 创建与回写元信息

Node.js 在构建完成后：

- 创建或更新 `JSBundle`（KubeSphere 插件前端产物）
- 将 **Scene 配置** 回写到 JSBundle metadata 中：

```yaml
metadata:
  annotations:
    scene.frontend-forge.io/config: |
      {
        "scenes": [
          {
            "type": "CrdTableScene",
            "input": {...}
          }
        ]
      }
```

> 该 annotation 作为：
>
> - 构建可回放依据
> - v2 迁移的重要桥梁

---

### 3.4 v1 的明确约束与取舍

#### 明确接受的限制

- Node.js 内部存在“隐式 controller 逻辑”
- 无 status / condition
- CR 不具备真正的声明式调度语义
- Node.js 强耦合 Scene 选择逻辑

#### v1 不做的事情

- 不实现 Kubernetes Controller
- 不引入 ConfigMap 中间层
- 不处理多租户 / RBAC / namespace 隔离

---

## 4. v2 版本规划（平台化 / 原教旨版）

### 4.1 版本目标

v2 的目标是：

> **将系统重构为标准 Kubernetes 控制面 + 执行面模型，使前端扩展成为一等集群资源**

核心变化：

- Node.js **彻底退出控制面**
- Controller 成为唯一意图调度者
- Scene 成为稳定中间语义层

---

### 4.2 架构概览（v2）

```text
FrontendIntegration CR
        ↓
FrontendIntegration Controller
        ├─ 校验 & 收敛
        ├─ Scene 选择
        └─ 生成 Scene[] ConfigMap
                ↓
        Node.js Builder (watch)
                ↓
        构建 & 创建 JSBundle
```

---

### 4.3 新增组件：Controller（v2）

Controller 的职责：

- watch `FrontendIntegration` CR
- 校验：
  - spec 合法性
  - CRD / API 可发现性

- 决定使用的 Scene 类型
- 生成 **Scene 配置 ConfigMap**

示例：

```yaml
kind: ConfigMap
metadata:
  name: scene-workspace-crd-table
data:
  scenes.json: |
    [
      {
        "type": "CrdTableScene",
        "input": {
          "group": "tenant.kubesphere.io",
          "version": "v1alpha2",
          "resource": "workspaces"
        }
      }
    ]
```

---

### 4.4 Node.js 职责变化（v2）

Node.js 在 v2 中 **只承担执行面**：

- watch Scene ConfigMap
- 不再解析 CR
- 不再选择 Scene
- 仅根据 Scene[] 构建 JSBundle

```text
Node.js = Scene Executor + Builder
```

---

### 4.5 Scene 的角色稳定化

在 v2 中：

- Scene 成为 **Controller 与 Node.js 的唯一语义契约**
- Scene 输入 / 输出需版本化
- Scene 可独立测试、演进

---

## 5. v1 → v2 迁移策略

### 5.1 设计保障

v1 已提前做出的关键设计保障：

- Scene 配置写入 JSBundle annotations
- Scene 结构不绑定 Node.js 私有状态
- 构建流水线与控制逻辑分离

---

### 5.2 迁移路径

1. v1 中引入 **Scene ConfigMap（但暂不使用）**
2. 新增 Controller，生成 ConfigMap
3. Node.js 同时支持：
   - HTTP CR（v1）
   - ConfigMap watch（v2）

4. 移除 v1 HTTP CR 接口
5. 完全切换为 Controller 驱动

---
