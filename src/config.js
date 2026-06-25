// game.js — Neon Survivors v0.07 MAJOR PATCH

// ============================================================
// 1. 게임 전역 설정 및 상태 상수
// ============================================================

// Suno MP3로 교체할 때: null → 'assets/audio/bgm.mp3' 로 변경
const BGM_AUDIO_SRC = null;

const MAP_WIDTH  = 2500;
const MAP_HEIGHT = 2500;

const STATE_MENU         = 'MENU';
const STATE_PLAYING      = 'PLAYING';
const STATE_LEVEL_UP     = 'LEVEL_UP';
const STATE_STAGE_CLEAR  = 'STAGE_CLEAR';
const STATE_STAGE_BONUS  = 'STAGE_BONUS';
const STATE_GAME_OVER    = 'GAME_OVER';
const STATE_SHOP         = 'SHOP';
const STATE_PAUSED       = 'PAUSED';
const STATE_CURSE        = 'CURSE';

// ============================================================
// 클래스 정의
// ============================================================
const CLASS_DEFS = {
  hacker: {
    name: '해커', icon: '💻', color: '#00f0ff',
    desc: '침투형. 빠른 레벨업, 리롤 3회. EMP로 적 집단 무력화.',
    hp: 100, speed: 3.4, damageMult: 1.0, magnetRadius: 90,
    startWeapon: 'flare', rerolls: 3, xpBonus: 1.15,
    activeSkill: { name: 'EMP 펄스', icon: '🔌', cd: 12000, desc: '반경 250 내 모든 적 3초 스턴 + 보스 1.5초 스턴' }
  },
  cyborg: {
    name: '방화벽', icon: '🔥', color: '#b026ff',
    desc: '방어형. HP 최고, 방어막으로 피해 차단. 근접전 특화.',
    hp: 200, speed: 2.8, damageMult: 0.9, magnetRadius: 80,
    startWeapon: 'orbiter', rerolls: 2, xpBonus: 1.0,
    activeSkill: { name: '방어막 가동', icon: '🛡', cd: 15000, desc: '8초간 피해 감소 60% + 주변 적 밀쳐냄' }
  },
  ghost: {
    name: '루트킷', icon: '🔓', color: '#39ff14',
    desc: '기동형. 속도 최고, 무적 대시로 전장 누빔. 순수 기동 특화.',
    hp: 65, speed: 5.0, damageMult: 1.05, magnetRadius: 70,
    startWeapon: 'flare', rerolls: 2, xpBonus: 1.0,
    activeSkill: { name: '위상 침투', icon: '👁', cd: 10000, desc: '4초간 무적 + 이동속도 2배' }
  },
  engineer: {
    name: '드론.exe', icon: '🤖', color: '#ffe600',
    desc: '자동화형. 드론이 자동 격리. Q스킬로 근접 적 밀쳐냄.',
    hp: 115, speed: 3.2, damageMult: 1.0, magnetRadius: 180,
    startWeapon: 'drone', rerolls: 2, xpBonus: 1.0,
    activeSkill: { name: '드론 폭발', icon: '💥', cd: 14000, desc: '반경 180 적 밀쳐냄 + 폭발 피해 + HP 20% 회복' }
  },
  sniper: {
    name: '스캐너', icon: '🎯', color: '#ff4466',
    desc: '원거리형. 피해량 최고, 원거리에서 코어 저격. 근접 취약.',
    hp: 80, speed: 3.2, damageMult: 1.6, magnetRadius: 70,
    startWeapon: 'missile', rerolls: 2, xpBonus: 1.0,
    activeSkill: { name: '정밀 스캔', icon: '🎯', cd: 8000, desc: '다음 미사일 5발 피해 5배 + 자동 추적' }
  },
  support: {
    name: '패치봇', icon: '💊', color: '#00ffaa',
    desc: '생존형. HP 재생 특화, XP +15%, 리롤 3회. 절대 안 죽는 플레이.',
    hp: 130, speed: 3.0, damageMult: 0.9, magnetRadius: 130,
    startWeapon: 'drone', rerolls: 3, xpBonus: 1.15,
    activeSkill: { name: '비상 패치', icon: '💊', cd: 15000, desc: 'HP 25% 즉시 회복 + 20초간 HP 재생 +3/s' }
  }
};

// ── 클래스 잠금 해제 조건 ──────────────────────────────────────
const CLASS_UNLOCK_DEFS = {
  hacker:   null, // 기본 개방
  cyborg:   null, // 기본 개방
  ghost:    null, // 기본 개방
  engineer: { stat: 'maxStage',      goal: 5,   label: '스테이지 5 이상 도달' },
  sniper:   { stat: 'totalKills',    goal: 300,  label: '바이러스 300마리 격리' },
  support:  { stat: 'totalBossKills',goal: 3,   label: '바이러스 코어 3회 파괴' },
};

function isClassUnlocked(classId) {
  const def = CLASS_UNLOCK_DEFS[classId];
  if (!def) return true;
  // 이미 한번 해금 저장된 경우
  if (saveData._unlockedClasses && saveData._unlockedClasses[classId]) return true;
  // 실시간 스탯 체크
  const s = _getStats();
  return (s[def.stat] || saveData[def.stat] || 0) >= def.goal;
}

let gameState    = STATE_MENU;
let selectedClass = 'hacker';
let keys = {};
let lastTime = 0;
let gameTime = 0;
let timeAccumulator = 0;
let killCount = 0;
let lastDamageSource = '';

// 엔티티 배열
let player;
let enemies       = [];
let projectiles   = [];
let gems          = [];
let particles     = [];
let fieldItems    = [];
let floatingTexts = [];
let bossProjectiles = [];

// ============================================================
// 2. 스테이지 시스템
// ============================================================
let currentStage     = 1;
let stageKillProgress = 0;
let stageKillGoal    = 20;
let isBossStage      = false;
let isMiniBossStage  = false;
let isEndlessMode    = false;
let endlessModeStartTime = 0;
let isStageClearAnim = false;   // 클리어 연출 진행 중 여부
let stageClearAnimStartMs = 0;  // 클리어 연출 시작 시각 (Date.now)
let bossStageStartMs = 0;       // 보스 스테이지 시작 시각 (갇힘 감지용)
let _gemMagnetTimer  = null;    // stageGemMagnet setTimeout ID
let gameLoopId       = null;    // requestAnimationFrame ID (루프 재시작 감지용)

// 보스
let activeBoss = null;

// 필드 아이템 스폰 타이머
let fieldItemTimer = 0;

// 화면 진동 (Screen Shake)
let screenShake = { x: 0, y: 0, intensity: 0, duration: 0 };

// 콤보 시스템
let comboCount = 0;
let comboTimer = 0;
const COMBO_WINDOW = 3500; // ms
let maxCombo = 0;

// 결과 통계
let evolutionCount = 0;
let activeSynergies = new Set();
let pendingBossCurse = false;

// 마인/블랙홀 엔티티
let mines = [];
let blackHoles = [];

// 리롤 잔여 횟수
let rerollUses = 2;

// 골드 & 상점
let shopTimer = 0;
let goldCoins = [];

// 메타 / 업적
let saveData            = { dataCores: 0, metaLevels: {}, achievements: [], bestKills: 0, bestStage: 0, bestTime: 0 };
let achieveCheckTimer   = 0;
let levelUpSelectedIdx  = 0;

// ─── 레벨업 버그 방지 ───
// stage clear 중 gem→XP→levelUp이 여러번 겹치면 큐에 적재
let pendingLevelUps    = 0;
let levelUpInProgress  = false;

