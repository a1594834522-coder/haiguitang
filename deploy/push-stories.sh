#!/usr/bin/env bash
# 把 stories-private/ 里不公开的剧本同步到服务器，然后重启服务。
# 这些剧本不进 git 仓库，也不走 GitHub Actions。
#   deploy/push-stories.sh [ssh 主机名，默认 bitfox-japan-next]
set -euo pipefail
HOST="${1:-bitfox-japan-next}"
cd "$(dirname "$0")/.."
ls stories-private/*.json >/dev/null

COPYFILE_DISABLE=1 tar --no-xattrs --no-mac-metadata -C stories-private -cf - $(cd stories-private && ls *.json) |
  ssh "$HOST" 'set -e
    d=/opt/haiguitang/shared/stories
    install -d -o haiguitang -g haiguitang -m 750 "$d"
    tar -C "$d" -xf - --no-same-owner --no-same-permissions
    chown haiguitang:haiguitang "$d"/*.json && chmod 640 "$d"/*.json
    systemctl restart haiguitang
    for i in $(seq 1 20); do
      curl -fsS --max-time 2 http://127.0.0.1:8797/api/health >/dev/null 2>&1 && { echo "[stories] 已上传：$(ls "$d" | tr "\n" " ")"; exit 0; }
      sleep 1
    done
    echo "[stories] 服务没有起来" >&2; exit 1'
