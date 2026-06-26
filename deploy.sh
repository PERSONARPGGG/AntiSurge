#!/bin/bash
# AntiSurge — 검증 후 배포 스크립트
# 사용: ./deploy.sh <GITHUB_TOKEN> [브랜치명=master]
# 예시: ./deploy.sh ghp_xxx
#        ./deploy.sh ghp_xxx dev

set -e

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
TOKEN="$1"
BRANCH="${2:-master}"
GITHUB_USER="PERSONARPGGG"
GITHUB_REPO="AntiSurge"
REMOTE="https://${GITHUB_USER}:${TOKEN}@github.com/${GITHUB_USER}/${GITHUB_REPO}.git"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   AntiSurge — 배포 파이프라인       ║"
echo "╚══════════════════════════════════════╝"
echo "  브랜치: $BRANCH"
echo ""

# 1. 검증
echo "🔍 Step 1/3 — 코드 검증..."
node "$REPO_ROOT/validate.js"
echo "✅ 검증 통과"
echo ""

# 2. 상태 확인
echo "📋 Step 2/3 — Git 상태..."
git log --oneline -3
echo ""

# 3. GitHub push
echo "🚀 Step 3/4 — GitHub push ($BRANCH)..."
if [ -n "$TOKEN" ]; then
  git push "$REMOTE" "$BRANCH"
else
  git push origin "$BRANCH"
fi

# 4. Firebase Hosting 배포
echo ""
echo "🔥 Step 4/4 — Firebase Hosting 배포..."
FIREBASE_CLI="/mnt/c/Users/SDH/AppData/Roaming/npm/firebase"
FB_TOKEN="${FIREBASE_TOKEN:-1//0eGiIiL1IzkBBCgYIARAAGA4SNwF-L9IrSamwdy6hJPr1VLZwT8eE3SzbpKvfWbVDwmmN2i9s-fnZfMgvByUim5gSyWCgOZlTQK4}"
"$FIREBASE_CLI" deploy --only hosting --token "$FB_TOKEN"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  ✅ 배포 완료!                       ║"
echo "║  🌐 https://antisurge-c0463.web.app  ║"
echo "╚══════════════════════════════════════╝"
echo ""