// ─── 스테이지 보너스 키보드 포커스 ───
let bonusSelectedIdx   = 0;

// ─── 일시정지 ───
let prevStateBeforePause = null;

// ─── 난이도 시스템 ───
let gameDifficulty = 'normal';
const DIFFICULTY_SETTINGS = {
  easy:   { enemyHpMult: 0.7,  enemySpeedMult: 0.85, spawnRateMult: 0.8,  xpMult: 0.8,  label: 'EASY',   color: '#39ff14' },
  normal: { enemyHpMult: 1.0,  enemySpeedMult: 1.0,  spawnRateMult: 1.0,  xpMult: 1.0,  label: 'NORMAL', color: '#00f0ff' },
  hard:   { enemyHpMult: 1.5,  enemySpeedMult: 1.2,  spawnRateMult: 1.3,  xpMult: 1.2,  label: 'HARD',   color: '#ff4466' }
};

// ─── 일일 도전 ───
let isDailyRun = false;
let dailyRunSeed = 0;
let dailyRNG = null;

// ─── 승천 시스템 ───
let ascensionLevel = 0;

// ─── 세이브 슬롯 ───
let currentSaveSlot = 0;

// ─── 모바일 조이스틱 ───
let joystickBase = null;
let joystickKnob = null;
const JOYSTICK_RADIUS = 50;
let joystickTouchId = null;

// ─── 메뉴 BGM ───
let menuBgmStarted = false;

// ─── 근사망 저주 플래그 ───
let pendingNearDeathCurse = false;

// ─── 배경 별 효과 (시각적) ───
// 별: 70개로 축소 (130→70), 색상 인덱스로 관리
const bgStars = Array.from({ length: 70 }, () => ({
  xNorm:     Math.random(),
  yNorm:     Math.random(),
  speedNorm: 0.000025 + Math.random() * 0.00006,
  size:      0.5 + Math.random() * 1.4,
  alpha:     0.15 + Math.random() * 0.45,
  color:     Math.random() < 0.07 ? '#b026ff' : Math.random() < 0.1 ? '#ffe600' : '#00f0ff'
}));
let bgScanY = Math.random();

// 배경 바이러스 오브젝트 — 6개로 축소, offscreen 캐시로 성능 최적화
const BG_VIRUS_TYPES = ['spike', 'hexa', 'double'];
const BG_VIRUS_COLORS = ['#00f0ff','#b026ff','#39ff14','#ff4466'];
const bgVirusObjs = Array.from({ length: 6 }, (_, i) => ({
  xNorm:    Math.random(),
  yNorm:    Math.random(),
  size:     70 + Math.random() * 90,
  vxNorm:   (Math.random() - 0.5) * 0.000010,
  vyNorm:   (Math.random() - 0.5) * 0.000007,
  rot:      Math.random() * Math.PI * 2,
  rotSpeed: (Math.random() - 0.5) * 0.00015,
  type:     BG_VIRUS_TYPES[i % 3],
  colIdx:   i % 4,
  alpha:    0.05 + Math.random() * 0.06,
}));
// offscreen canvas — 3프레임마다 갱신, 메인 캔버스엔 drawImage 1회
let _bgOC = null, _bgOCtx = null, _bgOCAge = 99, _bgOCW = 0, _bgOCH = 0;

let obstacles = [];

// ── 배경 테마 (스테이지별 자동 전환) ──────────────────────────
const BG_THEMES = [
  { // Stage 1-24: Cyan / Neon — 슬럼 지구
    zoneName:'🌆 슬럼 지구', zoneTag:'SLUM DISTRICT', zoneColor:'#00f0ff',
    bgDark:'#01010a', glow:'rgba(0,18,45,0.4)',
    stars:['#00f0ff','#b026ff','#ffe600'],
    gridRgb:'0,240,255', scanRgb:'0,240,255',
    borderColor:'rgba(255,0,127,0.75)', borderGlow:'#ff007f',
    vignetteColor:'rgba(0,0,10,0.6)'
  },
  { // Stage 25-49: Void / Purple — 서버 팜
    zoneName:'🖥 서버 팜', zoneTag:'SERVER FARM', zoneColor:'#b026ff',
    bgDark:'#07010e', glow:'rgba(35,0,65,0.45)',
    stars:['#b026ff','#ff00cc','#00f0ff'],
    gridRgb:'160,0,255', scanRgb:'176,38,255',
    borderColor:'rgba(176,38,255,0.8)', borderGlow:'#b026ff',
    vignetteColor:'rgba(5,0,15,0.65)'
  },
  { // Stage 50-74: Crimson / Red — 바이러스 코어
    zoneName:'☣ 바이러스 코어', zoneTag:'VIRUS CORE', zoneColor:'#ff4466',
    bgDark:'#0a0101', glow:'rgba(50,0,5,0.45)',
    stars:['#ff4466','#ff8800','#ffe600'],
    gridRgb:'255,50,80', scanRgb:'255,68,102',
    borderColor:'rgba(255,20,0,0.8)', borderGlow:'#ff2200',
    vignetteColor:'rgba(12,0,0,0.65)'
  },
  { // Stage 75-99: Matrix / Green — 붕괴 지대
    zoneName:'💀 붕괴 지대', zoneTag:'COLLAPSE ZONE', zoneColor:'#39ff14',
    bgDark:'#000a01', glow:'rgba(0,30,5,0.4)',
    stars:['#39ff14','#00f0ff','#ffe600'],
    gridRgb:'57,255,20', scanRgb:'57,255,20',
    borderColor:'rgba(57,255,20,0.8)', borderGlow:'#39ff14',
    vignetteColor:'rgba(0,8,0,0.65)'
  },
  { // Stage 100+: Endless / Gold — 엔드리스 존
    zoneName:'∞ 엔드리스 존', zoneTag:'ENDLESS ZONE', zoneColor:'#ffe600',
    bgDark:'#060400', glow:'rgba(60,40,0,0.45)',
    stars:['#ffe600','#ff8800','#ffffff'],
    gridRgb:'255,200,0', scanRgb:'255,230,0',
    borderColor:'rgba(255,200,0,0.85)', borderGlow:'#ffe600',
    vignetteColor:'rgba(6,4,0,0.7)'
  }
];


function getCurrentZoneIdx() {
  const s = (typeof currentStage !== 'undefined' && gameState !== STATE_MENU) ? currentStage : 1;
  if (s >= 100) return 4;
  if (s >= 75)  return 3;
  if (s >= 50)  return 2;
  if (s >= 25)  return 1;
  return 0;
}
function getCurrentBgTheme() { return BG_THEMES[getCurrentZoneIdx()]; }

let _lastZoneIdx = -1;

function checkZoneTransition() {
  if (gameState !== STATE_PLAYING) return;
  const zIdx = getCurrentZoneIdx();
  if (_lastZoneIdx === -1) { _lastZoneIdx = zIdx; return; }
  if (zIdx !== _lastZoneIdx) {
    _lastZoneIdx = zIdx;
    const th = BG_THEMES[zIdx];
    showZoneEntryOverlay(th);
    updateZoneHUDBadge(th);
  }
}

