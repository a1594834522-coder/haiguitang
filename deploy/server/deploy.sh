#!/usr/bin/env bash
# 服务器端发版入口，安装在 /opt/haiguitang/bin/deploy。
#
# 从 stdin 读取发布包（tar.gz，包含 package.json package-lock.json server stories dist），然后：
#   解到新的 releases/<时间> → 装生产依赖 → 原子切换 current → 重启 → 健康检查，失败自动回滚。
#
# 调用方式：
#   - GitHub Actions：部署 key 在 authorized_keys 里被限定为只能执行这个脚本（forced command）
#   - 手动：ssh <host> /opt/haiguitang/bin/deploy < release.tgz
set -Eeuo pipefail

ROOT=/opt/haiguitang
APP_USER=haiguitang
SERVICE=haiguitang
PORT=8797
KEEP=5
MAX_BYTES=$((64 * 1024 * 1024))

log() { echo "[deploy] $*"; }

exec 9>"$ROOT/deploy.lock"
flock -n 9 || { echo "[deploy] 另一次发版正在进行" >&2; exit 1; }

ID=$(date -u +%Y%m%dT%H%M%SZ)
REL="$ROOT/releases/$ID"
SWITCHED=0
on_error() { [ "$SWITCHED" = 1 ] || rm -rf "$REL"; }
trap on_error ERR

install -d -o "$APP_USER" -g "$APP_USER" "$REL"

# 解包和安装依赖都以低权限用户执行；包大小超限会被截断，tar 随即失败
head -c "$MAX_BYTES" | runuser -u "$APP_USER" -- tar -xzf - -C "$REL" --no-same-owner
for f in package.json package-lock.json server stories dist/index.html; do
  [ -e "$REL/$f" ] || { echo "[deploy] 发布包缺少 $f" >&2; false; }
done
log "解包完成 $ID"

runuser -u "$APP_USER" -- env PATH="$ROOT/node/bin:/usr/bin:/bin" HOME="$ROOT/shared" NPM_CONFIG_UPDATE_NOTIFIER=false \
  npm ci --omit=dev --no-audit --no-fund --loglevel=error --cache "$ROOT/shared/npm-cache" --prefix "$REL"
log "依赖安装完成"

ln -s "$ROOT/shared/.env" "$REL/.env"
ln -s "$ROOT/shared/data" "$REL/data"

PREV=$(readlink -f "$ROOT/current" 2>/dev/null || true)
switch_to() {
  ln -sfn "$1" "$ROOT/current.tmp"
  mv -Tf "$ROOT/current.tmp" "$ROOT/current"
}
healthy() {
  for _ in $(seq 20); do
    curl -fsS --max-time 2 "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && return 0
    sleep 1
  done
  return 1
}

switch_to "$REL"
SWITCHED=1
systemctl restart "$SERVICE"

if healthy; then
  log "上线成功 $ID"
else
  echo "[deploy] 健康检查失败，最近日志：" >&2
  journalctl -u "$SERVICE" -n 30 --no-pager >&2 || true
  if [ -n "$PREV" ] && [ -d "$PREV" ]; then
    switch_to "$PREV"
    systemctl restart "$SERVICE"
    healthy && echo "[deploy] 已回滚到 $(basename "$PREV")" >&2
  fi
  rm -rf "$REL"
  exit 1
fi

# 只保留最近几版
CUR=$(readlink -f "$ROOT/current")
ls -1dt "$ROOT"/releases/*/ 2>/dev/null | sed 's#/$##' | tail -n +$((KEEP + 1)) | while read -r d; do
  [ "$d" = "$CUR" ] || rm -rf "$d"
done
