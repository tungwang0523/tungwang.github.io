#!/bin/sh
set -eu

message="$*"

if [ -z "$message" ]; then
  echo '用法：git publish "更新说明"'
  exit 1
fi

if command -v npm >/dev/null 2>&1; then
  npm run build
else
  echo '本机未找到 npm，跳过本地构建；Vercel 会在部署时执行构建。'
fi

git add --all

if git diff --cached --quiet; then
  echo '没有需要提交的改动。'
  exit 0
fi

git commit -m "$message"
git push origin main

echo '已推送到 GitHub；Vercel 将自动开始部署。'