function showZoneEntryOverlay(th) {
  const ov      = document.getElementById('zone-entry-overlay');
  const tagEl   = document.getElementById('zone-entry-tag');
  const nameEl  = document.getElementById('zone-entry-name');
  if (!ov || !tagEl || !nameEl) return;
  ov.style.color = th.zoneColor;
  tagEl.textContent  = `— ${th.zoneTag} —`;
  nameEl.textContent = th.zoneName;
  ov.classList.remove('active');
  void ov.offsetWidth; // reflow for re-animation
  ov.classList.add('active');
  clearTimeout(ov._zt);
  ov._zt = setTimeout(() => {
    ov.style.transition = 'opacity 0.7s';
    ov.style.opacity = '0';
    setTimeout(() => { ov.classList.remove('active'); ov.style.opacity = ''; ov.style.transition = ''; }, 750);
  }, 2400);
  triggerScreenShake(6, 400);
  playSynthSound([300, 600, 900, 600, 300], 0.18, 'triangle', 0.12);
}

function updateZoneHUDBadge(th) {
  const badge = document.getElementById('zone-hud-badge');
  if (!badge) return;
  badge.textContent = th.zoneName;
  badge.style.color = th.zoneColor;
  badge.style.borderColor = th.zoneColor;
  badge.style.textShadow = `0 0 6px ${th.zoneColor}`;
  badge.style.boxShadow = `0 0 8px ${th.zoneColor}44`;
}

// 별 색상 매핑 (기존 고정 색 → 테마 인덱스)
const _STAR_CI = { '#00f0ff': 0, '#b026ff': 1, '#ffe600': 2 };

// ─── 개발자 모드 ───
let devMode       = false;
let devGodMode    = false;
let devKeyBuffer  = '';
let devKeyTimer   = null;
let devFpsCount   = 0;
let devLastFpsTs  = 0;
let devCurrentFps = 60;

// ─── 멀티플레이어 ───
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB8dgoM3W4KaNde7TNMQqKtJITn4dep03c",
  authDomain: "antisurge-c0463.firebaseapp.com",
  databaseURL: "https://antisurge-c0463-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "antisurge-c0463",
  storageBucket: "antisurge-c0463.firebasestorage.app",
  messagingSenderId: "309752114290",
  appId: "1:309752114290:web:a63a7bb5732a1fd00c66eb"
};

let mpMode      = false;
let mpIsHost    = false;
let mpRoomCode  = '';
let mpMyId      = '';
let mpMyColor   = '#00f0ff';
let mpPlayers   = {};
let mpChannel   = null;   // BroadcastChannel (폴백)
let mpUseFb     = false;  // Firebase 사용 여부
let mpFbRoomRef = null;   // Firebase room reference
let mpFbMsgRef  = null;   // Firebase messages reference
let mpSyncTimer = 0;
let mpMsgSeq    = 0;      // 메시지 중복 방지용
const MP_SYNC_MS    = 120;
const MP_COLORS     = ['#00f0ff','#b026ff','#39ff14','#ff4466','#ffe600','#ff8800'];
const MP_MAX_PLAYERS   = 3;
const MP_AURA_RANGE    = 220;
const MP_RESPAWN_DELAY = 30;
const MP_SABOTAGE_CD   = 30000;
let mpAuraActive       = false;
let mpGameStartTime    = 0;
let mpSpectating       = false;
let mpRespawnTimer     = 0;
let mpGameMode         = 'coop'; // 'coop' | 'battle'
let mpSabotageTimer    = 0;
let _authUser          = null;
let _currentAchTab     = 'basic';

// 오브젝트 상한 (멀티 대비 성능 캡)
const MAX_ENEMIES        = 120;
const MAX_PROJECTILES    = 200;
const MAX_BOSS_PROJ      = 40;
const MAX_PARTICLES   = 180;

// ─── 리듬 비트 시스템 ───
const BEAT_WINDOW_SEC  = 0.11;   // ±110ms 비트 윈도우
let beatKickTimes      = [];     // 예약된 킥 오디오 타임스탬프
let beatWindowActive   = false;
let beatChain          = 0;      // 연속 비트 킬 카운트
let beatChainTimer     = 0;
const BEAT_CHAIN_DECAY = 4000;   // ms

// ─── 랜덤 필드 이벤트 시스템 ───
const FIELD_EVENTS = [
  { id: 'core_surge',      icon: '💫', name: '코어 서지',     color: '#00f0ff', duration: 6000,
    desc: 'XP 흡수량 3배! 젬을 최대한 수집하세요.' },
  { id: 'virus_frenzy',    icon: '⚡', name: '바이러스 광란',  color: '#ff4400', duration: 9000,
    desc: '모든 적 이동속도 1.7배! 살아남으세요.' },
  { id: 'emf_pulse',       icon: '🔵', name: 'EMF 펄스',     color: '#39ff14', duration: 1200,
    desc: '전자기 펄스 발사! 범위 내 적 2.5초 스턴.' },
  { id: 'golden_rush',     icon: '💰', name: '골든 러쉬',     color: '#ffe600', duration: 7000,
    desc: '황금의 시간! 모든 처치 시 골드 3배 드롭.' },
  { id: 'data_storm',      icon: '🌪️', name: '데이터 폭풍',   color: '#b026ff', duration: 10000,
    desc: '혼돈의 폭풍! 적들이 불규칙하게 이동합니다.' },
  { id: 'elite_invasion',  icon: '👾', name: '엘리트 침공',   color: '#ff6600', duration: 12000,
    desc: '정예 바이러스 8기 긴급 침투! 20% 속도 강화 상태입니다.' },
  { id: 'virus_surge',     icon: '🦠', name: '바이러스 급증', color: '#ff0066', duration: 1200,
    desc: '바이러스 대량 출현! 25기가 동시에 쏟아집니다.' },
  { id: 'core_overload',   icon: '🔥', name: '코어 과부하',   color: '#ff8800', duration: 8000,
    desc: '공격력 3배 상승! 하지만 받는 피해도 1.5배 증가합니다.' },
  { id: 'phantom_shift',   icon: '👁', name: '팬텀 시프트',   color: '#8800ff', duration: 7000,
    desc: '적들의 추적 AI 오작동! 혼란 상태로 무작위 이동합니다.' },
  { id: 'freeze_zone',     icon: '❄️', name: '프리즈 존',     color: '#00cfff', duration: 10000,
    desc: '냉각 필드 발생! 10초간 모든 적 이동속도 -60% 감소합니다.' },
  { id: 'repair_drone',    icon: '🔧', name: '수리 드론',     color: '#39ff14', duration: 15000,
    desc: '수리 드론 출동! 15초간 매초 HP 5를 자동 회복합니다.' },
  { id: 'cyber_mine_field',icon: '💣', name: '마인 필드',     color: '#ff8800', duration: 1200,
    desc: '자동 마인 배치! 주변 랜덤 위치에 사이버 마인 8개가 설치됩니다.' }
];
let fieldEventTimer    = 0;
let fieldEventInterval = 40000 + Math.random() * 20000;
let activeFieldEvent   = null;

