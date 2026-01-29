# PageStore（Zustand）设计与重构说明

## 背景

当前 `usePageStore` 同时承担了三类职责：

1. **Store 创建与持久化**
2. **URL ↔ Store 同步（副作用）**
3. **组件消费 state / action**

当 **同一页面中多个组件（父 / 子）同时调用 `usePageStore` 且 pageId 相同** 时：

- Store 实例虽然被复用（通过 `storeMap`）
- **但 Hook 内部的 `useEffect` 副作用会被执行多次**
- 导致：
  - URL 同步逻辑重复执行
  - cache / persist 重复触发
  - 后续维护复杂（StrictMode / 并发渲染更明显）

## 目标

- **同一个 pageId 的 PageStore 只初始化 & 同步一次**
- 任意组件都可以安全读取 / 修改 PageStore
- 不依赖 React Context
- 保持 Zustand 单例 Store 模型
- 最小化对现有代码的侵入

---

## 设计原则

1. **Store 是单例（已满足）**
2. **副作用只能在一个地方执行**
3. **订阅（读 state）可以在任意组件执行**
4. **Action（写 state）可以在任意组件调用**

---

## 重构方案概览

将原来的 `usePageStore` 拆分为三层：

```
┌───────────────────────────┐
│ useInitPageStore          │  ← 只允许在页面根组件调用一次
│ - URL → Store 同步        │
│ - Store → URL 同步        │
│ - cache / persist         │
└───────────────────────────┘
            │
            ▼
┌───────────────────────────┐
│ Zustand Store（单例）      │  ← pageId 维度
└───────────────────────────┘
            │
            ▼
┌───────────────────────────┐
│ usePageStoreState         │  ← 任意组件可用
│ usePageStoreActions       │
└───────────────────────────┘
```

---

## 1. Store 层（保持不变）

### 现有能力（保留）

- `storeMap: Map<string, PageStoreHook>`
- `createPageStore(...)`
- LRU cache
- persist throttle
- reset 逻辑

### 要求

- `createPageStore` **不得包含 React Hook**
- Store 生命周期独立于 React 组件
- 同一 `pageId` 永远返回同一个 Store 实例

---

## 2. 初始化 Hook（新增）

### `useInitPageStore`

**职责：**

- 创建 / 获取 PageStore
- 执行以下副作用（只执行一次）：
  - URL → Store 同步
  - Store → URL 同步
  - cache 写入

- 不返回 state（只负责副作用）

### 设计约束

- **一个 pageId 在一个页面生命周期中只能调用一次**
- 只能在页面根组件使用
- 不允许在子组件中调用

### 示例接口

```ts
useInitPageStore<T>({
  pageId: string;
  columns: ColumnDef<T>[];
  initialQuery?: Record<string, any>;
});
```

### 内部逻辑（来自原 usePageStore）

需要迁移的逻辑包括：

- `parseFromUrl`
- `buildSearch`
- `normalizeSearch`
- `lastSyncedSearchRef`
- `useSearchParams`
- cache 首次写入
- URL ↔ Store 同步的 `useEffect`

---

## 3. 状态消费 Hook（新增）

### `usePageStoreState`

**职责：**

- 订阅并返回 PageStore 的状态
- 无副作用
- 可在任意组件调用（父 / 子 / 深层组件）

```ts
function usePageStoreState(pageId: string) {
  const store = storeMap.get(pageId)!;
  return store((s) => ({
    query: s.query,
    table: s.table,
    pagination: s.pagination,
  }));
}
```

---

## 4. Action Hook（新增）

### `usePageStoreActions`

**职责：**

- 返回 PageStore 的 action 方法
- 不订阅 state（避免不必要渲染）
- 可在任意组件调用

```ts
function usePageStoreActions(pageId: string) {
  const store = storeMap.get(pageId)!;
  return store((s) => ({
    setQuery: s.setQuery,
    setColumnFilters: s.setColumnFilters,
    setSorting: s.setSorting,
    setColumnVisibility: s.setColumnVisibility,
    setPagination: s.setPagination,
    reset: s.reset,
  }));
}
```

---

## 5. 页面使用方式（规范）

### 页面根组件

```tsx
function Page() {
  useInitPageStore({
    pageId: "users",
    columns,
    initialQuery,
  });

  return <PageContent />;
}
```

### 子组件（任意层级）

```tsx
function TableView() {
  const { table, pagination } = usePageStoreState("users");
  const { setPagination } = usePageStoreActions("users");

  ...
}
```

---

## 6. 禁止用法（明确约束）

❌ 不允许在多个组件中调用 `useInitPageStore`
❌ 不允许在子组件中做 URL / cache 同步
❌ 不允许在 state hook 中写副作用

---

## 7. 为什么不用 Context

- Zustand Store 本身是模块级单例
- Context 反而会：
  - 引入 Provider 层级依赖
  - 增加 rerender 复杂度

- pageId 已天然是作用域边界

---

## 8. 预期收益

- URL / cache 同步逻辑 **只执行一次**
- 子组件无感知，直接拿数据
- 更安全地支持：
  - React StrictMode
  - 并发渲染
  - Suspense / Streaming

- 逻辑分层清晰，后续可维护性显著提升

---

## 9. Codex 修改指令（可直接使用）

> 请将现有的 `usePageStore` 拆分为：
>
> - `useInitPageStore`
> - `usePageStoreState`
> - `usePageStoreActions`
>
> 要求：
>
> - 保持原有 PageStore 结构与行为
> - 所有副作用只存在于 `useInitPageStore`
> - Store 实例通过 `storeMap` 复用
> - 子组件调用 state / action 不触发任何副作用
> - 最小化 diff，不改变外部 API 语义

---

如果你愿意，下一步我可以帮你再补一段 **“为什么不用一个 hook + flag 防重” 的反例说明**，让 Codex 更不容易“走歪”。
