  #!/usr/bin/env bash
  set -euo pipefail

  # 1) 过滤 test.json 仅保留支持的文件扩展名
  jq '(.files) |= map(select(.path|test("\\.(ts|tsx|js|jsx|css|json)$")))' test.json > /tmp/test-sanitized.json

  rm -f /tmp/frontend-forge-test-build.json
  # 2) 发送构建请求并保存响应
  curl -s -X POST http://127.0.0.1:3000/build \
    -H 'Content-Type: application/json' \
    --data-binary @/tmp/test-sanitized.json \
    -o /tmp/frontend-forge-test-build.json \
    -w "\nHTTP: %{http_code}\n"

  # 3) 将生成的 JS 写入 dist/index.js
  mkdir -p dist
  jq -r '.outputs.js.content' /tmp/frontend-forge-test-build.json > dist/index.js

  # 可选：查看摘要
  jq '{ok, cacheHit, key, meta}' /tmp/frontend-forge-test-build.json
  wc -c dist/index.js