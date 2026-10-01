#!/usr/bin/env bash
# 把构建好的版本打成发布包（先 npm run build）。CI 和 deploy/push.sh 共用。
# 用法：deploy/pack.sh [输出文件，默认 release.tgz]
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-release.tgz}"
[ -f dist/index.html ] || { echo "先运行 npm run build" >&2; exit 1; }
# macOS 的 bsdtar 默认会带上 ._ 文件和扩展属性，GNU tar 解包时会刷警告
EXTRA=()
tar --version 2>/dev/null | grep -q bsdtar && EXTRA=(--no-xattrs --no-mac-metadata)
COPYFILE_DISABLE=1 tar "${EXTRA[@]}" -czf "$OUT" package.json package-lock.json server stories dist
echo "$OUT $(du -h "$OUT" | cut -f1)"
