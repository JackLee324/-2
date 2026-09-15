#!/bin/bash
# scripts/finalize.sh — 收尾：重启服务使新凭据生效，并逐项验证
#
# 用途：一次性完成「重启 → 凭据生效 → 接口验证 → 资源完整性验证」，
#       每一步都有明确输出和退出码，失败时指出原因。
#
# 用法：bash ~/Developer/cms/scripts/finalize.sh
#
# 退出码：0 全部通过 / 1 有验证项失败（详见输出）
#
# 注意：本脚本刻意 **不使用 `set -u`**。
#   在非交互模式下，bash 一旦遇到未绑定变量引用就会立刻终止整个脚本，
#   会让「某个辅助变量没取到」升级成「整轮验证中断」，代价过大。
#   这里改为对每个可选值使用 ${VAR:-默认} 兜底。

set -o pipefail

PROJECT_DIR="$HOME/Developer/cms"
PORT=3000
BASE="http://localhost:$PORT"
PASS=0
FAIL=0

cd "$PROJECT_DIR" || { echo "❌ 找不到项目目录 $PROJECT_DIR"; exit 1; }

# 引入 nvm（找 node/npm）
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm use node >/dev/null 2>&1 || true
fi
if ! command -v node >/dev/null 2>&1; then
  NODE_BIN="$(ls -1 "$HOME"/.nvm/versions/node/*/bin 2>/dev/null | tail -1 || true)"
  if [ -n "${NODE_BIN:-}" ]; then export PATH="$NODE_BIN:$PATH"; fi
fi

if ! command -v node >/dev/null 2>&1; then
  echo "❌ 找不到 node，请先修复 nvm / Node.js 安装"
  exit 1
fi

ok()  { echo "  ✅ $1"; PASS=$((PASS + 1)); }
bad() { echo "  ❌ $1"; FAIL=$((FAIL + 1)); }

echo ""
echo "════════ 收尾验证 $(date '+%Y-%m-%d %H:%M:%S') ════════"

# ─────────────────────────────────────────────────────────────
echo ""
echo "[0/6] 读取即将生效的凭据"
AUTH_FILE="$PROJECT_DIR/server/data/admin_auth.json"
EXPECTED_PASSWORD="$(node -e "try{console.log(require('$AUTH_FILE').adminPassword||'')}catch(e){console.log('')}" 2>/dev/null || true)"
EXPECTED_TOKEN="$(node -e "try{console.log(require('$AUTH_FILE').adminToken||'')}catch(e){console.log('')}" 2>/dev/null || true)"

if [ -z "${EXPECTED_PASSWORD:-}" ] || [ -z "${EXPECTED_TOKEN:-}" ]; then
  echo "  ❌ 无法读取 $AUTH_FILE（文件缺失或 JSON 非法）"
  exit 1
fi
echo "  密码: $EXPECTED_PASSWORD"
echo "  Token: ${EXPECTED_TOKEN:0:12}...（共 ${#EXPECTED_TOKEN} 位）"

# ─────────────────────────────────────────────────────────────
echo ""
echo "[1/6] 重启服务"
OLD_PIDS="$(pgrep -f 'node server/index.js' 2>/dev/null || true)"
if [ -n "${OLD_PIDS:-}" ]; then
  echo "  停止旧进程: $(echo "$OLD_PIDS" | tr '\n' ' ')"
  # shellcheck disable=SC2086
  kill $OLD_PIDS 2>/dev/null || true
  for _ in $(seq 1 15); do
    pgrep -f 'node server/index.js' >/dev/null 2>&1 || break
    sleep 1
  done
  if pgrep -f 'node server/index.js' >/dev/null 2>&1; then
    echo "  旧进程未退出，强制结束"
    pkill -9 -f 'node server/index.js' 2>/dev/null || true
    sleep 1
  fi
else
  echo "  没有正在运行的实例"
fi

mkdir -p logs
nohup node server/index.js > logs/server.out 2>&1 &
NEW_PID="${!:-}"          # 兜底：万一取不到也不让脚本崩
echo "  已启动新进程 PID=${NEW_PID:-未知}"

# 等待端口就绪（不依赖 PID，直接探测接口）
READY=0
for _ in $(seq 1 30); do
  if curl -s -m 2 -o /dev/null "$BASE/api/health" 2>/dev/null; then READY=1; break; fi
  sleep 1
done
if [ "$READY" = "1" ]; then
  ok "服务已在 $BASE 就绪（PID ${NEW_PID:-未知}）"
else
  bad "服务启动后 30 秒内未就绪，请看 logs/server.out"
