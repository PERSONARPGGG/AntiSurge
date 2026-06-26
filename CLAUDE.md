# AntiSurge — Claude 개발 가이드

## 프로젝트 개요
뱀파이어 서바이벌 스타일 웹게임. 사이버펑크 네온 테마.

**배포:** https://antisurge-c0463.web.app
**버전:** v0.11
**레포:** https://github.com/PERSONARPGGG/AntiSurge.git

## 파일 구조

### 핵심 파일
- `index.html` — UI 모달, HUD, 메뉴 화면 (스크립트 로딩 순서 포함)
- `style.css` — 네온 사이버펑크 스타일링
- `validate.js` — 배포 전 자동 검증 (node validate.js)
- `deploy.sh` — 검증 후 Firebase 배포
- `.githooks/pre-commit` — 커밋 전 자동 검증 훅
- `game.js` — 더 이상 사용 안 함 (빈 파일, 백업: game.js.bak)

### src/ 모듈 (로딩 순서 중요)
| 파일 | 내용 | 규모 |
|---|---|---|
| `src/i18n.js` | EN/KO 이중 언어 (STRINGS, EN_GAME, t(), tGame(), setLang()) | ~675줄 |
| `src/config.js` | 전역 상수 + 상태 선언 (CLASS_DEFS 10종, UPGRADES, CLASS_CODEC) | ~1250줄 |
| `src/audio.js` | Web Audio, BGM 4트랙, 스킬/난이도/저장 유틸 | ~607줄 |
| `src/player.js` | Player 클래스 | ~540줄 |
| `src/weapons.js` | 모든 무기 클래스 (11종 + 진화형) | ~1391줄 |
| `src/projectiles.js` | 투사체, 레이저, 보스 위험물 | ~173줄 |
| `src/enemies.js` | Enemy, Boss 클래스 (3페이즈 + 5가지 패턴), BossProjectile | ~1239줄 |
| `src/daily_enemies.js` | DailyHeroEnemy, DailyRivalSniper, DailyRivalBerserker (일일도전 전용) | ~856줄 |
| `src/entities.js` | FieldItem, Gem, Particle 등 | ~282줄 |
| `src/stage.js` | 스테이지/콤보/저장/스폰/충돌/배경 | ~1298줄 |
| `src/flow.js` | 게임 라이프사이클, showScreen, startGame, 아카이브 | ~770줄 |
| `src/loop.js` | gameLoop, update, draw, HUD(DOM 캐시), minimap | ~1060줄 |
| `src/upgrades.js` | 레벨업, 상점, 저주, 시너지 | ~775줄 |
| `src/endgame.js` | 게임 종료, 빅토리, NG+, 전체화면, 코덱 해금 | ~522줄 |
| `src/finalstage.js` | 패러사이트 트루 엔딩, VirusCoreEnemy, VirusOriginBoss, 컷씬 | ~522줄 |
| `src/extras.js` | 개발자 패널, 필드 이벤트 | ~281줄 |
| `src/input.js` | 터치, 유틸(dist), 설정 모달 | ~190줄 |
| `src/multiplayer.js` | 멀티플레이어, 리더보드, 초기화 | ~756줄 |

> **코드 수정 시:** 해당 기능이 어느 src/ 파일에 있는지 위 표로 확인.
> **주의:** `src/i18n.js`는 반드시 `src/config.js` **보다 먼저** 로드되어야 함.
> **주의:** `src/daily_enemies.js`는 반드시 `src/enemies.js` **다음에** 로드되어야 함.

## 브랜치 전략
- `master` — 배포 전용 (안정 버전, GitHub Pages)
- `dev` — 일상 개발 브랜치
- `feat/*` / `fix/*` — 기능/버그별 브랜치

## 주요 함수 맵
| 함수 | 역할 |
|---|---|
| `startGame()` | 게임 초기화 및 루프 시작 (`_initHUDRefs()` 포함) |
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
| `_initHUDRefs()` | HUD DOM 캐시 초기화 (startGame 시 호출) |
| `markWeaponsDirty()` | 무기 슬롯 재렌더 트리거 |
| `markPassivesDirty()` | 패시브 슬롯 재렌더 트리거 |
| `refreshClassCardLockState()` | 클래스 카드 언어/잠금 상태 업데이트 |
| `t(key)` | UI 문자열 번역 (i18n.js) |
| `tGame(cat, key, field, idx)` | 게임 데이터 번역 (i18n.js) |
| `setLang(lang)` | 언어 전환 + DOM 업데이트 |

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

## 클래스 시스템
`CLASS_DEFS` 객체 (src/config.js) — **10종**: hacker, cyborg, ghost, engineer, sniper, support (기본 6종) + jammer, cracker, glitch_dancer, parasite (히든 4종)

각 클래스 필드: `name/nameEn, icon, color, typeChip/typeChipEn, desc/descEn, statsExtra/statsExtraEn, startWeapon/startWeaponEn, hp, speed, damageMult, magnetRadius, rerolls, xpBonus, activeSkill{ name/nameEn, icon, cd, desc/descEn }`

히든 클래스 해금 조건: `CLASS_UNLOCK_DEFS` 객체 (src/config.js)

## 격리 로그 아카이브
`CLASS_CODEC` 객체 (src/config.js) — 클래스당 3개, 총 30개 로그.
각 로그 필드: `cond, condLabel/condLabelEn, title/titleEn, text/textEn`
해금 판정: `src/endgame.js` `_checkCodecUnlocks()`
렌더링: `src/flow.js` `_renderArchiveTabs()`

## i18n 시스템
- `LANG` 전역 (localStorage `ns_lang`, 기본 `'en'`)
- `t(key)` — STRINGS[LANG][key] (UI 문자열)
- `tGame(cat,key,field,idx)` — EN_GAME[cat][key][field] (게임 데이터)
- `setLang(lang)` — 언어 변경 + applyI18n() + refreshClassCardLockState() + _refreshSettingsAudioUI()
- `applyI18n()` — `data-i18n` / `data-i18n-placeholder` 속성 일괄 적용

## HUD 최적화
- `_hud` 캐시 객체: startGame() 시 `_initHUDRefs()`로 DOM 엘리먼트 한 번만 조회
- `_weaponsDirty` / `_passivesDirty` 플래그: 레벨업/상점에서만 슬롯 재빌드
- `markWeaponsDirty()`, `markPassivesDirty()` — upgrades.js 등에서 호출

## 무기 시스템
- 11종 무기, 각 레벨 1→5, 레벨 5에서 진화
- `UPGRADES.weapons` 객체에 name/icon/desc/evolvedName/maxLevel 정의
- `generateUpgradeChoices()`에서 풀 생성, `applyUpgrade(choice)`에서 적용

## BGM 시스템
4개 트랙 (src/audio.js, src/input.js):
- 0: SYNTHWAVE (신스웨이브)
- 1: DEVA SYSTEM (데바 시스템)
- 2: GHOST PROTOCOL (고스트 프로토콜)
- 3: SHADOW OPS (섀도우 옵스, 일일도전 전용)

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
8. 무기/패시브 변경 후 `markWeaponsDirty()` / `markPassivesDirty()` 호출 확인

## 배포
```bash
# 검증 + 배포 (master)
./deploy.sh <GITHUB_TOKEN>

# dev 브랜치 배포
./deploy.sh <GITHUB_TOKEN> dev
```
