#!/usr/bin/env bash
set -euo pipefail

SERVER_URL=${SERVER_URL:-http://127.0.0.1:3000}
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

for cmd in jq curl rg tar; do
  require_cmd "$cmd"
done

post_json() {
  local url=$1
  local payload=$2
  local out=$3
  local code
  code=$(curl -sS -o "$out" -w "%{http_code}" \
    -H 'Content-Type: application/json' \
    --data-binary @"$payload" \
    "$SERVER_URL$url")
  if [[ "$code" != "200" ]]; then
    echo "HTTP $code for $url" >&2
    cat "$out" >&2
    exit 1
  fi
}

post_tar() {
  local url=$1
  local payload=$2
  local out=$3
  local code
  code=$(curl -sS -o "$out" -w "%{http_code}" \
    -H 'Content-Type: application/json' \
    --data-binary @"$payload" \
    "$SERVER_URL$url")
  if [[ "$code" != "200" ]]; then
    echo "HTTP $code for $url" >&2
    cat "$out" >&2
    exit 1
  fi
}

echo "==> /build"
jq '(.files) |= map(select(.path|test("\\.(ts|tsx|js|jsx|css|json)$")))' \
  "$SCRIPT_DIR/test.json" > "$TMP_DIR/build.json"
post_json "/build" "$TMP_DIR/build.json" "$TMP_DIR/build.out.json"
jq -e '.ok == true' "$TMP_DIR/build.out.json" >/dev/null
jq -r '.outputs.js.content' "$TMP_DIR/build.out.json" > "$TMP_DIR/build.js"
rg -q "System.register" "$TMP_DIR/build.js"

cat <<'JSON' > "$TMP_DIR/page-schema.json"
{
  "pageSchema": {
    "meta": { "id": "page-1", "name": "Sample", "path": "/sample" },
    "root": {
      "id": "root",
      "type": "Layout",
      "props": { "TEXT": "Hello" },
      "children": [
        { "id": "child", "type": "Text", "props": { "TEXT": "World", "DEFAULT_VALUE": 1 } }
      ]
    },
    "context": {}
  }
}
JSON

echo "==> /page/code"
post_json "/page/code" "$TMP_DIR/page-schema.json" "$TMP_DIR/page-code.out.json"
jq -e '.ok == true' "$TMP_DIR/page-code.out.json" >/dev/null
jq -r '.code' "$TMP_DIR/page-code.out.json" > "$TMP_DIR/page-code.tsx"
rg -q "export default" "$TMP_DIR/page-code.tsx"

cat <<'JSON' > "$TMP_DIR/manifest.json"
{
  "manifest": {
    "version": "1.0",
    "name": "ff-test",
    "routes": [{ "path": "/sample", "pageId": "SamplePage" }],
    "menus": [],
    "locales": [{ "lang": "en", "messages": { "HELLO": "Hello" } }],
    "pages": [
      {
        "id": "SamplePage",
        "entryComponent": "SamplePage",
        "componentsTree": {
          "meta": { "id": "page-1", "name": "Sample", "path": "/sample" },
          "root": {
            "id": "root",
            "type": "Layout",
            "props": { "TEXT": "Hello" },
            "children": [
              { "id": "child", "type": "Text", "props": { "TEXT": "World", "DEFAULT_VALUE": 1 } }
            ]
          },
          "context": {}
        }
      }
    ],
    "build": { "target": "kubesphere-extension" }
  }
}
JSON

echo "==> /project/files"
post_json "/project/files" "$TMP_DIR/manifest.json" "$TMP_DIR/project-files.out.json"
jq -e '.ok == true' "$TMP_DIR/project-files.out.json" >/dev/null
jq -r '.files[] | select(.path == "src/index.ts") | .content' "$TMP_DIR/project-files.out.json" >/dev/null


echo "==> /project/files.tar.gz"
post_tar "/project/files.tar.gz" "$TMP_DIR/manifest.json" "$TMP_DIR/project-files.tar.gz"
tar -tzf "$TMP_DIR/project-files.tar.gz" | rg -q '^src/index.ts$'


echo "==> /project/build"
post_json "/project/build" "$TMP_DIR/manifest.json" "$TMP_DIR/project-build.out.json"
jq -e '.ok == true' "$TMP_DIR/project-build.out.json" >/dev/null
jq -r '.files[] | select(.path == "index.js") | .content' "$TMP_DIR/project-build.out.json" > "$TMP_DIR/project-build.js"
rg -q "System.register" "$TMP_DIR/project-build.js"


echo "==> /project/build.tar.gz"
post_tar "/project/build.tar.gz" "$TMP_DIR/manifest.json" "$TMP_DIR/project-build.tar.gz"
tar -tzf "$TMP_DIR/project-build.tar.gz" | rg -q '^index.js$'


echo "All tests passed."