// ─── 무기 시너지 정의 ───
const SYNERGY_DEFS = [
  {
    id: 'lightning_storm', name: '번개 폭풍', icon: '⚡',
    desc: '피해량 +20%, 이동속도 +10%',
    weapons: ['flare', 'zone'],
    apply: (p) => { p.damageMultiplier *= 1.20; p.speed *= 1.10; }
  },
  {
    id: 'orbital_network', name: '궤도 네트워크', icon: '🌀',
    desc: '피해량 +20%, 최대 HP +40',
    weapons: ['orbiter', 'drone'],
    apply: (p) => { p.damageMultiplier *= 1.20; p.maxHp += 40; p.hp = Math.min(p.hp+40, p.maxHp); }
  },
  {
    id: 'void_collapse', name: '공허 붕괴', icon: '🌑',
    desc: '피해량 +25%, 자석 범위 +30%',
    weapons: ['blackhole', 'ring'],
    apply: (p) => { p.damageMultiplier *= 1.25; p.magnetRadius *= 1.30; }
  },
  {
    id: 'chain_barrage', name: '연쇄 포격', icon: '🔗',
    desc: '피해량 +20%, 이동속도 +15%',
    weapons: ['chain', 'missile'],
    apply: (p) => { p.damageMultiplier *= 1.20; p.speed *= 1.15; }
  },
  {
    id: 'cluster_bomb', name: '집속 폭탄', icon: '💥',
    desc: '피해량 +20%, 폭발 피해 +30%',
    weapons: ['mine', 'boomerang'],
    apply: (p) => { p.damageMultiplier *= 1.20; }
  },
  {
    id: 'ghost_protocol', name: '고스트 프로토콜', icon: '👻',
    desc: '피해량 +20%, 속도 +12%',
    weapons: ['laser', 'boomerang'],
    apply: (p) => { p.damageMultiplier *= 1.20; p.speed *= 1.12; }
  },
  {
    id: 'digital_storm', name: '디지털 폭풍', icon: '🌪',
    desc: '피해량 +30%, 이동속도 +10%',
    weapons: ['chain', 'zone'],
    apply: (p) => { p.damageMultiplier *= 1.30; p.speed *= 1.10; }
  }
];

// ─── 무기 융합 진화 정의 (두 무기 모두 Lv5 → 특별 카드 등장) ───
const WEAPON_FUSIONS = [
  {
    id: 'arc_flare',
    name: '아크 플레어',
    icon: '✨⚡',
    weapons: ['flare', 'chain'],
    desc: '플레어 투사체 충돌 시 주변 2체에 연쇄 전격 발생. 투사체당 +2 체인!'
  },
  {
    id: 'hellfire_drone',
    name: '헬파이어 드론',
    icon: '🛸🚀',
    weapons: ['drone', 'missile'],
    desc: '드론이 총알 대신 유도 미사일 발사. 드론 1기당 추적 미사일 발사!'
  },
  {
    id: 'nova_collapse',
    name: '노바 콜랩스',
    icon: '🌑💥',
    weapons: ['blackhole', 'ring'],
    desc: '블랙홀 붕괴 시 12방향 폭발 투사체 발사. 광역 즉사 연쇄!'
  },
  {
    id: 'spectrum_blade',
    name: '스펙트럼 블레이드',
    icon: '🚨🪃',
    weapons: ['laser', 'boomerang'],
    desc: '레이저 발사 시 수직 방향 부메랑 2개 동시 발사. 광역 + 회전 복합 공격!'
  },
  {
    id: 'mine_orbital',
    name: '폭발 오비탈',
    icon: '🌀💣',
    weapons: ['orbiter', 'mine'],
    desc: '오비터가 적 접근 시 마인 자동 투하. 공전 중 폭탄 밭 자동 형성!'
  }
];

// ─── 미션 풀 ───────────────────────────────────────────────────
const MISSION_POOL = [
  // 킬 미션
  { id: 'kill_50',    cat: 'kill',    icon: '⚔',  name: '격리 작전',   desc: '바이러스 50마리 처치',     goal: 50,  trackKey: 'mKills',        reward: { type: 'gold',  val: 40 } },
  { id: 'kill_100',   cat: 'kill',    icon: '🔫',  name: '대규모 격리', desc: '바이러스 100마리 처치',    goal: 100, trackKey: 'mKills',        reward: { type: 'cores', val: 6 } },
  { id: 'stun_kill',  cat: 'kill',    icon: '⚡',  name: '무력화 처치', desc: '스턴 중 적 8마리 처치',    goal: 8,   trackKey: 'mStunKills',    reward: { type: 'heal',  val: 30 } },
  { id: 'combo_20',   cat: 'kill',    icon: '🔥',  name: '연속 처치',   desc: '콤보 20 달성',              goal: 20,  trackKey: 'mCombo',        reward: { type: 'xp',    val: 0 } },
  // 생존 미션
  { id: 'nodmg_20',   cat: 'survive', icon: '👁',  name: '완전 회피',   desc: '피격 없이 20초 생존',      goal: 20,  trackKey: 'mNoDmgSec',     reward: { type: 'heal',  val: 40 } },
  { id: 'highHp_90',  cat: 'survive', icon: '❤',  name: '고체력 유지', desc: 'HP 60% 이상 90초 유지',    goal: 90,  trackKey: 'mHighHpSec',    reward: { type: 'gold',  val: 35 } },
  // 보스/스테이지 미션
  { id: 'boss_fast',  cat: 'boss',    icon: '⏱',  name: '신속 격리',   desc: '보스를 60초 내에 처치',    goal: 1,   trackKey: 'mBossTimedKill',reward: { type: 'gold',  val: 60 } },
  { id: 'stage_10',   cat: 'stage',   icon: '📡',  name: '심층 침투',   desc: '스테이지 10 도달',          goal: 10,  trackKey: 'mStage',        reward: { type: 'cores', val: 5 } },
  { id: 'boss_2',     cat: 'boss',    icon: '💀',  name: '코어 파괴',   desc: '이번 런 보스 2개 처치',    goal: 2,   trackKey: 'mBossKills',    reward: { type: 'cores', val: 8 } },
];

let runMissions = [];
let mTrack = { mKills: 0, mStunKills: 0, mCombo: 0, mNoDmgSec: 0, mHighHpSec: 0, mBossTimedKill: 0, mStage: 1, mBossKills: 0, _noDmgStreak: 0 };

function initMissions() {
  const pool = [...MISSION_POOL];
  runMissions = [];
  while (runMissions.length < 3 && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    runMissions.push({ ...pool[i], progress: 0, done: false });
    pool.splice(i, 1);
  }
  mTrack = { mKills: 0, mStunKills: 0, mCombo: 0, mNoDmgSec: 0, mHighHpSec: 0, mBossTimedKill: 0, mStage: 1, mBossKills: 0, _noDmgStreak: 0 };
  const panel = document.getElementById('mission-panel');
  if (panel) panel.style.display = 'block';
  renderMissionPanel();
}

function updateMissions(dt) {
  if (!player || runMissions.length === 0 || gameState !== STATE_PLAYING) return;
  mTrack._noDmgStreak += dt / 1000;
  mTrack.mNoDmgSec = mTrack._noDmgStreak;
  if (player.hp >= player.maxHp * 0.6) mTrack.mHighHpSec += dt / 1000;
  mTrack.mCombo = Math.max(mTrack.mCombo, comboCount);
  mTrack.mStage = Math.max(mTrack.mStage, currentStage);
  checkMissions();
}

function checkMissions() {
  let anyChanged = false;
  for (const m of runMissions) {
    if (m.done) continue;
    const val = mTrack[m.trackKey] || 0;
    const prev = m.progress;
    m.progress = Math.min(val, m.goal);
    if (val >= m.goal) { m.done = true; anyChanged = true; completeMission(m); }
    else if (Math.floor(m.progress) !== Math.floor(prev)) anyChanged = true;
  }
  if (anyChanged) renderMissionPanel();
}

