# AntiSurge — Claude 개발 가이드

## 프로젝트 개요
뱀파이어 서바이벌 스타일 웹게임. 사이버펑크 네온 테마. 단일 파일 스택 (HTML + CSS + JS).

**배포:** https://antisurge-c0463.web.app
**버전:** v0.09
**레포:** https://github.com/PERSONARPGGG/AntiSurge.git

## 파일 구조
- `game.js` — 메인 게임 로직 (~6000줄)
- `index.html` — UI 모달, HUD, 메뉴 화면
- `style.css` — 네온 사이버펑크 스타일링
- `validate.js` — 배포 전 자동 검증 (node validate.js)
- `deploy.sh` — 검증 후 GitHub Pages 배포
- `.githooks/pre-commit` — 커밋 전 자동 검증 훅
- `assets/` — 이미지/오디오 (BGM은 Web Audio API 신스 생성)

## 브랜치 전략
- `master` — 배포 전용 (안정 버전, GitHub Pages)
- `dev` — 일상 개발 브랜치
- `feat/*` / `fix/*` — 기능/버그별 브랜치

## 주요 함수 맵
| 함수 | 역할 |
|---|---|
| `startGame()` | 게임 초기화 및 루프 시작 |
| `gameLoop(time)` | rAF 루프, update+draw 호출 |
| `update(dt)` | 게임 로직 업데이트 (dt=ms) |
| `draw(dt)` | 캔버스 렌더링 |
| `showScreen(state)` | 화면/상태 전환 |
| `generateUpgradeChoices()` | 레벨업 카드 풀 생성 |
| `checkCollisions()` | 충돌 감지 |
| `spawnEnemyPack()` | 적 스폰 |
| `advanceToNextStage()` | 스테이지 전환 |
| `triggerStageClear()` | 스테이지 클리어 처리 |
| `useActiveSkill()` | Q키 클래스 스킬 발동 |
| `ensureGameLoopRunning()` | 게임 루프 재시작 안전장치 |
| `startDailyRun()` | 일일 도전 시작 |
| `setDifficulty(d)` | 난이도 설정 |
| `selectSaveSlot(n)` | 세이브 슬롯 전환 |
| `syncMpState(dt)` | 멀티플레이어 상태 동기화 |
| `mpSetupChannel()` | Firebase/BroadcastChannel 초기화 |

## 상태 머신
```
STATE_MENU → STATE_PLAYING
  ↔ STATE_LEVEL_UP
  ↔ STATE_STAGE_CLEAR
  ↔ STATE_STAGE_BONUS
  ↔ STATE_SHOP
  ↔ STATE_CURSE
  ↔ STATE_PAUSED
  → STATE_GAME_OVER
```

## 클래스 정의 위치
`CLASS_DEFS` 객체 (game.js 상단) — 6종: hacker, cyborg, ghost, engineer, sniper, support
각 클래스에 `activeSkill: { name, icon, cd, desc }` 포함.

## 무기 시스템
- 11종 무기, 각 레벨 1→5, 레벨 5에서 진화
- `UPGRADES.weapons` 객체에 name/icon/desc/evolvedName/maxLevel 정의
- `generateUpgradeChoices()`에서 풀 생성, `applyUpgrade(choice)`에서 적용

## 멀티플레이어
- `FIREBASE_CONFIG = null` → BroadcastChannel 폴백 (같은 기기)
- Firebase config 설정 시 → 다른 기기와 실시간 협동 플레이
- Firebase SDK: index.html 주석 해제 필요

## 난이도 시스템
`DIFFICULTY_SETTINGS` 객체 — easy/normal/hard
- `getEnemyStageScale()` — HP/속도에 반영
- `getXpMultiplier()` — XP에 반영
- `updateEnemySpawning()` — 스폰 속도에 반영

## 세이브 슬롯
- 슬롯 0/1/2, `getSaveKey(slot)` → `ns_save_slot_N`
- `currentSaveSlot` 전역 변수
- 레거시 키 `neonSurvivorsData` → 슬롯 0 자동 마이그레이션

## 좌표계
- 맵: 2500×2500 픽셀
- 카메라: `camera.x/y` 기준 뷰포트
- 렌더링: `ctx.translate(-camera.x, -camera.y)` 후 월드 좌표로 그림
- 조이스틱/미니맵: 화면(screen) 좌표 사용

## 버그 방지 체크리스트
1. 상태 변경 후 `ensureGameLoopRunning()` 호출
2. 레벨업 중 `pendingLevelUps` 카운터 체크
3. 보스 스테이지 전환 시 `gameState = STATE_PLAYING` 먼저
4. 모달 닫기 시 올바른 `gameState` 복원
5. `isStageClearAnim` 체크 후 상태 결정
6. `pendingBossCurse` 플래그로 중복 저주 방지
7. 배열 루프 중 `triggerStageClear()` 유발 가능 코드 → `.length = 0` + 경계 체크

## 배포
```bash
# 검증 + 배포 (master)
./deploy.sh <GITHUB_TOKEN>

# dev 브랜치 배포
./deploy.sh <GITHUB_TOKEN> dev
```
