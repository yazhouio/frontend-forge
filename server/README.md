# FrontendForge

KubeSphere v4 插件构建服务：接收 TS/TSX/CSS 源码，通过 esbuild + SWC 生成 **SystemJS** 单文件 JS，支持可选 Tailwind CSS，同时具备缓存、并发队列与超时控制。

## 功能特性
- POST `/build` 接收文件数组并返回 SystemJS 产物（必含 `System.register`）
- 可选 Tailwind v4 输出 CSS，和 JS 构建解耦
- 内存 LRU + 磁盘 JSON 缓存，命中即回
- 并发队列、超时与隔离的临时工作目录，防止资源争用与路径穿越
- 预置 external 白名单（React 等），无 Webpack runtime 依赖

## 快速开始
```bash
# 安装依赖（首选 pnpm）
pnpm install

# 本地开发（热重载）
pnpm dev

# 生产运行
pnpm start
```

服务默认监听 `0.0.0.0:3000`，健康检查 `GET /healthz`。

## 环境变量
- `PORT`：HTTP 端口，默认 3000
- `CACHE_DIR`：磁盘缓存目录，默认 `.cache`
- `CACHE_MAX_ITEMS`：内存缓存大小，默认 200
- `CONCURRENCY`：并发构建数，默认 `cpu/2`
- `BUILD_TIMEOUT_MS`：构建超时时间，默认 30000
- `MAX_BODY_BYTES`：请求体大小限制，默认 1 MiB
- `CHILD_MAX_OLD_SPACE_MB`：子进程 Node 最大内存，默认 512

## API
`POST /build`
```json
{
  "files": [{ "path": "src/index.tsx", "content": "..." }],
  "entry": "src/index.tsx",
  "externals": ["react"],
  "tailwind": { "enabled": true, "input": "src/index.css", "config": "tailwind.config.js" }
}
```

响应（成功）：
```json
{
  "ok": true,
  "cacheHit": false,
  "key": "sha256...",
  "outputs": {
    "js": { "filename": "index.js", "content": "System.register(...)" },
    "css": { "filename": "style.css", "content": "..." }
  },
  "meta": { "buildMs": 123, "queuedMs": 130 }
}
```

示例：
```bash
curl -X POST http://localhost:3000/build \
  -H 'Content-Type: application/json' \
  --data-raw '{
    "entry": "src/index.tsx",
    "tailwind": {"enabled": true, "input": "src/index.css", "config": "tailwind.config.js"},
    "files": [
      {"path": "src/index.tsx", "content": "import \"./index.css\"; export default function App(){ console.log(\"hi\"); }"},
      {"path": "src/index.css", "content": "@import \"tailwindcss\";"},
      {"path": "tailwind.config.js", "content": "export default { content: [\"./src/**/*.{ts,tsx}\"] };"}
    ]
  }'
```

## Docker
```bash
docker build -t frontendforge .
docker run --rm -p 3000:3000 \
  -e CACHE_DIR=/data/cache \
  -v $(pwd)/.cache:/data/cache \
  frontendforge
```

生产部署建议：限制 CPU/内存、设置 `--pids-limit`，并将容器 rootfs 设为只读，挂载 tmpfs 至 `/tmp` 以获得更好的隔离。

## 约束与校验
- 拒绝绝对路径与 `..`，限定扩展名：`ts|tsx|js|jsx|css|json`
- 构建产物必须含 `System.register`，并拒绝 `__webpack_require__`、`webpackChunk`、`import(`
- 单入口构建，无代码分割；external 需在白名单或请求中传入