function completeMission(m) {
  if (m.reward.type === 'gold' && player) {
    player.gold = (player.gold || 0) + m.reward.val;
    addFloatingText(player.x, player.y - 64, `+${m.reward.val} 🪙 미션`, '#ffe600', 13);
  }
  if (m.reward.type === 'heal' && player) {
    player.hp = Math.min(player.hp + m.reward.val, player.maxHp);
    addFloatingText(player.x, player.y - 64, `+${m.reward.val} HP 미션`, '#00ffaa', 13);
  }
  if (m.reward.type === 'xp' && player) {
    player.xp += player.xpToNext * 0.85;
  }
  if (m.reward.type === 'cores') {
    saveData.dataCores += m.reward.val;
    saveSaveData();
    addFloatingText(player?.x || 0, (player?.y || 0) - 64, `+${m.reward.val} 코어 미션`, '#00f0ff', 13);
  }
  if (!saveData.completedMissions) saveData.completedMissions = {};
  saveData.completedMissions[m.id] = (saveData.completedMissions[m.id] || 0) + 1;
  saveSaveData();
  _checkClassUnlocks();
  triggerScreenShake(4, 250);
  playSynthSound([400, 650, 900], 0.18, 'triangle', 0.09);
}

function renderMissionPanel() {
  const list = document.getElementById('mission-list');
  if (!list) return;
  list.innerHTML = '';
  for (const m of runMissions) {
    const pct = Math.min(100, (m.progress / m.goal) * 100);
    const card = document.createElement('div');
    card.className = 'mission-card' + (m.done ? ' mission-done' : '');
    const rewardLabel = m.reward.type === 'gold' ? `+${m.reward.val}🪙` : m.reward.type === 'heal' ? `+${m.reward.val}HP` : m.reward.type === 'cores' ? `+${m.reward.val}코어` : 'XP';
    card.innerHTML = `
      <div class="mission-name">${m.icon} ${m.name}${m.done ? ' <span class="mission-check">✓</span>' : ''}</div>
      <div class="mission-desc">${m.desc}</div>
      <div class="mission-bar-wrap"><div class="mission-bar-fill" style="width:${pct}%"></div></div>
      <div class="mission-progress">${m.done ? `완료! 보상: ${rewardLabel}` : `${m.trackKey === 'mNoDmgSec' || m.trackKey === 'mHighHpSec' ? Math.floor(m.progress) + 's' : Math.floor(m.progress)} / ${m.goal}`}</div>
    `;
    list.appendChild(card);
  }
}

// ─── 저주 정의 ───
const CURSE_DEFS = [
  {
    id: 'curse_hp',
    debuff: '최대 HP -25%',
    reward: '보유한 모든 무기 레벨 +1 즉시',
    debuffFn: (p) => { const lose = Math.floor(p.maxHp * 0.25); p.maxHp -= lose; p.hp = Math.min(p.hp, p.maxHp); },
    rewardFn: () => {
      for (let key in player.weapons) {
        const w = player.weapons[key];
        if (w.level > 0 && w.level < UPGRADES.weapons[key].maxLevel) { w.level++; weaponStats[key].level = w.level; }
      }
      addFloatingText(player.x, player.y-50, '✨ ALL WEAPONS UP!', '#ffe600', 16);
    }
  },
  {
    id: 'curse_speed',
    debuff: '이동속도 -25%',
    reward: '피해량 영구 +50%',
    debuffFn: (p) => { const red = p.cursePenaltyReduce || 0; p.speed *= (1 - 0.25 * (1 - red)); },
    rewardFn: () => { player.damageMultiplier *= 1.50; addFloatingText(player.x, player.y-50, '🔥 피해 +50%!', '#ff6600', 16); }
  },
  {
    id: 'curse_dmg',
    debuff: '받는 피해 +40%',
    reward: '리롤 +5회, 골드 +30 즉시',
    debuffFn: (p) => { const red = p.cursePenaltyReduce || 0; p._curseDamageMult = (p._curseDamageMult || 1) * (1 + (0.40 * (1 - red))); },
    rewardFn: () => {
      rerollUses += 5;
      if (player) player.gold += 30;
      addFloatingText(player.x, player.y-50, '🔄 리롤 +5 · 💰 +30G!', '#b026ff', 15);
    }
  },
  {
    id: 'curse_magnet',
    debuff: '젬 자석 범위 -50%',
    reward: '골드 +40 즉시 획득',
    debuffFn: (p) => { p.magnetRadius *= 0.50; },
    rewardFn: () => { player.gold += 40; addFloatingText(player.x, player.y-50, '💰 +40 골드!', '#ffe600', 16); }
  }
];

// ─── 모바일 터치 입력 ───
let touchStartX = 0, touchStartY = 0;
let touchDX = 0, touchDY = 0;
let isTouching = false;

// ============================================================
// 3. 업그레이드 / 레어리티 상수
// ============================================================
const UPGRADES = {
  weapons: {
    flare: {
      name: "네온 플레어",
      icon: "✨",
      desc: ["가장 가까운 적에게 발광 투사체 발사", "투사체 갯수 증가 (+1)", "피해량 증가 및 투사체 속도 상향", "투사체 갯수 증가 (+1), 관통 속성 추가", "【진화】플라즈마 캐논 — 대형 폭발탄 발사, 광역 관통"],
      evolvedName: "플라즈마 캐논",
      maxLevel: 5
    },
    orbiter: {
      name: "사이버 오비터",
      icon: "🌀",
      desc: ["플레이어 주변을 공전하는 네온 구체 생성", "구체 갯수 증가 (+1)", "회전 속도 및 피해량 증가", "구체 갯수 증가 (+1)", "【진화】보이드 링 — 구체 크기 증가 및 네온 잔상 발생"],
      evolvedName: "보이드 링",
      maxLevel: 5
    },
    zone: {
      name: "일렉트로 존",
      icon: "⚡",
      desc: ["주변 적들에게 지속 피해를 주는 전기 지대 활성화", "피해량 증가 및 지대 반경 확장", "지대 안 적의 속도 25% 감속", "피해량 대폭 증가 및 반경 최대 확장", "【진화】사이버 폭풍 — 주기적으로 충격파 발생"],
      evolvedName: "사이버 폭풍",
      maxLevel: 5
    },
    laser: {
      name: "레이저 스트라이크",
      icon: "🚨",
      desc: ["무작위 방향으로 적을 관통하는 일직선 레이저 빔 발사", "발사 대기 시간 감소", "레이저 두께 확장 및 피해량 증가", "발사 대기 시간 대폭 감소", "【진화】십자 레이저 — 4방향 동시 발사"],
      evolvedName: "십자 레이저",
      maxLevel: 5
    },
    boomerang: {
      name: "사이버 부메랑",
      icon: "🪃",
      desc: ["적을 향해 부메랑 발사, 되돌아와 재차 관통", "귀환 속도 및 피해량 증가", "발사 간격 단축, 관통력 강화", "크기 및 피해량 대폭 증가", "【진화】포톤 크로스 — 4방향 동시 발사"],
      evolvedName: "포톤 크로스",
      maxLevel: 5
    },
    drone: {
      name: "데이터 드론",
      icon: "🛸",
      desc: ["자율 드론 소환, 인근 적에게 탄막 발사", "드론 발사 속도 증가", "드론 추가 소환 (+1)", "피해량 및 사거리 대폭 증가", "【진화】헥사 드론 — 드론 3기, 3발 동시 사격"],
      evolvedName: "헥사 드론",
      maxLevel: 5
    },
    missile: {
      name: "사이버 미사일",
      icon: "🚀",
      desc: ["적 추적 미사일 발사, 충돌 시 범위 폭발", "발사 간격 단축, 폭발 피해 증가", "미사일 2발 동시 발사", "피해량 대폭 증가, 유도력 강화", "【진화】쿼드 런처 — 4발 동시 발사, 대형 폭발"],
      evolvedName: "쿼드 런처",
      maxLevel: 5
    },
    ring: {
      name: "플라즈마 링",
      icon: "🔵",
      desc: ["플레이어 중심 확장 링 발생, 접촉한 적 피해", "링 반경 및 피해량 증가", "링 2개 동시 생성", "피해량 대폭 증가, 확장 속도 상향", "【진화】보이드 노바 — 3중 링, 적 흡입 후 폭발"],
      evolvedName: "보이드 노바",
      maxLevel: 5
    },
    chain: {
      name: "바이러스 체인",
      icon: "🔗",
      desc: ["가장 가까운 적을 전격으로 타격, 인근 1체에 연쇄", "연쇄 횟수 +1 (최대 3체)", "피해량 증가, 연쇄 범위 확장", "연쇄 횟수 +1 (최대 4체)", "【진화】뉴럴 바이러스 — 연쇄 5체, 처치 시 주변 폭발 연쇄"],
      evolvedName: "뉴럴 바이러스",
      maxLevel: 5
    },
    mine: {
      name: "랜드마인",
      icon: "💣",
      desc: ["발이 지나간 자리에 폭발 마인 설치", "마인 동시 배치 수 +1, 피해 증가", "폭발 반경 확장, 쿨타임 단축", "마인 배치 수 +1 (최대 4개)", "【진화】플라즈마 클러스터 — 폭발 시 소형 마인 3개 산란"],
      evolvedName: "플라즈마 클러스터",
      maxLevel: 5
    },
    blackhole: {
      name: "블랙홀 생성기",
      icon: "🌑",
      desc: ["전방에 중력장 생성, 적을 흡입하며 지속 피해", "중력장 반경 및 지속시간 증가", "붕괴 시 폭발 피해 2배", "블랙홀 2개 동시 생성", "【진화】이벤트 호라이즌 — 2개 동시, 붕괴 시 즉사 판정"],
      evolvedName: "이벤트 호라이즌",
      maxLevel: 5
    }
  },
  stats: [
    { id: "stat_hp",     name: "메모리 확장",    icon: "❤️",  desc: "최대 체력 +20 및 HP 소폭 회복" },
    { id: "stat_speed",  name: "오버클럭 이동",   icon: "🏃",  desc: "이동 속도 +10%" },
    { id: "stat_damage", name: "코어 전압 상승",  icon: "🔥",  desc: "모든 무기 피해량 +15%" },
    { id: "stat_magnet", name: "중력 필드 강화",  icon: "🧲",  desc: "경험치 코어 자석 흡수 범위 +30%" }
  ]
};

