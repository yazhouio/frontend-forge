
# 轻量 Action Graph（LAG）设计

## 一句话定位（非常重要）

> **Action Graph = 事件驱动的“指令流水线”
> 不建模状态机，只建模“事件 → 动作 → 副作用”**

它介于：

* ❌ 纯组件黑盒
* ❌ 完整 FSM / BPM

之间。

---

## 一、它解决什么问题（非常精确）

回到你的痛点：

```tsx
Input -> value
Button -> onClick
createUser(value)
```

问题不是“怎么渲染”，而是：

* Input 的值 **要被别的节点用**
* Button 的点击 **要触发副作用**
* 中间状态 **不能随意 useState**

👉 **Action Graph 的核心能力：
提供一个“受控的共享上下文 + 事件编排”**

---

## 二、Action Graph 的核心模型

### 2.1 Graph = Context + Actions

```ts
export type ActionGraphSchema = {
  id: string
  context: Record<string, any>
  actions: Record<string, ActionNode>
}
```

---

### 2.2 ActionNode（重点）

```ts
export type ActionNode = {
  on: string                 // 事件名
  do: ActionStep[]
}
```

---

### 2.3 ActionStep（最小指令集）

```ts
type ActionStep =
  | { type: 'assign'; to: string; value: string }
  | { type: 'callDataSource'; id: string; args?: string[] }
  | { type: 'reset'; path: string }
```

> ❗ 刻意只支持 3 种指令
> 不支持 if / loop（这是边界）

---

## 三、用 Action Graph 表达 CreateUser（完整示例）

### 3.1 JSON Schema（新增 actionGraph）

```json
{
  "version": "1.0",
  "dataSources": [
    {
      "id": "createUser",
      "type": "http",
      "config": {
        "url": "/api/users",
        "method": "POST",
        "immediate": false
      }
    }
  ],
  "actionGraphs": [
    {
      "id": "createUserGraph",
      "context": {
        "name": ""
      },
      "actions": {
        "INPUT_CHANGE": {
          "on": "input1.change",
          "do": [
            {
              "type": "assign",
              "to": "context.name",
              "value": "$event.value"
            }
          ]
        },
        "SUBMIT": {
          "on": "btn1.click",
          "do": [
            {
              "type": "callDataSource",
              "id": "createUser",
              "args": ["context.name"]
            },
            {
              "type": "reset",
              "path": "context.name"
            }
          ]
        }
      }
    }
  ],
  "root": {
    "id": "page",
    "type": "Page",
    "children": [
      {
        "type": "Layout",
        "children": [
          {
            "id": "input1",
            "type": "Input",
            "props": {
              "value": "$action.createUserGraph.context.name"
            }
          },
          {
            "id": "btn1",
            "type": "Button",
            "props": {
              "label": "Add User"
            }
          }
        ]
      }
    ]
  }
}
```

---

## 四、Engine 如何执行 Action Graph（关键）

### 4.1 Engine 自动生成的 state（compile）

```ts
const [actionContext, setActionContext] = useState({
  name: ""
});
```

---

### 4.2 事件派发器（自动生成）

```ts
const dispatchAction = (actionId, event) => {
  const action = graph.actions[actionId];
  for (const step of action.do) {
    executeStep(step, event);
  }
};
```

---

### 4.3 Step 执行逻辑（核心）

```ts
function executeStep(step, event) {
  switch (step.type) {
    case 'assign':
      setActionContext(ctx => ({
        ...ctx,
        [step.to]: resolve(step.value, event)
      }));
      break;

    case 'callDataSource':
      callDataSource(step.id, step.args.map(arg => resolve(arg)));
      break;

    case 'reset':
      setActionContext(ctx => ({ ...ctx, [step.path]: "" }));
      break;
  }
}
```

---

## 五、组件如何“无感知地接入”

### Input NodeDefinition

```tsx
<Input
  value={actionContext.name}
  onChange={e =>
    dispatchAction("INPUT_CHANGE", { value: e.target.value })
  }
/>
```

### Button NodeDefinition

```tsx
<Button
  onClick={() => dispatchAction("SUBMIT")}
/>
```

✔️ Input / Button **完全通用**
✔️ 没有 useState
✔️ 没有 useEffect
✔️ 没有业务逻辑

---

## 六、Action Graph vs FSM（非常清晰的对比）

| 维度     | Action Graph | FSM  |
| ------ | ------------ | ---- |
| 状态建模   | ❌            | ✅    |
| 事件编排   | ✅            | ✅    |
| 副作用控制  | ✅            | ✅    |
| 条件分支   | ❌            | ✅    |
| 心智成本   | 低            | 高    |
| 编辑器复杂度 | 中            | 高    |
| 适用比例   | ~80%         | ~20% |

---

## 七、你为什么“应该先做 Action Graph”

### 1️⃣ 和你现有设计**完全兼容**

* dataSource 仍然是唯一副作用
* statements / hooks 仍由 Engine 管
* renderBoundary 不变

### 2️⃣ 不会失控

* 没有 if / loop
* 没有隐式 Hook
* 没有动态 Schema

### 3️⃣ 极其适合编辑器

* 可视化为：事件 → 动作列表
* 非工程人员也能理解

---

## 八、什么时候不够用？

你开始想写：

```json
if (error) then ...
```

或者：

```json
while (...)
```

👉 **这时候才该上 FSM / BPM**

---

## 九、必须写进文档的“硬边界”

> ❗ Action Graph 不支持条件
> ❗ Action Graph 不支持循环
> ❗ Action Graph 不支持自定义 JS
> ❗ Action Graph 只能操作 context / dataSource

这些限制 **不是缺点，是安全网**。

---

## 十、一句压轴总结（请记住）

> **Action Graph 是低代码的“黄金中间层”：
> 足够强，又不会失控。**