fi

# ─────────────────────────────────────────────────────────────
echo ""
echo "[2/6] 健康检查接口"
HEALTH="$(curl -s -m 5 "$BASE/api/health" 2>/dev/null || true)"
echo "  ${HEALTH:-（无响应）}"
case "${HEALTH:-}" in
  *'"status":"ok"'*) ok "/api/health 返回 ok";;
  *) bad "/api/health 未返回 ok";;
esac
case "${HEALTH:-}" in
  *'"dataReadable":true'*) ok "数据文件可读（dataReadable=true）";;
  *) bad "dataReadable 不为 true，数据文件可能有问题";;
esac

# ─────────────────────────────────────────────────────────────
echo ""
echo "[3/6] 用新凭据登录"
LOGIN="$(curl -s -m 5 -X POST "$BASE/api/admin/login" \
  -H 'Content-Type: application/json' \
  -d "{\"password\":\"$EXPECTED_PASSWORD\"}" 2>/dev/null || true)"
echo "  ${LOGIN:-（无响应）}"
case "${LOGIN:-}" in
  *'"success":true'*) ok "新密码登录成功";;
  *) bad "新密码登录失败 —— 若你曾在后台改过密码，请以 server/data/admin_auth.json 为准";;
esac
# 用 grep -F 做固定串匹配，避免依赖 JSON 字段顺序
if printf '%s' "${LOGIN:-}" | grep -qF "\"token\":\"$EXPECTED_TOKEN\""; then
  ok "返回的 token 与文件中的一致"
else
  bad "返回的 token 与文件不一致"
fi

# ─────────────────────────────────────────────────────────────
echo ""
echo "[4/6] 数据接口"
for ep in venues curriculum parkour gallery calendar; do
  CODE="$(curl -s -m 10 -o /dev/null -w '%{http_code}' "$BASE/api/$ep" 2>/dev/null || echo 000)"
  if [ "${CODE:-000}" = "200" ]; then ok "GET /api/$ep → 200"; else bad "GET /api/$ep → ${CODE:-无响应}"; fi
done

# ─────────────────────────────────────────────────────────────
echo ""
echo "[5/6] 静态资源非空"
for u in /js/app.js /js/admin.js /js/calendar.js /js/admin-venues.js /js/splash.js /js/error-handler.js \
         /css/main.css /css/admin.css /css/calendar.css /css/splash.css \
         /index.html /admin.html /calendar.html /logo.png; do
  SIZE="$(curl -s -m 15 -o /dev/null -w '%{size_download}' "$BASE$u" 2>/dev/null || echo 0)"
  if [ "${SIZE:-0}" -gt 0 ] 2>/dev/null; then
    ok "$u ($SIZE 字节)"
  else
    bad "$u 为 0 字节（静默故障特征）"
  fi
done

# ─────────────────────────────────────────────────────────────
echo ""
echo "[6/6] 存储层巡检 + 冒烟测试"
# 注意：不能写 `node x | tail`，管道会吃掉退出码，导致失败被判为成功
HEALTH_OUT="$(node server/test/healthcheck.js 2>&1)"
HEALTH_RC=$?
printf '%s\n' "$HEALTH_OUT" | tail -4
if [ "${HEALTH_RC:-1}" -eq 0 ]; then ok "healthcheck 通过"; else bad "healthcheck 未通过（退出码 ${HEALTH_RC:-未知}）"; fi

TEST_OUT="$(node server/test/api.test.js 2>&1 | tail -1 || true)"
echo "  ${TEST_OUT:-（无输出）}"
case "${TEST_OUT:-}" in
  *"15/15 tests passed"*) ok "冒烟测试 15/15 通过";;
  *) bad "冒烟测试未全部通过";;
esac

# ─────────────────────────────────────────────────────────────
echo ""
echo "════════ 结果 ════════"
echo "  通过 $PASS 项，失败 $FAIL 项"
if [ "$FAIL" -eq 0 ]; then
  echo ""
  echo "  ✅ 全部通过。服务运行于 $BASE"
  echo ""
  echo "  下一步（提交本次改动）："
  echo "    cd $PROJECT_DIR && git add -A && \\"
  echo "      git commit -m 'docs+ops: 凭据轮换、launchd 自启、部署文档与 README 更新'"
  echo ""
  exit 0
else
  echo ""
  echo "  ❌ 有 $FAIL 项未通过，详见上方 ❌ 标记。"
  echo "  服务日志：$PROJECT_DIR/logs/server.out"
  echo ""
  exit 1
fi