const RARITY_DATA = {
  common:    { name: '일반', color: '#94a3b8', prob: 0.60 },
  rare:      { name: '희귀', color: '#3b82f6', prob: 0.27 },
  epic:      { name: '에픽', color: '#b026ff', prob: 0.10 },
  legendary: { name: '전설', color: '#ffe600', prob: 0.03 }
};

const LEGENDARY_POOL = [
  { id: 'leg_all_up',    name: '시스템 오버라이드', icon: '🌟', desc: '보유한 모든 무기 레벨 +1' },
  { id: 'leg_hp',        name: '코어 강화',         icon: '💎', desc: '최대 HP +80 및 완전 회복' },
  { id: 'leg_nuke',      name: '데이터 핵폭발',     icon: '☢️', desc: '화면 내 모든 적 즉시 제거' },
  { id: 'leg_overclock', name: '초과전압 폭주',      icon: '⚡', desc: '전체 딜 +50%, 이동속도 +25%' }
];

// 에픽 부활 퍽 풀
const REVIVAL_EPICS = [
  { id: 'rev_restore',   icon: '💾', name: '데이터 복원',   desc: '사망 시 HP 30%로 즉시 부활 (런당 1회)' },
  { id: 'rev_backup',    icon: '🔄', name: '긴급 백업',     desc: 'HP 15% 이하 시 자동으로 50% 즉시 회복 (런당 1회)' },
  { id: 'rev_laststand', icon: '🛡', name: '최후의 방어막', desc: 'HP 0 도달 시 실드 4초 + HP 20% 회복 (런당 2회)' },
  { id: 'rev_counter',   icon: '💥', name: '절명 반격',     desc: 'HP 0 도달 시 주변 적 전체 200 피해 후 HP 30% 회복 (1회)' },
  { id: 'rev_void',      icon: '🌀', name: '공허의 각성',   desc: 'HP 0 도달 시 8초간 무적 + 피해 2.5배 돌입 (1회)' }
];

// 스테이지 클리어 시 젬 자석 플래그
let stageGemMagnet = false;
// 상점 키보드 포커스
let shopFocusIdx = 0;

// 필드 아이템 타입
const FIELD_ITEM_TYPES = {
  health:  { icon: '💊', color: '#ff4466', name: '회복 팩',    effect: 'HP +40 즉시 회복' },
  magnet:  { icon: '🧲', color: '#b026ff', name: 'XP 자석',   effect: '화면 내 모든 젬 흡수' },
  nuke:    { icon: '☢️', color: '#ffe600', name: '데이터 핵',  effect: '화면 내 모든 적 제거' },
  shield:  { icon: '🛡️', color: '#00f0ff', name: '실드 버블',  effect: '5초간 피격 무적' },
  surge:   { icon: '⚡', color: '#39ff14', name: '오버클럭',   effect: '8초간 이동속도 2배' }
};

// ============================================================
// 저장 / 메타 / 업적 상수
// ============================================================
const SAVE_KEY = 'neonSurvivorsData';

const META_UPGRADES = [
  { id: 'meta_hp',      icon: '❤️', name: '시스템 강화',       desc: ['최대 HP +20',       '+40 (누적)', '+70 (누적)', '+110 (누적)'], maxLevel: 4, costs: [12, 28, 55, 100] },
  { id: 'meta_speed',   icon: '🏃', name: '오버클럭 드라이브',  desc: ['이동속도 +5%',      '+10%', '+20%'],                           maxLevel: 3, costs: [12, 30, 60]     },
  { id: 'meta_magnet',  icon: '🧲', name: '중력 코어',          desc: ['자석 범위 +10%',    '+25%', '+50%'],                           maxLevel: 3, costs: [12, 30, 60]     },
  { id: 'meta_damage',  icon: '🔥', name: '전투 프로토콜',      desc: ['피해량 +5%',        '+12%', '+25%'],                           maxLevel: 3, costs: [20, 50, 100]    },
  { id: 'meta_reroll',  icon: '🔄', name: '리롤 확장 칩',       desc: ['시작 리롤 +1',      '+2 (누적)', '+3 (누적)'],                  maxLevel: 3, costs: [25, 60, 120]    },
  { id: 'meta_gold',    icon: '💰', name: '골드 스타터',        desc: ['시작 골드 +5',      '+12 (누적)', '+22 (누적)'],                maxLevel: 3, costs: [20, 50, 100]    },
  { id: 'meta_xp',      icon: '⭐', name: 'XP 부스터',          desc: ['XP 획득 +8%',       '+18%', '+35%'],                           maxLevel: 3, costs: [15, 35, 75]     },
  { id: 'meta_shop',    icon: '🏪', name: '해커 마켓',          desc: ['상점 가격 -10%',    '-20% (누적)', '-30% (누적)'],              maxLevel: 3, costs: [18, 40, 80]     },
  { id: 'meta_crit',    icon: '💥', name: '크리티컬 프로토콜',  desc: ['치명타 확률 +5%',   '+10% (누적)', '+18% (누적)'],              maxLevel: 3, costs: [22, 55, 110]    },
  { id: 'meta_regen',   icon: '🔋', name: '재생 드라이브',      desc: ['피격 후 3초간 HP+1/s 재생', '재생량 HP+2/s로 증가'],           maxLevel: 2, costs: [30, 70]         },
  { id: 'meta_weapon',  icon: '🔫', name: '프리로드 모듈',      desc: ['시작 시 주 무기 Lv+1', '시작 무기 Lv+2 (누적)'],              maxLevel: 2, costs: [45, 110]        },
  { id: 'meta_curse',   icon: '🛡', name: '감염 차단 코어',     desc: ['감염 증상 20% 경감', '감염 증상 40% 경감 (누적)'],             maxLevel: 2, costs: [35, 85]         },
];

