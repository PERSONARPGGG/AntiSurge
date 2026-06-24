#!/bin/bash
# Neon Survivors — 검증 후 배포 스크립트
# 사용: ./deploy.sh <GITHUB_TOKEN>
# 토큰 없이: ./deploy.sh (기존 remote push)

set -e

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
TOKEN="$1"
REMOTE="https://personarpgg:${TOKEN}@github.com/personarpgg/game_1_antihero.git"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  Neon Survivors — 배포 파이프라인   ║"
echo "╚══════════════════════════════════════╝"
echo ""

# 1. 검증
echo "🔍 Step 1/3 — 코드 검증..."
node "$REPO_ROOT/validate.js"
echo "✅ 검증 통과"
echo ""

# 2. 스테이터스 확인
echo "📋 Step 2/3 — Git 상태 확인..."
git status --short
echo ""

# 3. 푸시
echo "🚀 Step 3/3 — GitHub Pages 배포..."
if [ -n "$TOKEN" ]; then
  git push "$REMOTE" master
else
  git push origin master
fi

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  ✅ 배포 완료!                       ║"
echo "║  🌐 https://personarpgg.github.io/   ║"
echo "║     game_1_antihero/                 ║"
echo "╚══════════════════════════════════════╝"
echo ""
