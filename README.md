# AntiSurge 🌐⚡

사이버펑크 네온 스타일의 뱀파이어 서바이벌 웹게임.  
브라우저에서 즉시 플레이, 모바일 지원, 멀티플레이어(Firebase).

**🎮 플레이:** https://personarpggg.github.io/AntiSurge/ *(GitHub Pages 배포 후 활성화)*  
**📋 버전:** v0.09  
**📅 최종 수정:** 2026-06-24

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [파일 구조](#2-파일-구조)
3. [게임 시스템 가이드](#3-게임-시스템-가이드)
4. [개발 환경 설정](#4-개발-환경-설정)
5. [브랜치 전략](#5-브랜치-전략)
6. [배포 방법](#6-배포-방법)
7. [멀티플레이어 Firebase 설정](#7-멀티플레이어-firebase-설정)
8. [주요 함수 맵](#8-주요-함수-맵)
9. [상태 머신](#9-상태-머신)
10. [버그 수정 체크리스트](#10-버그-수정-체크리스트)

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|---|---|
| 장르 | 뱀파이어 서바이벌 스타일 — 자동 공격, 레벨업 카드, 보스 |
| 테마 | 사이버펑크 네온 — 해커, 사이보그, 드론, 바이러스 |
| 기술 스택 | 순수 HTML + CSS + JavaScript (프레임워크 없음) |
| 빌드 도구 | 없음 — 파일 직접 편집 후 push |
| 렌더링 | HTML5 Canvas 2D |
| 오디오 | Web Audio API (BGM 직접 신스 생성, 외부 파일 없음) |
| 저장 | localStorage (세이브 슬롯 3개) |
| 배포 | GitHub Pages |

---

## 2. 파일 구조

```
AntiSurge/
├── index.html          — HTML 구조, 모달, HUD, 메뉴 화면
├── style.css           — 네온 사이버펑크 스타일링 전체
├── game.js             — 게임 로직 전체 (~6000줄)
│
├── validate.js         — 배포 전 자동 버그 검사기 (node validate.js)
├── deploy.sh           — 검증 후 GitHub Pages 배포 스크립트
├── .githooks/
│   └── pre-commit      — git commit 시 자동 validate.js 실행
│
├── CHANGELOG.md        — 버전별 변경 이력
├── README.md           — 이 파일
│
├── manifest.json       — PWA 설정 (HTTP 서버에서만 로드)
├── icon-192.png        — PWA 아이콘
├── icon-512.png        — PWA 아이콘
│
└── assets/
    ├── audio/          — (비어있음) BGM 파일 추가 시 여기
    └── img/            — (비어있음) 이미지 에셋 추가 시 여기
```

### game.js 내부 구조 (섹션별)

```
1~300줄    상수 / 전역 변수 / 설정값
300~600줄  클래스 정의 (CLASS_DEFS, UPGRADES, DIFFICULTY_SETTINGS 등)
600~1200줄 Player 클래스
1200~2200줄 무기 클래스 11종 (BaseWeapon → 각 무기)
2200~2800줄 Enemy 클래스 + Boss 클래스
2800~3700줄 게임 루프 핵심 (startGame, gameLoop, update, draw)
3700~4000줄 적 스폰, 필드 이벤트, 충돌 체크
4000~4700줄 HUD 렌더링, 미니맵, 멀티플레이어 렌더
4700~5000줄 레벨업 / 상점 / 저주 / 스테이지 보너스 모달
5000~5400줄 메타 업그레이드 / 업적 / 세이브 시스템
5400~5700줄 BGM 시스템 (Web Audio API)
5700~5900줄 설정 / 초대 모달 / 멀티플레이어 Firebase
5900~끝    초기화 코드
```

---

## 3. 게임 시스템 가이드

### 플레이어 클래스 (6종)

| ID | 이름 | 시작 무기 | Q 스킬 |
|---|---|---|---|
| `hacker` | 해커 💻 | 플레어 | EMP 버스트 |
| `cyborg` | 사이보그 🤖 | 오비터 | 과부하 |
| `ghost` | 고스트 👻 | EMP 존 | 위상 이동 |
| `engineer` | 엔지니어 🔧 | 드론 | 드론 긴급소집 |
| `sniper` | 스나이퍼 🎯 | 레이저 | 정밀 저격 |
| `support` | 서포트 💊 | 링 웨이브 | 쉴드 재생 |

정의 위치: `game.js` → `CLASS_DEFS` 객체

### 무기 시스템 (11종)

| 무기 | 키 | 진화 이름 | 특징 |
|---|---|---|---|
| 플레어 🔥 | `flare` | 인페르노 | 단일 대상 추적 |
| 오비터 🌀 | `orbiter` | 플라즈마 링 | 회전 궤도 |
| EMP 존 ⚡ | `zone` | 사이버 스톰 | 범위 지속 |
| 레이저 🔆 | `laser` | 이온 캐논 | 관통 빔 |
| 부메랑 🪃 | `boomerang` | 사이버 블레이드 | 왕복 투사체 |
| 드론 🤖 | `drone` | 무장 드론단 | 자동 추적 유닛 |
| 미사일 🚀 | `missile` | 클러스터 폭탄 | 유도 + 폭발 |
| 링 웨이브 💫 | `ring` | 포스 필드 | 방사형 파동 |
| 바이러스 체인 🔗 | `chain` | 뉴럴 바이러스 | 적 간 연쇄 |
| 랜드마인 💣 | `mine` | 플라즈마 클러스터 | 지형 설치 |
| 블랙홀 생성기 🌑 | `blackhole` | 이벤트 호라이즌 | 중력 + 붕괴 |

무기는 레벨 1→5, 레벨 5에서 자동 진화.  
`UPGRADES.weapons` 객체에 정의, `generateUpgradeChoices()`에서 풀 생성.

### 보스 패턴 (4종 순환, 10스테이지마다)

| 타입 | 특징 |
|---|---|
| BERSERKER | 고속 돌진 |
| SNIPER | 장거리 저격 발사체 |
| SUMMONER | 소환사 + 하수인 웨이브 |
| TITAN | 초고체력 + 광역 슬램 |

### 저장 시스템

- 슬롯 3개 (`ns_save_slot_0`, `ns_save_slot_1`, `ns_save_slot_2`)
- 레거시 키 `neonSurvivorsData` → 슬롯 0으로 자동 마이그레이션
- `currentSaveSlot` 전역 변수로 현재 슬롯 관리

---

## 4. 개발 환경 설정

### 필요 조건
- Node.js (검증 스크립트 실행용, 게임 실행엔 불필요)
- 브라우저 (Chrome 권장, Firefox 가능)
- Git

### 첫 세팅

```bash
# 1. 저장소 클론
git clone https://github.com/PERSONARPGGG/AntiSurge.git
cd AntiSurge

# 2. Git 훅 활성화 (커밋 전 자동 검증)
git config core.hooksPath .githooks

# 3. 로컬에서 게임 실행 (단순히 index.html을 브라우저로 열어도 됨)
# 또는 VS Code Live Server 사용 권장
```

### 코드 수정 워크플로우

```bash
# 1. dev 브랜치에서 작업
git checkout dev

# 2. 파일 수정 (game.js, index.html, style.css)

# 3. 검증 (자동으로 커밋 전 실행되지만 미리 확인 가능)
node validate.js

# 4. 커밋 (pre-commit hook이 자동으로 validate.js 실행)
git add -p
git commit -m "feat: ..."

# 5. master 병합 후 배포
git checkout master
git merge dev
./deploy.sh <GITHUB_TOKEN>
```

---

## 5. 브랜치 전략

```
master  ── 항상 배포 가능한 안정 버전 (GitHub Pages)
  │
  └─ dev ── 개발 작업 브랜치 (기능 추가, 버그 수정)
              │
              ├─ feat/새기능명  ── 큰 기능은 별도 브랜치
              └─ fix/버그명     ── 버그 수정 브랜치
```

| 브랜치 | 용도 |
|---|---|
| `master` | 배포 전용. 직접 커밋 금지. `dev`에서 병합만 |
| `dev` | 일상 개발. 커밋 전 자동 검증 실행 |
| `feat/*` | 대형 기능 개발 시 분리 |

---

## 6. 배포 방법

### 빠른 배포

```bash
./deploy.sh <GITHUB_TOKEN>
```

이 스크립트가 하는 일:
1. `node validate.js` 실행 → 오류 있으면 중단
2. `git status` 표시
3. `git push` to GitHub Pages

### 수동 배포

```bash
node validate.js          # 검증
git push https://PERSONARPGGG:<TOKEN>@github.com/PERSONARPGGG/AntiSurge.git master
```

### GitHub Pages 설정

저장소 설정 → Pages → Source: `master` 브랜치 `/` (root) 선택

---

## 7. 멀티플레이어 Firebase 설정

### 현재 상태
- `FIREBASE_CONFIG = null` → BroadcastChannel 모드 (같은 기기 탭 전용)
- Firebase config 입력 시 → 다른 기기와 실시간 플레이 가능

### Firebase 설정 방법 (5분)

**Step 1.** [Firebase Console](https://console.firebase.google.com) → 새 프로젝트 생성

**Step 2.** Realtime Database → 생성 → **테스트 모드** 선택 (30일간 공개)

**Step 3.** 프로젝트 설정 → 일반 → 웹 앱 추가 → SDK 구성 복사

**Step 4.** `game.js` 상단의 `FIREBASE_CONFIG = null` 을 아래로 교체:
```javascript
const FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project",
  messagingSenderId: "12345",
  appId: "1:12345:web:abc"
};
```

**Step 5.** `index.html` 에서 Firebase SDK 주석 해제:
```html
<!-- 이 두 줄의 주석 제거 -->
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"></script>
```

> ⚠️ **주의**: Firebase API Key는 클라이언트에 노출되어도 괜찮지만 (Firebase 설계상),  
> Realtime Database 보안 규칙을 반드시 설정하세요.  
> 기본 보안 규칙 예시 (`Database → Rules`):
> ```json
> {
>   "rules": {
>     "neon_rooms": {
>       "$room": {
>         ".read": true,
>         ".write": true,
>         ".indexOn": ["ts"]
>       }
>     }
>   }
> }
> ```

### Firebase RTDB 데이터 구조

```
neon_rooms/
  {roomCode}/
    players/
      {playerId}: { x, y, hp, maxHp, level, kills, color, name, ts }
    msgs/
      {autoId}: { type, id, senderId, ts }
```

---

## 8. 주요 함수 맵

| 함수 | 위치 (줄) | 역할 |
|---|---|---|
| `startGame()` | ~2800 | 게임 초기화 및 루프 시작 |
| `gameLoop(time)` | ~2850 | rAF 루프, update+draw 호출 |
| `update(dt)` | ~2900 | 게임 로직 업데이트 (dt=ms) |
| `draw(dt)` | ~4000 | 캔버스 렌더링 전체 |
| `showScreen(state)` | ~4100 | 화면/상태 전환 |
| `generateUpgradeChoices()` | ~4700 | 레벨업 카드 풀 생성 |
| `checkCollisions()` | ~3770 | 투사체↔적, 플레이어↔아이템 충돌 |
| `spawnEnemyPack()` | ~3734 | 적 스폰 |
| `advanceToNextStage()` | ~3200 | 스테이지 전환 |
| `triggerStageClear()` | ~3220 | 스테이지 클리어 처리 |
| `useActiveSkill()` | ~4800 | Q키 클래스 스킬 발동 |
| `ensureGameLoopRunning()` | ~2870 | 게임 루프 재시작 안전장치 |
| `syncMpState(dt)` | ~5800 | 멀티플레이어 상태 동기화 |
| `mpSetupChannel()` | ~5720 | Firebase/BroadcastChannel 설정 |

---

## 9. 상태 머신

```
STATE_MENU
  └─ startGame() ──→ STATE_PLAYING
                          │
                     레벨업 시 ──→ STATE_LEVEL_UP ──→ (카드 선택) ──→ STATE_PLAYING
                     스테이지 클리어 ──→ STATE_STAGE_CLEAR
                                              │
                                    보스 처치 시 ──→ STATE_CURSE ──→ STATE_STAGE_BONUS
                                    일반 클리어 ──→ STATE_STAGE_BONUS
                                                         │
                                                    (보너스 선택) ──→ STATE_SHOP ──→ STATE_PLAYING
                          │
                     ESC/P ──→ STATE_PAUSED ──→ STATE_PLAYING
                          │
                     HP=0 ──→ STATE_GAME_OVER ──→ STATE_MENU
```

**중요 규칙:**
- 상태 변경 후 `ensureGameLoopRunning()` 호출
- 레벨업 중 `pendingLevelUps` 카운터 확인
- 보스 스테이지 전환 시 `gameState = STATE_PLAYING` 먼저 설정
- `isStageClearAnim` 체크 후 상태 결정
- `pendingBossCurse` 플래그로 중복 저주 방지

---

## 10. 버그 수정 체크리스트

새 기능 추가 시 반드시 확인:

- [ ] `node validate.js` 실행 → 오류 0개
- [ ] 새로운 배열 루프에서 `takeDamage()` / `die()` 호출 시 스냅샷 사용
- [ ] `triggerStageClear()`에서 배열 초기화 시 `.length = 0` (재할당 금지)
- [ ] 모달 닫기 함수에 `ensureGameLoopRunning()` 또는 `gameState` 전환 포함
- [ ] `activeBoss` 사용 전 null 체크 (`if (activeBoss)`)
- [ ] `setTimeout` 콜백에서 `player` 사용 시 null 체크
- [ ] 새 HTML 요소 추가 시 `id` 중복 없는지 확인

---

## 기여 / 개발 메모

이 프로젝트는 1인 개발 프로젝트입니다.  
Claude Code (AI 페어 프로그래밍)를 활용해 개발 중.

이슈나 버그는 `CHANGELOG.md`의 "알려진 이슈 이력" 섹션에 기록하세요.