const ACHIEVEMENTS = [
  { id: 'ach_first',    icon: '🦠', name: '첫 격리',         desc: '바이러스 1마리 격리',          reward: 1  },
  { id: 'ach_hunter',   icon: '⚔️', name: '바이러스 헌터',   desc: '바이러스 100마리 격리',        reward: 3  },
  { id: 'ach_survivor', icon: '🛡️', name: '방화벽 유지',     desc: '스테이지 5 돌파',              reward: 3  },
  { id: 'ach_stage10',  icon: '🏆', name: '시스템 수호자',   desc: '스테이지 10 돌파',             reward: 6  },
  { id: 'ach_evolved',  icon: '✨', name: '시스템 진화',     desc: '백신 모듈 진화 1회',           reward: 5  },
  { id: 'ach_combo',    icon: '🎯', name: '연속 격리',       desc: '콤보 25 이상 달성',            reward: 3  },
  { id: 'ach_gold',     icon: '💾', name: '코어 수집가',     desc: '골드 50 이상 보유',            reward: 3  },
  { id: 'ach_endless',  icon: '∞',  name: '무한 방어 프로토콜', desc: '무한 모드 진입',            reward: 12 }
];

const CLOUD_ACHIEVEMENTS = [
  { id: 'kill_500',    name: '격리 전문가',     icon: '⚔',  desc: '바이러스 500마리 격리',  stat: 'totalKills',      goal: 500   },
  { id: 'kill_5000',   name: '네온 박멸자',     icon: '💀',  desc: '바이러스 5000마리 격리', stat: 'totalKills',      goal: 5000  },
  { id: 'kill_50000',  name: '사이버 신',       icon: '🔥',  desc: '바이러스 5만 마리 격리', stat: 'totalKills',      goal: 50000 },
  { id: 'boss_5',      name: '코어 파괴자',     icon: '👑',  desc: '바이러스 코어 5회 파괴', stat: 'totalBossKills',  goal: 5     },
  { id: 'boss_20',     name: '코어 킬러',       icon: '💥',  desc: '바이러스 코어 20회 파괴',stat: 'totalBossKills',  goal: 20    },
  { id: 'stage_20',    name: '하이퍼 방어막',   icon: '⚡',  desc: '스테이지 20 돌파',       stat: 'maxStage',        goal: 20    },
  { id: 'stage_50',    name: '디지털 레전드',   icon: '🌀',  desc: '스테이지 50 돌파',       stat: 'maxStage',        goal: 50    },
  { id: 'stage_100',   name: '프로토콜 완료',   icon: '🏆',  desc: '스테이지 100 돌파',      stat: 'maxStage',        goal: 100   },
  { id: 'time_600',    name: '10분 방어',       icon: '⏱',  desc: '단일 세션 10분 생존',    stat: 'maxSurviveTime',  goal: 600   },
  { id: 'time_1800',   name: '30분 방어',       icon: '⌛',  desc: '단일 세션 30분 생존',    stat: 'maxSurviveTime',  goal: 1800  },
  { id: 'evolve_5',    name: '업그레이드 마니아',icon: '🔮', desc: '백신 모듈 진화 5회',     stat: 'totalEvolutions', goal: 5     },
  { id: 'evolve_20',   name: '진화의 신',       icon: '💎',  desc: '백신 모듈 진화 20회',    stat: 'totalEvolutions', goal: 20    },
  { id: 'mp_first',    name: '네트워크 데뷔',   icon: '🌐',  desc: '멀티 첫 세션',           stat: 'mpGamesPlayed',   goal: 1     },
  { id: 'mp_win',      name: '네트워크 지배자', icon: '🥊',  desc: '경쟁 모드 1위',          stat: 'mpBattleWins',    goal: 1     },
  { id: 'mp_revive3',  name: '불사 프로토콜',   icon: '🔄',  desc: '멀티 부활 3회',          stat: 'mpRevives',       goal: 3     },
  { id: 'games_10',    name: '방어 루틴 가동',  icon: '🎮',  desc: '10번 세션 플레이',       stat: 'totalGamesPlayed',goal: 10    },
  { id: 'games_50',    name: '시스템 마스터',   icon: '🌟',  desc: '50번 세션 플레이',       stat: 'totalGamesPlayed',goal: 50    },
  { id: 'boss_50',     name: '코어 헌터',       icon: '🩸',  desc: '바이러스 코어 50회 파괴',stat: 'totalBossKills',  goal: 50    },
  { id: 'kills_1000',  name: '바이러스 박멸자', icon: '🦠',  desc: '바이러스 1000마리 격리', stat: 'totalKills',      goal: 1000  },
  { id: 'combo_30',    name: '연속 격리 달인',  icon: '🎯',  desc: '최대 콤보 30 달성',      stat: 'maxCombo',        goal: 30    },
  { id: 'combo_75',    name: '격리 체인 신',    icon: '⚡',  desc: '최대 콤보 75 달성',      stat: 'maxCombo',        goal: 75    },
  { id: 'survive_20m', name: '20분 방어',       icon: '🕐',  desc: '단일 세션 20분 생존',    stat: 'maxSurviveTime',  goal: 1200  },
  { id: 'mp_battle3',  name: '네트워크 고수',   icon: '🏅',  desc: '경쟁 모드 3회 우승',     stat: 'mpBattleWins',    goal: 3     },
  // ── 히든 업적 ──────────────────────────────────────────
  { id: 'hidden_dedicated', hidden: true, realName: '이름 없는 방어자', name: '???', icon: '🌙', desc: '100번 세션 플레이',          stat: 'totalGamesPlayed', goal: 100   },
  { id: 'hidden_slayer',    hidden: true, realName: '코어의 악몽',      name: '???', icon: '💀', desc: '바이러스 코어 100회 파괴',   stat: 'totalBossKills',   goal: 100   },
  { id: 'hidden_combo',     hidden: true, realName: '격리 전설',        name: '???', icon: '🌀', desc: '최대 콤보 100 달성',         stat: 'maxCombo',         goal: 100   },
  { id: 'hidden_mp_vet',    hidden: true, realName: '베테랑 방어자',    name: '???', icon: '🔱', desc: '멀티 10세션 플레이',         stat: 'mpGamesPlayed',    goal: 10    },
  { id: 'hidden_legend',    hidden: true, realName: '안티서지 레전드',  name: '???', icon: '👑', desc: '모든 기본 업적 달성',        stat: '__allBasic__',     goal: 8     },
  // ── 클래스 전용 업적 ──────────────────────────────────────
  { id: 'cls_hacker',   name: '시스템 침투자',  icon: '💻', desc: '[해커] 스테이지 20 돌파',         stat: 'cls_hacker_maxStage',    goal: 20  },
  { id: 'cls_cyborg',   name: '강철 방어막',    icon: '🤖', desc: '[사이보그] 30세션 플레이',         stat: 'cls_cyborg_games',       goal: 30  },
  { id: 'cls_ghost',    name: '페이즈 전술가',  icon: '👻', desc: '[고스트] 스테이지 15 돌파',        stat: 'cls_ghost_maxStage',     goal: 15  },
  { id: 'cls_engineer', name: '드론 마스터',    icon: '🔧', desc: '[엔지니어] 드론 격리 300회 누적',  stat: 'cls_engineer_droneKills',goal: 300 },
  { id: 'cls_sniper',   name: '원거리 방어자',  icon: '🎯', desc: '[저격수] 스테이지 25 돌파',        stat: 'cls_sniper_maxStage',    goal: 25  },
  { id: 'cls_support',  name: '방어 코어',      icon: '💊', desc: '[서포트] 10세션 플레이',           stat: 'cls_support_games',      goal: 10  },
];

