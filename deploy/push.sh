#!/usr/bin/env bash
# 从本机手动发版（平时 push 到 main 会由 GitHub Actions 自动发版）
# 用法：DEPLOY_HOST=bitfox-japan-next deploy/push.sh
set -euo pipefail
HOST="${DEPLOY_HOST:?请设置 DEPLOY_HOST（ssh 主机名）}"
cd "$(dirname "$0")/.."
npm run build
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
deploy/pack.sh "$TMP/release.tgz"
ssh "$HOST" /opt/haiguitang/bin/deploy < "$TMP/release.tgz"
