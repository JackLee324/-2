#!/bin/bash
# scripts/start-server.sh — 启动 PE CMS 服务（供 launchd 调用）
#
# 为什么需要这个脚本：
#   launchd 启动的进程环境极简，不加载 ~/.zshrc / ~/.bash_profile，
#   因此找不到 nvm 管理的 node。这里显式引入 nvm 后再启动服务。
set -euo pipefail

PROJECT_DIR="$HOME/Developer/cms"
cd "$PROJECT_DIR"

# 引入 nvm（node 由 nvm 管理）
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm use node >/dev/null 2>&1 || true
fi

# 兜底：nvm 不可用时，直接找最新安装的 node
if ! command -v node >/dev/null 2>&1; then
  NODE_BIN="$(ls -1 "$HOME"/.nvm/versions/node/*/bin 2>/dev/null | tail -1)"
  if [ -n "$NODE_BIN" ]; then
    export PATH="$NODE_BIN:$PATH"
  fi
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[start-server] 找不到 node，请先安装 Node.js 或修复 nvm" >&2
  exit 127
fi

mkdir -p "$PROJECT_DIR/logs"

# 端口占用检查：避免 launchd 反复拉起一个注定失败的实例（本配置带 KeepAlive）
PORT="${PORT:-3000}"
if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "[start-server] 端口 $PORT 已被占用，可能已有实例在运行（或其由其他方式启动）。" >&2
  echo "[start-server] 请先停止占用进程，例如：pkill -f 'node server/index.js'" >&2
  echo "[start-server] 为避免反复重启，本次启动放弃。退出码 75。" >&2
  exit 75
fi

echo "[start-server] node=$(command -v node) 启动于 $(date '+%Y-%m-%d %H:%M:%S')"
exec node server/index.js