// ============================================================
// 패시브 아이템 정의
// ============================================================
const PASSIVE_DEFS = {
  regen:     { name: '회생 코어',   icon: '🔋', desc: ['체력 3초마다 +1 자동 회복',             '회복량 3배 증가 (+3/3s)'] },
  shield:    { name: '방어막 칩',   icon: '💠', desc: ['받는 피해 10% 감소',                    '피해 감소 22%로 강화'] },
  nanobots:  { name: '나노봇 군단', icon: '🦠', desc: ['젬 흡수 시 20% 확률로 HP +3 회복',      '확률 40%, 회복량 +5로 증가'] },
  overclock: { name: '과부하 회로', icon: '⚙️', desc: ['모든 무기 피해량 +12%',                 '피해량 추가 +28% (합계 +40%)'] },
  resonance: { name: '공명 코어',   icon: '🔮', desc: ['젬 XP +20% 추가 획득',                 'XP +45%로 증가'] },
  thorns:    { name: '복수의 가시', icon: '⚔️', desc: ['피격 시 반경 120 내 적에게 15 피해',    '피해 25, 반경 160으로 강화'] },
  critical:  { name: '크리티컬 코어', icon: '💥', desc: ['15% 확률로 피해 2.5배 치명타 발생',   '치명타 확률 25%, 피해 3배로 강화'] },
  explosive: { name: '폭발 연쇄',   icon: '💣', desc: ['처치 시 30% 확률 반경 120 연쇄폭발',   '확률 50%, 반경 160, 피해 증가'] },
  barrier:   { name: '전기 방벽',   icon: '🛡', desc: ['5초마다 반경 150 내 적 1.5초 스턴',    '3초마다 발동, 스턴 2.5초로 강화'] }
};

// ── 클래스 전용 패시브 트리 ──────────────────────────────────
const CLASS_PASSIVE_DEFS = {
  hacker: [
    { key: 'hk_skill', name: '해킹 가속',   icon: '⏩', desc: ['Q 스킬 쿨다운 -25%',       'Q 쿨다운 -45%'] },
    { key: 'hk_xp',    name: '데이터 수집', icon: '💽', desc: ['XP 획득 +20% 추가',         'XP 획득 +40% 추가'] },
  ],
  cyborg: [
    { key: 'fw_armor', name: '강화 방호',   icon: '🧱', desc: ['받는 피해 -12% 추가',        '받는 피해 -22% 추가'] },
    { key: 'fw_regen', name: '자가 수복',   icon: '🔋', desc: ['HP 2/초 무조건 재생',         'HP 4/초 재생 + 보스 전 2배'] },
  ],
  ghost: [
    { key: 'rk_evade', name: '위상 회피',   icon: '👻', desc: ['피격 8% 확률 무효화',         '피격 18% 확률 무효화'] },
    { key: 'rk_speed', name: '고속 침투',   icon: '💨', desc: ['이동속도 +0.5',               '이동속도 +1.2'] },
  ],
  engineer: [
    { key: 'dr_dmg',   name: '드론 과부하', icon: '⚡', desc: ['드론 피해 +30%',              '드론 피해 +60%'] },
    { key: 'dr_count', name: '추가 배치',   icon: '🛸', desc: ['드론 +1기 추가 배치',          '드론 +2기 추가 배치'] },
  ],
  sniper: [
    { key: 'sc_crit',  name: '치명 조준',   icon: '🎯', desc: ['치명타 확률 +15%',             '치명타 확률 +28%'] },
    { key: 'sc_magnet',name: '광역 탐지',   icon: '🔭', desc: ['XP 자석 범위 +60%',            'XP 자석 +120%, 보스 즉시 표시'] },
  ],
  support: [
    { key: 'pb_maxhp', name: '핵심 강화',   icon: '💪', desc: ['최대 HP +40 & 즉시 회복',      '추가 HP +40, 레벨업 시 HP 20% 회복'] },
    { key: 'pb_triage',name: '응급 처치',   icon: '🏥', desc: ['피격 후 5초간 HP +4/초 재생',  '피격 후 5초간 HP +8/초 재생'] },
  ],
};

// 상점 아이템 풀
const SHOP_ITEMS = [
  { id: 'shop_hp',     icon: '💊', name: '긴급 수리 키트',  desc: 'HP를 최대치의 50% 즉시 회복',     cost: 8 },
  { id: 'shop_damage', icon: '🔥', name: '공격 강화 모듈',  desc: '모든 무기 피해량 영구 +20%',       cost: 18 },
  { id: 'shop_speed',  icon: '🏃', name: '이동 부스터',     desc: '이동 속도 영구 +15%',             cost: 14 },
  { id: 'shop_magnet', icon: '🧲', name: '자력 강화 칩',    desc: 'XP 자석 범위 영구 +40%',          cost: 14 },
  { id: 'shop_reroll', icon: '🔄', name: '리롤 모듈',       desc: '레벨업 리롤 횟수 +2 추가',         cost: 20 },
  { id: 'shop_maxhp',  icon: '❤️', name: '코어 확장',       desc: '최대 HP +30 영구 증가 & 즉시 회복', cost: 22 }
];

// 엘리트 몬스터 이름 (스테이지 8+부터 등장)
const ELITE_NAMES = ['ELITE-α', 'ELITE-β', 'ELITE-Γ', 'ELITE-Δ', 'ELITE-Ω'];

// 보스 이름 테이블
const BOSS_NAMES = [
  'VIRUS ALPHA',     'MALWARE CORE',    'TROJAN PRIME',    'ROOTKIT ZERO',
  'RANSOMWARE-X',    'CRYPTO WYRM',     'NEURAL CORRUPTOR','DAEMON KING',
  'QUANTUM GHOST',   'FINAL PROTOCOL'
];

// 무기 통계 (결과 화면용)
let weaponStats = {
  flare:     { level: 0, damage: 0, kills: 0 },
  orbiter:   { level: 0, damage: 0, kills: 0 },
  zone:      { level: 0, damage: 0, kills: 0 },
  laser:     { level: 0, damage: 0, kills: 0 },
  boomerang: { level: 0, damage: 0, kills: 0 },
  drone:     { level: 0, damage: 0, kills: 0 },
  missile:   { level: 0, damage: 0, kills: 0 },
  ring:      { level: 0, damage: 0, kills: 0 },
  chain:     { level: 0, damage: 0, kills: 0 },
  mine:      { level: 0, damage: 0, kills: 0 },
  blackhole: { level: 0, damage: 0, kills: 0 }
};
