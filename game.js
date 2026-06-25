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
  { // Stage 1-24: Cyan / Neon
    bgDark:'#01010a', glow:'rgba(0,18,45,0.4)',
    stars:['#00f0ff','#b026ff','#ffe600'],
    gridRgb:'0,240,255', scanRgb:'0,240,255',
    borderColor:'rgba(255,0,127,0.75)', borderGlow:'#ff007f',
    vignetteColor:'rgba(0,0,10,0.6)'
  },
  { // Stage 25-49: Void / Purple
    bgDark:'#07010e', glow:'rgba(35,0,65,0.45)',
    stars:['#b026ff','#ff00cc','#00f0ff'],
    gridRgb:'160,0,255', scanRgb:'176,38,255',
    borderColor:'rgba(176,38,255,0.8)', borderGlow:'#b026ff',
    vignetteColor:'rgba(5,0,15,0.65)'
  },
  { // Stage 50-74: Crimson / Red
    bgDark:'#0a0101', glow:'rgba(50,0,5,0.45)',
    stars:['#ff4466','#ff8800','#ffe600'],
    gridRgb:'255,50,80', scanRgb:'255,68,102',
    borderColor:'rgba(255,20,0,0.8)', borderGlow:'#ff2200',
    vignetteColor:'rgba(12,0,0,0.65)'
  },
  { // Stage 75-99: Matrix / Green
    bgDark:'#000a01', glow:'rgba(0,30,5,0.4)',
    stars:['#39ff14','#00f0ff','#ffe600'],
    gridRgb:'57,255,20', scanRgb:'57,255,20',
    borderColor:'rgba(57,255,20,0.8)', borderGlow:'#39ff14',
    vignetteColor:'rgba(0,8,0,0.65)'
  },
  { // Stage 100+: Endless / Gold
    bgDark:'#060400', glow:'rgba(60,40,0,0.45)',
    stars:['#ffe600','#ff8800','#ffffff'],
    gridRgb:'255,200,0', scanRgb:'255,230,0',
    borderColor:'rgba(255,200,0,0.85)', borderGlow:'#ffe600',
    vignetteColor:'rgba(6,4,0,0.7)'
  }
];


function getCurrentBgTheme() {
  const s = (typeof currentStage !== 'undefined' && gameState !== STATE_MENU) ? currentStage : 1;
  if (s >= 100) return BG_THEMES[4];
  if (s >= 75)  return BG_THEMES[3];
  if (s >= 50)  return BG_THEMES[2];
  if (s >= 25)  return BG_THEMES[1];
  return BG_THEMES[0];
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

// ============================================================
// 4. Web Audio API — 효과음
// ============================================================
let audioCtx = null;

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSynthSound(freqs, duration, type = 'sine', volume = 0.1, isNoise = false) {
  if (!audioCtx) return;
  try {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (isNoise) {
      const bufferSize = audioCtx.sampleRate * duration;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data   = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noiseNode = audioCtx.createBufferSource();
      noiseNode.buffer = buffer;
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(freqs[0] || 1000, audioCtx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(freqs[1] || 100, audioCtx.currentTime + duration);
      noiseNode.connect(filter);
      filter.connect(gain);
      gain.gain.setValueAtTime(volume, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      noiseNode.start();
      noiseNode.stop(audioCtx.currentTime + duration);
    } else {
      osc.type = type;
      osc.frequency.setValueAtTime(freqs[0], audioCtx.currentTime);
      if (freqs.length > 1) osc.frequency.exponentialRampToValueAtTime(freqs[1], audioCtx.currentTime + duration);
      gain.gain.setValueAtTime(volume, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    }
  } catch(e) { console.warn('오디오 재생 실패:', e); }
}

function playShotSound()          { playSynthSound([800, 200], 0.08, 'sawtooth', 0.05); }
function playGemSound()           { playSynthSound([523.25, 1046.50], 0.12, 'sine', 0.06); }
function playHitSound()           { playSynthSound([150, 40], 0.1, 'triangle', 0.08); }
function playEnemyExplosionSound(){ playSynthSound([600, 50], 0.15, 'sawtooth', 0.04, true); }

function playLevelUpSound() {
  if (!audioCtx) return;
  [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
    setTimeout(() => playSynthSound([f], 0.15, 'sine', 0.08), i * 90);
  });
}

function playGameOverSound() {
  if (!audioCtx) return;
  [392.00, 311.13, 261.63, 196.00].forEach((f, i) => {
    setTimeout(() => playSynthSound([f, f - 30], 0.3, 'sawtooth', 0.1), i * 200);
  });
}

function playVictorySound() {
  if (!audioCtx) return;
  [523.25, 523.25, 523.25, 523.25, 659.25, 587.33, 659.25, 783.99, 1046.50].forEach((f, i) => {
    setTimeout(() => playSynthSound([f, f + 5], 0.25, 'triangle', 0.08), i * 150);
  });
}

function playStageClearSound() {
  if (!audioCtx) return;
  [523, 659, 784, 1047].forEach((f, i) => {
    setTimeout(() => playSynthSound([f], 0.2, 'sine', 0.1), i * 120);
  });
}

function playBossDeathSound() {
  if (!audioCtx) return;
  [100, 150, 200, 300, 500].forEach((f, i) => {
    setTimeout(() => playSynthSound([f, f * 1.5], 0.3, 'sawtooth', 0.12), i * 80);
  });
}

// ============================================================
// 5. BGM 시퀀서 (D단조 신스웨이브)
// ============================================================
let bgmGainNode       = null;
let bgmAudioElement   = null;
let bgmMuted           = false;
let bgmTrackId         = 0;
let bgmTrackCheckTimer = 0;
let bgmSchedulerTimer = null;
let bgmCurrentStep    = 0;
let bgmNextNoteTime   = 0;
let bgmSnareBuffer    = null;
let bgmHihatBuffer    = null;

const BGM_BPM           = 138;
const BGM_STEP          = 60 / BGM_BPM / 4;
const BGM_TOTAL_STEPS   = 64;
const BGM_SCHEDULE_AHEAD = 0.12;
const BGM_SCHEDULER_MS  = 25;

function midiToFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

const BGM_BASS = [
  38,null,null,null,45,null,null,null,38,null,null,null,41,null,43,null,
  38,null,null,null,45,null,null,null,43,null,null,null,41,null,38,null,
  36,null,null,null,43,null,null,null,36,null,null,null,40,null,43,null,
  38,null,null,null,45,null,null,null,50,null,48,null, 45,null,null,null
];
const BGM_LEAD = [
  74,null,null,null,null,null,72,null,69,null,null,null,67,null,null,null,
  65,null,67,null,  69,null,null,null,65,null,null,null,62,null,null,null,
  67,null,null,null,69,null,72,null, 74,null,null,null,72,null,69,null,
  72,null,74,null,  null,null,69,null,72,null,69,null, 65,null,62,null
];
const BGM_PAD = [
  62,null,null,null,null,null,null,null,65,null,null,null,null,null,null,null,
  62,null,null,null,null,null,null,null,65,null,null,null,null,null,null,null,
  60,null,null,null,null,null,null,null,65,null,null,null,null,null,null,null,
  62,null,null,null,null,null,null,null,69,null,null,null,null,null,null,null
];
const BGM_KICK  = [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0];
const BGM_SNARE = [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0];
const BGM_HIHAT = [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0];

// ─── BGM Track 2: DEVA SYSTEM (Persona 2 inspired, C minor, heavy) ───
const BGM2_BASS = [
  36,null,36,null,39,null,null,null,43,null,null,null,41,null,43,null,
  36,null,null,null,36,null,39,null,41,null,null,null,43,null,null,null,
  44,null,null,null,44,null,48,null,51,null,null,null,48,null,46,null,
  43,null,null,null,43,null,46,null,36,null,null,null,39,null,36,null
];
const BGM2_LEAD = [
  72,null,null,null,null,null,75,null,79,null,null,null,77,null,75,null,
  74,null,75,null,77,null,null,null,75,null,null,null,72,null,null,null,
  80,null,null,null,79,null,77,null,80,null,null,null,82,null,80,null,
  79,null,77,null,75,null,null,null,77,null,75,null,72,null,null,null
];
const BGM2_PAD = [
  60,null,null,null,null,null,null,null,63,null,null,null,null,null,null,null,
  65,null,null,null,null,null,null,null,68,null,null,null,null,null,null,null,
  56,null,null,null,null,null,null,null,60,null,null,null,null,null,null,null,
  55,null,null,null,null,null,null,null,58,null,null,null,null,null,null,null
];
const BGM2_KICK  = [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,1,0,1,0,0,0];
const BGM2_SNARE = [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,1,0];

// ─── BGM Track 3: GHOST PROTOCOL (Dm, industrial / heavy, 138 BPM) ───
const BGM3_BASS = [
  38,null,38,null,41,null,null,null,38,null,38,null,43,null,41,null,
  36,null,null,null,36,null,41,null,38,null,38,null,43,null,null,null,
  38,null,null,null,36,null,38,null,41,null,null,null,43,null,45,null,
  46,null,null,null,43,null,null,null,38,null,36,null,38,null,null,null
];
const BGM3_LEAD = [
  74,null,77,null,null,null,74,null,72,null,null,null,70,null,null,null,
  72,null,70,null,69,null,null,null,72,null,null,null,74,null,null,null,
  77,null,null,null,74,null,72,null,74,null,77,null,79,null,null,null,
  77,null,74,null,null,null,77,null,79,null,77,null,74,null,72,null
];
const BGM3_PAD = [
  50,null,null,null,null,null,null,null,53,null,null,null,null,null,null,null,
  50,null,null,null,null,null,null,null,53,null,null,null,null,null,null,null,
  48,null,null,null,null,null,null,null,55,null,null,null,null,null,null,null,
  50,null,null,null,null,null,null,null,53,null,null,null,null,null,null,null
];
const BGM3_KICK  = [1,0,0,0,1,0,1,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,1,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,1,0,0,0,0,0,1,0,0,0,1,0,1,0,1,0,0,0,0,0,1,0,1,0,1,0];
const BGM3_SNARE = [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,1,0,1,0];
const BGM3_HIHAT = [1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,1,1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,1,1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,1,1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,1];

// ─── BGM Track 4: SHADOW OPS (Dm, atmospheric / sparse, daily run) ───
const BGM4_BASS = [
  38,null,null,null,null,null,null,null,41,null,null,null,null,null,null,null,
  38,null,null,null,null,null,null,null,43,null,null,null,45,null,null,null,
  36,null,null,null,null,null,null,null,41,null,null,null,null,null,null,null,
  38,null,null,null,null,null,41,null, 38,null,null,null,null,null,null,null
];
const BGM4_LEAD = [
  62,null,null,null,null,null,65,null,null,null,null,null,62,null,null,null,
  null,null,60,null,null,null,null,null,58,null,null,null,null,null,60,null,
  62,null,null,null,65,null,null,null,null,null,67,null,null,null,65,null,
  null,null,null,null,62,null,null,null,60,null,null,null,null,null,null,null
];
const BGM4_PAD = [
  50,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,
  53,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,
  48,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,
  50,null,null,null,null,null,null,null,53,null,null,null,null,null,null,null
];
const BGM4_KICK  = [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0];
const BGM4_SNARE = [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0];
const BGM4_HIHAT = [0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0];

function initBGMBuffers() {
  if (!audioCtx) return;
  const sr = audioCtx.sampleRate;
  bgmSnareBuffer = audioCtx.createBuffer(1, Math.floor(sr * 0.18), sr);
  const sd = bgmSnareBuffer.getChannelData(0);
  for (let i = 0; i < sd.length; i++) sd[i] = Math.random() * 2 - 1;
  bgmHihatBuffer = audioCtx.createBuffer(1, Math.floor(sr * 0.06), sr);
  const hd = bgmHihatBuffer.getChannelData(0);
  for (let i = 0; i < hd.length; i++) hd[i] = Math.random() * 2 - 1;
}

function bgmPlayTone(freq, dur, type, vol, t) {
  if (!audioCtx || !bgmGainNode) return;
  const osc = audioCtx.createOscillator();
  const g   = audioCtx.createGain();
  osc.connect(g); g.connect(bgmGainNode);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.start(t); osc.stop(t + dur + 0.02);
}

function bgmPlayKick(t) {
  if (!audioCtx || !bgmGainNode) return;
  const osc = audioCtx.createOscillator();
  const g   = audioCtx.createGain();
  osc.connect(g); g.connect(bgmGainNode);
  osc.frequency.setValueAtTime(170, t);
  osc.frequency.exponentialRampToValueAtTime(35, t + 0.18);
  g.gain.setValueAtTime(0.85, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  osc.start(t); osc.stop(t + 0.2);
  // 비트 시스템: 킥 타임스탬프 기록
  beatKickTimes.push(t);
}

function bgmPlaySnare(t) {
  if (!audioCtx || !bgmGainNode || !bgmSnareBuffer) return;
  const n = audioCtx.createBufferSource();
  n.buffer = bgmSnareBuffer;
  const f = audioCtx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 0.7;
  const g = audioCtx.createGain();
  n.connect(f); f.connect(g); g.connect(bgmGainNode);
  g.gain.setValueAtTime(0.42, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  n.start(t); n.stop(t + 0.18);
}

function bgmPlayHihat(t) {
  if (!audioCtx || !bgmGainNode || !bgmHihatBuffer) return;
  const n = audioCtx.createBufferSource();
  n.buffer = bgmHihatBuffer;
  const f = audioCtx.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = 7000;
  const g = audioCtx.createGain();
  n.connect(f); f.connect(g); g.connect(bgmGainNode);
  g.gain.setValueAtTime(0.065, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  n.start(t); n.stop(t + 0.06);
}

function bgmSchedule() {
  if (!audioCtx || !bgmGainNode) return;
  while (bgmNextNoteTime < audioCtx.currentTime + BGM_SCHEDULE_AHEAD) {
    const step  = bgmCurrentStep % BGM_TOTAL_STEPS;
    const t     = bgmNextNoteTime;
    let bass, lead, pad, kick, snare, hihat, bassVol, leadVol, leadType;
    if (bgmTrackId === 3) {
      bass = BGM4_BASS; lead = BGM4_LEAD; pad = BGM4_PAD;
      kick = BGM4_KICK; snare = BGM4_SNARE; hihat = BGM4_HIHAT;
      bassVol = 0.20; leadVol = 0.06; leadType = 'sine';
    } else if (bgmTrackId === 2) {
      bass = BGM3_BASS; lead = BGM3_LEAD; pad = BGM3_PAD;
      kick = BGM3_KICK; snare = BGM3_SNARE; hihat = BGM3_HIHAT;
      bassVol = 0.25; leadVol = 0.08; leadType = 'sawtooth';
    } else if (bgmTrackId === 1) {
      bass = BGM2_BASS; lead = BGM2_LEAD; pad = BGM2_PAD;
      kick = BGM2_KICK; snare = BGM2_SNARE; hihat = null;
      bassVol = 0.22; leadVol = 0.07; leadType = 'sawtooth';
    } else {
      bass = BGM_BASS; lead = BGM_LEAD; pad = BGM_PAD;
      kick = BGM_KICK; snare = BGM_SNARE; hihat = BGM_HIHAT;
      bassVol = 0.17; leadVol = 0.055; leadType = 'square';
    }
    if (bass[step]  !== null) bgmPlayTone(midiToFreq(bass[step] - 12), BGM_STEP * 1.7, 'sawtooth', bassVol, t);
    if (pad[step]   !== null) {
      bgmPlayTone(midiToFreq(pad[step]),     BGM_STEP * 3.8, 'sawtooth', 0.05, t);
      bgmPlayTone(midiToFreq(pad[step] + 7), BGM_STEP * 3.8, 'sawtooth', 0.03, t);
    }
    if (lead[step]  !== null) bgmPlayTone(midiToFreq(lead[step]), BGM_STEP * 0.85, leadType, leadVol, t);
    if (kick[step])  bgmPlayKick(t);
    if (snare[step]) bgmPlaySnare(t);
    if (hihat && hihat[step]) bgmPlayHihat(t);
    bgmCurrentStep++;
    bgmNextNoteTime += BGM_STEP;
  }
  bgmSchedulerTimer = setTimeout(bgmSchedule, BGM_SCHEDULER_MS);
}

// ============================================================
// 액티브 스킬 시스템 (Q 키)
// ============================================================
function useActiveSkill() {
  if (!player || player.activeSkillCd > 0) return;
  if (gameState !== STATE_PLAYING && gameState !== STATE_STAGE_CLEAR) return;
  const cls = CLASS_DEFS[player.classId];
  if (!cls?.activeSkill) return;
  player.activeSkillCd = cls.activeSkill.cd;
  initAudio();
  switch (player.classId) {
    case 'hacker':
      enemies.forEach(e => {
        const dx = e.x - player.x, dy = e.y - player.y;
        if (dx*dx + dy*dy < 200*200) e.stunTimer = 3000;
      });
      if (activeBoss) {
        const dx = activeBoss.x - player.x, dy = activeBoss.y - player.y;
        if (dx*dx + dy*dy < 200*200) activeBoss.stunTimer = (activeBoss.stunTimer || 0) + 1500;
      }
      createExplosionParticles(player.x, player.y, '#00f0ff', 30);
      playSynthSound([800, 200, 100], 0.25, 'sawtooth', 0.12, true);
      addFloatingText(player.x, player.y - 60, '⚡ EMP 펄스!', '#00f0ff', 16);
      break;
    case 'cyborg': {
      player.skillShieldActive = true;
      player.activeSkillTimer  = 8000;
      player._skillOrigDmgReduction = player.damageReduction;
      player.damageReduction = Math.min(player.damageReduction + 0.60, 0.90);
      // 주변 적 밀쳐냄
      enemies.forEach(e => {
        const dx = e.x - player.x, dy = e.y - player.y, dist = Math.sqrt(dx*dx+dy*dy);
        if (dist < 220 && dist > 0) { e.x += (dx/dist)*180; e.y += (dy/dist)*180; }
      });
      createExplosionParticles(player.x, player.y, '#b026ff', 20);
      playSynthSound([400, 600], 0.2, 'triangle', 0.1);
      addFloatingText(player.x, player.y - 60, '🛡 방어막 가동!', '#b026ff', 16);
      break;
    }
    case 'ghost':
      player.skillInvincible   = true;
      player.skillSpeedBoost   = true;
      player.activeSkillTimer  = 4000;
      player._skillOrigSpeed   = player.speed;
      player.speed *= 2.0;
      playSynthSound([1000, 2000], 0.15, 'sine', 0.1);
      addFloatingText(player.x, player.y - 60, '👁 위상 침투!', '#39ff14', 16);
      break;
    case 'engineer': {
      // 드론 폭발: 반경 밀쳐내기 + 폭발 피해 + HP 회복
      const expDmg = 60 + (player.level || 1) * 8;
      enemies.forEach(e => {
        const dx = e.x - player.x, dy = e.y - player.y, dist = Math.sqrt(dx*dx+dy*dy);
        if (dist < 200 && dist > 0) {
          e.takeDamage(expDmg, 'drone');
          e.x += (dx/dist)*200; e.y += (dy/dist)*200;
        }
      });
      if (activeBoss) {
        const dx = activeBoss.x - player.x, dy = activeBoss.y - player.y, dist = Math.sqrt(dx*dx+dy*dy);
        if (dist < 200) activeBoss.hp -= expDmg * 0.5;
      }
      const healEng = Math.floor(player.maxHp * 0.20);
      player.hp = Math.min(player.hp + healEng, player.maxHp);
      createExplosionParticles(player.x, player.y, '#ffe600', 25);
      playSynthSound([200, 400, 600], 0.25, 'sawtooth', 0.1);
      addFloatingText(player.x, player.y - 60, `💥 드론 폭발! +${healEng}HP`, '#ffe600', 16);
      break;
    }
    case 'sniper':
      player._sniperShotBoost = 5;
      addFloatingText(player.x, player.y - 60, '🎯 정밀 스캔!', '#ff4466', 16);
      playSynthSound([1200, 800], 0.15, 'sawtooth', 0.1);
      break;
    case 'support': {
      const healSup = Math.floor(player.maxHp * 0.25);
      player.hp = Math.min(player.hp + healSup, player.maxHp);
      player._patchbotRegenTimer = 20000;
      if (player.weapons.drone) player.weapons.drone._repaired = true;
      addFloatingText(player.x, player.y - 60, `💊 비상 패치! +${healSup}HP`, '#00ffaa', 16);
      playSynthSound([500, 900, 1400], 0.2, 'triangle', 0.08);
      break;
    }
  }
  triggerScreenShake(4, 250);
}

// ============================================================
// 난이도 / 일일 도전 / 승천
// ============================================================
function setDifficulty(d) {
  gameDifficulty = d;
  document.querySelectorAll('.diff-btn').forEach(b => b.classList.toggle('diff-active', b.dataset.diff === d));
  localStorage.setItem('ns_difficulty', d);
}

function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function getDailyRunDate() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}

function startDailyRun() {
  isDailyRun = true;
  const dateStr = getDailyRunDate();
  dailyRunSeed = [...dateStr].reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0);
  dailyRNG = mulberry32(dailyRunSeed);
  gameDifficulty = 'hard';
  bgmTrackId = 3; // 섀도우 옵스 — 일일 도전 전용
  startGame();
}

function getAscensionScale() {
  return 1.0 + (ascensionLevel || 0) * 0.25;
}

// ============================================================
// 세이브 슬롯
// ============================================================
function getSaveKey(slot) { return `ns_save_slot_${slot ?? currentSaveSlot}`; }

function selectSaveSlot(n) {
  saveSaveData();
  currentSaveSlot = n;
  saveData = loadSaveDataSlot(n);
  applyMetaUpgrades();
  renderMetaGrid();
  updateMenuMetaBadge();
  document.querySelectorAll('.slot-btn').forEach((b, i) => b.classList.toggle('slot-active', i === n));
}

function loadSaveDataSlot(slot) {
  try {
    const raw = localStorage.getItem(getSaveKey(slot));
    if (!raw) return { dataCores: 0, metaLevels: {}, achievements: [], bestKills: 0, bestStage: 0, bestTime: 0, ascensionLevel: 0 };
    const d = JSON.parse(raw);
    return {
      dataCores:      d.dataCores      || 0,
      metaLevels:     d.metaLevels     || {},
      achievements:   d.achievements   || [],
      bestKills:      d.bestKills      || 0,
      bestStage:      d.bestStage      || 0,
      bestTime:       d.bestTime       || 0,
      ascensionLevel: d.ascensionLevel || 0
    };
  } catch(e) { return { dataCores: 0, metaLevels: {}, achievements: [], bestKills: 0, bestStage: 0, bestTime: 0, ascensionLevel: 0 }; }
}

// ============================================================
// 메뉴 BGM 시작
// ============================================================
function tryStartMenuBgm() {
  // 메인화면 BGM은 현재 비활성화 (별도 메뉴 음악 추가 예정)
  return;
}

function startBGM() {
  if (!audioCtx) return;
  stopBGM();
  bgmGainNode = audioCtx.createGain();
  bgmGainNode.gain.value = bgmMuted ? 0 : 0.55;
  bgmGainNode.connect(audioCtx.destination);

  if (BGM_AUDIO_SRC) {
    // Suno MP3 재생 모드
    bgmAudioElement = new Audio(BGM_AUDIO_SRC);
    bgmAudioElement.loop = true;
    const src = audioCtx.createMediaElementSource(bgmAudioElement);
    src.connect(bgmGainNode);
    bgmAudioElement.play().catch(() => {});
    return;
  }

  // 기본 신스 시퀀서 모드
  initBGMBuffers();
  bgmCurrentStep = 0;
  bgmNextNoteTime = audioCtx.currentTime + 0.15;
  bgmSchedule();
}

function stopBGM() {
  if (bgmSchedulerTimer) { clearTimeout(bgmSchedulerTimer); bgmSchedulerTimer = null; }
  if (bgmAudioElement)   { bgmAudioElement.pause(); bgmAudioElement = null; }
  if (bgmGainNode) {
    const oldGain = bgmGainNode;
    bgmGainNode = null; // 즉시 null로 교체 (레이스 컨디션 방지)
    try { oldGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.08); } catch(e) {}
    setTimeout(() => { try { oldGain.disconnect(); } catch(e) {} }, 220);
  }
}

function toggleBGM() {
  bgmMuted = !bgmMuted;
  if (bgmGainNode && audioCtx) bgmGainNode.gain.setTargetAtTime(bgmMuted ? 0 : 0.55, audioCtx.currentTime, 0.1);
  const btn = document.getElementById('mute-btn');
  if (btn) btn.textContent = bgmMuted ? '🔇' : '🎵';
}

// ============================================================
// 6. 플레이어 클래스
// ============================================================
class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.radius = 16;
    this.color  = '#00f0ff';

    // 클래스 스탯 적용
    const cls = CLASS_DEFS[selectedClass] || CLASS_DEFS.hacker;
    this.classId          = selectedClass;
    this.speed            = cls.speed;
    this.maxHp            = cls.hp;
    this.hp               = cls.hp;
    this.magnetRadius     = cls.magnetRadius;
    this.damageMultiplier = cls.damageMult;

    this.xp          = 0;
    this.nextLevelXp = 10;
    this.level       = 1;
    this.shieldTimer = 0;   // 필드 아이템 실드
    this.surgeTimer  = 0;   // 필드 아이템 속도 부스트

    // 스테이지 클리어 서지 보너스
    this.attackSurgeTimer = 0;
    this.attackSurgeMult  = 1.0;

    // 패시브 아이템
    this.passives        = { regen: 0, shield: 0, nanobots: 0, overclock: 0, resonance: 0, thorns: 0, critical: 0, explosive: 0, barrier: 0 };
    this.regenTimer      = 0;
    this.barrierTimer    = 0;
    this.damageReduction = 0.0;
    this.passiveXpMult   = 1.0;
    this.thornsTrigger   = false;

    // 골드
    this.gold = 0;

    // 액티브 스킬
    this.activeSkillCd     = 0;
    this.activeSkillTimer  = 0;
    this.skillShieldActive = false;
    this.skillInvincible   = false;
    this.skillSpeedBoost   = false;
    this._skillOrigDmgReduction = 0;
    this._skillOrigSpeed   = 0;
    this._sniperShotBoost  = 0;
    this._nearDeathCurseSent = false;

    // 부활 퍽
    this.revivals     = { restore: false, backup: false, lastStand: 0, counter: false, void: false };
    this.voidActive   = false;
    this.voidTimer    = 0;
    this._voidDmgMult = 1;

    this.weapons = {
      flare:     new FlareWeapon(this),
      orbiter:   new OrbiterWeapon(this),
      zone:      new ZoneWeapon(this),
      laser:     new LaserWeapon(this),
      boomerang: new BoomerangWeapon(this),
      drone:     new DroneWeapon(this),
      missile:   new MissileWeapon(this),
      ring:      new RingWeapon(this),
      chain:     new ChainWeapon(this),
      mine:      new MineWeapon(this),
      blackhole: new BlackHoleWeapon(this)
    };
    const startW = cls.startWeapon || 'flare';
    this.weapons[startW].level = 1;
    weaponStats[startW].level  = 1;
  }

  update(dt) {
    if (mpSpectating) return;
    let dx = 0, dy = 0;
    if (keys['w'] || keys['W'] || keys['ArrowUp'])    dy -= 1;
    if (keys['s'] || keys['S'] || keys['ArrowDown'])  dy += 1;
    if (keys['a'] || keys['A'] || keys['ArrowLeft'])  dx -= 1;
    if (keys['d'] || keys['D'] || keys['ArrowRight']) dx += 1;
    // 모바일 터치 입력 병합
    if (isTouching && (Math.abs(touchDX) > 0.05 || Math.abs(touchDY) > 0.05)) {
      dx = touchDX; dy = touchDY;
    } else if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }

    if (dx !== 0 || dy !== 0) this._moveAngle = Math.atan2(dy, dx);
    let spd = this.speed * (this.surgeTimer > 0 ? 2.0 : 1.0) * (this._poolSpeedMult ?? 1.0);
    this.x += dx * spd * (dt / 16.66);
    this.y += dy * spd * (dt / 16.66);
    this.x = Math.max(this.radius, Math.min(MAP_WIDTH  - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(MAP_HEIGHT - this.radius, this.y));

    if (this.shieldTimer > 0) this.shieldTimer -= dt;
    if (this.surgeTimer  > 0) this.surgeTimer  -= dt;

    // 액티브 스킬 쿨다운 & 타이머
    if (this.activeSkillCd > 0) this.activeSkillCd = Math.max(0, this.activeSkillCd - dt);
    if (this.activeSkillTimer > 0) {
      this.activeSkillTimer -= dt;
      if (this.activeSkillTimer <= 0) this._deactivateSkill();
    }

    // 사망 직전 저주 계약 (HP 15% 이하, 1회)
    if (this.hp / this.maxHp <= 0.15 && !this._nearDeathCurseSent && !pendingBossCurse && !pendingNearDeathCurse && gameState === STATE_PLAYING) {
      this._nearDeathCurseSent = true;
      pendingNearDeathCurse = true;
      setTimeout(() => {
        if (player && player.hp > 0 && gameState === STATE_PLAYING) {
          pendingNearDeathCurse = false;
          showNearDeathCurseModal();
        } else {
          pendingNearDeathCurse = false;
        }
      }, 500);
    }
    if (this.hp / this.maxHp > 0.30) this._nearDeathCurseSent = false;

    if (this.attackSurgeTimer > 0) {
      this.attackSurgeTimer -= dt;
      if (this.attackSurgeTimer <= 0) {
        this.damageMultiplier /= this.attackSurgeMult;
        this.attackSurgeMult   = 1.0;
      }
    }

    // 패시브: 회생 코어
    if (this.passives.regen > 0 && this.hp < this.maxHp) {
      this.regenTimer += dt;
      const interval = 3000;
      const healAmt  = this.passives.regen === 2 ? 3 : 1;
      if (this.regenTimer >= interval) {
        this.regenTimer = 0;
        this.hp = Math.min(this.hp + healAmt, this.maxHp);
      }
    } else {
      this.regenTimer = 0;
    }

    // 패치봇 Q스킬 재생 버프
    if ((this._patchbotRegenTimer || 0) > 0) {
      this._patchbotRegenTimer -= dt;
      this._patchbotRegenTickTimer = (this._patchbotRegenTickTimer || 0) + dt;
      if (this._patchbotRegenTickTimer >= 1000) {
        this._patchbotRegenTickTimer -= 1000;
        this.hp = Math.min(this.hp + 3, this.maxHp);
      }
    }

    // 메타: 피격 후 재생 드라이브
    if ((this.regenAfterHit || 0) > 0 && (this._regenAfterHitTimer || 0) > 0) {
      this._regenAfterHitTimer -= dt;
      this._regenAfterHitTickTimer = (this._regenAfterHitTickTimer || 0) + dt;
      if (this._regenAfterHitTickTimer >= 1000) {
        this._regenAfterHitTickTimer -= 1000;
        this.hp = Math.min(this.hp + this.regenAfterHit, this.maxHp);
      }
    }

    // 수리 드론 이벤트: 매초 +5 HP
    if (activeFieldEvent?.id === 'repair_drone') {
      this._droneHealTimer = (this._droneHealTimer || 0) + dt;
      if (this._droneHealTimer >= 1000) {
        this._droneHealTimer -= 1000;
        this.hp = Math.min(this.hp + 5, this.maxHp);
        addFloatingText(this.x, this.y - 30, '+5 수리', '#39ff14', 11);
      }
    } else {
      this._droneHealTimer = 0;
    }

    // 패시브: 전기 방벽 — 주기적으로 주변 적 스턴
    if (this.passives.barrier > 0) {
      this.barrierTimer += dt;
      const barrierCD  = this.passives.barrier === 2 ? 3000 : 5000;
      const barrierR   = 150;
      const stunDur    = this.passives.barrier === 2 ? 2500 : 1500;
      if (this.barrierTimer >= barrierCD) {
        this.barrierTimer = 0;
        for (let e of enemies) {
          if (dist(this.x, this.y, e.x, e.y) < barrierR) e.stunTimer = stunDur;
        }
        if (activeBoss && dist(this.x, this.y, activeBoss.x, activeBoss.y) < barrierR)
          activeBoss.stunTimer = Math.min(stunDur * 0.4, 800);
        createExplosionParticles(this.x, this.y, '#00f0ff', 18);
        playSynthSound([300, 900, 200], 0.12, 'triangle', 0.07);
        addFloatingText(this.x, this.y - 40, '🛡 전기 방벽!', '#00f0ff', 13);
      }
    }

    // 부활 퍽: 긴급 백업 (HP 임계값 체크)
    if (this.revivals.backup && this.hp > 0 && this.hp <= this.maxHp * 0.15) {
      this.revivals.backup = false;
      this.hp = Math.ceil(this.maxHp * 0.50);
      addFloatingText(this.x, this.y - 50, '🔄 긴급 백업!', '#ffe600', 18);
      createExplosionParticles(this.x, this.y, '#ffe600', 15);
    }
    // 부활 퍽: 공허의 각성 타이머
    if (this.voidActive) {
      this.voidTimer -= dt;
      // 공허 활성 중 시각 효과
      if (Math.random() < 0.08) createExplosionParticles(this.x + (Math.random()-0.5)*40, this.y + (Math.random()-0.5)*40, '#b026ff', 2);
      if (this.voidTimer <= 0) {
        this.voidActive = false;
        this.damageMultiplier /= (this._voidDmgMult || 2.5);
        this._voidDmgMult = 1;
        this.hp = Math.max(1, this.hp - Math.floor(this.maxHp * 0.5));
        addFloatingText(this.x, this.y - 40, '공허 종료', '#b026ff', 14);
        triggerScreenShake(8, 400);
      }
    }

    // 패시브: 복수의 가시 (피격 지연 처리)
    if (this.thornsTrigger) {
      this.thornsTrigger = false;
      const thornDmg = this.passives.thorns === 2 ? 25 : 15;
      const thornR   = this.passives.thorns === 2 ? 160 : 120;
      for (const e of [...enemies]) {
        if (e && dist(this.x, this.y, e.x, e.y) < thornR) {
          if (e.takeDamage(thornDmg, 'thorns')) killCount++;
        }
      }
    }

    for (let key in this.weapons) {
      if (this.weapons[key].level > 0) this.weapons[key].update(dt);
    }
  }

  draw(ctx, camera) {
    ctx.save();
    const bx = this.x - camera.x, by = this.y - camera.y;
    const r  = this.radius;

    // 실드 링
    if (this.shieldTimer > 0) {
      ctx.shadowBlur=28; ctx.shadowColor='#00f0ff';
      ctx.strokeStyle='#00f0ff'; ctx.lineWidth=2;
      ctx.setLineDash([6,4]);
      ctx.beginPath(); ctx.arc(bx, by, r+12, 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
    }

    // 외곽 글로우 링
    ctx.shadowBlur=22; ctx.shadowColor=this.color;
    ctx.strokeStyle=this.color; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI*2); ctx.stroke();

    // 회전 마커 (4점)
    const rot = (Date.now()*0.0015) % (Math.PI*2);
    ctx.strokeStyle=this.color; ctx.lineWidth=2; ctx.shadowBlur=10;
    for (let i=0;i<4;i++){
      const a = rot + (i/4)*Math.PI*2;
      const ix = bx+Math.cos(a)*(r+5), iy = by+Math.sin(a)*(r+5);
      ctx.beginPath();
      ctx.moveTo(ix+Math.cos(a)*4, iy+Math.sin(a)*4);
      ctx.lineTo(ix-Math.cos(a)*4, iy-Math.sin(a)*4);
      ctx.stroke();
    }

    // 클래스별 내부 형태
    ctx.shadowBlur=18; ctx.shadowColor='#ffffff'; ctx.fillStyle='#ffffff';
    ctx.strokeStyle='#ffffff'; ctx.lineWidth=2.5;
    const _s = r * 0.5;
    const _cls = this.classId || 'hacker';
    if (_cls === 'cyborg') {
      // 방화벽: 육각형
      ctx.beginPath();
      for (let _i=0;_i<6;_i++){
        const _a = _i/6*Math.PI*2 - Math.PI/6;
        const _hx = bx+Math.cos(_a)*_s, _hy = by+Math.sin(_a)*_s;
        _i===0 ? ctx.moveTo(_hx,_hy) : ctx.lineTo(_hx,_hy);
      }
      ctx.closePath(); ctx.fill();
    } else if (_cls === 'ghost') {
      // 루트킷: 앞방향 화살표 삼각형 (이동 방향 추적)
      const _ma = this._moveAngle || 0;
      ctx.beginPath();
      ctx.moveTo(bx+Math.cos(_ma)*_s*1.1, by+Math.sin(_ma)*_s*1.1);
      ctx.lineTo(bx+Math.cos(_ma+2.4)*_s*0.85, by+Math.sin(_ma+2.4)*_s*0.85);
      ctx.lineTo(bx+Math.cos(_ma-2.4)*_s*0.85, by+Math.sin(_ma-2.4)*_s*0.85);
      ctx.closePath(); ctx.fill();
    } else if (_cls === 'engineer') {
      // 드론.exe: 회전 사각형
      const _sqR = (Date.now()*0.0012) % (Math.PI*2);
      ctx.beginPath();
      for (let _i=0;_i<4;_i++){
        const _a = _sqR + _i*Math.PI/2 + Math.PI/4;
        const _qx = bx+Math.cos(_a)*_s, _qy = by+Math.sin(_a)*_s;
        _i===0 ? ctx.moveTo(_qx,_qy) : ctx.lineTo(_qx,_qy);
      }
      ctx.closePath(); ctx.fill();
    } else if (_cls === 'sniper') {
      // 스캐너: 크로스헤어
      const _g = _s * 0.3;
      ctx.beginPath(); ctx.moveTo(bx-_s*1.05,by); ctx.lineTo(bx-_g,by); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx+_g,by); ctx.lineTo(bx+_s*1.05,by); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx,by-_s*1.05); ctx.lineTo(bx,by-_g); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx,by+_g); ctx.lineTo(bx,by+_s*1.05); ctx.stroke();
      ctx.beginPath(); ctx.arc(bx,by,_g*0.9,0,Math.PI*2); ctx.stroke();
    } else if (_cls === 'support') {
      // 패치봇: 의료 십자
      const _arm=_s*0.45, _th=_s*0.28;
      ctx.fillRect(bx-_th/2, by-_arm, _th, _arm*2);
      ctx.fillRect(bx-_arm, by-_th/2, _arm*2, _th);
    } else {
      // 해커(default): 다이아몬드
      ctx.beginPath();
      ctx.moveTo(bx,      by-r*0.52);
      ctx.lineTo(bx+r*0.38, by);
      ctx.lineTo(bx,      by+r*0.52);
      ctx.lineTo(bx-r*0.38, by);
      ctx.closePath(); ctx.fill();
    }

    // 중심 도트
    ctx.fillStyle=this.color; ctx.shadowBlur=12;
    ctx.beginPath(); ctx.arc(bx, by, r*0.18, 0, Math.PI*2); ctx.fill();

    ctx.restore();

    for (let key in this.weapons) {
      if (this.weapons[key].level > 0 && typeof this.weapons[key].draw === 'function') {
        this.weapons[key].draw(ctx, camera);
      }
    }
  }

  gainXp(amount) {
    let mult = getXpMultiplier() * getEarlyGameXpMult();
    const cls = CLASS_DEFS[this.classId];
    if (cls) mult *= cls.xpBonus;
    mult *= this.passiveXpMult;
    mult *= (this.xpMultiplier || 1);
    if (mpMode && mpAuraActive) mult *= 1.05; // 오라 XP 보너스
    this.xp += amount * mult;
    while (this.xp >= this.nextLevelXp) {
      this.xp -= this.nextLevelXp;
      this.levelUp();
    }
  }

  levelUp() {
    this.level++;
    this.nextLevelXp = Math.floor(this.nextLevelXp * 1.35) + 8;
    if (!levelUpInProgress) {
      levelUpInProgress = true;
      playLevelUpSound();
      triggerLevelUpModal();
    } else {
      // 같은 프레임 내 다중 레벨업 → 큐에 적재
      pendingLevelUps++;
    }
  }

  _deactivateSkill() {
    if (this.skillShieldActive) {
      this.damageReduction = this._skillOrigDmgReduction;
      this.skillShieldActive = false;
    }
    if (this.skillSpeedBoost) {
      this.speed = this._skillOrigSpeed || this.speed;
      this.skillSpeedBoost = false;
      this.skillInvincible = false;
    }
  }

  takeDamage(amount) {
    if (mpSpectating) return;
    if (devGodMode) {
      addFloatingText(this.x, this.y - this.radius - 5, '♦GOD♦', '#39ff14', 9);
      return;
    }
    if (this.skillInvincible) {
      addFloatingText(this.x, this.y - this.radius, 'PHASE', '#39ff14', 12);
      return;
    }
    if (this.shieldTimer > 0) {
      addFloatingText(this.x, this.y - this.radius, 'BLOCKED', '#00f0ff', 12);
      return;
    }
    let dmg = amount;
    // 코어 과부하 이벤트: 받는 피해 1.5배
    if (activeFieldEvent?.id === 'core_overload') dmg *= 1.5;
    // 저주: 받는 피해 증가
    if (this._curseDamageMult) dmg *= this._curseDamageMult;
    if (this.damageReduction > 0) dmg = Math.max(1, Math.floor(dmg * (1 - this.damageReduction)));
    this.hp -= dmg;
    if (this.passives.thorns > 0) this.thornsTrigger = true;
    if ((this.regenAfterHit || 0) > 0) { this._regenAfterHitTimer = 3000; }
    playHitSound();
    createDamageOverlayParticles(this.x, this.y);
    triggerScreenShake(5, 250);
    if (this.hp <= 0) {
      this.hp = 0;
      // 공허 활성 중: 1HP 유지
      if (this.voidActive) { this.hp = 1; return; }
      // 부활 퍽 우선순위 체크
      if (this.revivals.void) {
        this.revivals.void = false;
        this.voidActive = true; this.voidTimer = 8000;
        this._voidDmgMult = 2.5; this.damageMultiplier *= 2.5;
        this.hp = 1;
        addFloatingText(this.x, this.y - 50, '🌀 공허의 각성!', '#b026ff', 20);
        triggerScreenShake(15, 600);
        createExplosionParticles(this.x, this.y, '#b026ff', 25);
        return;
      }
      if (this.revivals.lastStand > 0) {
        this.revivals.lastStand--;
        this.hp = Math.ceil(this.maxHp * 0.20);
        this.shieldTimer = 4000;
        addFloatingText(this.x, this.y - 50, '🛡 최후의 방어막!', '#00f0ff', 20);
        triggerScreenShake(10, 400);
        createExplosionParticles(this.x, this.y, '#00f0ff', 15);
        return;
      }
      if (this.revivals.counter) {
        this.revivals.counter = false;
        this.hp = Math.ceil(this.maxHp * 0.30);
        const allT = [...enemies]; if (activeBoss) allT.push(activeBoss);
        for (let e of allT) { if (dist(this.x, this.y, e.x, e.y) < 500 && e.takeDamage(200, 'counter')) killCount++; }
        addFloatingText(this.x, this.y - 50, '💥 절명 반격!', '#ff4466', 20);
        createExplosionParticles(this.x, this.y, '#ff4466', 30);
        triggerScreenShake(20, 600);
        return;
      }
      if (this.revivals.restore) {
        this.revivals.restore = false;
        this.hp = Math.ceil(this.maxHp * 0.30);
        addFloatingText(this.x, this.y - 50, '💾 데이터 복원!', '#39ff14', 20);
        createExplosionParticles(this.x, this.y, '#39ff14', 15);
        return;
      }
      if (mpMode && _mpHasAliveTeammates()) {
        mpEnterSpectator();
      } else {
        endGame(false);
      }
    }
  }
}

// ============================================================
// 7. 무기 클래스들
// ============================================================
class BaseWeapon {
  constructor(owner) { this.owner = owner; this.level = 0; this.timer = 0; }
  update(dt) {}
}

// 1. 네온 플레어
class FlareWeapon extends BaseWeapon {
  constructor(owner) { super(owner); this.cooldown = 1500; }
  update(dt) {
    this.timer += dt;
    let cd = this.level === 5 ? 950 : this.cooldown;
    if (this.timer >= cd) { this.timer = 0; this.fire(); }
  }
  fire() {
    if (enemies.length === 0 && !activeBoss) return;
    if (projectiles.length >= MAX_PROJECTILES) return;
    let targets = [...enemies];
    if (activeBoss) targets.push(activeBoss);
    let target = null, minDist = Infinity;
    for (let e of targets) {
      let d = dist(this.owner.x, this.owner.y, e.x, e.y);
      if (d < minDist) { minDist = d; target = e; }
    }
    if (!target) return;
    let angle = Math.atan2(target.y - this.owner.y, target.x - this.owner.x);

    if (this.level === 5) {
      // 진화: 플라즈마 캐논 — 대형 폭발탄
      let damage = 90 * this.owner.damageMultiplier;
      playSynthSound([100, 400], 0.25, 'sawtooth', 0.1);
      createExplosionParticles(this.owner.x, this.owner.y, '#ff7700', 5);
      projectiles.push(new Projectile(this.owner.x, this.owner.y, Math.cos(angle)*5, Math.sin(angle)*5, damage, 12, '#ff7700', 25, 'flare'));
      return;
    }

    let count  = [1,2,2,3][this.level - 1] ?? 1;
    let damage = this.level >= 3 ? 26 : 15;
    damage *= this.owner.damageMultiplier;
    let speed  = this.level >= 3 ? 8.0 : 6.5;
    let pierce = this.level >= 4 ? 3   : 1;
    playShotSound();
    for (let i = 0; i < count; i++) {
      let sa = angle + (count > 1 ? (i - (count-1)/2) * 0.18 : 0);
      projectiles.push(new Projectile(this.owner.x, this.owner.y, Math.cos(sa)*speed, Math.sin(sa)*speed, damage, 4, '#00f0ff', pierce, 'flare'));
    }
  }
}

// 2. 사이버 오비터
class OrbiterWeapon extends BaseWeapon {
  constructor(owner) { super(owner); this.angle = 0; }
  update(dt) {
    let spd    = this.level >= 3 ? 0.038 : 0.025;
    this.angle += spd * (dt / 16.66);
    let count  = [1,2,2,3,4][this.level - 1] ?? 1;
    let radius = this.level === 5 ? 95 : 70;
    let orbR   = this.level === 5 ? 14 : 8;
    let damage = [8,8,14,14,28][this.level - 1] ?? 8;
    damage *= this.owner.damageMultiplier;
    for (let i = 0; i < count; i++) {
      let ca   = this.angle + i * (Math.PI * 2 / count);
      let orbX = this.owner.x + Math.cos(ca) * radius;
      let orbY = this.owner.y + Math.sin(ca) * radius;
      let allTargets = [...enemies];
      if (activeBoss) allTargets.push(activeBoss);
      for (let e of allTargets) {
        if (dist(orbX, orbY, e.x, e.y) < e.radius + orbR) {
          if (e.takeDamage(damage, 'orbiter')) killCount++;
        }
      }
      // 진화 Lv5: 네온 잔상 파티클
      if (this.level === 5 && Math.random() < 0.55) {
        particles.push(new Particle(orbX, orbY, (Math.random()-0.5)*0.4, (Math.random()-0.5)*0.4, '#ff00ff', 180));
      }
    }
  }
  draw(ctx, camera) {
    let count  = [1,2,2,3,4][this.level - 1] ?? 1;
    let radius = this.level === 5 ? 95 : 70;
    let orbR   = this.level === 5 ? 14 : 8;
    let color  = this.level === 5 ? '#ff00ff' : '#b026ff';
    ctx.save();
    ctx.shadowBlur = 10; ctx.shadowColor = color;
    ctx.strokeStyle = `rgba(${this.level === 5 ? '255,0,255' : '176,38,255'}, 0.15)`;
    ctx.lineWidth = 1; ctx.setLineDash([4,4]);
    ctx.beginPath();
    ctx.arc(this.owner.x - camera.x, this.owner.y - camera.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
      let ca = this.angle + i * (Math.PI * 2 / count);
      let dx = this.owner.x + Math.cos(ca) * radius - camera.x;
      let dy = this.owner.y + Math.sin(ca) * radius - camera.y;
      ctx.shadowBlur = this.level === 5 ? 20 : 10;
      ctx.beginPath(); ctx.arc(dx, dy, orbR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(dx, dy, orbR * 0.35, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color;
    }
    ctx.restore();
  }
}

// 3. 일렉트로 존
class ZoneWeapon extends BaseWeapon {
  constructor(owner) {
    super(owner);
    this.tickTimer      = 0;
    this.shockwaveTimer = 0;
    this.shockwaves     = [];
  }
  update(dt) {
    this.tickTimer += dt;
    let cd = this.level === 5 ? 350 : 500;
    if (this.tickTimer >= cd) { this.tickTimer = 0; this.tick(); }

    // 진화 Lv5: 충격파
    if (this.level === 5) {
      this.shockwaveTimer += dt;
      if (this.shockwaveTimer >= 3000) {
        this.shockwaveTimer = 0;
        this.shockwaves.push({ r: 20, life: 600, maxLife: 600 });
      }
      for (let i = this.shockwaves.length - 1; i >= 0; i--) {
        let sw = this.shockwaves[i];
        let prevR = sw.r;
        sw.life -= dt;
        sw.r = 20 + (1 - sw.life / sw.maxLife) * 220;
        let dmg = 18 * this.owner.damageMultiplier;
        let allTargets = [...enemies];
        if (activeBoss) allTargets.push(activeBoss);
        for (let e of allTargets) {
          let d = dist(this.owner.x, this.owner.y, e.x, e.y);
          if (d >= prevR && d < sw.r + e.radius) {
            if (e.takeDamage(dmg, 'zone')) killCount++;
          }
        }
        if (sw.life <= 0) this.shockwaves.splice(i, 1);
      }
    } else {
      this.shockwaves = [];
    }
  }
  tick() {
    let radius  = [80,110,110,145,145][this.level - 1] ?? 80;
    let damage  = [3,5,5,8,13][this.level - 1] ?? 3;
    damage *= this.owner.damageMultiplier;
    let slowFactor = this.level >= 5 ? 0.65 : this.level >= 3 ? 0.75 : 0.85;
    let allTargets = [...enemies];
    if (activeBoss) allTargets.push(activeBoss);
    for (let e of allTargets) {
      if (dist(this.owner.x, this.owner.y, e.x, e.y) < radius + e.radius) {
        e.speedMultiplier = slowFactor;
        if (e.takeDamage(damage, 'zone')) killCount++;
      }
    }
  }
  draw(ctx, camera) {
    let radius = [80,110,110,145,145][this.level - 1] ?? 80;
    let pulse  = Math.sin(Date.now() * 0.01) * 3;
    ctx.save();
    ctx.strokeStyle = this.level === 5 ? 'rgba(57, 255, 20, 0.6)' : 'rgba(57, 255, 20, 0.4)';
    ctx.shadowBlur  = this.level === 5 ? 14 : 8; ctx.shadowColor = '#39ff14';
    ctx.lineWidth   = this.level === 5 ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.arc(this.owner.x - camera.x, this.owner.y - camera.y, radius + pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(57, 255, 20, 0.03)';
    ctx.fill();
    // 충격파 링 렌더
    for (let sw of this.shockwaves) {
      let alpha = sw.life / sw.maxLife;
      ctx.strokeStyle = `rgba(57, 255, 20, ${alpha * 0.9})`;
      ctx.lineWidth   = 3 * alpha;
      ctx.shadowBlur  = 20 * alpha;
      ctx.beginPath();
      ctx.arc(this.owner.x - camera.x, this.owner.y - camera.y, sw.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// 4. 레이저 스트라이크
class LaserWeapon extends BaseWeapon {
  constructor(owner) { super(owner); this.cooldown = 3500; }
  update(dt) {
    this.timer += dt;
    let cd = this.level >= 4 ? 2200 : this.level >= 2 ? 2900 : 3500;
    if (this.timer >= cd) { this.timer = 0; this.fire(); }
  }
  fire() {
    let damage = [45,45,70,70,100][this.level - 1] ?? 45;
    damage *= this.owner.damageMultiplier;
    let width  = this.level >= 3 ? 42 : 24;
    let allTargets = [...enemies];
    if (activeBoss) allTargets.push(activeBoss);
    let angle  = Math.random() * Math.PI * 2;
    if (allTargets.length > 0) {
      let tgt = allTargets[Math.floor(Math.random() * allTargets.length)];
      angle = Math.atan2(tgt.y - this.owner.y, tgt.x - this.owner.x);
    }
    playSynthSound([150, 900], 0.25, 'sawtooth', 0.09);
    createLaserBeam(this.owner.x, this.owner.y, angle, width, damage, 400);
    if (this.level === 5) {
      // 진화: 십자 레이저 — 4방향 동시
      createLaserBeam(this.owner.x, this.owner.y, angle + Math.PI,     width, damage, 400);
      createLaserBeam(this.owner.x, this.owner.y, angle + Math.PI/2,   width, damage, 400);
      createLaserBeam(this.owner.x, this.owner.y, angle - Math.PI/2,   width, damage, 400);
    }
  }
}

// 5. 사이버 부메랑
class BoomerangWeapon extends BaseWeapon {
  constructor(owner) { super(owner); this.cooldown = 2200; }
  update(dt) {
    this.timer += dt;
    const cd = [2200, 2000, 1700, 1500, 1200][this.level - 1] ?? 2200;
    if (this.timer >= cd) { this.timer = 0; this.fire(); }
  }
  fire() {
    if (projectiles.length >= MAX_PROJECTILES) return;
    let targets = [...enemies]; if (activeBoss) targets.push(activeBoss);
    let angle = Math.random() * Math.PI * 2;
    if (targets.length > 0) {
      targets.sort((a, b) => dist(this.owner.x, this.owner.y, a.x, a.y) - dist(this.owner.x, this.owner.y, b.x, b.y));
      angle = Math.atan2(targets[0].y - this.owner.y, targets[0].x - this.owner.x);
    }
    const dmgBase = [18, 24, 32, 44, 60][this.level - 1] ?? 18;
    const damage  = dmgBase * this.owner.damageMultiplier;
    const speed   = this.level >= 4 ? 9 : 7;
    const count   = this.level === 5 ? 4 : 1;
    playSynthSound([900, 400], 0.18, 'sawtooth', 0.08);
    for (let i = 0; i < count; i++) {
      const a = this.level === 5 ? angle + i * (Math.PI / 2) : angle;
      projectiles.push(new BoomerangProjectile(this.owner.x, this.owner.y, Math.cos(a) * speed, Math.sin(a) * speed, damage, '#ff00cc', this.owner));
    }
  }
}

// 6. 데이터 드론
class DroneWeapon extends BaseWeapon {
  constructor(owner) { super(owner); this.angleOffset = 0; this.droneTimers = [0, 0, 0]; }
  update(dt) {
    const count  = [1, 1, 2, 2, 3][this.level - 1] ?? 1;
    const fireCD = [2000, 1500, 1500, 1100, 900][this.level - 1] ?? 2000;
    const radius = 115;
    this.angleOffset += 0.014 * (dt / 16.66);
    for (let i = 0; i < count; i++) {
      this.droneTimers[i] = (this.droneTimers[i] || 0) + dt;
      if (this.droneTimers[i] >= fireCD) {
        this.droneTimers[i] = 0;
        const angle  = this.angleOffset + (i / count) * Math.PI * 2;
        const droneX = this.owner.x + Math.cos(angle) * radius;
        const droneY = this.owner.y + Math.sin(angle) * radius;
        let allT = [...enemies]; if (activeBoss) allT.push(activeBoss);
        let nearest = null, minD = 350;
        for (let e of allT) {
          const d = dist(droneX, droneY, e.x, e.y);
          if (d < minD) { minD = d; nearest = e; }
        }
        if (nearest && projectiles.length < MAX_PROJECTILES) {
          const a     = Math.atan2(nearest.y - droneY, nearest.x - droneX);
          const dmgB  = [12, 16, 20, 30, 45][this.level - 1] ?? 12;
          const dmg   = dmgB * this.owner.damageMultiplier;
          const shots = this.level === 5 ? 3 : 1;
          playSynthSound([700, 1100], 0.08, 'square', 0.05);
          for (let s = 0; s < shots; s++) {
            const sa = a + (shots > 1 ? (s - 1) * 0.14 : 0);
            projectiles.push(new Projectile(droneX, droneY, Math.cos(sa) * 9, Math.sin(sa) * 9, dmg, 4, '#ff8800', 1, 'drone'));
          }
        }
      }
    }
  }
  draw(ctx, camera) {
    const count  = [1, 1, 2, 2, 3][this.level - 1] ?? 1;
    const radius = 115;
    const color  = this.level === 5 ? '#ff6600' : '#ff8800';
    ctx.save();
    ctx.strokeStyle = 'rgba(255,136,0,0.1)';
    ctx.lineWidth = 1; ctx.setLineDash([3, 7]);
    ctx.beginPath();
    ctx.arc(this.owner.x - camera.x, this.owner.y - camera.y, radius, 0, Math.PI * 2);
    ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < count; i++) {
      const a  = this.angleOffset + (i / count) * Math.PI * 2;
      const dx = this.owner.x + Math.cos(a) * radius - camera.x;
      const dy = this.owner.y + Math.sin(a) * radius - camera.y;
      ctx.shadowBlur = 16; ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let j = 0; j < 6; j++) {
        const ja = (j / 6) * Math.PI * 2 + this.angleOffset * 2;
        if (j === 0) ctx.moveTo(dx + Math.cos(ja) * 8, dy + Math.sin(ja) * 8);
        else         ctx.lineTo(dx + Math.cos(ja) * 8, dy + Math.sin(ja) * 8);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(dx, dy, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

// 7. 신규 무기 — 사이버 미사일
class MissileWeapon extends BaseWeapon {
  constructor(owner) { super(owner); this.cooldown = 3000; }
  update(dt) {
    this.timer += dt;
    const cds = [3000, 2500, 2500, 2200, 1800];
    const cd  = cds[Math.min(this.level - 1, cds.length - 1)] ?? 3000;
    if (this.timer >= cd) { this.timer = 0; this.fire(); }
  }
  fire() {
    if (!player || projectiles.length >= MAX_PROJECTILES) return;
    let allT = [...enemies]; if (activeBoss) allT.push(activeBoss);
    if (allT.length === 0) return;
    const target = allT.reduce((best, e) => {
      const d = dist(this.owner.x, this.owner.y, e.x, e.y);
      return (!best || d < best.d) ? { e, d } : best;
    }, null);
    if (!target) return;
    const counts = [1, 1, 2, 2, 4];
    const count  = counts[Math.min(this.level - 1, counts.length - 1)];
    const dmgs   = [55, 65, 65, 85, 90];
    const dmg    = dmgs[Math.min(this.level - 1, dmgs.length - 1)] * this.owner.damageMultiplier;
    const angle  = Math.atan2(target.e.y - this.owner.y, target.e.x - this.owner.x);
    const isEvo  = this.level === 5;
    playSynthSound([300, 600, 900], 0.12, 'sawtooth', 0.06);
    for (let i = 0; i < count; i++) {
      const spread = count > 1 ? (i - (count-1)/2) * 0.22 : 0;
      const a = angle + spread;
      projectiles.push(new MissileProjectile(
        this.owner.x, this.owner.y,
        Math.cos(a) * 5, Math.sin(a) * 5,
        dmg, isEvo ? 10 : 7, '#ff6600', 'missile', isEvo
      ));
    }
  }
  draw(ctx, camera) {
    if (this.level === 0) return;
    // 사거리 표시 없음 — 유도탄이라 범위 없음
  }
}

// 7b. 신규 무기 — 플라즈마 링
class RingWeapon extends BaseWeapon {
  constructor(owner) { super(owner); this.rings = []; }
  update(dt) {
    if (this.level === 0) return;
    this.timer += dt;
    const cds = [3500, 3000, 2500, 2200, 1800];
    const cd  = cds[Math.min(this.level - 1, cds.length - 1)] ?? 3500;
    if (this.timer >= cd) { this.timer = 0; this.spawnRings(); }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      ring.life -= dt;
      if (ring.life <= 0) { this.rings.splice(i, 1); continue; }
      const prog = 1 - ring.life / ring.maxLife;
      const prevR = ring.currentRadius;
      ring.currentRadius = ring.maxRadius * prog;

      // 반경 통과 시 적에게 피해 (hitEnemies로 중복 방지)
      const dmgs = [25, 30, 35, 40, 50];
      const dmg  = dmgs[Math.min(this.level - 1, dmgs.length - 1)] * this.owner.damageMultiplier;
      let allT = [...enemies]; if (activeBoss) allT.push(activeBoss);
      for (let e of allT) {
        if (ring.hitEnemies.has(e)) continue;
        const d = dist(ring.x, ring.y, e.x, e.y);
        if (d <= ring.currentRadius + e.radius && d >= prevR - e.radius) {
          ring.hitEnemies.add(e);
          const killed = e === activeBoss
            ? activeBoss.takeDamage(dmg, 'ring')
            : e.takeDamage(dmg, 'ring');
          if (killed && e !== activeBoss) killCount++;
          // 보이드 노바 진화: 링 안으로 당기기
          if (this.level === 5 && e !== activeBoss) {
            const dx = ring.x - e.x, dy = ring.y - e.y;
            const dd = Math.sqrt(dx*dx + dy*dy) || 1;
            e.x += (dx / dd) * 5;
            e.y += (dy / dd) * 5;
          }
        }
      }
    }
  }
  spawnRings() {
    const count    = this.level >= 3 ? (this.level === 5 ? 3 : 2) : 1;
    const maxRs    = [200, 280, 300, 330, 360];
    const maxR     = maxRs[Math.min(this.level - 1, maxRs.length - 1)];
    const dur      = 1400;
    playSynthSound([200, 800, 400], 0.15, 'sine', 0.07);
    for (let i = 0; i < count; i++) {
      this.rings.push({
        x: this.owner.x, y: this.owner.y,
        currentRadius: 0, maxRadius: maxR + i * 40,
        life: dur - i * 120, maxLife: dur - i * 120,
        hitEnemies: new Set()
      });
    }
  }
  draw(ctx, camera) {
    if (this.level === 0 || this.rings.length === 0) return;
    ctx.save();
    for (const ring of this.rings) {
      const alpha = (ring.life / ring.maxLife) * 0.85;
      const col   = this.level === 5 ? '#b026ff' : '#00f0ff';
      ctx.globalAlpha = alpha;
      ctx.shadowBlur  = 20; ctx.shadowColor = col;
      ctx.strokeStyle = col;
      ctx.lineWidth   = this.level === 5 ? 4 : 2.5;
      ctx.beginPath();
      ctx.arc(ring.x - camera.x, ring.y - camera.y, ring.currentRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

// ============================================================
// 7c. 바이러스 체인
// ============================================================
class ChainWeapon extends BaseWeapon {
  constructor(owner) { super(owner); }
  update(dt) {
    this.timer += dt;
    const cds = [2200, 1900, 1900, 1600, 1200];
    const cd  = cds[Math.min(this.level - 1, cds.length - 1)];
    if (this.timer >= cd) { this.timer = 0; this.fire(); }
  }
  fire() {
    if (!player) return;
    let allT = [...enemies]; if (activeBoss) allT.push(activeBoss);
    if (allT.length === 0) return;
    let nearest = null, minD = Infinity;
    for (let e of allT) {
      const d = dist(this.owner.x, this.owner.y, e.x, e.y);
      if (d < minD) { minD = d; nearest = e; }
    }
    if (!nearest) return;
    const chainCounts = [2, 3, 3, 4, 5];
    const chains = chainCounts[Math.min(this.level - 1, chainCounts.length - 1)];
    const baseDmg = [28, 34, 42, 52, 65][Math.min(this.level - 1, 4)] * this.owner.damageMultiplier;
    const chainR  = this.level >= 3 ? 200 : 160;
    let hit = [nearest];
    for (let c = 1; c < chains; c++) {
      const last = hit[hit.length - 1];
      let next = null, nextD = Infinity;
      for (let e of allT) {
        if (hit.includes(e)) continue;
        const d = dist(last.x, last.y, e.x, e.y);
        if (d < chainR && d < nextD) { nextD = d; next = e; }
      }
      if (next) hit.push(next); else break;
    }
    playSynthSound([900, 1400, 600], 0.12, 'square', 0.05);
    for (let i = 0; i < hit.length; i++) {
      const e   = hit[i];
      const dmg = baseDmg * Math.pow(0.75, i);
      createExplosionParticles(e.x, e.y, '#00f0ff', 4);
      if (e === activeBoss) {
        activeBoss.takeDamage(dmg, 'chain');
      } else {
        if (e.takeDamage(dmg, 'chain')) {
          killCount++;
          // 진화: 뉴럴 바이러스 — 처치 시 주변 폭발
          if (this.level === 5) {
            const nearbyForChain = enemies.filter(en => en !== e && dist(e.x, e.y, en.x, en.y) < 130);
            for (let nb of nearbyForChain) {
              if (nb.takeDamage(dmg * 0.6, 'chain')) killCount++;
            }
            createExplosionParticles(e.x, e.y, '#00f0ff', 10);
          }
        }
      }
      if (i < hit.length - 1) {
        addFloatingText((e.x + hit[i+1].x)/2, (e.y + hit[i+1].y)/2 - 10, '⚡', '#00f0ff', 13);
      }
    }
    addFloatingText(nearest.x, nearest.y - nearest.radius - 12, `⚡×${hit.length}`, '#00f0ff', 10);
  }
}

// ============================================================
// 7d. 랜드마인 엔티티 및 무기
// ============================================================
class Mine {
  constructor(x, y, damage, explodeR, isEvoSub) {
    this.x = x; this.y = y;
    this.damage    = damage;
    this.explodeR  = explodeR;
    this.triggerR  = Math.max(22, explodeR * 0.38);
    this.isEvoSub  = isEvoSub; // 진화 산란 마인 여부
    this.life      = isEvoSub ? 6000 : 15000;
    this.armTimer  = 400;
    this.armed     = false;
    this.exploded  = false;
  }
  update(dt) {
    if (this.exploded) return;
    this.life -= dt;
    if (this.life <= 0) { this.exploded = true; return; }
    if (!this.armed) { this.armTimer -= dt; if (this.armTimer <= 0) this.armed = true; return; }
    let allT = [...enemies]; if (activeBoss) allT.push(activeBoss);
    for (let e of allT) {
      if (dist(this.x, this.y, e.x, e.y) < this.triggerR + e.radius) { this.explode(); return; }
    }
  }
  explode() {
    this.exploded = true;
    createExplosionParticles(this.x, this.y, '#ff8800', 20);
    triggerScreenShake(4, 250);
    playSynthSound([180, 80], 0.18, 'sawtooth', 0.08, true);
    for (const e of [...enemies]) {
      if (e && dist(this.x, this.y, e.x, e.y) < this.explodeR + e.radius) {
        if (e.takeDamage(this.damage, 'mine')) killCount++;
      }
    }
    if (activeBoss && dist(this.x, this.y, activeBoss.x, activeBoss.y) < this.explodeR + activeBoss.radius) {
      activeBoss.takeDamage(this.damage * 0.6, 'mine');
    }
    // 진화: 플라즈마 클러스터 — 소형 마인 3개 산란
    if (!this.isEvoSub) {
      const ownerWeapon = player && player.weapons.mine;
      if (ownerWeapon && ownerWeapon.level === 5) {
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 + Math.random();
          mines.push(new Mine(this.x + Math.cos(a)*35, this.y + Math.sin(a)*35,
            this.damage * 0.55, this.explodeR * 0.65, true));
        }
      }
    }
    addFloatingText(this.x, this.y - 20, '💥 MINE!', '#ff8800', 11);
  }
  draw(ctx, camera) {
    if (this.exploded) return;
    const sx = this.x - camera.x, sy = this.y - camera.y;
    const pulse = 0.65 + Math.sin(Date.now() / 180) * 0.35;
    ctx.save();
    ctx.globalAlpha = this.armed ? pulse : 0.4;
    ctx.shadowBlur  = this.armed ? 14 : 5;
    ctx.shadowColor = '#ff8800';
    ctx.fillStyle   = this.armed ? '#ff8800' : '#664400';
    ctx.beginPath(); ctx.arc(sx, sy, this.isEvoSub ? 5 : 7, 0, Math.PI * 2); ctx.fill();
    if (this.armed) {
      ctx.globalAlpha   = 0.18;
      ctx.strokeStyle   = '#ff8800';
      ctx.lineWidth     = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.arc(sx, sy, this.triggerR, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

class MineWeapon extends BaseWeapon {
  constructor(owner) { super(owner); this.placeTimer = 0; }
  update(dt) {
    this.timer += dt;
    const cds = [4000, 3500, 3000, 2800, 2400];
    const cd  = cds[Math.min(this.level - 1, cds.length - 1)];
    if (this.timer >= cd) { this.timer = 0; this.placeMines(); }
  }
  placeMines() {
    if (!player) return;
    const counts = [1, 2, 2, 3, 4];
    const count  = counts[Math.min(this.level - 1, counts.length - 1)];
    const dmgs   = [55, 70, 85, 105, 130];
    const dmg    = dmgs[Math.min(this.level - 1, dmgs.length - 1)] * this.owner.damageMultiplier;
    const radii  = [90, 100, 120, 130, 140];
    const explR  = radii[Math.min(this.level - 1, radii.length - 1)];
    for (let i = 0; i < count; i++) {
      const spread = count > 1 ? (i - (count-1)/2) * 24 : 0;
      mines.push(new Mine(this.owner.x + spread, this.owner.y + (Math.random()-0.5)*16, dmg, explR, false));
    }
    playSynthSound([400, 200], 0.08, 'triangle', 0.04);
  }
}

// ============================================================
// 7e. 블랙홀 엔티티 및 무기
// ============================================================
class BlackHole {
  constructor(x, y, pullR, dmg, lifetime, isEvolved) {
    this.x = x; this.y = y;
    this.pullR     = pullR;
    this.dmg       = dmg;
    this.lifetime  = lifetime;
    this.maxLife   = lifetime;
    this.isEvolved = isEvolved;
    this.dmgTimer  = 0;
    this.dmgInt    = 600;
    this.dead      = false;
  }
  update(dt) {
    if (this.dead) return;
    this.lifetime -= dt;
    this.dmgTimer  += dt;
    const pullStr = 2.8 * (dt / 16.66);
    let allT = [...enemies]; if (activeBoss) allT.push(activeBoss);
    for (let e of allT) {
      const dx = this.x - e.x, dy = this.y - e.y;
      const d  = Math.sqrt(dx*dx + dy*dy) || 1;
      if (d < this.pullR) {
        const force = (1 - d / this.pullR) * pullStr;
        e.x += (dx / d) * force;
        e.y += (dy / d) * force;
        if (this.dmgTimer >= this.dmgInt && d < this.pullR * 0.4) {
          if (e === activeBoss) {
            activeBoss.takeDamage(this.dmg * 0.4, 'blackhole');
          } else {
            if (e.takeDamage(this.dmg, 'blackhole')) killCount++;
          }
        }
      }
    }
    if (this.dmgTimer >= this.dmgInt) this.dmgTimer = 0;
    if (this.lifetime <= 0) this.collapse();
  }
  collapse() {
    this.dead = true;
    const collapseR = this.pullR * 0.55;
    const collapseDmg = this.isEvolved ? 9999 : this.dmg * 6;
    createExplosionParticles(this.x, this.y, '#b026ff', 32);
    createExplosionParticles(this.x, this.y, '#ffffff', 12);
    triggerScreenShake(12, 700);
    playSynthSound([55, 140, 380], 0.28, 'sawtooth', 0.12);
    for (const e of [...enemies]) {
      if (e && dist(this.x, this.y, e.x, e.y) < collapseR + e.radius) {
        if (e.takeDamage(collapseDmg, 'blackhole')) killCount++;
      }
    }
    if (activeBoss && dist(this.x, this.y, activeBoss.x, activeBoss.y) < collapseR + activeBoss.radius) {
      activeBoss.takeDamage(Math.min(collapseDmg, activeBoss.maxHp * 0.4), 'blackhole');
    }
    addFloatingText(this.x, this.y - 30, '🌑 붕괴!', '#b026ff', 13);
  }
  draw(ctx, camera) {
    if (this.dead) return;
    const sx = this.x - camera.x, sy = this.y - camera.y;
    const prog = this.lifetime / this.maxLife;
    const rot  = (Date.now() / 600) % (Math.PI * 2);
    ctx.save();
    // 인력 범위 링
    ctx.globalAlpha = 0.22 * prog;
    ctx.strokeStyle = '#b026ff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 8]);
    ctx.beginPath(); ctx.arc(sx, sy, this.pullR, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    // 회전 파티클
    ctx.globalAlpha = 0.7 * prog;
    for (let i = 0; i < 5; i++) {
      const a   = rot + i * (Math.PI * 2 / 5);
      const orb = this.pullR * 0.22;
      ctx.shadowBlur  = 10; ctx.shadowColor = i % 2 === 0 ? '#b026ff' : '#00f0ff';
      ctx.fillStyle   = i % 2 === 0 ? '#b026ff' : '#00f0ff';
      ctx.beginPath();
      ctx.arc(sx + Math.cos(a)*orb, sy + Math.sin(a)*orb, 3.5, 0, Math.PI*2);
      ctx.fill();
    }
    // 코어
    ctx.globalAlpha = 0.9 * prog;
    ctx.shadowBlur  = 22; ctx.shadowColor = '#b026ff';
    ctx.fillStyle   = '#0d001a';
    ctx.beginPath(); ctx.arc(sx, sy, 13, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#b026ff'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

class BlackHoleWeapon extends BaseWeapon {
  constructor(owner) { super(owner); }
  update(dt) {
    this.timer += dt;
    const cds = [8000, 7000, 6000, 5500, 4500];
    const cd  = cds[Math.min(this.level - 1, cds.length - 1)];
    if (this.timer >= cd) { this.timer = 0; this.summon(); }
  }
  summon() {
    if (!player) return;
    const counts  = [1, 1, 1, 2, 2];
    const count   = this.level === 5 ? 2 : counts[Math.min(this.level - 1, counts.length - 1)];
    const radii   = [160, 190, 200, 210, 230];
    const pullR   = radii[Math.min(this.level - 1, radii.length - 1)];
    const dmgs    = [18, 22, 28, 34, 42];
    const dmg     = dmgs[Math.min(this.level - 1, dmgs.length - 1)] * this.owner.damageMultiplier;
    const lives   = [3500, 4000, 4500, 5000, 5500];
    const life    = lives[Math.min(this.level - 1, lives.length - 1)];
    const isEvo   = this.level === 5;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r   = 120 + Math.random() * 100;
      blackHoles.push(new BlackHole(
        this.owner.x + Math.cos(ang) * r,
        this.owner.y + Math.sin(ang) * r,
        pullR, dmg, life, isEvo
      ));
    }
    playSynthSound([60, 30], 0.22, 'sawtooth', 0.1);
    triggerScreenShake(5, 300);
    addFloatingText(this.owner.x, this.owner.y - 30, '🌑 블랙홀 생성!', '#b026ff', 11);
  }
}

// ============================================================
// 8. 투사체 및 레이저
// ============================================================
class Projectile {
  constructor(x, y, vx, vy, damage, radius, color, pierce = 1, weaponKey = '') {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.damage = damage; this.radius = radius; this.color = color;
    this.pierce = pierce; this.weaponKey = weaponKey;
    this.life = 3500;
    this.hitEnemies = new Set();
  }
  update(dt) { this.x += this.vx * (dt / 16.66); this.y += this.vy * (dt / 16.66); this.life -= dt; }
  draw(ctx, camera) {
    ctx.save();
    ctx.shadowBlur = 8; ctx.shadowColor = this.color; ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x - camera.x, this.y - camera.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class BoomerangProjectile extends Projectile {
  constructor(x, y, vx, vy, damage, color, owner) {
    super(x, y, vx, vy, damage, 8, color, 15, 'boomerang');
    this.owner       = owner;
    this.returning   = false;
    this.travelTime  = 0;
    this.returnDelay = 550;
    this.life        = 3000;
  }
  update(dt) {
    this.travelTime += dt;
    if (!this.returning && this.travelTime >= this.returnDelay) {
      this.returning = true;
      this.hitEnemies.clear();
      this.pierce = 15;
    }
    if (this.returning) {
      const dx = this.owner.x - this.x;
      const dy = this.owner.y - this.y;
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d < 22) { this.life = 0; return; }
      this.vx = (dx / d) * 11;
      this.vy = (dy / d) * 11;
    }
    this.x += this.vx * (dt / 16.66);
    this.y += this.vy * (dt / 16.66);
    this.life -= dt;
  }
  draw(ctx, camera) {
    const sx = this.x - camera.x, sy = this.y - camera.y;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(this.travelTime * 0.025);
    ctx.shadowBlur = 14; ctx.shadowColor = this.color;
    ctx.strokeStyle = this.color; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0.35, Math.PI * 2 - 0.35);
    ctx.stroke();
    ctx.strokeStyle = this.color + '66';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0.6, Math.PI * 2 - 0.6);
    ctx.stroke();
    ctx.restore();
  }
}

// 미사일 투사체 — 유도 + 폭발
class MissileProjectile extends Projectile {
  constructor(x, y, vx, vy, damage, radius, color, weaponKey, isEvo) {
    super(x, y, vx, vy, damage, radius, color, 1, weaponKey);
    this.speed   = Math.sqrt(vx*vx + vy*vy);
    this.life    = 4500;
    this.isEvo   = isEvo;
    this.trail   = [];
  }
  update(dt) {
    // 가장 가까운 적 추적
    let allT = [...enemies]; if (activeBoss) allT.push(activeBoss);
    let target = null, minD = Infinity;
    for (let e of allT) {
      const d = dist(this.x, this.y, e.x, e.y);
      if (d < minD) { minD = d; target = e; }
    }
    if (target) {
      const dx = target.x - this.x, dy = target.y - this.y;
      const d  = Math.sqrt(dx*dx + dy*dy) || 1;
      const tx = (dx / d) * this.speed;
      const ty = (dy / d) * this.speed;
      const steer = this.isEvo ? 0.06 : 0.04;
      this.vx += (tx - this.vx) * steer * (dt / 16.66);
      this.vy += (ty - this.vy) * steer * (dt / 16.66);
    }
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 8) this.trail.shift();
    this.x += this.vx * (dt / 16.66);
    this.y += this.vy * (dt / 16.66);
    this.life -= dt;
  }
  draw(ctx, camera) {
    ctx.save();
    // 잔상 트레일
    for (let i = 0; i < this.trail.length; i++) {
      const a = (i / this.trail.length) * 0.4;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ff8800';
      ctx.beginPath();
      ctx.arc(this.trail[i].x - camera.x, this.trail[i].y - camera.y, this.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 18; ctx.shadowColor = this.color;
    ctx.fillStyle  = this.color;
    ctx.beginPath();
    ctx.arc(this.x - camera.x, this.y - camera.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  explode() {
    const expR  = this.isEvo ? 90 : 60;
    const expDmg = this.damage * 0.7;
    createExplosionParticles(this.x, this.y, '#ff8800', this.isEvo ? 20 : 12);
    triggerScreenShake(this.isEvo ? 5 : 3, 200);
    let allT = [...enemies]; if (activeBoss) allT.push(activeBoss);
    for (let e of allT) {
      if (dist(this.x, this.y, e.x, e.y) < expR + e.radius) {
        const killed = e === activeBoss
          ? activeBoss.takeDamage(expDmg, 'missile')
          : e.takeDamage(expDmg, 'missile');
        if (killed && e !== activeBoss) killCount++;
      }
    }
    this.life = 0;
  }
}

let activeLasersArr = [];

function createLaserBeam(px, py, angle, width, damage, duration) {
  let dx = Math.cos(angle), dy = Math.sin(angle);
  let length = 2000;
  const laser = { startX: px, startY: py, endX: px + dx*length, endY: py + dy*length, width, damage, maxLife: duration, life: duration };
  activeLasersArr.push(laser);
  let allTargets = [...enemies];
  if (activeBoss) allTargets.push(activeBoss);
  for (let e of allTargets) {
    if (distToSegment(e.x, e.y, px, py, laser.endX, laser.endY) < e.radius + width / 2) {
      if (e.takeDamage(damage, 'laser')) killCount++;
    }
  }
}

function updateAndDrawLasers(ctx, camera, dt) {
  ctx.save();
  for (let i = activeLasersArr.length - 1; i >= 0; i--) {
    let l = activeLasersArr[i];
    l.life -= dt;
    let pct = l.life / l.maxLife;
    ctx.shadowBlur = 20; ctx.shadowColor = '#ffe600';
    ctx.strokeStyle = `rgba(255,230,0,${pct})`; ctx.lineWidth = l.width * pct;
    ctx.beginPath(); ctx.moveTo(l.startX - camera.x, l.startY - camera.y);
    ctx.lineTo(l.endX - camera.x, l.endY - camera.y); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${pct * 0.9})`; ctx.lineWidth = l.width * pct * 0.35;
    ctx.beginPath(); ctx.moveTo(l.startX - camera.x, l.startY - camera.y);
    ctx.lineTo(l.endX - camera.x, l.endY - camera.y); ctx.stroke();
    if (l.life <= 0) activeLasersArr.splice(i, 1);
  }
  ctx.restore();
}

// ============================================================
// 9. 적 클래스 (일반 Enemy + Boss)
// ============================================================
function getEnemyStageScale() {
  const diff = DIFFICULTY_SETTINGS[gameDifficulty] || DIFFICULTY_SETTINGS.normal;
  const asc  = getAscensionScale();
  return {
    hpMult:    (1 + (currentStage - 1) * 0.18) * diff.enemyHpMult * asc,
    dmgMult:   (1 + (currentStage - 1) * 0.10) * diff.enemyHpMult,
    speedMult: (1 + (currentStage - 1) * 0.025) * diff.enemySpeedMult
  };
}

class Enemy {
  constructor(x, y, type) {
    this.x = x; this.y = y; this.type = type;
    this.speedMultiplier = 1.0;
    this.stunTimer = 0;
    this.stormDX = 0; this.stormDY = 0; this.stormTimer = 0;
    switch (type) {
      case 'swarm':
        this.radius = 12; this.color = '#00ff66'; this.baseSpeed = 1.6;
        this.hp = 12; this.maxHp = 12; this.damage = 6; this.xpValue = 1; break;
      case 'rusher':
        this.radius = 10; this.color = '#ffe600'; this.baseSpeed = 2.8;
        this.hp = 6;  this.maxHp = 6;  this.damage = 10; this.xpValue = 2; break;
      case 'bruiser':
        this.radius = 22; this.color = '#ff007f'; this.baseSpeed = 0.9;
        this.hp = 85; this.maxHp = 85; this.damage = 18; this.xpValue = 6; break;
      case 'elite':
        this.radius = 18; this.color = '#ff6600'; this.baseSpeed = 2.1;
        this.hp = 140; this.maxHp = 140; this.damage = 20; this.xpValue = 12;
        this.isElite = true;
        this.eliteName = ELITE_NAMES[Math.floor(Math.random() * ELITE_NAMES.length)];
        break;
    }
    // 스테이지 스케일링 적용
    let s = getEnemyStageScale();
    this.hp      = Math.floor(this.hp    * s.hpMult);
    this.maxHp   = this.hp;
    this.damage  = Math.ceil(this.damage * s.dmgMult);
    this.baseSpeed *= s.speedMult;
    this.speed   = this.baseSpeed;
    this.flashTimer = 0;
  }

  update(dt) {
    if (!player) return;
    // 스턴 처리
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      this.flashTimer = 60;
      return;
    }
    // 데이터 폭풍: 불규칙 이동
    if (activeFieldEvent?.id === 'data_storm') {
      this.stormTimer -= dt;
      if (this.stormTimer <= 0) {
        const a = Math.random() * Math.PI * 2;
        this.stormDX = Math.cos(a); this.stormDY = Math.sin(a);
        this.stormTimer = 600 + Math.random() * 800;
      }
      let spd = this.baseSpeed * 1.1 * this.speedMultiplier;
      this.x += this.stormDX * spd * (dt / 16.66);
      this.y += this.stormDY * spd * (dt / 16.66);
      this.speedMultiplier = 1.0;
      if (this.flashTimer > 0) this.flashTimer -= dt;
      return;
    }
    let dx, dy;
    // 팬텀 시프트 이벤트: 적 AI 오작동 — 랜덤 방향으로 이동
    if (activeFieldEvent?.id === 'phantom_shift') {
      if (!this._phantomAngle) this._phantomAngle = Math.random() * Math.PI * 2;
      this._phantomAngle += (Math.random() - 0.5) * 0.15;
      dx = Math.cos(this._phantomAngle);
      dy = Math.sin(this._phantomAngle);
    } else {
      dx = player.x - this.x; dy = player.y - this.y;
      let d = Math.sqrt(dx*dx + dy*dy);
      if (d > 0) { dx /= d; dy /= d; }
    }
    let spd = this.baseSpeed * this.speedMultiplier;
    // 바이러스 광란 이벤트
    if (activeFieldEvent?.id === 'virus_frenzy') spd *= 1.7;
    // 엘리트 침공 이벤트: 20% 속도 증가
    if (activeFieldEvent?.id === 'elite_invasion') spd *= 1.2;
    // 프리즈 존: 적 속도 -60%
    if (activeFieldEvent?.id === 'freeze_zone') spd *= 0.4;
    this.x += dx * spd * (dt / 16.66);
    this.y += dy * spd * (dt / 16.66);
    this.speedMultiplier = 1.0;
    if (this.flashTimer > 0) this.flashTimer -= dt;
  }

  draw(ctx, camera) {
    const bx = this.x - camera.x, by = this.y - camera.y;
    const r  = this.radius;
    const t  = this.type;
    const fl = this.flashTimer > 0;
    const col = fl ? '#ffffff' : this.color;

    ctx.save();

    if (t === 'swarm') {
      // 육각형 (shadowBlur 없음 — 성능)
      ctx.fillStyle = col;
      ctx.strokeStyle = fl ? '#ffffff' : '#39ff14';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i/6)*Math.PI*2 - Math.PI/6;
        i === 0 ? ctx.moveTo(bx+Math.cos(a)*r, by+Math.sin(a)*r)
                : ctx.lineTo(bx+Math.cos(a)*r, by+Math.sin(a)*r);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      if (this.hp < this.maxHp && this.hp > 0) {
        const bw=r*1.6, bh=2;
        ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(bx-bw/2, by-r-6, bw, bh);
        ctx.fillStyle='#00ff66';          ctx.fillRect(bx-bw/2, by-r-6, bw*(this.hp/this.maxHp), bh);
      }
    } else if (t === 'rusher') {
      // 뾰족 삼각형
      ctx.shadowBlur=8; ctx.shadowColor=col;
      ctx.fillStyle=col; ctx.strokeStyle='#ffffff'; ctx.lineWidth=1;
      ctx.beginPath();
      ctx.moveTo(bx,    by-r*1.3);
      ctx.lineTo(bx-r,  by+r*0.8);
      ctx.lineTo(bx+r,  by+r*0.8);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.shadowBlur=4; ctx.fillStyle='#ffffff';
      ctx.beginPath(); ctx.arc(bx, by+r*0.1, r*0.22, 0, Math.PI*2); ctx.fill();
    } else if (t === 'bruiser') {
      // 팔각형 + 스파이크
      ctx.shadowBlur=14; ctx.shadowColor=col;
      ctx.fillStyle=col; ctx.strokeStyle='#ffffff'; ctx.lineWidth=1.5;
      ctx.beginPath();
      for (let i=0;i<8;i++){
        const a=(i/8)*Math.PI*2-Math.PI/8;
        i===0?ctx.moveTo(bx+Math.cos(a)*r, by+Math.sin(a)*r)
             :ctx.lineTo(bx+Math.cos(a)*r, by+Math.sin(a)*r);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle=col; ctx.lineWidth=2;
      for(let i=0;i<4;i++){
        const a=(i/4)*Math.PI*2;
        ctx.beginPath();
        ctx.moveTo(bx+Math.cos(a)*r, by+Math.sin(a)*r);
        ctx.lineTo(bx+Math.cos(a)*(r+8), by+Math.sin(a)*(r+8));
        ctx.stroke();
      }
      if (this.hp < this.maxHp) {
        const bw=r*1.6, bh=3;
        ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(bx-bw/2, by-r-8, bw, bh);
        ctx.fillStyle='#ff007f';         ctx.fillRect(bx-bw/2, by-r-8, bw*(this.hp/this.maxHp), bh);
      }
    } else {
      // elite: 다이아몬드 + 점선 링
      ctx.shadowBlur=20; ctx.shadowColor='#ff6600';
      ctx.fillStyle=fl?'#ffffff':'#ff6600'; ctx.strokeStyle='#ffaa00'; ctx.lineWidth=2;
      ctx.beginPath();
      ctx.moveTo(bx,    by-r*1.35);
      ctx.lineTo(bx+r,  by);
      ctx.lineTo(bx,    by+r*1.35);
      ctx.lineTo(bx-r,  by);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle='rgba(255,102,0,0.45)'; ctx.lineWidth=1; ctx.setLineDash([3,3]);
      ctx.beginPath(); ctx.arc(bx, by, r+7, 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font='bold 7px Orbitron,monospace'; ctx.fillStyle='#ffaa00';
      ctx.textAlign='center'; ctx.shadowBlur=4;
      ctx.fillText(this.eliteName||'ELITE', bx, by-r-13);
      if (this.hp < this.maxHp) {
        const bw=r*1.6, bh=3;
        ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(bx-bw/2, by-r-8, bw, bh);
        ctx.fillStyle='#ff6600';         ctx.fillRect(bx-bw/2, by-r-8, bw*(this.hp/this.maxHp), bh);
      }
    }

    ctx.restore();
  }

  takeDamage(amount, sourceKey) {
    // 크리티컬 코어 패시브 + 메타 크리티컬 보너스
    const _hasCrit = player && (player.passives.critical > 0 || (player.critBonus || 0) > 0);
    if (_hasCrit && sourceKey !== 'thorns' && sourceKey !== 'boss_proj') {
      const baseChance = player.passives.critical === 2 ? 0.25 : (player.passives.critical === 1 ? 0.15 : 0);
      const chance = Math.min(0.70, baseChance + (player.critBonus || 0));
      const mult   = player.passives.critical === 2 ? 3.0  : 2.5;
      if (Math.random() < chance) {
        amount *= mult;
        addFloatingText(this.x, this.y - this.radius - 8, '💥CRIT!', '#ffe600', 13);
      }
    }
    // 코어 과부하 이벤트: 플레이어 공격력 3배
    if (activeFieldEvent?.id === 'core_overload' && sourceKey !== 'thorns' && sourceKey !== 'boss_proj') {
      amount *= 3;
    }
    this.hp -= amount;
    this.flashTimer = 80;
    if (weaponStats[sourceKey]) weaponStats[sourceKey].damage += amount;
    createExplosionParticles(this.x, this.y, this.color, 3);
    if (Math.random() < 0.25) {
      addFloatingText(this.x + (Math.random()-0.5)*20, this.y - this.radius, Math.floor(amount).toString(), '#ffffff', 11);
    }
    if (this.hp <= 0) { this.die(sourceKey); return true; }
    return false;
  }

  die(sourceKey) {
    if (this.dead) return;
    this.dead = true;
    createExplosionParticles(this.x, this.y, this.color, this.isElite ? 20 : 12);
    playEnemyExplosionSound();
    if (weaponStats[sourceKey]) weaponStats[sourceKey].kills++;

    // 폭발 연쇄 패시브
    if (player && player.passives.explosive > 0) {
      const chance = player.passives.explosive === 2 ? 0.5 : 0.3;
      const radius = player.passives.explosive === 2 ? 160 : 120;
      const dmg    = player.passives.explosive === 2 ? 60  : 40;
      if (Math.random() < chance) {
        createExplosionParticles(this.x, this.y, '#ff8800', 14);
        // 스냅샷으로 이터레이션 중 배열 변경 방지
        const nearby = enemies.filter(e => e !== this && dist(this.x, this.y, e.x, e.y) < radius);
        for (let e of nearby) {
          if (e.takeDamage(dmg, 'explosive')) killCount++;
        }
        if (activeBoss && dist(this.x, this.y, activeBoss.x, activeBoss.y) < radius)
          activeBoss.takeDamage(dmg, 'explosive');
      }
    }

    // 리듬 비트 시스템: 비트 윈도우 안에 처치하면 XP 보너스
    if (beatWindowActive) {
      beatChain++;
      beatChainTimer = BEAT_CHAIN_DECAY;
      const beatMult = Math.min(1.0 + beatChain * 0.25, 4.0);
      gems.push(new Gem(this.x, this.y, Math.ceil(this.xpValue * beatMult)));
      addFloatingText(this.x, this.y - this.radius - 14,
        `♪ BEAT! x${beatMult.toFixed(1)}`, '#ffe600', beatChain >= 5 ? 15 : 12);
      createBeatParticles(this.x, this.y);
    } else {
      gems.push(new Gem(this.x, this.y, this.xpValue));
    }

    // 스테이지 킬 진행
    stageKillProgress++;
    onEnemyKilled();
    checkStageProgress();

    // 필드 아이템 드롭 (elite 20%, bruiser 12%, rusher 4%, swarm 2%)
    let dropChance = this.isElite ? 0.20 : this.type === 'bruiser' ? 0.12 : this.type === 'rusher' ? 0.04 : 0.02;
    if (Math.random() < dropChance && fieldItems.length < 8) {
      let dropTypes = ['health', 'health', 'magnet', 'surge'];
      let dropType  = dropTypes[Math.floor(Math.random() * dropTypes.length)];
      fieldItems.push(new FieldItem(this.x, this.y, dropType));
    }

    // 골드 드롭 (골든 러쉬 이벤트 중엔 3배 + 항상 드롭)
    let goldMult = activeFieldEvent?.id === 'golden_rush' ? 3 : 1;
    let goldAmt = 0;
    if (this.isElite) goldAmt = 4 + Math.floor(Math.random() * 4);
    else if (this.type === 'bruiser') goldAmt = 2 + Math.floor(Math.random() * 3);
    else if (activeFieldEvent?.id === 'golden_rush') goldAmt = 1;
    else if (this.type === 'rusher'  && Math.random() < 0.4) goldAmt = 1 + (Math.random() < 0.3 ? 1 : 0);
    else if (this.type === 'swarm'   && Math.random() < 0.2) goldAmt = 1;
    if (goldAmt > 0) spawnGoldCoins(this.x, this.y, Math.ceil(goldAmt * goldMult));

    let idx = enemies.indexOf(this);
    if (idx !== -1) enemies.splice(idx, 1);
  }
}

// ============================================================
// 10. 보스 클래스
// ============================================================
// 보스 타입 팔레트 (인덱스 % 4 순환)
const BOSS_TYPES = [
  { id: 'berserker', label: 'BERSERKER', outerColor: '#ff0044', innerColor: '#ff4466', glowColor: '#ff0044' },
  { id: 'sharpshooter', label: 'SNIPER',  outerColor: '#00f0ff', innerColor: '#00aaff', glowColor: '#00f0ff' },
  { id: 'summoner',  label: 'SUMMONER',  outerColor: '#b026ff', innerColor: '#cc66ff', glowColor: '#b026ff' },
  { id: 'titan',     label: 'TITAN',     outerColor: '#ffe600', innerColor: '#ffaa00', glowColor: '#ff8800' },
];

// ============================================================
// 장애물 시스템
// ============================================================
class FirewallWall {
  constructor(x1, y1, x2, y2) {
    this.x1 = x1; this.y1 = y1; this.x2 = x2; this.y2 = y2;
    this.type = 'firewall'; this.color = '#00f0ff';
    this.pulseT = Math.random() * Math.PI * 2; this.dead = false;
  }
  update(dt) { this.pulseT += dt * 0.003; }
  draw(ctx, camera) {
    const sx1 = this.x1 - camera.x, sy1 = this.y1 - camera.y;
    const sx2 = this.x2 - camera.x, sy2 = this.y2 - camera.y;
    const pulse = 0.6 + Math.sin(this.pulseT) * 0.3;
    ctx.save();
    ctx.shadowBlur = 10; ctx.shadowColor = this.color;
    ctx.strokeStyle = this.color; ctx.lineWidth = 3; ctx.globalAlpha = pulse;
    ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(sx2, sy2); ctx.stroke();
    ctx.lineWidth = 1; ctx.globalAlpha = pulse * 0.4;
    const dx = sx2-sx1, dy = sy2-sy1, len = Math.sqrt(dx*dx+dy*dy);
    const nx = -dy/len*6, ny = dx/len*6;
    const segs = Math.max(2, Math.floor(len / 40));
    for (let i = 0; i <= segs; i++) {
      const t = i/segs, mx = sx1+dx*t, my = sy1+dy*t;
      ctx.beginPath(); ctx.moveTo(mx-nx, my-ny); ctx.lineTo(mx+nx, my+ny); ctx.stroke();
    }
    ctx.restore();
  }
  collidesWithCircle(cx, cy, cr) {
    const dx = this.x2-this.x1, dy = this.y2-this.y1, lenSq = dx*dx+dy*dy;
    if (lenSq === 0) return false;
    let t = Math.max(0, Math.min(1, ((cx-this.x1)*dx+(cy-this.y1)*dy)/lenSq));
    return Math.sqrt((cx-this.x1-t*dx)**2+(cy-this.y1-t*dy)**2) < cr + 4;
  }
  pushOutVector(cx, cy, cr) {
    const dx = this.x2-this.x1, dy = this.y2-this.y1, lenSq = dx*dx+dy*dy;
    if (lenSq === 0) return {x:0,y:0};
    let t = Math.max(0, Math.min(1, ((cx-this.x1)*dx+(cy-this.y1)*dy)/lenSq));
    const nearX = this.x1+t*dx, nearY = this.y1+t*dy;
    let pvx = cx-nearX, pvy = cy-nearY;
    const d = Math.sqrt(pvx*pvx+pvy*pvy);
    if (d === 0) { pvx = -dy/Math.sqrt(lenSq); pvy = dx/Math.sqrt(lenSq); return {x:pvx*(cr+5),y:pvy*(cr+5)}; }
    return { x: pvx/d*(cr+5-d), y: pvy/d*(cr+5-d) };
  }
}

class ElectricZone {
  constructor(x, y, radius) {
    this.x = x; this.y = y; this.radius = radius;
    this.type = 'electric'; this.color = '#ffe600';
    this.on = true; this.timer = 0;
    this.ON_DUR  = 2200 + Math.random() * 800;
    this.OFF_DUR = 900  + Math.random() * 400;
    this.dmgTimer = 0; this.dead = false;
  }
  update(dt) {
    this.timer += dt;
    if (this.timer >= (this.on ? this.ON_DUR : this.OFF_DUR)) { this.timer = 0; this.on = !this.on; }
    if (this.on && player) {
      const dx = player.x-this.x, dy = player.y-this.y;
      if (Math.sqrt(dx*dx+dy*dy) < this.radius + player.radius) {
        this.dmgTimer += dt;
        if (this.dmgTimer >= 400) {
          this.dmgTimer = 0;
          player.hp -= 4; player.flashTimer = 60;
          if (player.hp <= 0) endGame(false);
          addFloatingText(player.x, player.y-20, '-4 ⚡', '#ffe600', 11);
        }
      } else { this.dmgTimer = 0; }
    }
  }
  draw(ctx, camera) {
    if (!this.on && this.timer > this.OFF_DUR * 0.7) return;
    const sx = this.x-camera.x, sy = this.y-camera.y;
    const alpha = this.on ? (0.18+Math.sin(Date.now()*0.008)*0.08) : 0.05+(1-this.timer/this.OFF_DUR)*0.08;
    ctx.save();
    ctx.shadowBlur = this.on ? 18 : 4; ctx.shadowColor = this.color;
    ctx.strokeStyle = this.color; ctx.lineWidth = 2; ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(sx, sy, this.radius, 0, Math.PI*2); ctx.stroke();
    if (this.on) {
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const a = (i/6)*Math.PI*2+Date.now()*0.002;
        ctx.beginPath();
        ctx.moveTo(sx+Math.cos(a)*this.radius*0.6, sy+Math.sin(a)*this.radius*0.6);
        ctx.lineTo(sx+Math.cos(a)*this.radius, sy+Math.sin(a)*this.radius);
        ctx.stroke();
      }
    }
    ctx.font = 'bold 8px Orbitron,monospace'; ctx.fillStyle = this.color;
    ctx.textAlign = 'center'; ctx.globalAlpha = alpha*1.5;
    ctx.fillText(this.on ? '⚡ ELECTRIC' : '[ OFF ]', sx, sy);
    ctx.restore();
  }
}

class VirusPool {
  constructor(x, y, radius) {
    this.x = x; this.y = y; this.radius = radius;
    this.type = 'pool'; this.color = '#39ff14';
    this.pulseT = Math.random()*Math.PI*2; this.dmgTimer = 0; this.dead = false;
  }
  update(dt) {
    this.pulseT += dt*0.002;
    const r = this.radius+Math.sin(this.pulseT)*8;
    if (player) {
      const dx = player.x-this.x, dy = player.y-this.y;
      if (Math.sqrt(dx*dx+dy*dy) < r+player.radius) {
        player._inVirusPool = true;
        this.dmgTimer += dt;
        if (this.dmgTimer >= 600) {
          this.dmgTimer = 0;
          player.hp -= 3; player.flashTimer = 40;
          if (player.hp <= 0) endGame(false);
          addFloatingText(player.x, player.y-20, '-3 ☣', '#39ff14', 10);
        }
      }
    }
  }
  draw(ctx, camera) {
    const sx = this.x-camera.x, sy = this.y-camera.y;
    const r  = this.radius+Math.sin(this.pulseT)*8;
    ctx.save();
    ctx.shadowBlur = 8; ctx.shadowColor = this.color;
    ctx.globalAlpha = 0.12+Math.sin(this.pulseT)*0.04;
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 0.4; ctx.strokeStyle = this.color; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = 0.15; ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const a = (i/4)*Math.PI*2+this.pulseT;
      ctx.beginPath(); ctx.moveTo(sx, sy);
      ctx.lineTo(sx+Math.cos(a)*r*0.7, sy+Math.sin(a)*r*0.7); ctx.stroke();
    }
    ctx.globalAlpha = 0.45; ctx.font = 'bold 7px Orbitron,monospace';
    ctx.fillStyle = this.color; ctx.textAlign = 'center';
    ctx.fillText('☣ POOL', sx, sy);
    ctx.restore();
  }
}

class Boss {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.type   = 'boss';
    this.speedMultiplier = 1.0;
    this.flashTimer = 0;
    this.pulseTimer = 0;
    this.stunTimer  = 0;
    this.shieldActive = false;
    this.shieldTimer  = 0;

    let bossIdx = Math.max(0, Math.floor(currentStage / 10) - 1);
    this.isFinalBoss = (currentStage === 100);

    // 반경: 스테이지 높을수록 조금씩 성장
    this.radius = this.isFinalBoss ? 90 : Math.min(50 + bossIdx * 2, 70);

    let scale   = 1 + bossIdx * 0.65;
    // 최종 보스: HP 2.5배 추가
    this.maxHp  = Math.floor(450 * scale * (this.isFinalBoss ? 2.5 : 1));
    this.hp     = this.maxHp;
    this.damage = Math.floor(22 * (1 + bossIdx * 0.25));
    this.xpValue = 40 + bossIdx * 15;
    this.baseSpeed = this.isFinalBoss ? 1.6 : 1.3;
    this.name   = BOSS_NAMES[Math.min(bossIdx, BOSS_NAMES.length - 1)];
    this.phase  = 1;
    this.bossIdx = bossIdx;
    // 최종 보스는 TITAN 패턴 기반 (유도탄 + 전 패턴 동시 활성)
    this.patternType = this.isFinalBoss
      ? { id: 'final', label: 'FINAL PROTOCOL', outerColor: '#ffe600', innerColor: '#ff0044', glowColor: '#ffffff' }
      : BOSS_TYPES[bossIdx % 4];

    // 공격성 스케일: bossIdx 높을수록 쿨다운 최대 60% 단축
    const ag = Math.max(0.4, 1.0 - bossIdx * 0.06);

    // 돌진 공격
    this.chargeTimer    = 0;
    this.chargeCooldown = Math.round((this.isFinalBoss ? 2500 : (this.patternType.id === 'berserker' ? 3500 : 4500)) * ag);
    this.isCharging     = false;
    this.chargeVx = 0; this.chargeVy = 0;
    this.chargeDuration = 0;
    this.pendingCharges = 0;

    // 미니언 소환
    this.minionTimer    = 0;
    this.minionCooldown = Math.round((this.isFinalBoss ? 4000 : (this.patternType.id === 'summoner' ? 5000 : 8000)) * ag);

    // 궤도 사격
    this.orbShotTimer    = 0;
    this.orbShotCooldown = Math.round((this.isFinalBoss ? 3500 : 5000) * ag);

    // 유도탄
    this.homingTimer    = 0;
    this.homingCooldown = Math.round((this.isFinalBoss ? 4000 : 6000) * ag);

    // 방어막 (summoner + 최종 보스)
    this.shieldCooldown = Math.round((this.isFinalBoss ? 10000 : 14000) * ag);
    this.shieldCDTimer  = 0;

    // 최종 보스 전용: 엘리트 파동
    this.eliteWaveTimer    = 0;
    this.eliteWaveCooldown = 8000;
  }

  update(dt) {
    this.pulseTimer += dt;
    this.speedMultiplier = 1.0;
    if (this.flashTimer > 0) this.flashTimer -= dt;

    // 스턴 처리
    if (this.stunTimer > 0) { this.stunTimer -= dt; return; }

    // 방어막 처리
    if (this.shieldActive) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) {
        this.shieldActive = false;
        addFloatingText(this.x, this.y - 70, '🛡 방어막 해제!', '#b026ff', 13);
      }
      // 방어막 중에도 이동은 함
    }

    // 페이즈 2 전환 (HP 50% 이하, 미니보스 제외)
    if (!this.isMini && this.phase === 1 && this.hp <= this.maxHp * 0.5) {
      this.phase = 2;
      this.baseSpeed    *= 1.5;
      this.chargeCooldown = this.patternType.id === 'berserker' ? 2000 : 2500;
      this.minionCooldown = this.patternType.id === 'summoner'  ? 3000 : 5000;
      this.orbShotCooldown = 3500;
      this.homingCooldown  = 4000;
      createExplosionParticles(this.x, this.y, this.patternType.outerColor, 25);
      triggerScreenShake(8, 500);
      addFloatingText(this.x, this.y - 70, 'PHASE 2!', '#ff6600', 18);
      playSynthSound([80, 200], 0.5, 'sawtooth', 0.12);
    }

    // 페이즈 3 전환 (HP 25% 이하, bossIdx >= 2 또는 최종 보스, 미니보스 제외)
    if (!this.isMini && this.phase === 2 && (this.bossIdx >= 2 || this.isFinalBoss) && this.hp <= this.maxHp * 0.25) {
      this.phase = 3;
      this.baseSpeed    *= 1.3;
      this.chargeCooldown  = 1800;
      this.minionCooldown  = 2500;
      this.orbShotCooldown = 2500;
      this.homingCooldown  = 2500;
      createExplosionParticles(this.x, this.y, '#ffffff', 35);
      triggerScreenShake(14, 800);
      addFloatingText(this.x, this.y - 70, '⚠ PHASE 3!', '#ffffff', 20);
      playSynthSound([60, 120, 240], 0.6, 'sawtooth', 0.14);
    }

    if (this.isCharging) {
      this.x += this.chargeVx * (dt / 16.66);
      this.y += this.chargeVy * (dt / 16.66);
      this.chargeDuration -= dt;
      if (this.chargeDuration <= 0) {
        this.isCharging = false;
        const baseSpd = this.phase === 3 ? 2.5 : this.phase === 2 ? 1.95 : 1.3;
        this.baseSpeed = baseSpd;
        // 베르세르커: 연속 돌진
        if (this.patternType.id === 'berserker' && this.pendingCharges > 0) {
          this.pendingCharges--;
          setTimeout(() => { if (activeBoss === this) this.startCharge(false); }, 200);
        }
      }
    } else {
      if (player) {
        let dx = player.x - this.x, dy = player.y - this.y;
        let d  = Math.sqrt(dx*dx + dy*dy);
        if (d > 0) { dx /= d; dy /= d; }
        let spd = this.baseSpeed * this.speedMultiplier;
        this.x += dx * spd * (dt / 16.66);
        this.y += dy * spd * (dt / 16.66);
      }
    }

    this.chargeTimer += dt;
    if (this.chargeTimer >= this.chargeCooldown && player) {
      this.chargeTimer = 0;
      this.startCharge(true);
    }

    this.minionTimer += dt;
    if (this.minionTimer >= this.minionCooldown) {
      this.minionTimer = 0;
      this.spawnMinions();
    }

    // 궤도 사격 (sharpshooter + 페이즈2 이상 + bossIdx 3 이상 + 최종 보스)
    if (this.patternType.id === 'sharpshooter' || this.phase >= 2 || this.bossIdx >= 3 || this.isFinalBoss) {
      this.orbShotTimer += dt;
      if (this.orbShotTimer >= this.orbShotCooldown) {
        this.orbShotTimer = 0;
        this.orbitalShot();
      }
    }

    // 유도탄 (titan + 페이즈3 + bossIdx 5 이상 + 최종 보스)
    if (this.patternType.id === 'titan' || this.phase >= 3 || this.bossIdx >= 5 || this.isFinalBoss) {
      this.homingTimer += dt;
      if (this.homingTimer >= this.homingCooldown) {
        this.homingTimer = 0;
        this.homingShot();
      }
    }

    // 방어막 쿨다운 (summoner + 최종 보스)
    if ((this.patternType.id === 'summoner' || this.isFinalBoss) && !this.shieldActive) {
      this.shieldCDTimer += dt;
      if (this.shieldCDTimer >= this.shieldCooldown) {
        this.shieldCDTimer = 0;
        this.activateShield();
      }
    }

    // 최종 보스 전용: 엘리트 파동
    if (this.isFinalBoss) {
      this.eliteWaveTimer += dt;
      if (this.eliteWaveTimer >= this.eliteWaveCooldown) {
        this.eliteWaveTimer = 0;
        this.spawnEliteWave();
      }
    }
  }

  startCharge(isNew) {
    if (!player) return;
    let dx = player.x - this.x, dy = player.y - this.y;
    let d  = Math.sqrt(dx*dx + dy*dy);
    if (d > 0) { dx /= d; dy /= d; }
    const phase3 = this.phase >= 3;
    let chargeSpd = phase3 ? 17 : (this.phase === 2 ? 14 : 9);
    this.chargeVx = dx * chargeSpd;
    this.chargeVy = dy * chargeSpd;
    this.isCharging     = true;
    this.chargeDuration = 600;
    this.baseSpeed      = 0;
    // 베르세르커: 연속 2-3회 돌진
    if (isNew && this.patternType.id === 'berserker') {
      this.pendingCharges = this.phase >= 2 ? 2 : 1;
    }
    addFloatingText(this.x, this.y - 60, '⚡ CHARGE!', '#ff6600', 13);
    playSynthSound([200, 600], 0.3, 'sawtooth', 0.1);
    triggerScreenShake(4, 300);
  }

  orbitalShot() {
    if (!player) return;
    const shotCount = this.phase >= 3 ? 12 : (this.phase >= 2 ? 10 : 8);
    const spd = 5.5;
    const dmg = this.damage * 0.6;
    if (bossProjectiles.length >= MAX_BOSS_PROJ) return;
    addFloatingText(this.x, this.y - 60, '🔵 궤도 사격!', this.patternType.glowColor, 12);
    playSynthSound([500, 300, 700], 0.12, 'triangle', 0.07);
    for (let i = 0; i < shotCount; i++) {
      const angle = (i / shotCount) * Math.PI * 2;
      bossProjectiles.push(new BossProjectile(
        this.x, this.y,
        Math.cos(angle) * spd, Math.sin(angle) * spd,
        dmg, 7, this.patternType.glowColor, false
      ));
    }
  }

  homingShot() {
    if (!player) return;
    const count = this.phase >= 3 ? 3 : (this.phase >= 2 ? 2 : 1);
    const dmg = this.damage * 0.8;
    if (bossProjectiles.length >= MAX_BOSS_PROJ) return;
    addFloatingText(this.x, this.y - 60, '🎯 유도탄!', '#ff8800', 12);
    playSynthSound([150, 400], 0.15, 'sawtooth', 0.08);
    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * 0.3;
      const angle = Math.atan2(player.y - this.y, player.x - this.x) + spread;
      bossProjectiles.push(new BossProjectile(
        this.x, this.y,
        Math.cos(angle) * 3.5, Math.sin(angle) * 3.5,
        dmg, 9, '#ff8800', true
      ));
    }
  }

  activateShield() {
    this.shieldActive = true;
    this.shieldTimer  = 3500;
    addFloatingText(this.x, this.y - 70, '🛡 방어막 발동!', '#b026ff', 14);
    createExplosionParticles(this.x, this.y, '#b026ff', 20);
    playSynthSound([400, 800, 1200], 0.15, 'triangle', 0.08);
  }

  spawnEliteWave() {
    if (!player) return;
    const count = this.phase >= 3 ? 8 : (this.phase === 2 ? 6 : 4);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = 180 + Math.random() * 80;
      const ex = Math.max(20, Math.min(MAP_WIDTH  - 20, this.x + Math.cos(angle) * r));
      const ey = Math.max(20, Math.min(MAP_HEIGHT - 20, this.y + Math.sin(angle) * r));
      enemies.push(new Enemy(ex, ey, 'elite'));
    }
    addFloatingText(this.x, this.y - this.radius - 20, '☠ ELITE WAVE!', '#ff0044', 15);
    triggerScreenShake(9, 500);
    playSynthSound([80, 160, 320], 0.35, 'sawtooth', 0.12);
  }

  spawnMinions() {
    const isSummoner = this.patternType.id === 'summoner';
    const count = this.phase >= 3 ? 6 : (this.phase === 2 ? 4 : (isSummoner ? 3 : 2));
    const minionType = isSummoner && this.phase >= 2 ? 'elite' : 'rusher';
    for (let i = 0; i < count; i++) {
      let angle = Math.random() * Math.PI * 2;
      let r  = 80 + Math.random() * 60;
      let ex = Math.max(20, Math.min(MAP_WIDTH  - 20, this.x + Math.cos(angle) * r));
      let ey = Math.max(20, Math.min(MAP_HEIGHT - 20, this.y + Math.sin(angle) * r));
      enemies.push(new Enemy(ex, ey, minionType));
    }
    addFloatingText(this.x, this.y - 60, '▶ 소환!', '#ff0044', 12);
  }

  draw(ctx, camera) {
    ctx.save();
    const pt  = this.patternType;
    let pulse = Math.sin(this.pulseTimer * 0.006) * (this.isFinalBoss ? 8 : 5);
    let drawR = this.radius + pulse;
    let bx = this.x - camera.x, by = this.y - camera.y;

    // 최종 보스: 회전 링 장식
    if (this.isFinalBoss) {
      const rot = this.pulseTimer * 0.002;
      const ringCols = ['#ffe600', '#ff0044', '#00f0ff', '#b026ff'];
      for (let r = 0; r < 4; r++) {
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(rot + r * Math.PI / 2);
        ctx.strokeStyle = ringCols[r];
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.6 + Math.sin(this.pulseTimer * 0.008 + r) * 0.2;
        ctx.shadowBlur = 20; ctx.shadowColor = ringCols[r];
        ctx.beginPath();
        ctx.arc(0, 0, drawR + 12 + r * 8, -0.6, 0.6);
        ctx.stroke();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    // 방어막 링
    if (this.shieldActive) {
      ctx.strokeStyle = '#b026ff'; ctx.lineWidth = 3;
      ctx.shadowBlur = 25; ctx.shadowColor = '#b026ff';
      const sAlpha = 0.4 + Math.sin(this.pulseTimer * 0.01) * 0.2;
      ctx.globalAlpha = sAlpha;
      ctx.beginPath(); ctx.arc(bx, by, drawR + 18, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    let outerCol;
    if (this.isFinalBoss) {
      // 최종 보스: 페이즈별 색상
      outerCol = this.phase >= 3 ? '#ffffff' : (this.phase === 2 ? '#ff6600' : '#ffe600');
    } else {
      outerCol = this.phase >= 3 ? '#ffffff' : (this.phase === 2 ? '#ff6600' : pt.outerColor);
    }
    ctx.shadowBlur  = this.isFinalBoss ? 60 : 35;
    ctx.shadowColor = this.isFinalBoss ? '#ffe600' : (this.shieldActive ? '#b026ff' : pt.glowColor);
    ctx.fillStyle   = this.flashTimer > 0 ? '#ffffff' : outerCol;
    ctx.beginPath(); ctx.arc(bx, by, drawR, 0, Math.PI * 2); ctx.fill();

    ctx.shadowBlur  = 15;
    ctx.fillStyle   = this.isFinalBoss
      ? (this.phase >= 2 ? '#ff2200' : '#ff0044')
      : (this.phase >= 2 ? '#ff8800' : pt.innerColor);
    ctx.beginPath(); ctx.arc(bx, by, drawR * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = this.isFinalBoss ? 3 : 2; ctx.stroke();

    // 보스 이름 + 타입 라벨
    ctx.font      = `bold ${this.isFinalBoss ? 13 : 11}px Orbitron, sans-serif`;
    ctx.fillStyle = this.isFinalBoss ? '#ffe600' : '#fff';
    ctx.textAlign = 'center';
    ctx.shadowBlur  = this.isFinalBoss ? 12 : 5;
    ctx.shadowColor = this.isFinalBoss ? '#ffe600' : pt.glowColor;
    ctx.fillText(this.name, bx, by - drawR - 20);
    ctx.font = '8px Orbitron, sans-serif';
    ctx.fillStyle = this.isFinalBoss ? '#ff0044' : pt.glowColor;
    ctx.fillText(`[${pt.label}]`, bx, by - drawR - 10);

    // HP 바
    let barW = this.radius * 2.5, barH = this.isFinalBoss ? 9 : 6;
    let barX = bx - barW / 2, barY = by - drawR - 30;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(barX, barY, barW, barH);
    let pct = Math.max(this.hp / this.maxHp, 0);
    ctx.fillStyle = pct > 0.5 ? (this.isFinalBoss ? '#ffe600' : pt.outerColor) : pct > 0.25 ? '#ff6600' : '#ff0000';
    ctx.fillRect(barX, barY, barW * pct, barH);
    // 페이즈 경계 표시
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(barX + barW * 0.5 - 1, barY, 2, barH);
    if (this.bossIdx >= 2 || this.isFinalBoss) ctx.fillRect(barX + barW * 0.25 - 1, barY, 2, barH);

    ctx.restore();
  }

  takeDamage(amount, sourceKey) {
    // 방어막 중: 피해 80% 감소
    if (this.shieldActive) amount *= 0.2;
    this.hp -= amount;
    this.flashTimer = 80;
    if (weaponStats[sourceKey]) weaponStats[sourceKey].damage += amount;
    createExplosionParticles(this.x, this.y, '#ff0044', 2);
    addFloatingText(this.x + (Math.random()-0.5)*30, this.y - this.radius, Math.floor(amount).toString(), '#ff4466', 13);
    if (this.hp <= 0) { this.hp = 0; this.die(sourceKey); return true; }
    return false;
  }

  die(sourceKey) {
    if (this.dead) return;
    this.dead = true;
    bossProjectiles.length = 0;
    createExplosionParticles(this.x, this.y, '#ff0044', 35);
    createExplosionParticles(this.x, this.y, '#ffe600', 25);
    createExplosionParticles(this.x, this.y, this.patternType.outerColor, 20);
    triggerScreenShake(18, 900);
    if (weaponStats[sourceKey]) weaponStats[sourceKey].kills++;
    for (let i = 0; i < 12; i++) {
      let ang = Math.random() * Math.PI * 2;
      let r   = Math.random() * 70;
      gems.push(new Gem(this.x + Math.cos(ang)*r, this.y + Math.sin(ang)*r, this.xpValue));
    }
    playBossDeathSound();
    spawnGoldCoins(this.x, this.y, 12 + Math.floor(Math.random() * 9));
    // 보스 처치 보너스 드롭: HP 또는 서지 아이템
    const bossDropType = ['health', 'health', 'surge', 'magnet'][Math.floor(Math.random() * 4)];
    fieldItems.push(new FieldItem(this.x + (Math.random() - 0.5) * 60, this.y + (Math.random() - 0.5) * 60, bossDropType));
    addFloatingText(this.x, this.y - this.radius - 20, '★ BOSS DROP!', '#ffe600', 15);
    _statAdd('totalBossKills', 1);
    activeBoss = null;
    isBossStage = false;
    isMiniBossStage = false;
    bossStageStartMs = 0;
    if (!this.isMini) {
      pendingBossCurse = true;
    } else {
      for (let i = 0; i < 6; i++) {
        const ang = Math.random() * Math.PI * 2;
        gems.push(new Gem(this.x + Math.cos(ang) * 50, this.y + Math.sin(ang) * 50, this.xpValue * 2));
      }
      spawnGoldCoins(this.x, this.y, 8 + Math.floor(Math.random() * 5));
      addFloatingText(this.x, this.y - 80, '⚡ MINI BOSS 처치!', '#ffe600', 16);
    }
    triggerStageClear();
  }
}

// 보스 발사체 클래스
class BossProjectile {
  constructor(x, y, vx, vy, damage, radius, color, homing) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.damage = damage; this.radius = radius; this.color = color;
    this.homing = homing;
    this.speed  = Math.sqrt(vx*vx + vy*vy);
    this.life   = homing ? 5000 : 3500;
  }
  update(dt) {
    if (this.homing && player) {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const d  = Math.sqrt(dx*dx + dy*dy);
      if (d > 0) {
        const tx = (dx/d) * this.speed;
        const ty = (dy/d) * this.speed;
        this.vx += (tx - this.vx) * 0.022 * (dt / 16.66);
        this.vy += (ty - this.vy) * 0.022 * (dt / 16.66);
      }
    }
    this.x += this.vx * (dt / 16.66);
    this.y += this.vy * (dt / 16.66);
    this.life -= dt;
  }
  draw(ctx, camera) {
    ctx.save();
    ctx.shadowBlur = 14; ctx.shadowColor = this.color;
    ctx.fillStyle  = this.color;
    ctx.beginPath();
    ctx.arc(this.x - camera.x, this.y - camera.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    if (this.homing) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.restore();
  }
}

// ============================================================
// 11. 필드 아이템 클래스
// ============================================================
class FieldItem {
  constructor(x, y, type) {
    this.x = x; this.y = y; this.type = type;
    this.radius    = 14;
    this.life      = 18000;
    this.maxLife   = 18000;
    this.bobTimer  = Math.random() * Math.PI * 2;
    this.collected = false;
    const data = FIELD_ITEM_TYPES[type];
    this.color = data.color;
    this.icon  = data.icon;
  }

  update(dt) {
    if (this.collected) return;
    this.life     -= dt;
    this.bobTimer += dt * 0.003;
    if (!player) return;
    let d = dist(this.x, this.y, player.x, player.y);
    if (d < player.radius + this.radius) this.collect();
  }

  collect() {
    if (this.collected) return;
    this.collected = true;
    applyFieldItemEffect(this.type, this.x, this.y);
    playSynthSound([800, 1200], 0.12, 'sine', 0.06);
  }

  draw(ctx, camera) {
    let bob   = Math.sin(this.bobTimer) * 5;
    let alpha = this.life < this.maxLife * 0.25 ? (this.life / (this.maxLife * 0.25)) : 1.0;
    let bx = this.x - camera.x, by = this.y - camera.y + bob;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur  = 18; ctx.shadowColor = this.color;
    ctx.fillStyle   = 'rgba(10,10,20,0.75)';
    ctx.beginPath(); ctx.arc(bx, by, this.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = this.color; ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font         = `${this.radius}px serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.icon, bx, by);
    ctx.restore();
  }
}

function applyFieldItemEffect(type, x, y) {
  if (type === 'health') {
    let healAmt = player.classId === 'engineer' ? 60 : 40;
    player.hp = Math.min(player.hp + healAmt, player.maxHp);
    addFloatingText(x, y, `+${healAmt} HP`, '#ff4466', 16);

  } else if (type === 'magnet') {
    for (let gem of gems) { gem.isAttracted = true; gem.speed = Math.max(gem.speed, 8); }
    addFloatingText(x, y, 'XP 흡수!', '#b026ff', 14);

  } else if (type === 'nuke') {
    let nuked = 0;
    for (let e of [...enemies]) {
      createExplosionParticles(e.x, e.y, '#ffe600', 8);
      stageKillProgress++;
      killCount++;
      onEnemyKilled();
      nuked++;
      gems.push(new Gem(e.x, e.y, e.xpValue));
    }
    if (activeBoss) {
      let bossKilled = activeBoss.takeDamage(activeBoss.maxHp * 0.3, 'nuke');
      if (bossKilled) killCount++;
      addFloatingText(activeBoss.x, activeBoss.y - 60, 'NUKE HIT!', '#ffe600', 16);
    }
    enemies.length = 0;
    addFloatingText(x, y, `☢ NUKE x${nuked}!`, '#ffe600', 18);
    triggerScreenShake(14, 700);
    checkStageProgress();

  } else if (type === 'shield') {
    player.shieldTimer = player.classId === 'cyborg' ? 8000 : 5000;
    addFloatingText(x, y, '실드 활성!', '#00f0ff', 14);

  } else if (type === 'surge') {
    player.surgeTimer = 8000;
    addFloatingText(x, y, '오버클럭!', '#39ff14', 14);
  }
}

// ============================================================
// 12. 플로팅 텍스트 클래스
// ============================================================
class FloatingText {
  constructor(x, y, text, color, size) {
    this.x = x; this.y = y;
    this.text  = text; this.color = color;
    this.size  = size || 13;
    this.vy    = -1.2;
    this.life  = 750;
    this.maxLife = 750;
  }
  update(dt) { this.y += this.vy * (dt / 16.66); this.vy *= 0.97; this.life -= dt; }
  draw(ctx, camera) {
    let alpha = Math.min(this.life / this.maxLife * 2, 1.0);
    ctx.save();
    ctx.globalAlpha  = alpha;
    ctx.font         = `bold ${this.size}px Orbitron, monospace`;
    ctx.fillStyle    = this.color;
    ctx.textAlign    = 'center';
    ctx.shadowBlur   = 6; ctx.shadowColor = this.color;
    ctx.fillText(this.text, this.x - camera.x, this.y - camera.y);
    ctx.restore();
  }
}

function addFloatingText(x, y, text, color, size) {
  floatingTexts.push(new FloatingText(x, y - 20, text, color, size));
}

// ============================================================
// 13. 경험치 젬 및 파티클
// ============================================================
class Gem {
  constructor(x, y, value) {
    this.x = x; this.y = y; this.value = value;
    this.radius = 5 + Math.min(value, 5);
    this.color  = value === 1 ? '#00f0ff' : value < 5 ? '#b026ff' : '#ffe600';
    this.isAttracted = false;
    this.speed  = 0.5;
  }
  update(dt) {
    if (!player) return;
    let d = dist(this.x, this.y, player.x, player.y);
    if (d < player.radius + this.radius) {
      player.gainXp(this.value);
      if (player.passives.nanobots > 0) {
        const chance = player.passives.nanobots === 2 ? 0.4 : 0.2;
        const heal   = player.passives.nanobots === 2 ? 5 : 3;
        if (Math.random() < chance) player.hp = Math.min(player.hp + heal, player.maxHp);
      }
      playGemSound();
      let idx = gems.indexOf(this);
      if (idx !== -1) gems.splice(idx, 1);
      return;
    }
    if (stageGemMagnet || this.isAttracted || d < player.magnetRadius) {
      this.isAttracted = true;
      let dx = player.x - this.x, dy = player.y - this.y;
      if (d > 0) { dx /= d; dy /= d; }
      const accel = stageGemMagnet ? 3.0 : 0.35;
      const maxSpd = stageGemMagnet ? 40  : 18;
      this.speed = Math.min(this.speed + accel * (dt / 16.66), maxSpd);
      this.x += dx * this.speed * (dt / 16.66);
      this.y += dy * this.speed * (dt / 16.66);
    }
  }
  draw(ctx, camera) {
    ctx.save();
    ctx.shadowBlur = 8; ctx.shadowColor = this.color; ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(this.x - camera.x,                  this.y - camera.y - this.radius);
    ctx.lineTo(this.x - camera.x + this.radius*0.7, this.y - camera.y);
    ctx.lineTo(this.x - camera.x,                  this.y - camera.y + this.radius);
    ctx.lineTo(this.x - camera.x - this.radius*0.7, this.y - camera.y);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

// ============================================================
// 골드 코인 클래스
// ============================================================
class GoldCoin {
  constructor(x, y) {
    this.x = x + (Math.random() - 0.5) * 50;
    this.y = y + (Math.random() - 0.5) * 50;
    this.radius    = 5;
    this.speed     = 0;
    this.collected = false;
    this.bobTimer  = Math.random() * Math.PI * 2;
  }
  update(dt) {
    if (!player || this.collected) return;
    this.bobTimer += dt * 0.004;
    const d = dist(this.x, this.y, player.x, player.y);
    if (d < player.radius + this.radius) {
      this.collected = true;
      player.gold++;
      playSynthSound([880, 1046], 0.06, 'sine', 0.04);
      return;
    }
    if (d < player.magnetRadius * 0.6) {
      const dx = player.x - this.x, dy = player.y - this.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      this.speed = Math.min(this.speed + 0.4 * (dt / 16.66), 10);
      this.x += (dx / len) * this.speed * (dt / 16.66);
      this.y += (dy / len) * this.speed * (dt / 16.66);
    }
  }
  draw(ctx, camera) {
    const bob = Math.sin(this.bobTimer) * 3;
    const bx  = this.x - camera.x, by = this.y - camera.y + bob;
    ctx.save();
    ctx.shadowBlur = 10; ctx.shadowColor = '#ffd700';
    ctx.fillStyle  = '#ffd700';
    ctx.beginPath(); ctx.arc(bx, by, this.radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.arc(bx - 1.5, by - 1.5, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function spawnGoldCoins(x, y, count) {
  for (let i = 0; i < count; i++) goldCoins.push(new GoldCoin(x, y));
}

class Particle {
  constructor(x, y, vx, vy, color, duration = 400) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.color = color; this.maxLife = duration; this.life = duration;
    this.radius = 2.5 + Math.random() * 2;
  }
  update(dt) { this.x += this.vx * (dt/16.66); this.y += this.vy * (dt/16.66); this.life -= dt; }
  draw(ctx, camera) {
    let alpha = this.life / this.maxLife;
    ctx.fillStyle = this.color; ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(this.x - camera.x, this.y - camera.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function createExplosionParticles(x, y, color, count) {
  const allowed = Math.min(count, MAX_PARTICLES - particles.length);
  for (let i = 0; i < allowed; i++) {
    let speed = 1.0 + Math.random() * 3.5;
    let angle = Math.random() * Math.PI * 2;
    particles.push(new Particle(x, y, Math.cos(angle)*speed, Math.sin(angle)*speed, color, 250 + Math.random()*250));
  }
}

function createBeatParticles(x, y) {
  if (particles.length >= MAX_PARTICLES - 8) return;
  for (let i = 0; i < 8; i++) {
    let speed = 1.5 + Math.random() * 3;
    let angle = Math.random() * Math.PI * 2;
    particles.push(new Particle(x, y, Math.cos(angle)*speed, Math.sin(angle)*speed, '#ffe600', 300 + Math.random()*150));
  }
}
function createDamageOverlayParticles(x, y) {
  for (let i = 0; i < 8; i++) {
    let speed = 2.0 + Math.random() * 2.0;
    let angle = Math.random() * Math.PI * 2;
    particles.push(new Particle(x, y, Math.cos(angle)*speed, Math.sin(angle)*speed, '#ff007f', 400));
  }
}

// ============================================================
// 14. 스테이지 시스템
// ============================================================
function getStageKillGoal(stage) {
  if (stage % 10 === 0) return 0;
  if (stage > 100) {
    // 무한 모드: 60~100 범위에서 완만하게 증가, 과도한 grinding 방지
    return Math.min(60 + Math.floor((stage - 101) * 3), 100);
  }
  return Math.floor(20 + (stage - 1) * 6);
}

function checkStageProgress() {
  if (isStageClearAnim || isBossStage || !player) return;
  if (stageKillProgress >= stageKillGoal && stageKillGoal > 0) {
    triggerStageClear();
  }
}

function triggerStageClear() {
  if (isStageClearAnim) return;
  isStageClearAnim = true;
  stageClearAnimStartMs = Date.now();
  gameState = STATE_STAGE_CLEAR;

  // 남은 적들 젬 드롭 후 제거 + 자석 흡입 활성화
  for (let e of enemies) {
    gems.push(new Gem(e.x, e.y, e.xpValue));
    createExplosionParticles(e.x, e.y, e.color, 5);
  }
  enemies.length = 0;
  obstacles.length = 0;
  projectiles.length = 0;
  mines.length = 0;
  blackHoles.length = 0;
  stageGemMagnet = true;
  if (_gemMagnetTimer) clearTimeout(_gemMagnetTimer);
  _gemMagnetTimer = setTimeout(() => { stageGemMagnet = false; _gemMagnetTimer = null; }, 3500);

  const isEntry = currentStage === 100;
  showStageOverlay(
    `STAGE ${currentStage} CLEAR!`,
    currentStage > 100  ? '∞ 다음 파동으로 진입!' :
    isEntry             ? '★ ENDLESS MODE 진입! ★' : '보너스 보상을 선택하세요!',
    currentStage >= 100 ? '#ffe600' : '#39ff14'
  );
  playStageClearSound();
  spawnRandomFieldItem();

  setTimeout(() => {
    hideStageOverlay();
    showStageBonusSafe();
  }, 2200);
}

// 레벨업 모달이 열려 있으면 대기 후 보너스 모달 표시
function showStageBonusSafe(retries = 0) {
  if (gameState === STATE_GAME_OVER || gameState === STATE_MENU) return;
  if (gameState === STATE_STAGE_BONUS) return; // 이미 표시 중
  if (!isStageClearAnim) return; // 보너스 선택이 먼저 완료된 경우
  if (levelUpInProgress && retries < 200) {
    setTimeout(() => showStageBonusSafe(retries + 1), 60);
    return;
  }
  // 200회 폴링(~12초) 초과 시 강제 해제
  if (levelUpInProgress) {
    levelUpInProgress = false;
    pendingLevelUps   = 0;
    levelUpModal.classList.remove('active');
  }
  showStageBonusModal();
}

function advanceToNextStage() {
  currentStage++;

  if (currentStage > 100 && !isEndlessMode) {
    isEndlessMode = true;
    endlessModeStartTime = gameTime;
  }

  if (currentStage % 10 === 0) {
    isBossStage      = true;
    isMiniBossStage  = false;
    stageKillGoal    = 0;
    stageKillProgress = 0;
    bossStageStartMs  = Date.now();
    gameState = STATE_PLAYING;
    showBossWarning();
  } else if (currentStage % 10 === 5) {
    isBossStage      = true;
    isMiniBossStage  = true;
    stageKillGoal    = 0;
    stageKillProgress = 0;
    bossStageStartMs  = Date.now();
    gameState = STATE_PLAYING;
    setTimeout(() => spawnMiniBoss(), 1500);
  } else {
    isBossStage       = false;
    isMiniBossStage   = false;
    stageKillProgress = 0;
    stageKillGoal     = getStageKillGoal(currentStage);
    gameState = STATE_PLAYING;
    // 3스테이지마다 (보스 스테이지 제외) 특별 엘리트 소환
    if (currentStage % 3 === 0 && currentStage > 3) {
      setTimeout(() => spawnEliteEnemy(), 2000);
    }
    spawnStageObstacles();
  }
}

function spawnEliteEnemy() {
  if (!player || gameState !== STATE_PLAYING) return;
  const angle = Math.random() * Math.PI * 2;
  const ex = Math.max(50, Math.min(MAP_WIDTH - 50, player.x + Math.cos(angle) * 420));
  const ey = Math.max(50, Math.min(MAP_HEIGHT - 50, player.y + Math.sin(angle) * 420));
  enemies.push(new Enemy(ex, ey, 'elite'));
  showStageOverlay('⚠ ELITE VIRUS!', '정예 바이러스 침투!', '#ff6600');
  setTimeout(hideStageOverlay, 2000);
}

function spawnMiniBoss() {
  if (!player) return;
  // 상점/일시정지/레벨업 중이면 재시도 (isBossStage가 true인 채로 갇히는 버그 방지)
  if (gameState !== STATE_PLAYING) { setTimeout(() => spawnMiniBoss(), 500); return; }
  // x,y 없이 생성하면 NaN → 화면 밖. 플레이어 근처에 스폰
  const _ang = Math.random() * Math.PI * 2;
  const _bx  = Math.max(80, Math.min(MAP_WIDTH  - 80, player.x + Math.cos(_ang) * 380));
  const _by  = Math.max(80, Math.min(MAP_HEIGHT - 80, player.y + Math.sin(_ang) * 380));
  const miniBoss = new Boss(_bx, _by);
  miniBoss.maxHp  = Math.floor(miniBoss.maxHp * 0.40);
  miniBoss.hp     = miniBoss.maxHp;
  miniBoss.radius = Math.floor(miniBoss.radius * 0.75);
  miniBoss.isMini = true;
  miniBoss.phase  = 1;
  miniBoss.name   = '⚡ MINI ' + miniBoss.name;
  activeBoss = miniBoss;
  enemies.length = 0;
  bossProjectiles.length = 0;
  showStageOverlay('⚡ MINI BOSS', miniBoss.name, '#b026ff');
  triggerScreenShake(8, 600);
  playSynthSound([150, 200, 250], 0.2, 'sawtooth', 0.1);
}

function spawnStageObstacles() {
  obstacles.length = 0;
  if (!player || currentStage < 3) return;
  if (currentStage % 10 === 0 || currentStage % 10 === 5) return;
  const numWalls = currentStage >= 30 ? 2 : currentStage >= 10 ? 1 : 0;
  const numElec  = currentStage >= 50 ? 2 : currentStage >= 30 ? 1 : 0;
  const numPools = currentStage >= 20 ? 1 : 0;
  const safeR = 260, cx = player.x, cy = player.y;
  function randMapPos() {
    let x, y, tries = 0;
    do {
      x = 150 + Math.random() * (MAP_WIDTH  - 300);
      y = 150 + Math.random() * (MAP_HEIGHT - 300);
      tries++;
    } while (Math.sqrt((x-cx)**2+(y-cy)**2) < safeR && tries < 20);
    return {x, y};
  }
  for (let i = 0; i < numWalls; i++) {
    const p = randMapPos(), angle = Math.random()*Math.PI, len = 150+Math.random()*180;
    obstacles.push(new FirewallWall(
      p.x+Math.cos(angle)*len/2, p.y+Math.sin(angle)*len/2,
      p.x-Math.cos(angle)*len/2, p.y-Math.sin(angle)*len/2
    ));
  }
  for (let i = 0; i < numElec; i++) {
    const p = randMapPos();
    obstacles.push(new ElectricZone(p.x, p.y, 55+Math.random()*35));
  }
  for (let i = 0; i < numPools; i++) {
    const p = randMapPos();
    obstacles.push(new VirusPool(p.x, p.y, 65+Math.random()*40));
  }
}

// ============================================================
// 스테이지 클리어 보너스 선택
// ============================================================
const STAGE_BONUSES = [
  { id: 'repair',  icon: '💊', name: '응급 수리',   desc: 'HP를 최대치의 40% 즉시 회복' },
  { id: 'surge',   icon: '⚡', name: '데이터 서지', desc: '20초간 모든 무기 피해량 ×1.8' },
  { id: 'supply',  icon: '📦', name: '비상 보급',   desc: '랜덤 필드 아이템 3개 즉시 생성' }
];

function showStageBonusModal() {
  // 보스 처치 후 저주 계약 먼저 제시
  if (pendingBossCurse) {
    pendingBossCurse = false;
    showCurseModal();
    return;
  }
  gameState = STATE_STAGE_BONUS;
  bonusSelectedIdx = 0;
  const modal = document.getElementById('stage-bonus-modal');
  const list  = document.getElementById('stage-bonus-list');
  list.innerHTML = '';
  STAGE_BONUSES.forEach(b => {
    let btn = document.createElement('button');
    btn.className = 'bonus-card';
    btn.innerHTML = `<span class="bonus-icon">${b.icon}</span><span class="bonus-name">${b.name}</span><span class="bonus-desc">${b.desc}</span>`;
    btn.addEventListener('click', () => applyStageClearBonus(b.id));
    list.appendChild(btn);
  });
  modal.classList.add('active');
  const cards = [...list.querySelectorAll('.bonus-card')];
  updateBonusFocus(cards);
  ensureGameLoopRunning();
}

function updateBonusFocus(cards) {
  cards.forEach((c, i) => c.classList.toggle('card-kb-focus', i === bonusSelectedIdx));
}

function applyStageClearBonus(id) {
  document.getElementById('stage-bonus-modal').classList.remove('active');
  if (!player) { isStageClearAnim = false; advanceToNextStage(); return; }

  if (id === 'repair') {
    let heal = Math.floor(player.maxHp * 0.4);
    player.hp = Math.min(player.hp + heal, player.maxHp);
    addFloatingText(player.x, player.y - 40, `+${heal} HP 회복`, '#ff4466', 18);
    playSynthSound([600, 1200], 0.15, 'sine', 0.08);

  } else if (id === 'surge') {
    if (player.attackSurgeTimer <= 0) {
      player.attackSurgeMult  = 1.8;
      player.damageMultiplier *= 1.8;
    }
    player.attackSurgeTimer = 20000;
    addFloatingText(player.x, player.y - 40, '⚡ 데이터 서지 20초!', '#ffe600', 16);
    playSynthSound([300, 800], 0.2, 'sawtooth', 0.08);
    triggerScreenShake(5, 300);

  } else if (id === 'supply') {
    for (let i = 0; i < 3; i++) spawnRandomFieldItem();
    addFloatingText(player.x, player.y - 40, '📦 보급 도착!', '#39ff14', 16);
    playSynthSound([800, 1000], 0.12, 'triangle', 0.06);
  }

  isStageClearAnim = false;
  advanceToNextStage();
}

function showBossWarning() {
  let bossIdx  = Math.floor(currentStage / 10) - 1;
  let bossName = BOSS_NAMES[Math.min(bossIdx, BOSS_NAMES.length - 1)];
  const isFinal = (currentStage === 100);
  showStageOverlay(
    isFinal ? '★★ FINAL BOSS ★★' : `⚠ BOSS STAGE ${currentStage} ⚠`,
    isFinal ? `☠ ${bossName} ☠` : bossName,
    isFinal ? '#ffe600' : '#ff0044'
  );
  triggerScreenShake(6, 400);

  setTimeout(() => {
    if (gameState === STATE_GAME_OVER || gameState === STATE_MENU) return;
    hideStageOverlay();
    spawnBossEnemy();
    gameState = STATE_PLAYING;
    ensureGameLoopRunning();
  }, 2200);
}

function spawnBossEnemy() {
  if (!player) return;
  let angle = Math.random() * Math.PI * 2;
  let bossX = Math.max(100, Math.min(MAP_WIDTH  - 100, player.x + Math.cos(angle) * 520));
  let bossY = Math.max(100, Math.min(MAP_HEIGHT - 100, player.y + Math.sin(angle) * 520));
  activeBoss = new Boss(bossX, bossY);
  playSynthSound([80, 40], 0.7, 'sawtooth', 0.15);
  triggerScreenShake(8, 500);
}

function showStageOverlay(text, sub, color) {
  const overlay = document.getElementById('stage-overlay');
  const textEl  = document.getElementById('stage-overlay-text');
  const subEl   = document.getElementById('stage-overlay-sub');
  if (!overlay) return;
  textEl.textContent   = text;
  textEl.style.color   = color;
  subEl.textContent    = sub || '';
  subEl.style.color    = color;
  overlay.classList.add('active');
}

function hideStageOverlay() {
  const overlay = document.getElementById('stage-overlay');
  if (overlay) overlay.classList.remove('active');
}

// ============================================================
// 15. 콤보 시스템
// ============================================================
function onEnemyKilled() {
  comboCount++;
  comboTimer = COMBO_WINDOW;
  if (comboCount > maxCombo) maxCombo = comboCount;
  checkComboMilestone(comboCount);
  updateComboDisplay();
  // 킬 마일스톤 (100킬 배수마다)
  if (killCount > 0 && killCount % 100 === 0 && player) {
    addFloatingText(player.x, player.y - 70, `💀 ${killCount} KILLS! +50XP`, '#ffe600', 16);
    gems.push(new Gem(player.x, player.y, 50));
    triggerScreenShake(5, 300);
    playSynthSound([600, 800, 1000], 0.15, 'triangle', 0.08);
  }
}

function checkComboMilestone(count) {
  if (!player) return;
  const banner = document.getElementById('combo-milestone-banner');
  if (count === 10) {
    showComboMilestoneBanner('🔥 KILLING SPREE! x10', '#ff8800');
    player.damageMultiplier *= 1.25;
    setTimeout(() => { if (player) player.damageMultiplier /= 1.25; }, 5000);
    addFloatingText(player.x, player.y - 60, '🔥 피해 +25% (5초)!', '#ff8800', 14);
    playSynthSound([400, 800, 1200], 0.18, 'sawtooth', 0.07);
  } else if (count === 25) {
    showComboMilestoneBanner('💀 MASSACRE! x25', '#ff4466');
    triggerScreenShake(10, 600);
    createExplosionParticles(player.x, player.y, '#ff4466', 25);
    player.damageMultiplier *= 1.4;
    setTimeout(() => { if (player) player.damageMultiplier /= 1.4; }, 7000);
    addFloatingText(player.x, player.y - 60, '💀 피해 +40% (7초)!', '#ff4466', 16);
    playSynthSound([200, 600, 1400], 0.22, 'sawtooth', 0.09);
  } else if (count === 50) {
    showComboMilestoneBanner('☢ CYBER RAMPAGE! x50', '#ffe600');
    triggerScreenShake(18, 900);
    // 화면 내 모든 적 50 피해
    for (let e of [...enemies]) { if (e.takeDamage(50, 'combo')) killCount++; }
    createExplosionParticles(player.x, player.y, '#ffe600', 35);
    addFloatingText(player.x, player.y - 70, '☢ 전체 폭발!', '#ffe600', 20);
    playSynthSound([100, 300, 800, 1600], 0.28, 'sawtooth', 0.12);
  }
}

function showComboMilestoneBanner(text, color) {
  const el = document.getElementById('combo-milestone-banner');
  if (!el) return;
  el.textContent = text;
  el.style.color = color;
  el.style.textShadow = `0 0 20px ${color}, 0 0 40px ${color}`;
  el.classList.add('active');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('active'), 2000);
}

function updateComboSystem(dt) {
  if (comboCount > 0) {
    comboTimer -= dt;
    if (comboTimer <= 0) { comboCount = 0; comboTimer = 0; hideComboDisplay(); }
    else updateComboDisplay();
  }
}

function getXpMultiplier() {
  const diff = DIFFICULTY_SETTINGS[gameDifficulty] || DIFFICULTY_SETTINGS.normal;
  let base = 1.0;
  if (comboCount < 5)       base = 1.0;
  else if (comboCount < 15) base = 1.25;
  else if (comboCount < 30) base = 1.5;
  else if (comboCount < 60) base = 2.0;
  else                       base = 2.5;
  return base * diff.xpMult;
}

// 초반 경험치 버프 (스테이지 10 이하) — 너무 강하지 않게 조정
function getEarlyGameXpMult() {
  if (currentStage <= 3)  return 1.7;
  if (currentStage <= 6)  return 1.4;
  if (currentStage <= 10) return 1.2;
  return 1.0;
}

// ============================================================
// 저장 / 메타 성장 / 업적 시스템
// ============================================================
function loadSaveData() {
  // 슬롯 0에서 로드, 레거시 데이터 마이그레이션
  try {
    const slotRaw = localStorage.getItem(getSaveKey(0));
    if (slotRaw) return loadSaveDataSlot(0);
    // 레거시 마이그레이션
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { dataCores: 0, metaLevels: {}, achievements: [], bestKills: 0, bestStage: 0, bestTime: 0, ascensionLevel: 0 };
    const d = JSON.parse(raw);
    const migrated = {
      dataCores:      d.dataCores    || 0,
      metaLevels:     d.metaLevels   || {},
      achievements:   d.achievements || [],
      bestKills:      d.bestKills    || 0,
      bestStage:      d.bestStage    || 0,
      bestTime:       d.bestTime     || 0,
      ascensionLevel: 0
    };
    localStorage.setItem(getSaveKey(0), JSON.stringify(migrated));
    return migrated;
  } catch(e) { return { dataCores: 0, metaLevels: {}, achievements: [], bestKills: 0, bestStage: 0, bestTime: 0, ascensionLevel: 0 }; }
}

function saveSaveData() {
  try { localStorage.setItem(getSaveKey(currentSaveSlot), JSON.stringify(saveData)); } catch(e) {}
}

// 난이도 로드
function loadDifficulty() {
  gameDifficulty = localStorage.getItem('ns_difficulty') || 'normal';
  document.querySelectorAll('.diff-btn').forEach(b => b.classList.toggle('diff-active', b.dataset.diff === gameDifficulty));
}

function applyMetaUpgrades() {
  const l = saveData.metaLevels;
  const hpBonus = [0, 20, 40, 70, 110][l.meta_hp || 0];
  player.maxHp += hpBonus;
  player.hp    += hpBonus;
  player.speed            *= [1, 1.05, 1.10, 1.20][l.meta_speed  || 0];
  player.magnetRadius     *= [1, 1.10, 1.25, 1.50][l.meta_magnet || 0];
  player.damageMultiplier *= [1, 1.05, 1.12, 1.25][l.meta_damage || 0];
  rerollUses  += [0, 1, 2, 3][l.meta_reroll || 0];
  player.gold += [0, 5, 12, 22][l.meta_gold  || 0];
  player.xpMultiplier = (player.xpMultiplier || 1) * [1, 1.08, 1.18, 1.35][l.meta_xp || 0];
  player.shopDiscount = [0, 0.10, 0.20, 0.30][l.meta_shop || 0];
  player.critBonus    = (player.critBonus || 0) + [0, 0.05, 0.10, 0.18][l.meta_crit || 0];
  player.regenAfterHit = [0, 1, 2][l.meta_regen || 0];
  // 프리로드: 시작 무기 레벨은 startGame()에서 별도 처리
  player.preloadWeaponBonus = [0, 1, 2][l.meta_weapon || 0];
  player.cursePenaltyReduce = [0, 0.20, 0.40][l.meta_curse || 0];
}

function earnDataCores() {
  const earned = Math.max(1, Math.floor(killCount / 25) + Math.floor(currentStage / 6));
  saveData.dataCores += earned;
  saveSaveData();
  return earned;
}

function checkAchievements() {
  if (!player) return;
  const done = saveData.achievements;
  const conds = {
    ach_first:    () => killCount >= 1,
    ach_hunter:   () => killCount >= 100,
    ach_survivor: () => currentStage >= 5,
    ach_stage10:  () => currentStage >= 10,
    ach_evolved:  () => Object.values(player.weapons).some(w => w.level >= 5),
    ach_combo:    () => comboCount >= 25,
    ach_gold:     () => player.gold >= 50,
    ach_endless:  () => isEndlessMode
  };
  for (const ach of ACHIEVEMENTS) {
    if (done.includes(ach.id)) continue;
    if (conds[ach.id] && conds[ach.id]()) {
      done.push(ach.id);
      saveData.dataCores += ach.reward;
      saveSaveData();
      showAchievementPopup(ach);
    }
  }
}

function showAchievementPopup(ach) {
  const el = document.getElementById('achievement-popup');
  if (!el) return;
  el.querySelector('.ach-icon-el').textContent  = ach.icon;
  el.querySelector('.ach-name').textContent      = ach.name;
  el.querySelector('.ach-desc-el').textContent   = ach.desc;
  el.querySelector('.ach-reward').textContent    = `+${ach.reward}💾`;
  el.classList.add('active');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('active'), 3500);
}

function updateMenuMetaBadge() {
  const badge = document.getElementById('meta-cores-badge');
  if (badge) badge.textContent = saveData.dataCores;
  // 최고 기록 패널
  const bm = Math.floor((saveData.bestTime || 0) / 60);
  const bs = (saveData.bestTime || 0) % 60;
  const stageEl = document.getElementById('mrp-stage');
  const killsEl = document.getElementById('mrp-kills');
  const timeEl  = document.getElementById('mrp-time');
  if (stageEl) stageEl.textContent = saveData.bestStage ? `S ${saveData.bestStage}` : 'S —';
  if (killsEl) killsEl.textContent = saveData.bestKills ? `${saveData.bestKills.toLocaleString()} 킬` : '— 킬';
  if (timeEl)  timeEl.textContent  = saveData.bestStage
    ? `${bm.toString().padStart(2, '0')}:${bs.toString().padStart(2, '0')}` : '—:——';
}

function renderMetaGrid() {
  const grid = document.getElementById('meta-upgrade-grid');
  const disp = document.getElementById('meta-cores-display');
  if (!grid) return;
  if (disp) disp.textContent = `💾 보유 데이터 코어: ${saveData.dataCores}`;
  grid.innerHTML = '';
  for (const upg of META_UPGRADES) {
    const lvl   = saveData.metaLevels[upg.id] || 0;
    const maxed = lvl >= upg.maxLevel;
    const cost  = maxed ? null : upg.costs[lvl];
    const canBuy = !maxed && saveData.dataCores >= cost;
    const stars  = '★'.repeat(lvl) + '☆'.repeat(upg.maxLevel - lvl);
    const card = document.createElement('div');
    card.className = `meta-card${maxed ? ' meta-maxed' : ''}`;
    card.innerHTML = `
      <div class="meta-icon">${upg.icon}</div>
      <div class="meta-info">
        <div class="meta-name">${upg.name}</div>
        <div class="meta-stars">${stars}</div>
        <div class="meta-effect">${maxed ? '✓ 최대 강화' : upg.desc[lvl]}</div>
      </div>
      <button class="meta-buy-btn${canBuy ? '' : ' meta-buy-disabled'}"${canBuy ? '' : ' disabled'}>
        ${maxed ? 'MAX' : `💾${cost}`}
      </button>`;
    if (canBuy) {
      card.querySelector('.meta-buy-btn').addEventListener('click', () => {
        saveData.dataCores -= cost;
        saveData.metaLevels[upg.id] = lvl + 1;
        saveSaveData();
        renderMetaGrid();
      });
    }
    grid.appendChild(card);
  }
}

function openMetaModal() {
  renderMetaGrid();
  document.getElementById('meta-upgrade-modal').classList.add('active');
}

function closeMetaModal() {
  document.getElementById('meta-upgrade-modal').classList.remove('active');
  updateMenuMetaBadge();
}

function updateComboDisplay() {
  const el   = document.getElementById('combo-display');
  const mult = document.getElementById('combo-multiplier');
  const cnt  = document.getElementById('combo-count');
  if (!el) return;
  if (comboCount >= 5) {
    el.style.display = 'block';
    let m = getXpMultiplier();
    if (mult) { mult.textContent = `x${m.toFixed(2)} XP`; mult.style.color = comboCount >= 30 ? '#ffe600' : comboCount >= 15 ? '#b026ff' : '#39ff14'; }
    if (cnt)  cnt.textContent = `${comboCount} COMBO`;
  } else {
    el.style.display = 'none';
  }
}

function hideComboDisplay() {
  const el = document.getElementById('combo-display');
  if (el) el.style.display = 'none';
}

// ============================================================
// 16. 화면 진동 (Screen Shake)
// ============================================================
function triggerScreenShake(intensity, duration) {
  if (intensity > screenShake.intensity) {
    screenShake.intensity = intensity;
    screenShake.duration  = duration;
  }
}

function updateScreenShake(dt) {
  if (screenShake.duration > 0) {
    screenShake.duration -= dt;
    if (screenShake.duration > 0) {
      screenShake.x = (Math.random() - 0.5) * screenShake.intensity * 2;
      screenShake.y = (Math.random() - 0.5) * screenShake.intensity * 2;
    } else {
      screenShake.x = 0; screenShake.y = 0; screenShake.intensity = 0;
    }
  }
}

// ============================================================
// 17. 필드 아이템 스폰
// ============================================================
function updateFieldItems(dt) {
  fieldItemTimer += dt;
  let interval = Math.max(15000, 35000 - currentStage * 200);
  if (fieldItemTimer >= interval && fieldItems.length < 5) {
    fieldItemTimer = 0;
    spawnRandomFieldItem();
  }
  for (let i = fieldItems.length - 1; i >= 0; i--) {
    fieldItems[i].update(dt);
    if (fieldItems[i].collected || fieldItems[i].life <= 0) fieldItems.splice(i, 1);
  }
}

function spawnRandomFieldItem() {
  if (!player) return;
  let types = Object.keys(FIELD_ITEM_TYPES);
  let type  = types[Math.floor(Math.random() * types.length)];
  let angle = Math.random() * Math.PI * 2;
  let r     = 150 + Math.random() * 200;
  let ix = Math.max(30, Math.min(MAP_WIDTH  - 30, player.x + Math.cos(angle) * r));
  let iy = Math.max(30, Math.min(MAP_HEIGHT - 30, player.y + Math.sin(angle) * r));
  fieldItems.push(new FieldItem(ix, iy, type));
}

// ============================================================
// 18. 적 스폰 시스템
// ============================================================
let enemySpawnTimer    = 0;
let enemySpawnInterval = 1200;

function updateEnemySpawning(dt) {
  if (isBossStage || isStageClearAnim) return;
  enemySpawnTimer += dt;
  let timeMultiplier  = Math.min(gameTime / 300, 1.0);
  let stageMultiplier = Math.min((currentStage - 1) / 50, 0.7);
  enemySpawnInterval  = Math.max(200, 1200 - timeMultiplier * 600 - stageMultiplier * 500);
  const spawnRate = DIFFICULTY_SETTINGS[gameDifficulty]?.spawnRateMult || 1.0;
  const effectiveInterval = enemySpawnInterval / spawnRate;
  if (enemySpawnTimer >= effectiveInterval) {
    enemySpawnTimer = 0;
    spawnEnemyPack();
  }
}

function spawnEnemyPack() {
  if (!player || enemies.length >= MAX_ENEMIES) return;
  let count = 1 + Math.floor(Math.random() * 2);
  if (gameTime > 120 || currentStage > 5)  count += 1;
  if (gameTime > 240 || currentStage > 15) count += 2;
  count = Math.min(count, MAX_ENEMIES - enemies.length);

  for (let i = 0; i < count; i++) {
    let angle = Math.random() * Math.PI * 2;
    let d     = 450 + Math.random() * 150;
    let sx = Math.max(20, Math.min(MAP_WIDTH  - 20, player.x + Math.cos(angle) * d));
    let sy = Math.max(20, Math.min(MAP_HEIGHT - 20, player.y + Math.sin(angle) * d));

    let type = 'swarm';
    let rand = Math.random();

    // 엘리트 몬스터: 스테이지 8+ 부터 등장, 스테이지 높을수록 빈도 증가
    const eliteChance = Math.min((currentStage - 8) * 0.007, 0.15);
    if (currentStage >= 8 && Math.random() < eliteChance) {
      type = 'elite';
    } else if (gameTime > 180 || currentStage > 10) {
      if (rand < 0.25) type = 'bruiser';
      else if (rand < 0.55) type = 'rusher';
    } else if (gameTime > 60 || currentStage > 3) {
      if (rand < 0.12) type = 'bruiser';
      else if (rand < 0.35) type = 'rusher';
    } else {
      if (rand < 0.15) type = 'rusher';
    }
    enemies.push(new Enemy(sx, sy, type));
  }
}

// ============================================================
// 19. 충돌 감지
// ============================================================
function checkCollisions() {
  if (!player) return;

  // 투사체 vs 적 + 보스
  for (let i = projectiles.length - 1; i >= 0; i--) {
    if (i >= projectiles.length) continue;
    let p = projectiles[i];
    if (!p) continue;
    let allTargets = [...enemies];
    if (activeBoss) allTargets.push(activeBoss);

    for (let e of allTargets) {
      if (p.hitEnemies.has(e)) continue;
      if (dist(p.x, p.y, e.x, e.y) < p.radius + e.radius) {
        let isDead = e.takeDamage(p.damage, p.weaponKey);
        if (isDead) killCount++;
        p.hitEnemies.add(e);
        // 미사일: 충돌 시 폭발
        if (p instanceof MissileProjectile) { p.explode(); projectiles.splice(i, 1); break; }
        p.pierce--;
        if (p.pierce <= 0) { projectiles.splice(i, 1); break; }
      }
    }
  }

  // 보스 발사체 vs 플레이어
  if (player.shieldTimer <= 0 && !player.voidActive) {
    for (let i = bossProjectiles.length - 1; i >= 0; i--) {
      const bp = bossProjectiles[i];
      if (dist(bp.x, bp.y, player.x, player.y) < player.radius + bp.radius) {
        lastDamageSource = '보스 발사체';
        player.takeDamage(bp.damage);
        createExplosionParticles(bp.x, bp.y, bp.color, 8);
        bossProjectiles.splice(i, 1);
      }
    }
  }

  // 적 + 보스 vs 플레이어 충돌
  if (!player.lastHitTime) player.lastHitTime = 0;
  let now = Date.now();
  if (now - player.lastHitTime > 250) {
    let allTargets = [...enemies];
    if (activeBoss) allTargets.push(activeBoss);
    for (let e of allTargets) {
      if (dist(player.x, player.y, e.x, e.y) < player.radius + e.radius) {
        lastDamageSource = e === activeBoss ? '보스 충돌' : '바이러스 충돌';
        player.takeDamage(e.damage);
        player.lastHitTime = now;
        break;
      }
    }
  }
}

// ============================================================
// 20. 배경 + 맵 격자 렌더링
// ============================================================
// shadowBlur 없이 path만으로 바이러스 실루엣 그리기 (성능 최적화)
function _drawBgVirus(ctx, x, y, size, rot, type, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.strokeStyle = color;
  ctx.fillStyle   = 'transparent';
  ctx.lineWidth   = 1.2;
  if (type === 'spike') {
    // 단일 path로 원+스파이크 통합 (draw call 1회)
    ctx.beginPath(); ctx.arc(0, 0, size * 0.38, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const r1 = size * 0.38, r2 = size * 0.56;
      ctx.moveTo(Math.cos(a - 0.16) * r1, Math.sin(a - 0.16) * r1);
      ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
      ctx.lineTo(Math.cos(a + 0.16) * r1, Math.sin(a + 0.16) * r1);
    }
    ctx.stroke();
  } else if (type === 'hexa') {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
      i === 0 ? ctx.moveTo(Math.cos(a)*size*0.5, Math.sin(a)*size*0.5)
              : ctx.lineTo(Math.cos(a)*size*0.5, Math.sin(a)*size*0.5);
    }
    ctx.closePath(); ctx.stroke();
    // 내부 작은 육각형 하나만
    ctx.globalAlpha = alpha * 0.4;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
      i === 0 ? ctx.moveTo(Math.cos(a)*size*0.28, Math.sin(a)*size*0.28)
              : ctx.lineTo(Math.cos(a)*size*0.28, Math.sin(a)*size*0.28);
    }
    ctx.closePath(); ctx.stroke();
  } else {
    // double: 두 원만 (stroke only)
    ctx.beginPath(); ctx.arc(0, 0, size * 0.44, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = alpha * 0.5;
    ctx.beginPath(); ctx.arc(0, 0, size * 0.26, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function drawBackground(ctx, w, h, dt) {
  const th = getCurrentBgTheme();

  // 베이스 다크
  ctx.fillStyle = th.bgDark;
  ctx.fillRect(0, 0, w, h);

  // 중앙 방사형 글로우
  const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.55);
  grad.addColorStop(0, th.glow);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // 배경 바이러스 오브젝트 — offscreen canvas에 3프레임마다 갱신, 메인엔 drawImage 1회
  const dtMs = (dt || 16.66);
  _bgOCAge++;
  if (_bgOCAge >= 3 || _bgOCW !== w || _bgOCH !== h) {
    _bgOCAge = 0; _bgOCW = w; _bgOCH = h;
    if (!_bgOC) { _bgOC = document.createElement('canvas'); _bgOCtx = _bgOC.getContext('2d'); }
    if (_bgOC.width !== w || _bgOC.height !== h) { _bgOC.width = w; _bgOC.height = h; }
    _bgOCtx.clearRect(0, 0, w, h);
    for (const v of bgVirusObjs) {
      v.xNorm += v.vxNorm * dtMs * 3;
      v.yNorm += v.vyNorm * dtMs * 3;
      v.rot   += v.rotSpeed * dtMs * 3;
      if (v.xNorm < -0.15) v.xNorm = 1.15;
      if (v.xNorm >  1.15) v.xNorm = -0.15;
      if (v.yNorm < -0.15) v.yNorm = 1.15;
      if (v.yNorm >  1.15) v.yNorm = -0.15;
      _drawBgVirus(_bgOCtx, v.xNorm * w, v.yNorm * h, v.size, v.rot, v.type, BG_VIRUS_COLORS[v.colIdx], v.alpha);
    }
  }
  if (_bgOC) ctx.drawImage(_bgOC, 0, 0);

  // 흘러가는 별 입자 (색상 테마 적용)
  const elapsed = dtMs / 1000;
  for (const s of bgStars) {
    s.xNorm -= s.speedNorm * elapsed;
    if (s.xNorm < -0.01) { s.xNorm = 1.02 + Math.random() * 0.05; s.yNorm = Math.random(); }
    ctx.globalAlpha = s.alpha;
    ctx.fillStyle   = th.stars[_STAR_CI[s.color] ?? 0];
    ctx.beginPath();
    ctx.arc(s.xNorm * w, s.yNorm * h, s.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 보스 어프로치 연출 (shadowBlur 없음 — 단순 stroke + alpha만)
  if (typeof currentStage !== 'undefined' && gameState !== STATE_MENU) {
    const stageInCycle = currentStage % 10;
    const progress = stageInCycle === 0 ? 0 : Math.max(0, (stageInCycle - 4) / 5);
    if (progress > 0) {
      const silhAlpha = progress * 0.09;
      const silhSize  = progress * 110 + 40;
      const silhX     = w * 0.87 - progress * w * 0.14;
      const silhY     = h * 0.5;
      const bossColArr = ['#00f0ff','#b026ff','#ff4466','#ff8800','#ffe600','#ff0044','#39ff14','#ffffff','#ff6600','#b026ff'];
      const bCol = bossColArr[Math.floor(currentStage / 10) % bossColArr.length];
      ctx.save();
      ctx.globalAlpha = silhAlpha;
      ctx.strokeStyle = bCol;
      ctx.lineWidth   = 1.5;
      // 원 하나 + 6스파이크 (단일 stroke pass, shadowBlur 없음)
      ctx.beginPath(); ctx.arc(silhX, silhY, silhSize * 0.5, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a  = (i / 6) * Math.PI * 2;
        const r1 = silhSize * 0.5, r2 = silhSize * 0.72;
        ctx.moveTo(silhX + Math.cos(a - 0.18)*r1, silhY + Math.sin(a - 0.18)*r1);
        ctx.lineTo(silhX + Math.cos(a)*r2,         silhY + Math.sin(a)*r2);
        ctx.lineTo(silhX + Math.cos(a + 0.18)*r1, silhY + Math.sin(a + 0.18)*r1);
      }
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;

  // 수평 스캔 라인
  bgScanY = (bgScanY + 0.00010 * (dt || 16.66)) % 1;
  const scanY    = bgScanY * h;
  const scanGrad = ctx.createLinearGradient(0, scanY - 28, 0, scanY + 28);
  scanGrad.addColorStop(0,   `rgba(${th.scanRgb},0)`);
  scanGrad.addColorStop(0.5, `rgba(${th.scanRgb},0.022)`);
  scanGrad.addColorStop(1,   `rgba(${th.scanRgb},0)`);
  ctx.fillStyle = scanGrad;
  ctx.fillRect(0, scanY - 28, w, 56);

  // 필드 이벤트 활성 시 배경 오버레이
  if (activeFieldEvent) {
    const evtPulse = 0.06 + Math.sin(Date.now() * 0.0035) * 0.035;
    const evtColor = activeFieldEvent.id === 'golden_rush' ? `rgba(180,120,0,${evtPulse})`
                   : activeFieldEvent.id === 'core_surge'  ? `rgba(0,120,200,${evtPulse})`
                   : activeFieldEvent.id === 'emf_pulse'   ? `rgba(0,180,30,${evtPulse})`
                   : `rgba(200,20,0,${evtPulse + 0.02})`;
    ctx.fillStyle = evtColor;
    ctx.fillRect(0, 0, w, h);
    // 이벤트 테두리 펄스
    const bPulse = 0.3 + Math.sin(Date.now() * 0.005) * 0.2;
    ctx.strokeStyle = activeFieldEvent.color
      ? activeFieldEvent.color.replace(')', `,${bPulse})`).replace('rgb','rgba') : `rgba(255,50,0,${bPulse})`;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, w - 4, h - 4);
  }
}

function drawVignette(ctx, w, h) {
  const th = getCurrentBgTheme();
  ctx.save();
  const vGrad = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.22,
                                          w * 0.5, h * 0.5, Math.max(w, h) * 0.82);
  vGrad.addColorStop(0, 'rgba(0,0,0,0)');
  vGrad.addColorStop(1, th.vignetteColor);
  ctx.fillStyle = vGrad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawGrid(ctx, camera, width, height) {
  const th = getCurrentBgTheme();
  ctx.save();
  const gridSize = 100;
  let startX = Math.floor(camera.x / gridSize) * gridSize;
  let startY = Math.floor(camera.y / gridSize) * gridSize;

  // 소격자선
  ctx.strokeStyle = `rgba(${th.gridRgb},0.07)`;
  ctx.lineWidth   = 0.5;
  for (let x = startX; x < startX + width + gridSize; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x - camera.x, 0); ctx.lineTo(x - camera.x, height); ctx.stroke();
  }
  for (let y = startY; y < startY + height + gridSize; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, y - camera.y); ctx.lineTo(width, y - camera.y); ctx.stroke();
  }

  // 대격자선 (500 단위)
  const majorGrid = 500;
  let mx = Math.floor(camera.x / majorGrid) * majorGrid;
  let my = Math.floor(camera.y / majorGrid) * majorGrid;
  ctx.strokeStyle = `rgba(${th.gridRgb},0.14)`;
  ctx.lineWidth   = 0.8;
  for (let x = mx; x < mx + width + majorGrid; x += majorGrid) {
    ctx.beginPath(); ctx.moveTo(x - camera.x, 0); ctx.lineTo(x - camera.x, height); ctx.stroke();
  }
  for (let y = my; y < my + height + majorGrid; y += majorGrid) {
    ctx.beginPath(); ctx.moveTo(0, y - camera.y); ctx.lineTo(width, y - camera.y); ctx.stroke();
  }

  // 맵 경계 (테마 컬러 글로우)
  ctx.shadowBlur  = 12; ctx.shadowColor = th.borderGlow;
  ctx.strokeStyle = th.borderColor;
  ctx.lineWidth   = 2.5;
  ctx.strokeRect(-camera.x, -camera.y, MAP_WIDTH, MAP_HEIGHT);
  ctx.restore();
}

// ============================================================
// 21. 게임 라이프사이클 컨트롤러
// ============================================================
const canvas = document.getElementById('game-canvas');
const ctx    = canvas.getContext('2d');
let camera   = { x: 0, y: 0, width: 0, height: 0 };

function resizeCanvas() {
  canvas.width   = canvas.parentElement.clientWidth;
  canvas.height  = canvas.parentElement.clientHeight;
  camera.width   = canvas.width;
  camera.height  = canvas.height;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// 키보드
window.addEventListener('keydown', e => {
  // ESC / P: 일시정지 토글
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    if (gameState === STATE_PLAYING || gameState === STATE_STAGE_CLEAR || gameState === STATE_PAUSED) {
      e.preventDefault();
      togglePause();
      return;
    }
  }

  // 상점 키보드 조작
  if (gameState === STATE_SHOP) {
    const shopCards = [...document.querySelectorAll('#shop-items-list .shop-item-card')];
    if (shopCards.length) {
      if (['ArrowLeft','ArrowUp','a','A','w','W'].includes(e.key)) {
        e.preventDefault();
        shopFocusIdx = (shopFocusIdx - 1 + shopCards.length) % shopCards.length;
        updateShopFocus(shopCards); return;
      }
      if (['ArrowRight','ArrowDown','d','D','s','S'].includes(e.key)) {
        e.preventDefault();
        shopFocusIdx = (shopFocusIdx + 1) % shopCards.length;
        updateShopFocus(shopCards); return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const focused = shopCards[shopFocusIdx];
        if (focused && !focused.classList.contains('shop-cant-afford')) focused.click();
        return;
      }
    }
    if (e.key === 'Escape') { e.preventDefault(); closeShopModal(); return; }
  }

  // 스테이지 보너스 모달 키보드 조작
  if (gameState === STATE_STAGE_BONUS) {
    const bonusCards = [...document.querySelectorAll('#stage-bonus-list .bonus-card')];
    if (bonusCards.length) {
      if (['ArrowLeft','ArrowUp','a','A','w','W'].includes(e.key)) {
        e.preventDefault();
        bonusSelectedIdx = (bonusSelectedIdx - 1 + bonusCards.length) % bonusCards.length;
        updateBonusFocus(bonusCards);
        return;
      }
      if (['ArrowRight','ArrowDown','d','D','s','S'].includes(e.key)) {
        e.preventDefault();
        bonusSelectedIdx = (bonusSelectedIdx + 1) % bonusCards.length;
        updateBonusFocus(bonusCards);
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        bonusCards[bonusSelectedIdx]?.click();
        return;
      }
    }
  }

  // 레벨업 모달 키보드 조작
  if (gameState === STATE_LEVEL_UP) {
    const cards = [...document.querySelectorAll('#card-container .upgrade-card')];
    if (cards.length) {
      if (['ArrowLeft','ArrowUp','a','A','w','W'].includes(e.key)) {
        e.preventDefault();
        levelUpSelectedIdx = (levelUpSelectedIdx - 1 + cards.length) % cards.length;
        updateLevelUpFocus(cards);
        return;
      }
      if (['ArrowRight','ArrowDown','d','D','s','S'].includes(e.key)) {
        e.preventDefault();
        levelUpSelectedIdx = (levelUpSelectedIdx + 1) % cards.length;
        updateLevelUpFocus(cards);
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        cards[levelUpSelectedIdx]?.click();
        return;
      }
    }
  }
  // 저주 계약 모달: Y=수락, N/ESC=거절
  if (gameState === STATE_CURSE) {
    if (e.key === 'y' || e.key === 'Y') {
      e.preventDefault();
      document.getElementById('curse-accept-btn')?.click(); return;
    }
    if (e.key === 'n' || e.key === 'N' || e.key === 'Escape') {
      e.preventDefault();
      document.getElementById('curse-decline-btn')?.click(); return;
    }
  }

  // R키: 레벨업 모달에서 리롤
  if (gameState === STATE_LEVEL_UP && (e.key === 'r' || e.key === 'R')) {
    e.preventDefault();
    const rerollBtn = document.getElementById('reroll-btn');
    if (rerollBtn && !rerollBtn.disabled) rerollBtn.click();
    return;
  }
  // 개발자 모드 "7501" 버퍼 감지 (입력 필드 제외)
  if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
    const digit = e.key;
    if (digit >= '0' && digit <= '9') {
      clearTimeout(devKeyTimer);
      devKeyBuffer += digit;
      if (devKeyBuffer.length > 4) devKeyBuffer = devKeyBuffer.slice(-4);
      if (devKeyBuffer === '7501') {
        devKeyBuffer = '';
        toggleDevPanel();
      } else {
        devKeyTimer = setTimeout(() => { devKeyBuffer = ''; }, 2000);
      }
    } else {
      devKeyBuffer = '';
    }
  }

  keys[e.key] = true;
  if (e.key === 'm' || e.key === 'M') toggleBGM();
  if ((e.key === 'q' || e.key === 'Q') && (gameState === STATE_PLAYING || gameState === STATE_STAGE_CLEAR)) useActiveSkill();
  if ((e.key === 'e' || e.key === 'E') && gameState === STATE_PLAYING && mpMode && mpGameMode === 'battle' && !mpSpectating) mpTriggerSabotage();
});
window.addEventListener('keyup', e => { keys[e.key] = false; });

// UI 요소 참조
const menuScreen   = document.getElementById('menu-screen');
const gameScreen   = document.getElementById('game-screen');
const startBtn     = document.getElementById('start-btn');
const retryBtn     = document.getElementById('retry-btn');
const homeBtn      = document.getElementById('home-btn');
const levelUpModal  = document.getElementById('level-up-modal');
const gameOverModal = document.getElementById('game-over-modal');

startBtn.addEventListener('click', () => {
  initAudio();
  menuScreen.classList.remove('active');
  document.getElementById('class-select-screen').classList.add('active');
});
retryBtn.addEventListener('click', () => { startGame(); });
homeBtn.addEventListener('click',  () => {
  document.getElementById('class-select-screen').classList.remove('active');
  showScreen(STATE_MENU);
});
document.getElementById('mute-btn').addEventListener('click', () => toggleBGM());

// 클래스 선택 카드 이벤트 (2단계 선택 흐름)
document.querySelectorAll('.class-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.class-card').forEach(c => c.classList.remove('class-selected'));
    card.classList.add('class-selected');
    selectedClass = card.dataset.class;
    const hint = document.getElementById('class-selected-hint');
    const confirmBtn = document.getElementById('class-confirm-btn');
    const names = { hacker:'해커', cyborg:'사이보그', ghost:'고스트', engineer:'엔지니어', sniper:'스나이퍼', support:'서포터' };
    if (hint) { hint.textContent = `✓ ${names[selectedClass] || selectedClass} 선택됨`; hint.classList.add('has-selection'); }
    if (confirmBtn) confirmBtn.disabled = false;
  });
});

function confirmClassStart() {
  if (!selectedClass) return;
  document.getElementById('class-select-screen').classList.remove('active');
  startGame();
}

function goBackToMenu() {
  document.getElementById('class-select-screen').classList.remove('active');
  menuScreen.classList.add('active');
  // 선택 상태 초기화
  document.querySelectorAll('.class-card').forEach(c => c.classList.remove('class-selected'));
  const hint = document.getElementById('class-selected-hint');
  const confirmBtn = document.getElementById('class-confirm-btn');
  if (hint) { hint.textContent = '백신 유형을 선택하세요'; hint.classList.remove('has-selection'); }
  if (confirmBtn) confirmBtn.disabled = true;
}

function showScreen(state) {
  gameState = state;
  menuScreen.classList.remove('active');
  gameScreen.classList.remove('active');
  levelUpModal.classList.remove('active');
  gameOverModal.classList.remove('active');
  document.getElementById('stage-bonus-modal').classList.remove('active');
  document.getElementById('shop-modal').classList.remove('active');
  if (state === STATE_MENU) { menuScreen.classList.add('active'); menuBgmStarted = false; stopBGM(); updateMenuMetaBadge(); }
  else if (state === STATE_PLAYING || state === STATE_STAGE_CLEAR || state === STATE_STAGE_BONUS) {
    gameScreen.classList.add('active');
  }
  // 모바일 스킬버튼 표시 여부 갱신
  _refreshMobileControls(state);
}

// 모바일 전용: 터치 기기 감지
const _isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches;

function _refreshMobileControls(state) {
  const ctrl = document.getElementById('mobile-controls');
  if (!ctrl) return;
  const playing = state === STATE_PLAYING || state === STATE_STAGE_CLEAR;
  ctrl.style.display = (playing && _isTouchDevice()) ? 'block' : 'none';
}

// 스킬 버튼 매 프레임 업데이트 (쿨다운 링 + 아이콘)
const _MSR_CIRC = 175.9; // 2π × 28
function updateMobileSkillBtn() {
  const btn = document.getElementById('mobile-skill-btn');
  if (!btn) return;
  if (!player) { btn.style.opacity = '0.4'; return; }
  const cls = CLASS_DEFS[player.classId];
  if (!cls?.activeSkill) return;

  const maxCd  = cls.activeSkill.cd;
  const cdLeft = player.activeSkillCd || 0;
  const cdRatio = cdLeft > 0 ? cdLeft / maxCd : 0;

  // 아이콘
  const icon = document.getElementById('mobile-skill-icon');
  if (icon) icon.textContent = cls.activeSkill.icon || '⚡';

  // 쿨다운 텍스트
  const label = document.getElementById('mobile-skill-cd-label');
  if (label) label.textContent = cdLeft > 0 ? Math.ceil(cdLeft / 1000) + 's' : '';

  // SVG 링
  const circle = document.getElementById('mobile-skill-cd-circle');
  if (circle) circle.style.strokeDashoffset = cdRatio * _MSR_CIRC;

  // 준비 여부 표현
  btn.classList.toggle('on-cooldown', cdLeft > 0);
  btn.style.opacity = cdLeft > 0 ? '0.55' : '1';
}

// 모바일 스킬 버튼 터치 핸들러
function useActiveSkillTouch(e) {
  e.stopPropagation();
  e.preventDefault();
  useActiveSkill();
}

function startGame() {
  // 모바일 자동 전체화면
  if (_isTouchDevice() && !document.fullscreenElement && !document.webkitFullscreenElement) {
    const _el = document.documentElement;
    const _req = _el.requestFullscreen || _el.webkitRequestFullscreen || _el.mozRequestFullScreen;
    if (_req) _req.call(_el, { navigationUI: 'hide' }).catch(() => {});
  }

  // HUD 복원 (게임오버에서 hidden 처리한 것 되돌리기)
  const _sHudEl = document.getElementById('hud');
  if (_sHudEl) _sHudEl.style.visibility = '';
  showScreen(STATE_PLAYING);

  // 전체 리셋
  killCount = 0; gameTime = 0; timeAccumulator = 0; lastDamageSource = '';
  if (mpMode) { mpGameStartTime = Date.now(); mpSpectating = false; mpRespawnTimer = 0; _statAdd('mpGamesPlayed', 1); }
  enemies = []; projectiles = []; gems = []; particles = [];
  activeLasersArr = []; fieldItems = []; floatingTexts = [];
  bossProjectiles = [];
  activeBoss  = null;
  if (_gemMagnetTimer) { clearTimeout(_gemMagnetTimer); _gemMagnetTimer = null; }
  stageGemMagnet = false;
  currentStage = 1;
  stageKillProgress = 0;
  stageKillGoal     = getStageKillGoal(1);
  isBossStage       = false;
  isMiniBossStage   = false;
  isEndlessMode     = false;
  endlessModeStartTime = 0;
  isStageClearAnim  = false;
  stageClearAnimStartMs = 0;
  obstacles         = [];
  gameLoopId        = null;
  screenShake       = { x: 0, y: 0, intensity: 0, duration: 0 };
  comboCount = 0; comboTimer = 0; maxCombo = 0;
  evolutionCount = 0; activeSynergies = new Set(); pendingBossCurse = false; pendingNearDeathCurse = false;
  mines = []; blackHoles = [];
  fieldItemTimer    = 0;
  shopTimer         = 0;
  goldCoins         = [];
  achieveCheckTimer = 0;
  rerollUses        = (CLASS_DEFS[selectedClass] || CLASS_DEFS.hacker).rerolls;
  // 비트/이벤트/레벨업 리셋
  beatKickTimes    = []; beatWindowActive = false; beatChain = 0; beatChainTimer = 0;
  activeFieldEvent = null;
  fieldEventTimer  = 0;
  fieldEventInterval = 40000 + Math.random() * 20000;
  touchDX = 0; touchDY = 0; isTouching = false;
  pendingLevelUps  = 0; levelUpInProgress = false;
  bonusSelectedIdx = 0; prevStateBeforePause = null;
  const po = document.getElementById('pause-overlay');
  if (po) po.classList.remove('active');
  enemySpawnTimer   = 0;
  hideComboDisplay();
  hideStageOverlay();

  for (let k in weaponStats) weaponStats[k] = { level: 0, damage: 0, kills: 0 };

  player = new Player(MAP_WIDTH / 2, MAP_HEIGHT / 2);
  applyMetaUpgrades();
  if (player.preloadWeaponBonus > 0) {
    const cls = CLASS_DEFS[selectedClass] || CLASS_DEFS.hacker;
    const sw = cls.startWeapon || 'flare';
    const newLvl = Math.min(4, 1 + player.preloadWeaponBonus);
    if (player.weapons[sw]) { player.weapons[sw].level = newLvl; weaponStats[sw].level = newLvl; }
  }
  resizeCanvas();
  camera.x = player.x - camera.width  / 2;
  camera.y = player.y - camera.height / 2;

  // 승천 레벨 로드 + 보너스 적용
  ascensionLevel = saveData.ascensionLevel || 0;
  if (ascensionLevel > 0 && player) {
    const hpBonus = ascensionLevel * 15;
    player.maxHp += hpBonus;
    player.hp    += hpBonus;
    rerollUses   += Math.floor(ascensionLevel / 2);
    if (ascensionLevel >= 3) player.passiveXpMult *= 1.10;
    addFloatingText(player.x, player.y - 50, `✨ 승천 Lv.${ascensionLevel} 보너스 적용!`, '#ffe600', 13);
  }

  if (!isDailyRun) bgmTrackId = Math.floor(Math.random() * 3); // 일일 도전은 bgmTrackId=3 유지
  bgmTrackCheckTimer = 0;
  menuBgmStarted = true;
  initAudio(); // 오디오 컨텍스트 보장
  startBGM();
  lastTime = performance.now();
  gameLoopId = requestAnimationFrame(gameLoop);
}

// ============================================================
// 22-A. 커스텀 UI 유틸리티 (native confirm/alert/prompt 대체)
// ============================================================
let _gcOkCb = null, _gcCancelCb = null;

function showGameConfirm(msg, onOk, onCancel, opts = {}) {
  const modal  = document.getElementById('game-confirm-modal');
  const cancelBtn = document.getElementById('gc-cancel-btn');
  document.getElementById('gc-icon').textContent  = opts.icon    || '⚠';
  document.getElementById('gc-title').textContent = opts.title   || '확인';
  document.getElementById('gc-msg').textContent   = msg;
  document.getElementById('gc-ok-btn').textContent = opts.okLabel || '확인';
  cancelBtn.textContent = opts.cancelLabel || '취소';
  cancelBtn.style.display = opts.noCancel ? 'none' : '';
  const copyBox = document.getElementById('gc-copy-box');
  if (opts.copyText) {
    document.getElementById('gc-copy-text').value = opts.copyText;
    copyBox.style.display = 'flex';
  } else { copyBox.style.display = 'none'; }
  const hint = document.getElementById('gc-key-hint');
  hint.style.display = opts.noCancel ? 'none' : '';
  _gcOkCb = onOk || null;
  _gcCancelCb = onCancel || null;
  modal.classList.add('active');
}
function showGameAlert(msg, opts = {}) {
  showGameConfirm(msg, null, null, { ...opts, noCancel: true, icon: opts.icon || '⚡', title: opts.title || '알림', okLabel: opts.okLabel || '확인' });
}
function showGameToast(msg, duration = 2200) {
  const t = document.getElementById('game-toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), duration);
}
function gcOk()     { document.getElementById('game-confirm-modal').classList.remove('active'); _gcOkCb?.();     _gcOkCb = _gcCancelCb = null; }
function gcCancel() { document.getElementById('game-confirm-modal').classList.remove('active'); _gcCancelCb?.(); _gcOkCb = _gcCancelCb = null; }
function gcCopyText() {
  const ta = document.getElementById('gc-copy-text');
  if (!ta) return;
  ta.select(); document.execCommand('copy');
  showGameToast('📋 클립보드에 복사되었습니다');
  gcCancel();
}
// 커스텀 confirm/alert 모달 키보드 (Enter=OK, ESC=Cancel)
window.addEventListener('keydown', e => {
  const modal = document.getElementById('game-confirm-modal');
  if (!modal?.classList.contains('active')) return;
  if (e.key === 'Enter') { e.preventDefault(); gcOk(); }
  if (e.key === 'Escape') { e.preventDefault(); gcCancel(); }
}, true);

// ============================================================
// 22. 메인 게임 루프
function ensureGameLoopRunning() {
  if (gameLoopId !== null) return; // 이미 실행 중
  if (gameState !== STATE_PLAYING && gameState !== STATE_LEVEL_UP &&
      gameState !== STATE_STAGE_CLEAR && gameState !== STATE_STAGE_BONUS &&
      gameState !== STATE_SHOP && gameState !== STATE_PAUSED &&
      gameState !== STATE_CURSE) return;
  lastTime = performance.now();
  gameLoopId = requestAnimationFrame(gameLoop);
}

// ============================================================
function gameLoop(time) {
  gameLoopId = null;
  if (gameState !== STATE_PLAYING && gameState !== STATE_LEVEL_UP &&
      gameState !== STATE_STAGE_CLEAR && gameState !== STATE_STAGE_BONUS &&
      gameState !== STATE_SHOP && gameState !== STATE_PAUSED &&
      gameState !== STATE_CURSE) return;
  let dt = time - lastTime;
  if (dt > 100) dt = 16.66;
  lastTime = time;

  if (gameState === STATE_PLAYING || gameState === STATE_STAGE_CLEAR) update(dt);

  draw(dt);

  // FPS 카운터
  devFpsCount++;
  if (time - devLastFpsTs >= 500) {
    devCurrentFps = Math.round(devFpsCount * 1000 / (time - devLastFpsTs));
    devFpsCount   = 0;
    devLastFpsTs  = time;
    if (devMode) {
      const fpsEl = document.getElementById('dev-fps');
      if (fpsEl) fpsEl.textContent = devCurrentFps;
      const entEl = document.getElementById('dev-entity-count');
      if (entEl) entEl.textContent = `E${enemies.length}/P${projectiles.length}/G${gems.length}`;
      const stEl = document.getElementById('dev-stage-display');
      if (stEl) stEl.textContent = currentStage ?? '--';
    }
    if (showFps) {
      const hudFps = document.getElementById('hud-fps');
      if (hudFps) hudFps.textContent = `${devCurrentFps} FPS`;
    }
  }

  gameLoopId = requestAnimationFrame(gameLoop);
}

function update(dt) {
  // 시간 누적
  timeAccumulator += dt;
  if (timeAccumulator >= 1000) {
    gameTime++;
    timeAccumulator -= 1000;
    if (isEndlessMode) endlessModeStartTime; // 무한모드는 별도로 gameTime을 표시
  }

  player.update(dt);
  updateMobileSkillBtn();

  // 스펙테이터 카운트다운 (협동 모드만 부활)
  if (mpSpectating && mpGameMode === 'coop') {
    mpRespawnTimer -= dt / 1000;
    if (mpRespawnTimer <= 0) mpDoRespawn();
  }

  // 방해 스킬 쿨다운
  if (mpMode && mpGameMode === 'battle' && mpSabotageTimer > 0) {
    mpSabotageTimer -= dt;
  }

  // 카메라 추종 (스펙테이터 시 팀원 위치 추종)
  let targetCamX, targetCamY;
  if (mpSpectating) {
    const t = _mpGetSpectateTarget();
    targetCamX = (t ? (t.renderX ?? t.x) : player.x) - camera.width  / 2;
    targetCamY = (t ? (t.renderY ?? t.y) : player.y) - camera.height / 2;
  } else {
    targetCamX = player.x - camera.width  / 2;
    targetCamY = player.y - camera.height / 2;
  }
  camera.x += (targetCamX - camera.x) * 0.1;
  camera.y += (targetCamY - camera.y) * 0.1;
  camera.x = Math.max(0, Math.min(MAP_WIDTH  - camera.width,  camera.x));
  camera.y = Math.max(0, Math.min(MAP_HEIGHT - camera.height, camera.y));

  // 적 업데이트
  for (let i = enemies.length - 1; i >= 0; i--) enemies[i].update(dt);

  // 보스 업데이트
  if (activeBoss) activeBoss.update(dt);

  // 투사체
  for (let i = projectiles.length - 1; i >= 0; i--) {
    projectiles[i].update(dt);
    if (projectiles[i].life <= 0) {
      if (projectiles[i] instanceof MissileProjectile) projectiles[i].explode();
      projectiles.splice(i, 1);
    }
  }

  // 보스 발사체
  for (let i = bossProjectiles.length - 1; i >= 0; i--) {
    bossProjectiles[i].update(dt);
    if (bossProjectiles[i].life <= 0) bossProjectiles.splice(i, 1);
  }

  // 젬
  for (let i = gems.length - 1; i >= 0; i--) gems[i].update(dt);

  // 파티클
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update(dt);
    if (particles[i].life <= 0) particles.splice(i, 1);
  }

  // 플로팅 텍스트
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    floatingTexts[i].update(dt);
    if (floatingTexts[i].life <= 0) floatingTexts.splice(i, 1);
  }

  // 필드 아이템
  updateFieldItems(dt);

  // 마인 업데이트
  for (let i = mines.length - 1; i >= 0; i--) {
    if (i >= mines.length) continue;
    mines[i].update(dt);
    if (i >= mines.length) continue; // triggerStageClear가 mines를 클리어했을 수 있음
    if (mines[i].exploded) mines.splice(i, 1);
  }

  // 블랙홀 업데이트
  for (let i = blackHoles.length - 1; i >= 0; i--) {
    if (i >= blackHoles.length) continue;
    blackHoles[i].update(dt);
    if (i >= blackHoles.length) continue;
    if (blackHoles[i].dead) blackHoles.splice(i, 1);
  }

  // 장애물 업데이트 + 충돌 처리
  if (player) player._inVirusPool = false;
  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].update(dt);
    if (obstacles[i].dead) obstacles.splice(i, 1);
  }
  if (player) {
    for (const obs of obstacles) {
      if (obs.type === 'firewall' && obs.collidesWithCircle(player.x, player.y, player.radius)) {
        const push = obs.pushOutVector(player.x, player.y, player.radius);
        player.x = Math.max(player.radius, Math.min(MAP_WIDTH  - player.radius, player.x + push.x));
        player.y = Math.max(player.radius, Math.min(MAP_HEIGHT - player.radius, player.y + push.y));
      }
    }
    player._poolSpeedMult = player._inVirusPool ? 0.55 : 1.0;
  }

  // 적 스폰
  updateEnemySpawning(dt);

  // 충돌
  checkCollisions();

  // 콤보
  updateComboSystem(dt);

  // 업적 체크 (2초마다)
  achieveCheckTimer += dt;
  if (achieveCheckTimer >= 2000) { achieveCheckTimer = 0; checkAchievements(); }

  // 골드 코인 업데이트
  for (let i = goldCoins.length - 1; i >= 0; i--) {
    goldCoins[i].update(dt);
    if (goldCoins[i].collected) goldCoins.splice(i, 1);
  }

  // 상점 타이머 (2분마다, 보스/클리어 중 제외)
  shopTimer += dt;
  if (shopTimer >= 120000 && !isBossStage && !isStageClearAnim) {
    shopTimer = 0;
    triggerShopModal();
    return;
  }

  // 화면 진동
  updateScreenShake(dt);

  // 리듬 비트 윈도우 갱신
  if (audioCtx) {
    const now = audioCtx.currentTime;
    beatKickTimes    = beatKickTimes.filter(t => t > now - 0.35);
    beatWindowActive = beatKickTimes.some(t => Math.abs(t - now) < BEAT_WINDOW_SEC);
  }
  if (beatChain > 0) {
    beatChainTimer -= dt;
    if (beatChainTimer <= 0) { beatChain = 0; }
  }

  // 랜덤 필드 이벤트 타이머
  if (!isBossStage && !isStageClearAnim) {
    fieldEventTimer += dt;
    if (fieldEventTimer >= fieldEventInterval) {
      fieldEventTimer    = 0;
      fieldEventInterval = 40000 + Math.random() * 20000;
      triggerFieldEvent();
    }
    if (activeFieldEvent) {
      activeFieldEvent.remaining -= dt;
      if (activeFieldEvent.remaining <= 0) endFieldEvent();
    }
  }

  // 스테이지 클리어 연출 고착 감지 (15초 이상 isStageClearAnim=true면 강제 진행)
  if (isStageClearAnim && Date.now() - stageClearAnimStartMs > 15000) {
    showStageBonusSafe(200);
  }

  // 보스 스테이지 갇힘 감지: isBossStage=true인데 보스가 없는 상태가 12초 이상이면 강제 클리어
  if (isBossStage && !activeBoss && bossStageStartMs > 0 && Date.now() - bossStageStartMs > 12000) {
    bossStageStartMs = 0;
    isBossStage = false;
    isMiniBossStage = false;
    triggerStageClear();
  }

  // HUD 동기화
  updateHUD();

  // BGM 트랙은 설정 모달에서 수동 선택만 허용 — 자동 override 없음

  // MP 상태 동기화 + 보간 + 오라
  if (mpMode) {
    syncMpState(dt);
    mpUpdateGhostPositions(dt);
    mpCheckAura();
  }
}

// ============================================================
// 23. 그리기
// ============================================================
function draw(dt) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 배경 (화면 공간, 흔들림 없음)
  drawBackground(ctx, canvas.width, canvas.height, dt);

  // 화면 진동 적용
  ctx.save();
  if (screenShake.duration > 0) {
    ctx.translate(screenShake.x, screenShake.y);
  }

  drawGrid(ctx, camera, canvas.width, canvas.height);

  for (let gem of gems)  gem.draw(ctx, camera);

  ctx.save();
  for (let p of particles) p.draw(ctx, camera);
  ctx.globalAlpha = 1.0;
  ctx.restore();

  updateAndDrawLasers(ctx, camera, 16.66);

  for (let p of projectiles) p.draw(ctx, camera);
  for (let bp of bossProjectiles) bp.draw(ctx, camera);

  for (const obs of obstacles) obs.draw(ctx, camera);
  for (let e of enemies) e.draw(ctx, camera);

  if (activeBoss) activeBoss.draw(ctx, camera);

  for (let item of fieldItems) item.draw(ctx, camera);
  for (let coin of goldCoins)  coin.draw(ctx, camera);
  for (let m of mines) m.draw(ctx, camera);
  for (let bh of blackHoles) bh.draw(ctx, camera);

  player.draw(ctx, camera);

  // MP 고스트 플레이어
  if (mpMode) drawMultiplayerGhosts(ctx, camera);

  // 비트 윈도우 비주얼 — 플레이어 주위 펄스 링
  if (beatWindowActive && player) {
    const chainAlpha = Math.min(0.35 + beatChain * 0.06, 0.85);
    const ringR = player.radius + 14 + beatChain * 2;
    ctx.save();
    ctx.strokeStyle = `rgba(255, 230, 0, ${chainAlpha})`;
    ctx.lineWidth   = beatChain >= 3 ? 2.5 : 1.8;
    ctx.shadowBlur  = 18;
    ctx.shadowColor = '#ffe600';
    ctx.beginPath();
    ctx.arc(player.x - camera.x, player.y - camera.y, ringR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 플로팅 텍스트
  for (let ft of floatingTexts) ft.draw(ctx, camera);

  ctx.restore(); // 화면 진동 해제

  if (player) drawMinimap(ctx);

  // MP 스코어보드
  if (mpMode) drawMpScoreboard(ctx, canvas.width, canvas.height);

  // 배틀 모드 방해 스킬 버튼 (E키)
  if (mpMode && mpGameMode === 'battle' && !mpSpectating) {
    const bx = canvas.width - 70, by = canvas.height - 70;
    const ready = mpSabotageTimer <= 0;
    ctx.save();
    ctx.globalAlpha = ready ? 1 : 0.55;
    ctx.fillStyle = ready ? 'rgba(255,68,102,0.18)' : 'rgba(40,40,40,0.5)';
    ctx.strokeStyle = ready ? '#ff4466' : '#555';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(bx - 28, by - 28, 56, 56, 8); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = '22px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText('💀', bx, by + 8);
    ctx.font = 'bold 9px Orbitron, monospace';
    ctx.fillStyle = ready ? '#ff4466' : '#888';
    ctx.fillText(ready ? '[E] 방해' : `${Math.ceil(mpSabotageTimer/1000)}s`, bx, by + 24);
    ctx.restore();
  }

  // 스펙테이터 오버레이
  if (mpSpectating) {
    const cx = canvas.width / 2, cy = canvas.height / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.52)';
    ctx.fillRect(0, cy - 38, canvas.width, 76);
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px Orbitron, monospace';
    ctx.shadowBlur = 14; ctx.shadowColor = '#ff4466';
    ctx.fillStyle = '#ff4466';
    ctx.fillText(mpGameMode === 'battle' ? '💀 ELIMINATED' : '💀 SPECTATING', cx, cy - 14);
    ctx.shadowBlur = 0;
    ctx.font = '12px Orbitron, monospace';
    ctx.fillStyle = '#ffffff';
    if (mpGameMode === 'battle') {
      ctx.fillText('관전 중 — 팀원을 응원하세요!', cx, cy + 10);
    } else {
      ctx.fillText(`부활까지  ${Math.ceil(Math.max(0, mpRespawnTimer))}초`, cx, cy + 10);
    }
    ctx.restore();
  }

  // 비네트 오버레이 (화면 가장자리 어둡게)
  drawVignette(ctx, canvas.width, canvas.height);

  // 모바일 가상 조이스틱 (screen 좌표로 직접 그림)
  if (joystickBase && joystickKnob && isTouching) {
    ctx.save();
    ctx.globalAlpha = 0.30;
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(joystickBase.x, joystickBase.y, JOYSTICK_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle   = '#00f0ff';
    ctx.beginPath();
    ctx.arc(joystickKnob.x, joystickKnob.y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.restore();
  }
}

// ============================================================
// 미니맵
// ============================================================
function drawMinimap(ctx) {
  const SIZE  = 130;
  const PAD   = 12;
  const mx    = canvas.width  - SIZE - PAD;
  const my    = canvas.height - SIZE - PAD;
  const scaleX = SIZE / MAP_WIDTH;
  const scaleY = SIZE / MAP_HEIGHT;

  ctx.save();

  // 배경 + 테두리
  const mmRect = (x, y, w, h, r) => {
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); }
    else { ctx.rect(x, y, w, h); }
  };

  ctx.globalAlpha = 0.82;
  ctx.fillStyle   = 'rgba(3, 3, 12, 0.9)';
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
  ctx.lineWidth   = 1.5;
  ctx.beginPath(); mmRect(mx, my, SIZE, SIZE, 5); ctx.fill(); ctx.stroke();
  ctx.globalAlpha = 1.0;

  // 라벨
  ctx.font      = 'bold 7px Orbitron, monospace';
  ctx.fillStyle = 'rgba(0, 240, 255, 0.55)';
  ctx.textAlign = 'left';
  ctx.fillText('RADAR', mx + 5, my + 10);

  // 클립 영역
  ctx.beginPath(); mmRect(mx, my, SIZE, SIZE, 5); ctx.clip();

  // 격자선
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.07)';
  ctx.lineWidth   = 0.5;
  for (let i = 1; i < 5; i++) {
    const g = SIZE / 5 * i;
    ctx.beginPath(); ctx.moveTo(mx + g, my); ctx.lineTo(mx + g, my + SIZE); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx, my + g); ctx.lineTo(mx + SIZE, my + g); ctx.stroke();
  }

  // 젬 (최대 40개, 작은 점)
  ctx.fillStyle = 'rgba(0, 240, 255, 0.35)';
  const gemLimit = Math.min(gems.length, 40);
  for (let i = 0; i < gemLimit; i++) {
    ctx.beginPath();
    ctx.arc(mx + gems[i].x * scaleX, my + gems[i].y * scaleY, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  // 골드 코인
  ctx.fillStyle = 'rgba(255, 215, 0, 0.5)';
  for (const c of goldCoins) {
    ctx.beginPath();
    ctx.arc(mx + c.x * scaleX, my + c.y * scaleY, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  // 필드 아이템
  for (const item of fieldItems) {
    ctx.fillStyle   = item.color;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(mx + item.x * scaleX, my + item.y * scaleY, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }

  // 일반 적
  for (const e of enemies) {
    const r = e.type === 'bruiser' ? 2.5 : 1.5;
    ctx.fillStyle = e.type === 'bruiser' ? '#ff007f' : '#ff3040';
    ctx.beginPath();
    ctx.arc(mx + e.x * scaleX, my + e.y * scaleY, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 보스 (펄스)
  if (activeBoss) {
    const pulse = (Math.sin(Date.now() * 0.007) + 1) * 0.5;
    ctx.shadowBlur  = 8;
    ctx.shadowColor = '#ff0044';
    ctx.fillStyle   = `rgba(255, ${Math.floor(60 + pulse * 140)}, 0, 1)`;
    ctx.beginPath();
    ctx.arc(mx + activeBoss.x * scaleX, my + activeBoss.y * scaleY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // 카메라 뷰포트 영역 표시
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.22)';
  ctx.lineWidth   = 0.8;
  ctx.strokeRect(
    mx + camera.x * scaleX,
    my + camera.y * scaleY,
    camera.width  * scaleX,
    camera.height * scaleY
  );

  // 플레이어 (흰 테두리 + 파랑 점)
  const px = mx + player.x * scaleX;
  const py = my + player.y * scaleY;
  ctx.shadowBlur  = 10;
  ctx.shadowColor = '#00f0ff';
  ctx.fillStyle   = '#00f0ff';
  ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(px, py, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  ctx.restore();
}

// ============================================================
// 24. HUD 업데이트
// ============================================================
function updateHUD() {
  document.getElementById('player-level').innerText = player.level;
  document.getElementById('kill-count').innerText   = killCount;
  document.getElementById('stage-number').innerText = currentStage;
  const cls = CLASS_DEFS[player.classId];
  const clsEl = document.getElementById('class-icon');
  if (clsEl && cls) { clsEl.textContent = cls.icon; clsEl.style.color = cls.color; clsEl.style.textShadow = `0 0 5px ${cls.color}`; }

  // 무한모드 시 stage-number 색상 변경
  const stageEl = document.getElementById('stage-number');
  stageEl.style.color      = isEndlessMode ? '#ffe600' : '';
  stageEl.style.textShadow = isEndlessMode ? '0 0 5px #ffe600' : '';

  // 타이머
  let minutes = Math.floor(gameTime / 60);
  let seconds = gameTime % 60;
  document.getElementById('game-timer').innerText =
    `${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;

  // XP 바
  let xpPct = (player.xp / player.nextLevelXp) * 100;
  document.getElementById('xp-bar').style.width = `${Math.min(xpPct, 100)}%`;

  // HP 바
  let hpPct = (player.hp / player.maxHp) * 100;
  document.getElementById('hp-bar').style.width      = `${Math.max(hpPct, 0)}%`;
  document.getElementById('hp-bar').style.background = player.shieldTimer > 0 ? '#00f0ff' : '';
  document.getElementById('hp-text').innerText = `${Math.ceil(player.hp)} / ${player.maxHp}`;

  // 스테이지 진행 바
  const bossHud  = document.getElementById('boss-hud');
  const stageBar = document.getElementById('stage-bar');
  const stageBarText = document.getElementById('stage-bar-text');

  if (isBossStage && activeBoss) {
    bossHud.style.display = 'block';
    let bossPct = Math.max(activeBoss.hp / activeBoss.maxHp, 0) * 100;
    document.getElementById('boss-hp-bar').style.width    = `${bossPct}%`;
    document.getElementById('boss-hp-bar').style.background = bossPct > 50 ? '' : bossPct > 25 ? 'linear-gradient(90deg,#8b3000,#ff6600)' : 'linear-gradient(90deg,#8b0000,#ff2200)';
    document.getElementById('boss-name-text').innerText   = `⚠ ${activeBoss.name} ⚠`;
    document.getElementById('boss-hp-display').innerText  = `${Math.ceil(activeBoss.hp)} / ${activeBoss.maxHp}`;
    stageBar.style.width      = '100%';
    stageBar.style.background = '#ff0044';
    stageBarText.innerText    = 'BOSS STAGE';
  } else {
    bossHud.style.display = 'none';
    let progPct = stageKillGoal > 0 ? (stageKillProgress / stageKillGoal) * 100 : 100;
    stageBar.style.width      = `${Math.min(progPct, 100)}%`;
    stageBar.style.background = isEndlessMode ? 'linear-gradient(90deg,#ffe600,#ff8800)' : '';
    stageBarText.innerText    = isEndlessMode ? `∞ ${stageKillProgress}/${stageKillGoal}` : `${stageKillProgress} / ${stageKillGoal}`;
  }

  // 무기 슬롯 (진화 진행도 바 포함)
  let wc = document.getElementById('weapons-list');
  wc.innerHTML = '';
  for (let key in player.weapons) {
    let w = player.weapons[key];
    if (w.level > 0) {
      let slot = document.createElement('div');
      slot.className = 'weapon-slot active';
      const maxLvl = UPGRADES.weapons[key].maxLevel;
      const isEvolved = w.level >= maxLvl;
      const pct = (w.level / maxLvl) * 100;
      slot.title = UPGRADES.weapons[key].name + (isEvolved ? ` — ${UPGRADES.weapons[key].evolvedName || '진화'}` : ` Lv.${w.level}`);
      slot.innerHTML = `${UPGRADES.weapons[key].icon}<span class="weapon-level">${isEvolved ? '✨' : `Lv.${w.level}`}</span><div class="weapon-evo-bar"><div class="weapon-evo-fill" style="width:${pct}%;background:${isEvolved ? '#ffe600' : '#00f0ff'}"></div></div>`;
      wc.appendChild(slot);
    }
  }
  // 액티브 스킬 슬롯
  const actCls = CLASS_DEFS[player.classId];
  if (actCls?.activeSkill) {
    let skillEl = document.getElementById('active-skill-slot');
    if (!skillEl) {
      skillEl = document.createElement('div');
      skillEl.id = 'active-skill-slot';
      skillEl.className = 'active-skill-slot';
      wc.parentNode.appendChild(skillEl);
    }
    const cdReady = player.activeSkillCd <= 0;
    skillEl.innerHTML = `<span>${actCls.activeSkill.icon}</span><span class="skill-cd-text">${cdReady ? 'Q' : Math.ceil(player.activeSkillCd / 1000) + 's'}</span>`;
    skillEl.style.opacity = cdReady ? '1' : '0.5';
    skillEl.title = `[Q] ${actCls.activeSkill.name}: ${actCls.activeSkill.desc}`;
  }
  // 빌드 요약 HUD
  const buildHud = document.getElementById('build-summary-hud');
  if (buildHud) {
    const parts = [];
    if (activeSynergies.size > 0) {
      [...activeSynergies].forEach(id => { const s = SYNERGY_DEFS.find(d => d.id === id); if (s) parts.push(`${s.icon}${s.name}`); });
    }
    if (player._curseDamageMult > 1) parts.push('🦠감염');
    if (player.skillShieldActive)    parts.push('🛡강화');
    if (player.skillInvincible)      parts.push('👁위상');
    buildHud.style.display = parts.length > 0 ? 'flex' : 'none';
    buildHud.textContent = parts.join('  ·  ');
  }

  // 골드 표시
  const goldEl = document.getElementById('gold-count');
  if (goldEl) goldEl.innerText = player.gold;

  // 패시브 슬롯
  const pc = document.getElementById('passive-list');
  if (pc) {
    pc.innerHTML = '';
    for (let key in PASSIVE_DEFS) {
      const lvl = player.passives[key];
      if (lvl > 0) {
        const slot = document.createElement('div');
        slot.className = 'passive-slot';
        slot.title     = `${PASSIVE_DEFS[key].name} Lv.${lvl}`;
        slot.innerHTML = `${PASSIVE_DEFS[key].icon}<span class="passive-level">${lvl}</span>`;
        pc.appendChild(slot);
      }
    }
  }
}

// ============================================================
// 25. 레벨업 시스템 (레어리티 + 리롤 + 전설)
// ============================================================
function rollRarity() {
  let r   = Math.random();
  let cum = 0;
  for (let [key, data] of Object.entries(RARITY_DATA)) {
    cum += data.prob;
    if (r < cum) return key;
  }
  return 'common';
}

function updateLevelUpFocus(cards) {
  cards.forEach((c, i) => c.classList.toggle('card-kb-focus', i === levelUpSelectedIdx));
}

function triggerLevelUpModal() {
  gameState = STATE_LEVEL_UP;
  levelUpModal.classList.add('active');
  renderUpgradeCards(generateUpgradeChoices());
  levelUpSelectedIdx = 0;
  updateLevelUpFocus([...document.querySelectorAll('#card-container .upgrade-card')]);

  const rerollBtn  = document.getElementById('reroll-btn');
  const rerollUsesEl = document.getElementById('reroll-uses');
  rerollBtn.disabled = (rerollUses <= 0);
  if (rerollUsesEl) rerollUsesEl.textContent = `(${rerollUses}회)`;

  rerollBtn.onclick = () => {
    if (rerollUses <= 0) return;
    rerollUses--;
    renderUpgradeCards(generateUpgradeChoices());
    levelUpSelectedIdx = 0;
    updateLevelUpFocus([...document.querySelectorAll('#card-container .upgrade-card')]);
    rerollBtn.disabled = (rerollUses <= 0);
    if (rerollUsesEl) rerollUsesEl.textContent = `(${rerollUses}회)`;
    playSynthSound([400, 600, 800], 0.15, 'square', 0.05);
  };
}

function generateUpgradeChoices() {
  let pool = [];

  // 무기 풀
  for (let key in UPGRADES.weapons) {
    let wData = UPGRADES.weapons[key];
    let lvl   = player.weapons[key].level;
    if (lvl === 0) {
      pool.push({ type:'weapon', key, name:wData.name, icon:wData.icon, desc:wData.desc[0], isUpgrade:false, nextLevel:1 });
    } else if (lvl < wData.maxLevel) {
      pool.push({ type:'weapon', key, name:wData.name, icon:wData.icon, desc:wData.desc[lvl], isUpgrade:true, nextLevel:lvl+1 });
    }
  }

  // 스탯 풀
  UPGRADES.stats.forEach(stat => {
    pool.push({ type:'stat', id:stat.id, name:stat.name, icon:stat.icon, desc:stat.desc });
  });

  // 패시브 풀
  for (let key in PASSIVE_DEFS) {
    const pd  = PASSIVE_DEFS[key];
    const lvl = player.passives[key];
    if (lvl < 2) {
      pool.push({ type:'passive', key, name:pd.name, icon:pd.icon, desc:pd.desc[lvl], isUpgrade: lvl > 0, nextLevel: lvl + 1 });
    }
  }

  let choices = [];
  let tempPool = [...pool];

  for (let i = 0; i < 4; i++) {
    let rarity = rollRarity();

    if (rarity === 'legendary') {
      let legItem = LEGENDARY_POOL[Math.floor(Math.random() * LEGENDARY_POOL.length)];
      choices.push({ ...legItem, type:'legendary', rarity:'legendary' });
      continue;
    }

    // 에픽 등급 시 35% 확률로 부활 에픽 제공
    if (rarity === 'epic' && Math.random() < 0.35) {
      const available = REVIVAL_EPICS.filter(r => {
        const key = r.id.replace('rev_', '');
        return key === 'laststand' ? (player.revivals.lastStand < 4) : !player.revivals[key];
      });
      if (available.length > 0) {
        const rev = available[Math.floor(Math.random() * available.length)];
        choices.push({ ...rev, type: 'revival', rarity: 'epic', rarityMult: 2.0 });
        continue;
      }
    }

    if (tempPool.length === 0) break;
    let idx    = Math.floor(Math.random() * tempPool.length);
    let choice = { ...tempPool.splice(idx, 1)[0], rarity };
    choice.rarityMult = rarity === 'epic' ? 2.0 : rarity === 'rare' ? 1.5 : 1.0;
    choices.push(choice);
  }

  return choices;
}

function renderUpgradeCards(choices) {
  const container = document.getElementById('card-container');
  container.innerHTML = '';

  choices.forEach(choice => {
    let card = document.createElement('div');
    let rd   = RARITY_DATA[choice.rarity] || RARITY_DATA.common;

    // 기본 스타일 클래스
    let baseClass = 'new-weapon';
    if      (choice.type === 'stat')                        baseClass = 'stat-boost';
    else if (choice.type === 'passive' && choice.isUpgrade) baseClass = 'passive-upgrade';
    else if (choice.type === 'passive')                     baseClass = 'new-passive';
    else if (choice.isUpgrade)                              baseClass = 'weapon-upgrade';
    else if (choice.type === 'legendary')                   baseClass = 'new-weapon';

    card.className = `upgrade-card ${baseClass} rarity-${choice.rarity || 'common'}`;

    let tagText  = '신규 무기';
    if      (choice.type === 'revival')                      tagText = '💀 에픽 부활';
    else if (choice.type === 'stat')                         tagText = '시스템 강화';
    else if (choice.type === 'passive' && !choice.isUpgrade) tagText = '패시브 신규';
    else if (choice.type === 'passive' && choice.isUpgrade)  tagText = `패시브 Lv${choice.nextLevel}`;
    else if (choice.isUpgrade)                               tagText = `업그레이드 Lv.${choice.nextLevel}`;
    else if (choice.type === 'legendary')                    tagText = '⭐ 전설';

    let descText = choice.desc;
    if (choice.rarityMult > 1.0 && choice.type === 'stat') {
      descText += ` <span style="color:${rd.color}">[${rd.name}: 효과 x${choice.rarityMult}]</span>`;
    }

    const evoPreview = (choice.type === 'weapon' && choice.nextLevel === 5)
      ? `<div class="evo-preview-badge">✨ 진화 → ${UPGRADES.weapons[choice.key]?.evolvedName || '진화형'}</div>`
      : '';
    card.innerHTML = `
      <div class="card-icon">${choice.icon}</div>
      <div class="card-details">
        <div class="card-title-row">
          <span class="card-name" style="color:${choice.rarity === 'legendary' ? '#ffe600' : '#fff'}">${choice.name}</span>
          <span class="card-tag tag-${choice.rarity || 'common'}">${tagText}</span>
        </div>
        <div class="card-desc">${descText}</div>
        ${evoPreview}
      </div>
    `;

    card.addEventListener('click', () => {
      applyUpgrade(choice);
      closeLevelUpModal();
    });

    container.appendChild(card);
  });
}

// 레벨업 모달 닫기 — 대기 중인 레벨업 있으면 순차 처리
function closeLevelUpModal() {
  levelUpModal.classList.remove('active');
  if (pendingLevelUps > 0) {
    pendingLevelUps--;
    playLevelUpSound();
    triggerLevelUpModal(); // 다음 레벨업 모달 열기
  } else {
    levelUpInProgress = false;
    // 보너스 모달이 이미 열려 있으면 gameState 덮어쓰지 않음
    if (gameState !== STATE_STAGE_BONUS && gameState !== STATE_SHOP && gameState !== STATE_CURSE) {
      gameState = isStageClearAnim ? STATE_STAGE_CLEAR : STATE_PLAYING;
    }
    lastTime  = performance.now();
    ensureGameLoopRunning();
  }
}

// ─── 일시정지 시스템 ───
function pauseGame() {
  if (gameState !== STATE_PLAYING && gameState !== STATE_STAGE_CLEAR) return;
  prevStateBeforePause = gameState;
  gameState = STATE_PAUSED;
  openSettingsModal();
}

function resumeGame() {
  if (gameState !== STATE_PAUSED) return;
  gameState = prevStateBeforePause || STATE_PLAYING;
  const modal = document.getElementById('settings-modal');
  if (modal) modal.classList.remove('active');
  const ia = document.getElementById('settings-ingame-actions');
  if (ia) ia.style.display = 'none';
  lastTime = performance.now();
  ensureGameLoopRunning();
}

function goToMenu() {
  showGameConfirm(
    '지금 게임을 종료하고 메인 메뉴로 돌아갑니다.\n진행 상황은 자동 저장됩니다.',
    () => {
      stopBGM();
      if (gameLoopId) { cancelAnimationFrame(gameLoopId); gameLoopId = null; }
      enemies.length = 0; projectiles.length = 0; activeBoss = null;
      isDailyRun = false; mpSpectating = false;
      const _modal = document.getElementById('settings-modal');
      if (_modal) _modal.classList.remove('active');
      const _ia = document.getElementById('settings-ingame-actions');
      if (_ia) _ia.style.display = 'none';
      const _hudEl2 = document.getElementById('hud');
      if (_hudEl2) _hudEl2.style.visibility = '';
      gameState = STATE_MENU;
      showScreen(STATE_MENU);
      menuBgmStarted = false;
      tryStartMenuBgm();
    },
    null,
    { title: '게임 종료', icon: '⚡', okLabel: '나가기', cancelLabel: '계속하기' }
  );
}

function togglePause() {
  if (gameState === STATE_PAUSED) resumeGame();
  else pauseGame();
}

// ============================================================
// 저주/축복 시스템
// ============================================================
function showCurseModal() {
  gameState = STATE_CURSE;
  const curse = CURSE_DEFS[Math.floor(Math.random() * CURSE_DEFS.length)];
  const modal = document.getElementById('curse-modal');
  const card  = document.getElementById('curse-offer-card');
  if (!modal || !card) { gameState = STATE_STAGE_BONUS; showStageBonusModal(); return; }
  card.innerHTML = `
    <div class="curse-debuff">🦠 감염: ${curse.debuff}</div>
    <div class="curse-reward">⚡ 추출: ${curse.reward}</div>
  `;
  document.getElementById('curse-accept-btn').onclick = () => applyCurseChoice(curse, true);
  document.getElementById('curse-decline-btn').onclick = () => applyCurseChoice(curse, false);
  modal.classList.add('active');
  ensureGameLoopRunning();
}

// 근사망 저주: 선택 후 게임 플레이로 복귀 (스테이지 보너스 없음)
function showNearDeathCurseModal() {
  gameState = STATE_CURSE;
  const curse = CURSE_DEFS[Math.floor(Math.random() * CURSE_DEFS.length)];
  const modal = document.getElementById('curse-modal');
  const card  = document.getElementById('curse-offer-card');
  if (!modal || !card) { gameState = STATE_PLAYING; ensureGameLoopRunning(); return; }
  card.innerHTML = `
    <div style="color:#ff8800;font-size:0.75rem;margin-bottom:6px">⚠ 위기 감염 협약 — 생존 우선</div>
    <div class="curse-debuff">🦠 감염: ${curse.debuff}</div>
    <div class="curse-reward">⚡ 추출: ${curse.reward}</div>
  `;
  document.getElementById('curse-accept-btn').onclick = () => applyNearDeathCurseChoice(curse, true);
  document.getElementById('curse-decline-btn').onclick = () => applyNearDeathCurseChoice(curse, false);
  modal.classList.add('active');
  ensureGameLoopRunning();
}

function applyNearDeathCurseChoice(curse, accepted) {
  document.getElementById('curse-modal').classList.remove('active');
  if (accepted && player) {
    curse.debuffFn(player);
    curse.rewardFn();
    addFloatingText(player.x, player.y - 40, '🦠 감염 감수!', '#ff4466', 15);
    playSynthSound([150, 80, 200], 0.2, 'sawtooth', 0.1);
    triggerScreenShake(8, 400);
  } else {
    addFloatingText(player?.x ?? 0, (player?.y ?? 0) - 40, '🛡 격리 완료', '#94a3b8', 13);
  }
  // 근사망 저주는 스테이지 보너스 없이 바로 게임 복귀
  gameState = STATE_PLAYING;
  lastTime = performance.now();
  ensureGameLoopRunning();
}

function applyCurseChoice(curse, accepted) {
  document.getElementById('curse-modal').classList.remove('active');
  if (accepted && player) {
    curse.debuffFn(player);
    curse.rewardFn();
    addFloatingText(player.x, player.y - 40, '🦠 감염 감수!', '#ff4466', 15);
    playSynthSound([150, 80, 200], 0.2, 'sawtooth', 0.1);
    triggerScreenShake(8, 400);
  } else {
    addFloatingText(player?.x ?? 0, (player?.y ?? 0) - 40, '🛡 격리 완료', '#94a3b8', 13);
  }
  gameState = STATE_STAGE_BONUS;
  showStageBonusModal();
}

// ============================================================
// 무기 시너지 시스템
// ============================================================
function checkSynergies() {
  if (!player) return;
  for (const syn of SYNERGY_DEFS) {
    if (activeSynergies.has(syn.id)) continue;
    const allActive = syn.weapons.every(key => {
      if (key in player.weapons) return player.weapons[key].level > 0;
      if (key in player.passives) return player.passives[key] > 0;
      return false;
    });
    if (allActive) {
      activeSynergies.add(syn.id);
      syn.apply(player);
      showSynergyBanner(syn.icon, syn.name);
      addFloatingText(player.x, player.y - 55, `✨ 시너지: ${syn.name}!`, '#ffe600', 14);
      triggerScreenShake(6, 400);
      playSynthSound([600, 900, 1400, 800], 0.18, 'sine', 0.07);
    }
  }
}

function showSynergyBanner(icon, name) {
  const banner = document.getElementById('synergy-banner');
  if (!banner) return;
  document.getElementById('syn-icon').textContent = icon;
  document.getElementById('syn-name').textContent = name;
  banner.classList.add('active');
  clearTimeout(banner._timer);
  banner._timer = setTimeout(() => banner.classList.remove('active'), 2800);
}

function showEvolutionNotification(icon, name) {
  const banner = document.getElementById('evolution-banner');
  if (!banner) return;
  banner.querySelector('#evo-icon').textContent = icon;
  banner.querySelector('#evo-name').textContent = name;
  banner.classList.add('active');
  setTimeout(() => banner.classList.remove('active'), 2500);
  triggerScreenShake(10, 700);
  playSynthSound([200, 800, 1600], 0.22, 'sawtooth', 0.1);
}

function applyUpgrade(choice) {
  let mult = choice.rarityMult || 1.0;

  if (choice.type === 'legendary') {
    applyLegendaryUpgrade(choice.id);
    return;
  }

  if (choice.type === 'revival') {
    applyRevivalPerk(choice.id);
    return;
  }

  if (choice.type === 'weapon') {
    let weapon = player.weapons[choice.key];
    weapon.level = choice.nextLevel;
    weaponStats[choice.key].level = choice.nextLevel;
    if (choice.nextLevel === 5) {
      evolutionCount++;
      _statAdd('totalEvolutions', 1);
      let evolvedName = UPGRADES.weapons[choice.key].evolvedName || UPGRADES.weapons[choice.key].name;
      showEvolutionNotification(UPGRADES.weapons[choice.key].icon, evolvedName);
    } else {
      playSynthSound([600, 1200], 0.15, 'sine', 0.05);
    }
    checkSynergies();
  } else if (choice.type === 'stat') {
    switch (choice.id) {
      case 'stat_hp':
        player.maxHp += Math.floor(20 * mult);
        player.hp = Math.min(player.hp + Math.floor(30 * mult), player.maxHp); break;
      case 'stat_speed':
        player.speed *= 1 + 0.1 * mult; break;
      case 'stat_damage':
        player.damageMultiplier *= 1 + 0.15 * mult; break;
      case 'stat_magnet':
        player.magnetRadius *= 1 + 0.3 * mult; break;
    }
    playSynthSound([800, 1000], 0.1, 'triangle', 0.05);
  } else if (choice.type === 'passive') {
    player.passives[choice.key] = choice.nextLevel;
    applyPassiveEffect(choice.key, choice.nextLevel);
    playSynthSound([500, 900, 1200], 0.12, 'triangle', 0.05);
    checkSynergies();
  }
}

function applyPassiveEffect(key, level) {
  switch (key) {
    case 'overclock':
      player.damageMultiplier *= level === 2 ? (1.4 / 1.12) : 1.12;
      addFloatingText(player.x, player.y - 40, `⚙️ 과부하 회로 Lv${level}!`, '#ffe600', 14);
      break;
    case 'resonance':
      player.passiveXpMult = level === 2 ? 1.45 : 1.2;
      addFloatingText(player.x, player.y - 40, `🔮 공명 코어 Lv${level}!`, '#b026ff', 14);
      break;
    case 'shield':
      player.damageReduction = level === 2 ? 0.22 : 0.10;
      addFloatingText(player.x, player.y - 40, `💠 방어막 Lv${level}!`, '#00f0ff', 14);
      break;
    case 'regen':
      addFloatingText(player.x, player.y - 40, `🔋 회생 코어 Lv${level}!`, '#39ff14', 14);
      break;
    case 'nanobots':
      addFloatingText(player.x, player.y - 40, `🦠 나노봇 Lv${level}!`, '#b026ff', 14);
      break;
    case 'thorns':
      addFloatingText(player.x, player.y - 40, `⚔️ 복수의 가시 Lv${level}!`, '#ff4466', 14);
      break;
    case 'critical':
      addFloatingText(player.x, player.y - 40, `💥 크리티컬 코어 Lv${level}!`, '#ffe600', 14);
      break;
    case 'explosive':
      addFloatingText(player.x, player.y - 40, `💣 폭발 연쇄 Lv${level}!`, '#ff8800', 14);
      break;
    case 'barrier':
      player.barrierTimer = 0;
      addFloatingText(player.x, player.y - 40, `🛡 전기 방벽 Lv${level}!`, '#00f0ff', 14);
      break;
  }
}

// ============================================================
// 상점 시스템
// ============================================================
function updateShopFocus(cards) {
  cards.forEach((c, i) => c.classList.toggle('shop-kb-focus', i === shopFocusIdx));
}

function triggerShopModal() {
  gameState = STATE_SHOP;
  shopFocusIdx = 0;
  const modal    = document.getElementById('shop-modal');
  const goldDisp = document.getElementById('shop-gold-display');
  if (goldDisp) goldDisp.textContent = `보유 골드: 💰 ${player.gold}G`;
  const shuffled = [...SHOP_ITEMS].sort(() => Math.random() - 0.5).slice(0, 3);
  renderShopItems(shuffled);
  modal.classList.add('active');
  setTimeout(() => updateShopFocus([...document.querySelectorAll('#shop-items-list .shop-item-card')]), 50);
}

function getItemCost(item) {
  const discount = player?.shopDiscount || 0;
  return Math.max(1, Math.floor(item.cost * (1 - discount)));
}

function renderShopItems(items) {
  const list     = document.getElementById('shop-items-list');
  const goldDisp = document.getElementById('shop-gold-display');
  if (goldDisp) goldDisp.textContent = `보유 골드: 💰 ${player.gold}G`;
  list.innerHTML = '';
  items.forEach(item => {
    const cost = getItemCost(item);
    const canAfford = player.gold >= cost;
    const btn = document.createElement('button');
    btn.className = `shop-item-card${canAfford ? '' : ' shop-cant-afford'}`;
    const discountTag = (player?.shopDiscount > 0) ? ` <span style="color:#39ff14;font-size:0.7em">(-${Math.round((player.shopDiscount)*100)}%)</span>` : '';
    btn.innerHTML = `
      <div class="shop-item-icon">${item.icon}</div>
      <div class="shop-item-details">
        <div class="shop-item-name">${item.name}</div>
        <div class="shop-item-desc">${item.desc}</div>
      </div>
      <div class="shop-item-cost ${canAfford ? 'can-afford' : 'cant-afford'}">💰 ${cost}G${discountTag}</div>
    `;
    if (canAfford) {
      btn.addEventListener('click', () => {
        applyShopItem(item);
        renderShopItems(items);
      });
    }
    list.appendChild(btn);
  });
}

function applyShopItem(item) {
  const cost = getItemCost(item);
  if (player.gold < cost) return;
  player.gold -= cost;
  switch (item.id) {
    case 'shop_hp': {
      const heal = Math.floor(player.maxHp * 0.5);
      player.hp = Math.min(player.hp + heal, player.maxHp);
      addFloatingText(player.x, player.y - 40, `+${heal} HP`, '#ff4466', 16);
      break;
    }
    case 'shop_damage':
      player.damageMultiplier *= 1.2;
      addFloatingText(player.x, player.y - 40, '🔥 피해 +20%', '#ff6600', 14);
      break;
    case 'shop_speed':
      player.speed *= 1.15;
      addFloatingText(player.x, player.y - 40, '🏃 속도 +15%', '#39ff14', 14);
      break;
    case 'shop_magnet':
      player.magnetRadius *= 1.4;
      addFloatingText(player.x, player.y - 40, '🧲 자석 +40%', '#b026ff', 14);
      break;
    case 'shop_reroll':
      rerollUses += 2;
      addFloatingText(player.x, player.y - 40, '🔄 리롤 +2', '#ffe600', 14);
      break;
    case 'shop_maxhp':
      player.maxHp += 30;
      player.hp = Math.min(player.hp + 30, player.maxHp);
      addFloatingText(player.x, player.y - 40, '❤️ 최대 HP +30', '#ff4466', 14);
      break;
  }
  playSynthSound([440, 880], 0.1, 'sine', 0.06);
}

function closeShopModal() {
  document.getElementById('shop-modal').classList.remove('active');
  gameState = isStageClearAnim ? STATE_STAGE_CLEAR : STATE_PLAYING;
  shopTimer = 0;
  lastTime  = performance.now();
  ensureGameLoopRunning();
}

function applyRevivalPerk(id) {
  if (!player) return;
  switch (id) {
    case 'rev_restore':
      player.revivals.restore = true;
      addFloatingText(player.x, player.y - 40, '💾 복원 칩 장착!', '#39ff14', 14); break;
    case 'rev_backup':
      player.revivals.backup  = true;
      addFloatingText(player.x, player.y - 40, '🔄 긴급 백업 장착!', '#ffe600', 14); break;
    case 'rev_laststand':
      player.revivals.lastStand += 2;
      addFloatingText(player.x, player.y - 40, `🛡 방어막 장전! (${player.revivals.lastStand}회)`, '#00f0ff', 14); break;
    case 'rev_counter':
      player.revivals.counter = true;
      addFloatingText(player.x, player.y - 40, '💥 절명 반격 장착!', '#ff4466', 14); break;
    case 'rev_void':
      player.revivals.void    = true;
      addFloatingText(player.x, player.y - 40, '🌀 공허 코어 장착!', '#b026ff', 14); break;
  }
  playSynthSound([300, 600, 1000, 1500], 0.15, 'sine', 0.07);
  triggerScreenShake(5, 300);
}

function applyLegendaryUpgrade(id) {
  switch (id) {
    case 'leg_all_up':
      for (let key in player.weapons) {
        let w = player.weapons[key];
        if (w.level > 0 && w.level < UPGRADES.weapons[key].maxLevel) {
          w.level++;
          weaponStats[key].level = w.level;
        }
      }
      addFloatingText(player.x, player.y - 40, '✨ ALL WEAPONS UP!', '#ffe600', 16);
      break;
    case 'leg_hp':
      player.maxHp += 80;
      player.hp     = player.maxHp;
      addFloatingText(player.x, player.y - 40, '💎 CORE RESTORED!', '#ffe600', 16);
      break;
    case 'leg_nuke':
      applyFieldItemEffect('nuke', player.x, player.y);
      break;
    case 'leg_overclock':
      player.damageMultiplier *= 1.5;
      player.speed *= 1.25;
      addFloatingText(player.x, player.y - 40, '⚡ OVERCLOCK!', '#ffe600', 16);
      break;
  }
  playVictorySound();
  triggerScreenShake(6, 400);
}

// ============================================================
// 26. 게임 종료 / 결과 화면
// ============================================================
function endGame(isVictory) {
  gameState = STATE_GAME_OVER;
  stopBGM();
  // 캔버스 클리어 (마지막 프레임의 미니맵/스코어보드가 뒤에 비치는 문제 방지)
  if (typeof canvas !== 'undefined' && canvas) {
    const _c2 = canvas.getContext('2d');
    _c2.fillStyle = '#000007';
    _c2.fillRect(0, 0, canvas.width, canvas.height);
  }
  const _hudEl = document.getElementById('hud');
  if (_hudEl) _hudEl.style.visibility = 'hidden';
  if (!isDailyRun) {
    _statAdd('totalKills', killCount);
    _statAdd('totalGamesPlayed', 1);
    _statSet('maxStage', currentStage);
    _statSet('maxSurviveTime', gameTime);
    _statSet('maxCombo', maxCombo);
    if (!isVictory) _statAdd('totalDeaths', 1);
    // 클래스별 스탯
    if (player) {
      const cls = player.classId;
      _statAdd(`cls_${cls}_games`, 1);
      _statSet(`cls_${cls}_maxStage`, currentStage);
      _statAdd(`cls_${cls}_kills`, killCount);
      if (cls === 'engineer') _statAdd('cls_engineer_droneKills', weaponStats.drone?.kills || 0);
    }
    _checkCloudAchievements();
    _syncToCloud();
    submitLeaderboard(isVictory);
  }
  gameOverModal.classList.add('active');
  const causeRowHide = document.getElementById('death-cause-row');
  if (causeRowHide && isVictory) causeRowHide.style.display = 'none';

  const title    = document.getElementById('result-title');
  const subtitle = document.getElementById('result-subtitle');

  if (isDailyRun) {
    title.innerText = '📅 DAILY RUN';
    title.style.textShadow = '0 0 10px #ffe600, 0 0 20px #ffe600';
    title.style.color = '#fff';
    subtitle.innerText = `[${getDailyRunDate()}] 일일 챌린지 완료! STAGE ${currentStage} 도달`;
    const dailyKey = `ns_daily_${getDailyRunDate()}`;
    const prev = parseInt(localStorage.getItem(dailyKey) || '0');
    if (currentStage > prev) localStorage.setItem(dailyKey, currentStage);
    isDailyRun = false;
  } else if (isEndlessMode) {
    title.innerText = 'ENDLESS TERMINATED';
    title.style.textShadow = '0 0 10px #ffe600, 0 0 20px #ffe600';
    title.style.color = '#fff';
    subtitle.innerText = `★ STAGE ${currentStage} 도달! STAGE 100 돌파 후 무한 생존! ★`;
    // 승천 레벨 증가 가능
    if (isVictory && !saveData._ascendedToday) {
      saveData.ascensionLevel = (saveData.ascensionLevel || 0) + 1;
      ascensionLevel = saveData.ascensionLevel;
      saveSaveData();
      addFloatingText(player?.x ?? 0, (player?.y ?? 0) - 60, `✨ 승천 Lv.${ascensionLevel}!`, '#ffe600', 18);
    }
  } else {
    title.innerText = 'SYSTEM OVERLOAD';
    title.style.textShadow = '0 0 10px var(--color-neon-pink), 0 0 20px var(--color-neon-pink)';
    title.style.color = '#fff';
    subtitle.innerText = `STAGE ${currentStage}에서 바이러스에 감염되었습니다.`;
    const causeEl = document.getElementById('death-cause-row');
    if (causeEl) {
      if (lastDamageSource) {
        causeEl.textContent = `☠ 사망 원인: ${lastDamageSource}`;
        causeEl.style.display = 'block';
      } else {
        causeEl.style.display = 'none';
      }
    }
    playGameOverSound();
  }

  let minutes = Math.floor(gameTime / 60);
  let seconds = gameTime % 60;
  document.getElementById('stat-time').innerText  = `${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
  document.getElementById('stat-kills').innerText  = killCount;
  document.getElementById('stat-level').innerText  = `Lv. ${player.level}`;
  document.getElementById('stat-stage').innerText  = `S${currentStage}${isEndlessMode ? ' ∞' : ''}`;
  const mcEl = document.getElementById('stat-maxcombo');
  if (mcEl) mcEl.innerText = maxCombo;
  const evoEl = document.getElementById('stat-evolutions');
  if (evoEl) evoEl.innerText = evolutionCount;
  const synRow = document.getElementById('stat-synergies-row');
  if (synRow) {
    if (activeSynergies.size > 0) {
      const names = [...activeSynergies].map(id => {
        const s = SYNERGY_DEFS.find(d => d.id === id);
        return s ? `${s.icon} ${s.name}` : id;
      }).join('  ·  ');
      synRow.textContent = `시너지 발동: ${names}`;
    } else {
      synRow.textContent = '';
    }
  }

  // 멀티 생존 순위
  if (mpMode && mpGameStartTime > 0) {
    const mySurvivalMs = Date.now() - mpGameStartTime;
    if (_fbDb) _fbDb.ref(`${_mpFbRoomPath()}/players/${mpMyId}`).update({ survivalMs: mySurvivalMs, alive: false });
    const rankEl = document.getElementById('mp-survival-rank');
    if (rankEl) {
      const allEntries = Object.entries(mpPlayers).map(([id, p]) => ({
        name: p.name || 'P', color: p.color,
        ms: id === mpMyId ? mySurvivalMs : (p.survivalMs || p.ts ? (Date.now() - (p.ts || 0)) : 0),
        isMe: id === mpMyId
      })).sort((a, b) => b.ms - a.ms);
      const fmt = ms => { const s = Math.floor(ms/1000); return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`; };
      rankEl.innerHTML = '<div style="color:#00f0ff;font-size:11px;margin-bottom:4px">🏆 멀티 생존 순위</div>' +
        allEntries.map((e,i) => `<div style="color:${e.color}">${['🥇','🥈','🥉'][i]||`${i+1}.`} ${e.name}${e.isMe?' (나)':''} — ${fmt(e.ms)}</div>`).join('');
      rankEl.style.display = 'block';
    }
  }

  checkAchievements();
  const coresEarned = earnDataCores();
  const coresEl = document.getElementById('cores-earned-row');
  if (coresEl) coresEl.textContent = `💾 데이터 코어 획득: +${coresEarned}  (보유: ${saveData.dataCores})`;

  // 최고 기록 갱신 체크
  let isNewRecord = false;
  if (killCount > saveData.bestKills) { saveData.bestKills = killCount; isNewRecord = true; }
  if (currentStage > saveData.bestStage) { saveData.bestStage = currentStage; isNewRecord = true; }
  if (gameTime > saveData.bestTime) { saveData.bestTime = gameTime; }
  if (isNewRecord) saveSaveData();
  const bestEl = document.getElementById('best-record-row');
  if (bestEl) {
    const bm = Math.floor(saveData.bestTime / 60), bs = saveData.bestTime % 60;
    bestEl.textContent = `🏆 최고 기록 — STAGE ${saveData.bestStage} · ${saveData.bestKills}마리 · ${bm.toString().padStart(2,'0')}:${bs.toString().padStart(2,'0')}`;
    bestEl.style.color = isNewRecord ? '#ffe600' : '#94a3b8';
  }

  buildWeaponContributionList();
}

function buildWeaponContributionList() {
  const c = document.getElementById('weapon-contribution-list');
  c.innerHTML = '';
  let totalDmg = 0;
  for (let k in weaponStats) totalDmg += weaponStats[k].damage;

  for (let key in weaponStats) {
    let stat  = weaponStats[key];
    if (stat.level === 0) continue;
    let pct   = totalDmg > 0 ? Math.round((stat.damage / totalDmg) * 100) : 0;
    let wData = UPGRADES.weapons[key];
    let item  = document.createElement('div');
    item.className = 'contrib-item';
    item.innerHTML = `
      <div class="contrib-name">${wData.icon} ${wData.name} <span class="contrib-level">Lv.${stat.level}</span></div>
      <div class="contrib-damage-container">
        <div class="contrib-bar-outer"><div class="contrib-bar-inner" style="width:${pct}%"></div></div>
        <span class="contrib-pct">${pct}%</span>
      </div>`;
    c.appendChild(item);
  }

  if (c.innerHTML === '') c.innerHTML = '<p style="color:#64748b;font-size:0.9rem">기록된 공격 이력이 없습니다.</p>';
}

// ============================================================
// 전체화면
// ============================================================
function toggleFullscreen() {
  const el = document.documentElement;
  const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
  if (!fsEl) {
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
    if (req) req.call(el, { navigationUI: 'hide' }).catch(() => {});
  } else {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit) exit.call(document);
  }
}

document.addEventListener('fullscreenchange', () => {});

// ============================================================
// 결과 공유
// ============================================================
function shareResult() {
  const nameInput = document.getElementById('player-name-input');
  const name      = (nameInput?.value || '').trim() || 'UNKNOWN';
  const minutes   = Math.floor(gameTime / 60);
  const seconds   = gameTime % 60;
  const timeStr   = `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
  const stageStr  = `${currentStage}${isEndlessMode ? ' ∞' : ''}`;
  const clsInfo   = CLASS_DEFS[player?.classId || selectedClass];
  const diffLabel = DIFFICULTY_SETTINGS[gameDifficulty]?.label || 'NORMAL';
  const synergyStr = activeSynergies.size > 0
    ? [...activeSynergies].map(id => { const s = SYNERGY_DEFS.find(d => d.id === id); return s ? `${s.icon}${s.name}` : id; }).join(', ')
    : '없음';
  const text =
    `⚡ AntiSurge β v0.09\n` +
    `👤 ${name} [${clsInfo?.icon || ''}${clsInfo?.name || ''}] [${diffLabel}]\n` +
    `🏆 STAGE ${stageStr} 도달\n` +
    `💀 ${killCount}마리 제거  ⭐ Lv.${player?.level ?? '?'}\n` +
    `⏱ ${timeStr}  💥 최대콤보 ${maxCombo}\n` +
    `🔗 시너지: ${synergyStr}\n` +
    (ascensionLevel > 0 ? `✨ 승천 Lv.${ascensionLevel}\n` : '') +
    `\n#AntiSurge #사이버펑크서바이벌`;

  const btn = document.getElementById('share-btn');
  if (navigator.share) {
    navigator.share({ title: 'AntiSurge β v0.09', text }).catch(() => {});
  } else if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      if (btn) { btn.textContent = '✓ 클립보드 복사!'; setTimeout(() => { btn.textContent = '📤 결과 공유'; }, 2500); }
    }).catch(() => { showGameConfirm('', null, null, { title: '결과 공유', icon: '📤', noCancel: true, okLabel: '닫기', copyText: text }); });
  } else {
    showGameConfirm('', null, null, { title: '결과 공유', icon: '📤', noCancel: true, okLabel: '닫기', copyText: text });
  }
}

// ============================================================
// ⚡ 개발자 모드 (비밀번호: 7501)
// ============================================================
function toggleDevPanel() {
  devMode = !devMode;
  const panel = document.getElementById('dev-panel');
  if (panel) panel.classList.toggle('active', devMode);
  if (devMode) { devLastFpsTs = performance.now(); devFpsCount = 0; }
}

function closeDevPanel() {
  devMode = false;
  document.getElementById('dev-panel')?.classList.remove('active');
}

function devToggleGodMode() {
  devGodMode = !devGodMode;
  const btn = document.getElementById('dev-godmode-btn');
  if (btn) { btn.textContent = `🛡 무적: ${devGodMode ? 'ON ✓' : 'OFF'}`; btn.style.color = devGodMode ? '#39ff14' : ''; }
  if (player) addFloatingText(player.x, player.y - 40, `GOD MODE ${devGodMode ? 'ON' : 'OFF'}`, '#39ff14', 14);
}

function devLevelUp() {
  if (!player || gameState === STATE_MENU || gameState === STATE_GAME_OVER) return;
  player.level++;
  player.nextLevelXp = Math.floor(player.nextLevelXp * 1.35) + 8;
  if (!levelUpInProgress) { levelUpInProgress = true; playLevelUpSound(); triggerLevelUpModal(); }
  else pendingLevelUps++;
}

function devAddXP(amount) {
  if (!player) return;
  player.gainXp(amount);
  addFloatingText(player.x, player.y - 40, `DEV +${amount} XP`, '#00f0ff', 13);
}

function devAddGold(amount) {
  if (!player) return;
  player.gold += amount;
  addFloatingText(player.x, player.y - 40, `DEV +${amount} G`, '#ffe600', 13);
}

function devAddCores(amount) {
  saveData.dataCores += amount;
  saveSaveData();
  updateMenuMetaBadge();
  if (player) addFloatingText(player.x, player.y - 40, `DEV +${amount} 💾`, '#b026ff', 13);
}

function devKillAll() {
  if (gameState === STATE_MENU || gameState === STATE_GAME_OVER) return;
  const n = enemies.length;
  for (let e of enemies) createExplosionParticles(e.x, e.y, e.color, 5);
  enemies.length = 0;
  if (player) addFloatingText(player.x, player.y - 40, `DEV: 적 ${n}마리 제거`, '#ff4466', 13);
}

function devSpawnBoss() {
  if (!player || gameState === STATE_MENU || gameState === STATE_GAME_OVER) return;
  if (activeBoss) { if (player) addFloatingText(player.x, player.y-40,'보스 이미 존재','#ff4466',12); return; }
  isBossStage = true; spawnBossEnemy();
  addFloatingText(player.x, player.y - 40, 'DEV: 보스 소환!', '#ff0044', 14);
}

function devTriggerEvent() {
  if (gameState === STATE_MENU || gameState === STATE_GAME_OVER) return;
  if (activeFieldEvent) endFieldEvent();
  activeFieldEvent = null;
  triggerFieldEvent();
}

function devClearEvent() { if (activeFieldEvent) endFieldEvent(); }

function devJumpStage() {
  if (gameState === STATE_MENU || gameState === STATE_GAME_OVER) return;
  const input  = document.getElementById('dev-stage-input');
  const target = Math.max(1, Math.min(200, parseInt(input?.value) || 1));

  document.getElementById('stage-bonus-modal')?.classList.remove('active');
  document.getElementById('shop-modal')?.classList.remove('active');
  document.getElementById('level-up-modal')?.classList.remove('active');
  hideStageOverlay(); hideFieldEventBanner();

  currentStage      = target;
  stageKillProgress = 0;
  enemies.length = 0; projectiles.length = 0; activeBoss = null;
  isStageClearAnim  = false; levelUpInProgress = false; pendingLevelUps = 0;
  activeFieldEvent  = null;
  isEndlessMode     = target > 100;

  if (target % 10 === 0) {
    isBossStage = true; stageKillGoal = 0;
    gameState   = STATE_PLAYING;
    setTimeout(() => spawnBossEnemy(), 400);
  } else {
    isBossStage   = false;
    stageKillGoal = getStageKillGoal(target);
    gameState     = STATE_PLAYING;
  }
  if (player) addFloatingText(player.x, player.y - 50, `⚡ DEV JUMP → STAGE ${target}`, '#39ff14', 16);
}

function devResetSave() {
  showGameConfirm(
    '모든 저장 데이터를 초기화합니다.\n메타 업그레이드, 업적, 최고기록이 전부 삭제됩니다.',
    () => {
      localStorage.removeItem(SAVE_KEY);
      saveData = loadSaveData();
      updateMenuMetaBadge();
      showGameToast('⚡ 저장 데이터가 초기화되었습니다');
    },
    null,
    { title: '데이터 초기화', icon: '💀', okLabel: '전부 삭제', cancelLabel: '취소' }
  );
}

// ============================================================
// 27. 랜덤 필드 이벤트
// ============================================================
function triggerFieldEvent() {
  if (activeFieldEvent) return;
  const ev = FIELD_EVENTS[Math.floor(Math.random() * FIELD_EVENTS.length)];
  activeFieldEvent = { ...ev, remaining: ev.duration || 1200 };

  // 즉발 효과: EMF 펄스
  if (ev.id === 'emf_pulse' && player) {
    const stunRange = 480;
    for (let e of enemies) {
      if (dist(player.x, player.y, e.x, e.y) < stunRange) e.stunTimer = 2500;
    }
    if (activeBoss) activeBoss.stunTimer = 1500;
    createExplosionParticles(player.x, player.y, '#39ff14', 25);
    triggerScreenShake(7, 400);
    playSynthSound([120, 600, 40], 0.25, 'sawtooth', 0.1);
  }

  // 즉발: 엘리트 침공 — 8기 스폰 + 속도 부스트
  if (ev.id === 'elite_invasion' && player) {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const d = 500 + Math.random() * 150;
      const ex = Math.max(20, Math.min(MAP_WIDTH-20, player.x + Math.cos(angle)*d));
      const ey = Math.max(20, Math.min(MAP_HEIGHT-20, player.y + Math.sin(angle)*d));
      enemies.push(new Enemy(ex, ey, 'elite'));
    }
    // 이벤트 지속 중 적 속도 20% 증가는 enemy.update()에서 activeFieldEvent 체크로 처리
    triggerScreenShake(6, 400);
    playSynthSound([80, 200, 500], 0.2, 'sawtooth', 0.1);
  }

  // 즉발: 바이러스 급증 — 25기 무작위 스폰
  if (ev.id === 'virus_surge' && player) {
    const spawnTypes = ['swarm', 'swarm', 'rusher', 'rusher', 'bruiser'];
    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * Math.PI * 2;
      const d = 400 + Math.random() * 200;
      const ex = Math.max(20, Math.min(MAP_WIDTH-20, player.x + Math.cos(angle)*d));
      const ey = Math.max(20, Math.min(MAP_HEIGHT-20, player.y + Math.sin(angle)*d));
      const t = spawnTypes[Math.floor(Math.random() * spawnTypes.length)];
      enemies.push(new Enemy(ex, ey, t));
    }
    triggerScreenShake(9, 500);
    playSynthSound([100, 300, 600], 0.2, 'sawtooth', 0.12);
  }

  // 즉발: 마인 필드 — 8개 사이버 마인 랜덤 배치
  if (ev.id === 'cyber_mine_field' && player) {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.5;
      const d = 120 + Math.random() * 200;
      const mx = Math.max(20, Math.min(MAP_WIDTH - 20, player.x + Math.cos(angle) * d));
      const my = Math.max(20, Math.min(MAP_HEIGHT - 20, player.y + Math.sin(angle) * d));
      mines.push(new Mine(mx, my, 80, 130, false));
    }
    triggerScreenShake(5, 300);
    playSynthSound([200, 100, 50], 0.15, 'sawtooth', 0.09, true);
  }

  // 이벤트 배너 표시
  showFieldEventBanner(ev);
  playSynthSound([400, 600, 500], 0.12, 'triangle', 0.07);
}

function endFieldEvent() {
  if (!activeFieldEvent) return;
  addFloatingText(player ? player.x : MAP_WIDTH/2, player ? player.y - 50 : MAP_HEIGHT/2,
    `${activeFieldEvent.icon} 이벤트 종료`, '#94a3b8', 12);
  activeFieldEvent = null;
  hideFieldEventBanner();
}

function showFieldEventBanner(ev) {
  const el = document.getElementById('field-event-banner');
  if (!el) return;
  el.querySelector('.fev-icon').textContent  = ev.icon;
  el.querySelector('.fev-name').textContent  = ev.name;
  el.querySelector('.fev-desc').textContent  = ev.desc;
  el.style.borderColor = ev.color;
  el.style.setProperty('--fev-color', ev.color);
  el.classList.add('active');
  if (ev.duration > 1200) {
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(hideFieldEventBanner, ev.duration);
  } else {
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(hideFieldEventBanner, 2000);
  }
}

function hideFieldEventBanner() {
  const el = document.getElementById('field-event-banner');
  if (el) el.classList.remove('active');
}

// ============================================================
// 28. 모바일 터치 조작
// ============================================================
function initTouchControls() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;

  // 멀티터치: joystickTouchId로 특정 손가락만 추적
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameState !== STATE_PLAYING && gameState !== STATE_STAGE_CLEAR) return;
    // 아직 조이스틱 손가락이 없는 경우만 신규 등록
    if (joystickTouchId !== null) return;
    const t = e.changedTouches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    joystickBase = { x: t.clientX, y: t.clientY };
    joystickKnob = { x: t.clientX, y: t.clientY };
    joystickTouchId = t.identifier;
    touchDX = 0; touchDY = 0;
    isTouching = true;
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!isTouching) return;
    for (const t of e.changedTouches) {
      if (t.identifier === joystickTouchId) {
        const dx = t.clientX - joystickBase.x;
        const dy = t.clientY - joystickBase.y;
        const len = Math.sqrt(dx*dx + dy*dy);
        const deadzone = 12;
        if (len < deadzone) { touchDX = 0; touchDY = 0; joystickKnob = { x: joystickBase.x, y: joystickBase.y }; continue; }
        const clamped = Math.min(len, JOYSTICK_RADIUS);
        const angle = Math.atan2(dy, dx);
        joystickKnob = { x: joystickBase.x + Math.cos(angle) * clamped, y: joystickBase.y + Math.sin(angle) * clamped };
        const maxDist = 80;
        const ratio = Math.min(len, maxDist) / maxDist;
        touchDX = (dx / len) * ratio;
        touchDY = (dy / len) * ratio;
      }
    }
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    // 조이스틱 손가락이 들렸을 때만 리셋
    for (const t of e.changedTouches) {
      if (t.identifier === joystickTouchId) {
        joystickBase = null; joystickKnob = null; joystickTouchId = null;
        isTouching = false; touchDX = 0; touchDY = 0;
      }
    }
  }, { passive: false });

  // 스킬 버튼 터치
  const skillBtn = document.getElementById('mobile-skill-btn');
  if (skillBtn) {
    skillBtn.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      e.preventDefault();
      useActiveSkill();
    }, { passive: false });
  }

  // 터치 기기면 모바일 컨트롤 표시 등록
  if (_isTouchDevice()) {
    _refreshMobileControls(gameState);
  }
}

// ============================================================
// 유틸리티
// ============================================================
function dist(x1, y1, x2, y2) {
  return Math.sqrt((x2-x1)**2 + (y2-y1)**2);
}

function distToSegment(px, py, x1, y1, x2, y2) {
  let l2 = (x2-x1)**2 + (y2-y1)**2;
  if (l2 === 0) return dist(px, py, x1, y1);
  let t  = Math.max(0, Math.min(1, ((px-x1)*(x2-x1) + (py-y1)*(y2-y1)) / l2));
  return dist(px, py, x1 + t*(x2-x1), y1 + t*(y2-y1));
}

// ============================================================
// ⚙ 설정 모달
// ============================================================
const BGM_TRACK_NAMES = ['🎵 신스웨이브', '🎶 데바 시스템', '⚡ 고스트 프로토콜', '🌑 섀도우 옵스'];

function openSettingsModal() {
  const modal = document.getElementById('settings-modal');
  if (modal) modal.classList.add('active');
  const muteBtn = document.getElementById('settings-mute-btn');
  if (muteBtn) muteBtn.textContent = bgmMuted ? '🔇 꺼짐' : '🎵 켜짐';
  const trackBtn = document.getElementById('settings-bgm-track-btn');
  if (trackBtn) trackBtn.textContent = BGM_TRACK_NAMES[bgmTrackId] || BGM_TRACK_NAMES[0];
  const ia = document.getElementById('settings-ingame-actions');
  if (ia) ia.style.display = gameState === STATE_PAUSED ? 'flex' : 'none';
}

function settingsToggleBgmTrack() {
  bgmTrackId = (bgmTrackId + 1) % BGM_TRACK_NAMES.length;
  bgmTrackCheckTimer = 0;
  if (!bgmMuted && bgmGainNode) { stopBGM(); startBGM(); }
  const btn = document.getElementById('settings-bgm-track-btn');
  if (btn) btn.textContent = BGM_TRACK_NAMES[bgmTrackId];
}

function closeSettingsModal() {
  if (gameState === STATE_PAUSED) {
    resumeGame();
  } else {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.remove('active');
  }
}

function settingsToggleMute() {
  toggleBGM();
  const btn = document.getElementById('settings-mute-btn');
  if (btn) btn.textContent = bgmMuted ? '🔇 꺼짐' : '🎵 켜짐';
}

let showFps = false;
function settingsToggleFps() {
  showFps = !showFps;
  const btn = document.getElementById('settings-fps-btn');
  if (btn) btn.textContent = showFps ? '📊 켜짐' : '📊 꺼짐';
  const hudFps = document.getElementById('hud-fps');
  if (hudFps) hudFps.style.display = showFps ? 'inline' : 'none';
}

// ============================================================
// 🎮 멀티플레이어 모드 (Firebase RTDB / BroadcastChannel 듀얼)
// ============================================================

// ── Firebase 초기화 ──────────────────────────────────────────
let _fbApp = null, _fbDb = null;
function _mpInitFirebase() {
  if (_fbDb) return true;
  if (!FIREBASE_CONFIG) return false;
  if (typeof firebase === 'undefined') return false;
  try {
    _fbApp = firebase.apps.length ? firebase.apps[0] : firebase.initializeApp(FIREBASE_CONFIG);
    _fbDb  = firebase.database(_fbApp);
    return true;
  } catch (e) {
    console.warn('[MP] Firebase 초기화 실패:', e.message);
    return false;
  }
}

function _mpFbRoomPath() { return `neon_rooms/${mpRoomCode}`; }

// ── 공통 유틸 ───────────────────────────────────────────────
function openInviteModal() {
  const modal = document.getElementById('invite-modal');
  if (modal) modal.classList.add('active');
  // Firebase 설정 여부 표시
  const note = document.getElementById('mp-mode-note');
  const fbReady = FIREBASE_CONFIG && typeof firebase !== 'undefined';
  if (note) note.textContent = fbReady
    ? '🌐 Firebase 모드 — 다른 기기와 플레이 가능'
    : '⚠ 로컬 모드 — 같은 기기의 다른 탭에서만 작동';
}

function closeInviteModal() {
  const modal = document.getElementById('invite-modal');
  if (modal) modal.classList.remove('active');
}

function mpGenCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ── 채널 설정 ────────────────────────────────────────────────
function mpSetupChannel() {
  mpUseFb = _mpInitFirebase();

  if (mpUseFb) {
    // Firebase 모드
    const db = _fbDb;
    const roomRef  = db.ref(_mpFbRoomPath());
    const myRef    = roomRef.child(`players/${mpMyId}`);
    const playerData = {
      x: 0, y: 0, hp: 100, maxHp: 100, level: 1, kills: 0,
      color: mpMyColor, name: mpIsHost ? 'HOST' : 'PLAYER', ts: Date.now()
    };

    // 연결 끊기면 자동 삭제
    myRef.onDisconnect().remove();
    if (mpIsHost) {
      roomRef.onDisconnect().remove();
      roomRef.child('mode').set(mpGameMode);
    }

    myRef.set(playerData, err => {
      if (err) {
        console.error('[MP] Firebase 쓰기 실패:', err.message);
        showGameToast('⚠ Firebase 연결 실패 (콘솔 확인)');
        mpUseFb = false;
      } else {
        console.log('[MP] Firebase 연결 성공 —', mpMyId, '→', _mpFbRoomPath());
      }
    });

    // 다른 플레이어 상태 실시간 수신
    mpFbRoomRef = roomRef.child('players');
    mpFbRoomRef.on('value', snap => {
      const all = snap.val() || {};
      console.log('[MP] players 업데이트:', Object.keys(all));
      for (const [id, p] of Object.entries(all)) {
        if (id === mpMyId) continue;
        mpPlayers[id] = { ...mpPlayers[id], ...p, lastUpdate: Date.now() };
        // 공유 보스 HP 동기화 (팀원 보스 HP가 더 낮으면 반영)
        if (p.bossHp !== undefined && p.bossHp >= 0 && activeBoss) {
          if (p.bossHp < activeBoss.hp) activeBoss.hp = p.bossHp;
        }
      }
      // 사라진 플레이어 제거
      for (const id in mpPlayers) {
        if (id !== mpMyId && !all[id]) delete mpPlayers[id];
      }
      mpUpdatePlayerList();
    }, err => console.error('[MP] players 수신 실패:', err.message));

    // 게임 이벤트 수신 (join/start/leave)
    mpFbMsgRef = roomRef.child('msgs');
    mpFbMsgRef.limitToLast(1).on('child_added', snap => {
      const msg = snap.val();
      if (!msg || msg.senderId === mpMyId) return;
      _mpHandleEvent(msg);
    });
  } else {
    // BroadcastChannel 폴백 (같은 기기)
    if (mpChannel) mpChannel.close();
    mpChannel = new BroadcastChannel('ns_room_' + mpRoomCode);
    mpChannel.onmessage = e => _mpHandleMsg(e.data);
  }

  mpMode = true;
  mpPlayers[mpMyId] = {
    x: 0, y: 0, hp: 100, maxHp: 100, level: 1, kills: 0,
    color: mpMyColor, name: mpIsHost ? 'HOST' : 'PLAYER', lastUpdate: Date.now()
  };
  mpUpdatePlayerList();
}

// ── 방 생성 / 참가 ───────────────────────────────────────────
function mpCreateRoom(mode) {
  mpGameMode = mode || 'coop';
  mpRoomCode = mpGenCode();
  mpMyId     = 'H_' + Date.now().toString(36);
  mpIsHost   = true;
  mpMyColor  = MP_COLORS[0];
  mpSetupChannel();
  _mpShowRoom();
}

function mpJoinFromInput() {
  const code = (document.getElementById('invite-code-input')?.value || '').trim().toUpperCase();
  if (code.length !== 6) { showGameToast('⚠ 초대 코드는 6자리입니다'); return; }
  if (FIREBASE_CONFIG && typeof firebase !== 'undefined') {
    if (!_fbDb) _mpInitFirebase();
    if (_fbDb) {
      const roomRef = _fbDb.ref(`neon_rooms/${code}`);
      roomRef.once('value', snap => {
        const room = snap.val() || {};
        const playerCount = room.players ? Object.keys(room.players).length : 0;
        if (playerCount >= MP_MAX_PLAYERS) { showGameToast(`⚠ 방이 가득 찼습니다 (최대 ${MP_MAX_PLAYERS}명)`); return; }
        mpGameMode = room.mode || 'coop';
        mpJoinRoom(code);
      });
      return;
    }
  }
  mpJoinRoom(code);
}

function mpJoinRoom(code) {
  mpRoomCode = code;
  mpMyId     = 'P_' + Date.now().toString(36);
  mpIsHost   = false;
  mpMyColor  = MP_COLORS[1 + Math.floor(Math.random() * (MP_COLORS.length - 1))];
  mpSetupChannel();
  if (!mpUseFb) {
    mpBroadcast({ type: 'join', id: mpMyId, color: mpMyColor, name: 'PLAYER' });
  }
  _mpShowRoom();
}

// ── 메시지 처리 (BroadcastChannel용) ─────────────────────────
function _mpHandleMsg(msg) {
  if (!msg?.type) return;
  if (msg.type === 'join') {
    mpPlayers[msg.id] = { x: 0, y: 0, hp: 100, maxHp: 100, level: 1, kills: 0,
      color: msg.color, name: msg.name || 'PLAYER', lastUpdate: Date.now() };
    mpBroadcast({ type: 'join_ack', id: mpMyId, color: mpMyColor,
      name: mpPlayers[mpMyId]?.name || 'HOST' });
    mpUpdatePlayerList();
  } else if (msg.type === 'join_ack') {
    if (!mpPlayers[msg.id]) {
      mpPlayers[msg.id] = { x: 0, y: 0, hp: 100, maxHp: 100, level: 1, kills: 0,
        color: msg.color, name: msg.name || 'PLAYER', lastUpdate: Date.now() };
      mpUpdatePlayerList();
    }
  } else if (msg.type === 'state') {
    if (msg.id === mpMyId) return;
    if (!mpPlayers[msg.id]) mpPlayers[msg.id] = { color: '#ffffff', name: 'PLAYER' };
    Object.assign(mpPlayers[msg.id], msg.state, { lastUpdate: Date.now() });
  } else {
    _mpHandleEvent(msg);
  }
}

// ── 게임 이벤트 처리 (공통) ──────────────────────────────────
function _mpHandleEvent(msg) {
  if (msg.type === 'start') {
    if (!mpIsHost) {
      if (msg.mode) mpGameMode = msg.mode;
      closeInviteModal();
      startGame();
    }
  } else if (msg.type === 'leave') {
    delete mpPlayers[msg.id || msg.senderId];
    mpUpdatePlayerList();
  } else if (msg.type === 'sabotage') {
    _mpApplySabotage(msg.sabotageType, msg.curseIdx);
  } else if (msg.type === 'eliminated') {
    const id = msg.senderId || msg.id;
    if (mpPlayers[id]) mpPlayers[id].alive = false;
    if (mpGameMode === 'battle' && !mpSpectating) {
      const anyAliveEnemy = Object.entries(mpPlayers).some(([pid, p]) => pid !== mpMyId && p.alive !== false);
      if (!anyAliveEnemy) _mpShowBattleWin();
    }
  } else if (msg.type === 'battle_win') {
    addFloatingText(player?.x ?? MAP_WIDTH/2, (player?.y ?? MAP_HEIGHT/2) - 80,
      `🏆 ${msg.name || '?'} 최후 생존자!`, '#ffe600', 20);
  }
}

// ── 브로드캐스트 ─────────────────────────────────────────────
function mpBroadcast(data) {
  if (mpUseFb && _fbDb) {
    _fbDb.ref(`${_mpFbRoomPath()}/msgs`).push({
      ...data, senderId: mpMyId, ts: Date.now(), seq: mpMsgSeq++
    });
  } else if (mpChannel) {
    mpChannel.postMessage(data);
  }
}

// ── UI ───────────────────────────────────────────────────────
function _mpShowRoom() {
  document.getElementById('invite-lobby').style.display = 'none';
  document.getElementById('invite-room').style.display  = 'block';
  document.getElementById('room-code-text').textContent = mpRoomCode;
  const desc = document.getElementById('mp-room-desc');
  const modeLabel = mpGameMode === 'battle' ? '⚔ 경쟁 (배틀로얄)' : '🤝 협동';
  if (desc) desc.textContent = (mpUseFb
    ? '📱 다른 기기에서 이 코드로 참가하세요.'
    : '🖥 같은 기기의 다른 탭에서 이 코드로 참가하세요.')
    + `  |  ${modeLabel}`;
  const modeEl = document.getElementById('mp-game-mode-badge');
  if (modeEl) { modeEl.textContent = modeLabel; modeEl.style.color = mpGameMode === 'battle' ? '#ff4466' : '#39ff14'; }
  mpUpdatePlayerList();
}

function mpUpdatePlayerList() {
  const list = document.getElementById('mp-player-list');
  if (!list) return;
  const count = Object.keys(mpPlayers).length;
  list.innerHTML = Object.entries(mpPlayers).map(([id, p]) =>
    `<div class="mp-player-item" style="color:${p.color}">● ${(p.name||'P').slice(0,10)}${id === mpMyId ? ' (나)' : ''}</div>`
  ).join('') || '<div class="mp-player-item" style="color:#475569">대기 중...</div>';
  const startBtn = document.getElementById('mp-start-btn');
  if (startBtn) startBtn.disabled = !mpIsHost || count < 2;
  const countEl = document.getElementById('mp-player-count');
  if (countEl) countEl.textContent = `${count}/${MP_MAX_PLAYERS}`;
}

function mpStartGame() {
  if (!mpIsHost) return;
  mpBroadcast({ type: 'start', id: mpMyId, mode: mpGameMode });
  closeInviteModal();
  startGame();
}

function mpLeaveRoom() {
  mpBroadcast({ type: 'leave', id: mpMyId });
  // Firebase 정리
  if (mpUseFb && _fbDb) {
    _fbDb.ref(`${_mpFbRoomPath()}/players/${mpMyId}`).remove();
    if (mpIsHost) _fbDb.ref(_mpFbRoomPath()).remove();
    if (mpFbRoomRef) { mpFbRoomRef.off(); mpFbRoomRef = null; }
    if (mpFbMsgRef)  { mpFbMsgRef.off();  mpFbMsgRef  = null; }
  }
  // BroadcastChannel 정리
  if (mpChannel) { mpChannel.close(); mpChannel = null; }

  mpMode = false; mpIsHost = false; mpUseFb = false;
  mpRoomCode = ''; mpMyId = ''; mpPlayers = {};
  document.getElementById('invite-lobby').style.display = 'block';
  document.getElementById('invite-room').style.display  = 'none';
  const inp = document.getElementById('invite-code-input');
  if (inp) inp.value = '';
}

// ── 상태 동기화 (게임 루프에서 호출) ─────────────────────────
function syncMpState(dt) {
  if (!player) return;
  mpSyncTimer += dt;
  if (mpSyncTimer < MP_SYNC_MS) return;
  mpSyncTimer = 0;

  const state = {
    x: player.x, y: player.y,
    hp: player.hp, maxHp: player.maxHp,
    level: player.level, kills: killCount,
    color: mpMyColor, name: mpPlayers[mpMyId]?.name || 'ME',
    ts: Date.now(),
    alive: !mpSpectating,
    bossHp: activeBoss?.hp ?? -1
  };
  mpPlayers[mpMyId] = { ...state, lastUpdate: Date.now() };

  if (mpUseFb && _fbDb) {
    // Firebase: player 노드 직접 업데이트 (메시지 채널 사용 X, 대역폭 절약)
    _fbDb.ref(`${_mpFbRoomPath()}/players/${mpMyId}`).update(state);
  } else if (mpChannel) {
    mpChannel.postMessage({ type: 'state', id: mpMyId, state });
  }

  // 오래된 플레이어 로컬 제거 (Firebase 모드는 presence로 자동 처리)
  if (!mpUseFb) {
    const now = Date.now();
    for (const id in mpPlayers) {
      if (id !== mpMyId && mpPlayers[id].lastUpdate && now - mpPlayers[id].lastUpdate > 6000)
        delete mpPlayers[id];
    }
  }
}

function _mpHasAliveTeammates() {
  return Object.entries(mpPlayers).some(([id, p]) => id !== mpMyId && p.alive !== false);
}

function _mpGetSpectateTarget() {
  for (const [id, p] of Object.entries(mpPlayers)) {
    if (id !== mpMyId && p.alive !== false) return p;
  }
  return null;
}

function _mpCountAlive() {
  return Object.values(mpPlayers).filter(p => p.alive !== false).length;
}

function mpTriggerSabotage() {
  if (!player || mpSabotageTimer > 0) return;
  const types = ['curse', 'boss_buff'];
  const sabotageType = types[Math.floor(Math.random() * types.length)];
  const curseIdx = sabotageType === 'curse' ? Math.floor(Math.random() * CURSE_DEFS.length) : -1;
  mpBroadcast({ type: 'sabotage', sabotageType, curseIdx });
  mpSabotageTimer = MP_SABOTAGE_CD;
  const label = sabotageType === 'curse' ? '🦠 바이러스 주입!' : '👿 보스 강화 발동!';
  addFloatingText(player.x, player.y - 60, label, '#ff4466', 14);
}

function _mpApplySabotage(sabotageType, curseIdx) {
  if (!player) return;
  if (sabotageType === 'curse') {
    const curse = CURSE_DEFS[curseIdx ?? 0];
    if (curse) {
      curse.debuffFn(player);
      addFloatingText(player.x, player.y - 60, `🦠 감염: ${curse.debuff}!`, '#ff4466', 14);
    }
  } else if (sabotageType === 'boss_buff') {
    if (activeBoss) {
      activeBoss.hp = Math.min(activeBoss.maxHp, activeBoss.hp * 1.25);
      if (activeBoss.speed) activeBoss.speed *= 1.15;
      addFloatingText(activeBoss.x, activeBoss.y - 60, '👿 BOSS BUFFED!', '#ff4466', 16);
    } else {
      addFloatingText(player.x, player.y - 60, '👿 보스 강화 예약됨!', '#ff8800', 14);
    }
  }
}

function _mpShowBattleWin() {
  const myName = mpPlayers[mpMyId]?.name || 'ME';
  mpBroadcast({ type: 'battle_win', name: myName });
  _statAdd('mpBattleWins', 1);
  addFloatingText(player?.x ?? MAP_WIDTH/2, (player?.y ?? MAP_HEIGHT/2) - 80,
    '🏆 최후 생존자!', '#ffe600', 24);
  setTimeout(() => endGame(true), 3000);
}

function mpEnterSpectator() {
  mpSpectating = true;
  if (player) player.hp = player.maxHp;
  const survMs = mpGameStartTime > 0 ? Date.now() - mpGameStartTime : 0;
  if (_fbDb) _fbDb.ref(`${_mpFbRoomPath()}/players/${mpMyId}`).update({ alive: false, survivalMs: survMs });

  if (mpGameMode === 'battle') {
    mpRespawnTimer = -1; // 부활 없음
    mpBroadcast({ type: 'eliminated', id: mpMyId });
    addFloatingText(player?.x ?? MAP_WIDTH/2, (player?.y ?? MAP_HEIGHT/2) - 50, '💀 탈락!', '#ff4466', 20);
  } else {
    mpRespawnTimer = MP_RESPAWN_DELAY;
    addFloatingText(player?.x ?? MAP_WIDTH/2, (player?.y ?? MAP_HEIGHT/2) - 50, '💀 스펙테이터 모드', '#ff4466', 16);
  }
}

function mpDoRespawn() {
  mpSpectating = false;
  mpRespawnTimer = 0;
  if (!player) return;
  const t = _mpGetSpectateTarget();
  const ox = (Math.random() - 0.5) * 180, oy = (Math.random() - 0.5) * 180;
  player.x = Math.max(100, Math.min(MAP_WIDTH  - 100, (t ? (t.renderX ?? t.x) : MAP_WIDTH  / 2) + ox));
  player.y = Math.max(100, Math.min(MAP_HEIGHT - 100, (t ? (t.renderY ?? t.y) : MAP_HEIGHT / 2) + oy));
  player.hp = Math.ceil(player.maxHp * 0.5);
  if (_fbDb) _fbDb.ref(`${_mpFbRoomPath()}/players/${mpMyId}`).update({ alive: true });
  _statAdd('mpRevives', 1);
  addFloatingText(player.x, player.y - 50, '🔄 부활!', '#39ff14', 20);
  createExplosionParticles(player.x, player.y, '#39ff14', 15);
}

function mpUpdateGhostPositions(dt) {
  const alpha = Math.min(1, dt / 55);
  for (const [id, p] of Object.entries(mpPlayers)) {
    if (id === mpMyId) continue;
    if (p.renderX === undefined) { p.renderX = p.x; p.renderY = p.y; continue; }
    p.renderX += (p.x - p.renderX) * alpha;
    p.renderY += (p.y - p.renderY) * alpha;
  }
}

function mpCheckAura() {
  if (!player) { mpAuraActive = false; return; }
  mpAuraActive = false;
  for (const [id, p] of Object.entries(mpPlayers)) {
    if (id === mpMyId) continue;
    const rx = p.renderX ?? p.x, ry = p.renderY ?? p.y;
    if (Math.hypot(player.x - rx, player.y - ry) < MP_AURA_RANGE) { mpAuraActive = true; break; }
  }
  // 오라 활성 시 데미지 +10%
  player.damageMultiplier = mpAuraActive
    ? player.damageMultiplier * (player._mpAuraApplied ? 1 : 1.1)
    : player.damageMultiplier / (player._mpAuraApplied ? 1.1 : 1);
  player._mpAuraApplied = mpAuraActive;
}

// ═══════════════════════════════════════════════════════════════
// Google Auth + 클라우드 저장 + 확장 업적
// ═══════════════════════════════════════════════════════════════
function _initAuth() {
  if (!FIREBASE_CONFIG || typeof firebase === 'undefined' || !firebase.auth) return;
  if (!_fbDb) _mpInitFirebase(); // auth 호출 전 앱 초기화 보장
  firebase.auth().onAuthStateChanged(user => {
    _authUser = user;
    _updateAuthUI();
    if (user) _loadFromCloud();
  });
}

function signInGoogle() {
  if (typeof firebase === 'undefined' || !firebase.auth) { showGameToast('⚠ Firebase가 설정되지 않았습니다'); return; }
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider).catch(e => { console.error('[AUTH]', e.message); showGameToast('⚠ 로그인 실패: ' + e.message); });
}

function signOutUser() {
  if (!firebase?.auth) return;
  firebase.auth().signOut().then(() => { _authUser = null; _updateAuthUI(); });
}

function _updateAuthUI() {
  const btn  = document.getElementById('auth-btn');
  const info = document.getElementById('auth-user-info');
  if (!btn) return;
  if (_authUser) {
    btn.textContent = '🚪 로그아웃';
    btn.onclick = signOutUser;
    if (info) info.textContent = `☁ ${_authUser.displayName || _authUser.email} (클라우드 동기화 중)`;
  } else {
    btn.textContent = '🔑 Google 로그인';
    btn.onclick = signInGoogle;
    if (info) info.textContent = '로컬 저장 중 (로그인 시 클라우드 동기화)';
  }
}

// ── 통계 헬퍼 ────────────────────────────────────────────────
function _getStats() {
  if (!saveData.stats) saveData.stats = {};
  return saveData.stats;
}

function _statAdd(key, n) {
  const s = _getStats();
  s[key] = (s[key] || 0) + n;
  _checkCloudAchievements();
}

function _statSet(key, val) {
  const s = _getStats();
  if (val > (s[key] || 0)) { s[key] = val; _checkCloudAchievements(); }
}

// ── 클라우드 업적 ─────────────────────────────────────────────
function _checkCloudAchievements() {
  const s = _getStats();
  if (!saveData.cloudAchievements) saveData.cloudAchievements = {};
  for (const def of CLOUD_ACHIEVEMENTS) {
    if (saveData.cloudAchievements[def.id]) continue;
    const cur = def.stat === '__allBasic__'
      ? (saveData.achievements || []).length
      : (s[def.stat] || 0);
    if (cur >= def.goal) _unlockCloudAchievement(def);
  }
}

function _unlockCloudAchievement(def) {
  if (!saveData.cloudAchievements) saveData.cloudAchievements = {};
  saveData.cloudAchievements[def.id] = true;
  saveSaveData();
  _pushToCloud(`achievements/${def.id}`, true);
  _showAchievementToast(def);
}

function _showAchievementToast(ach) {
  const displayName = ach.realName || ach.name;
  const el = document.createElement('div');
  el.className = 'cloud-ach-toast';
  el.innerHTML = `<div class="ach-toast-icon">${ach.icon}</div><div><div class="ach-toast-name">업적 달성: ${displayName}</div><div class="ach-toast-desc">${ach.desc}</div></div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 4000);
}

// ── 클라우드 동기화 ───────────────────────────────────────────
function _cloudBase() {
  return (_authUser && _fbDb) ? `users/${_authUser.uid}` : null;
}

function _pushToCloud(subpath, val) {
  const base = _cloudBase();
  if (!base) return;
  _fbDb.ref(`${base}/${subpath}`).set(val).catch(e => console.warn('[CLOUD]', subpath, e.message));
}

function _syncToCloud() {
  const base = _cloudBase();
  if (!base) return;
  const now = Date.now();
  _fbDb.ref(base).update({
    profile: { displayName: _authUser.displayName || '', lastLogin: now },
    stats: _getStats(),
    achievements: saveData.cloudAchievements || {},
    [`saves/slot${currentSaveSlot}`]: { ...saveData, lastSaved: now }
  }).catch(e => console.warn('[CLOUD] 동기화 실패:', e.message));
}

function _loadFromCloud() {
  const base = _cloudBase();
  if (!base) return;
  _fbDb.ref(base).once('value', snap => {
    const data = snap.val();
    if (!data) { _syncToCloud(); return; }
    if (data.stats) {
      const ls = _getStats();
      for (const k in data.stats) { if ((data.stats[k] || 0) > (ls[k] || 0)) ls[k] = data.stats[k]; }
    }
    if (data.achievements) {
      if (!saveData.cloudAchievements) saveData.cloudAchievements = {};
      Object.assign(saveData.cloudAchievements, data.achievements);
    }
    if (data.saves) {
      for (let slot = 0; slot < 3; slot++) {
        const cloud = data.saves[`slot${slot}`];
        if (!cloud) continue;
        try {
          const localRaw = localStorage.getItem(`ns_save_slot_${slot}`);
          const local = localRaw ? JSON.parse(localRaw) : null;
          if (!local || (cloud.lastSaved || 0) > (local.lastSaved || 0)) {
            localStorage.setItem(`ns_save_slot_${slot}`, JSON.stringify(cloud));
          }
        } catch(e) {}
      }
      saveData = loadSaveDataSlot(currentSaveSlot);
    }
    _checkCloudAchievements();
    console.log('[CLOUD] 데이터 로드 완료');
  });
}

// ── 업적 모달 UI ──────────────────────────────────────────────
function openAchievementModal() {
  const modal = document.getElementById('achievement-modal');
  if (modal) { modal.classList.add('active'); renderAchievements(); }
}

function closeAchievementModal() {
  document.getElementById('achievement-modal')?.classList.remove('active');
}

function switchAchTab(tab) {
  _currentAchTab = tab;
  document.querySelectorAll('.ach-tab').forEach(el => {
    const match = (tab === 'basic' && el.textContent.includes('기본')) ||
                  (tab === 'cloud' && el.textContent.includes('도전')) ||
                  (tab === 'stats' && el.textContent.includes('통계'));
    el.classList.toggle('active', match);
  });
  renderAchievements();
}

function renderAchievements() {
  const list = document.getElementById('achievement-list');
  if (!list) return;
  if (_currentAchTab === 'stats') {
    const s = _getStats();
    list.innerHTML = `<div class="stats-grid">${[
      ['총 킬 수', (s.totalKills||0).toLocaleString()],
      ['보스 처치', (s.totalBossKills||0).toLocaleString()],
      ['최고 스테이지', s.maxStage||0],
      ['최장 생존', _fmtTime(s.maxSurviveTime||0)],
      ['무기 진화', s.totalEvolutions||0],
      ['총 플레이', s.totalGamesPlayed||0],
      ['멀티 게임', s.mpGamesPlayed||0],
      ['배틀 우승', s.mpBattleWins||0],
    ].map(([l,v]) => `<div class="stat-card"><div class="stat-label">${l}</div><div class="stat-value">${v}</div></div>`).join('')}</div>`;
    return;
  }
  const defs = _currentAchTab === 'basic' ? ACHIEVEMENTS : CLOUD_ACHIEVEMENTS;
  const done = _currentAchTab === 'basic' ? (saveData.achievements || []) : (saveData.cloudAchievements || {});
  list.innerHTML = defs.map(def => {
    const isDone = _currentAchTab === 'basic' ? done.includes(def.id) : !!done[def.id];
    const isHidden = def.hidden && !isDone;
    const displayName = isDone ? (def.realName || def.name) : (isHidden ? '???' : def.name);
    const displayDesc = isHidden ? '🔒 비밀 업적 — 조건을 찾아보세요' : (def.desc + (def.reward ? ` (+${def.reward} 코어)` : ''));
    const s = _getStats();
    const cur = def.stat === '__allBasic__' ? (saveData.achievements||[]).length : (s[def.stat]||0);
    const prog = (_currentAchTab === 'cloud' && !isHidden)
      ? `${Math.min(cur, def.goal).toLocaleString()} / ${def.goal.toLocaleString()}` : '';
    return `<div class="ach-item${isDone?' done':''}">
      <div class="ach-item-icon">${isDone ? def.icon : '🔒'}</div>
      <div class="ach-item-body">
        <div class="ach-item-name">${displayName}</div>
        <div class="ach-item-desc">${displayDesc}</div>
        ${prog ? `<div class="ach-item-prog">${prog}</div>` : ''}
      </div>
      <div class="ach-item-status">${isDone ? '✅' : ''}</div>
    </div>`;
  }).join('');
}

function _fmtTime(secs) {
  const m = Math.floor(secs/60), s = secs%60;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function drawMultiplayerGhosts(ctx, camera) {
  // 오라 링 (내 캐릭터 주변)
  if (mpAuraActive && player) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(player.x - camera.x, player.y - camera.y, MP_AURA_RANGE, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(185,255,100,0.18)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
  for (const [id, p] of Object.entries(mpPlayers)) {
    if (id === mpMyId) continue;
    const sx = (p.renderX ?? p.x) - camera.x;
    const sy = (p.renderY ?? p.y) - camera.y;
    const offscreen = sx < -60 || sy < -60 || sx > canvas.width + 60 || sy > canvas.height + 60;
    if (offscreen) {
      const angle = Math.atan2(sy - canvas.height/2, sx - canvas.width/2);
      const margin = 28;
      const ax = canvas.width/2  + Math.cos(angle)*(Math.min(canvas.width/2, canvas.height/2)-margin);
      const ay = canvas.height/2 + Math.sin(angle)*(Math.min(canvas.width/2, canvas.height/2)-margin);
      ctx.save();
      ctx.translate(ax, ay); ctx.rotate(angle);
      ctx.fillStyle=p.color; ctx.globalAlpha=0.85;
      ctx.shadowBlur=8; ctx.shadowColor=p.color;
      ctx.beginPath();
      ctx.moveTo(12,0); ctx.lineTo(-8,-7); ctx.lineTo(-8,7);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha=1; ctx.shadowBlur=0;
      ctx.font='bold 8px Orbitron,monospace';
      ctx.fillStyle=p.color; ctx.textAlign='center';
      ctx.fillText((p.name||'P').slice(0,6), 0, -10);
      ctx.restore();
      continue;
    }
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.arc(sx, sy, 14, 0, Math.PI * 2);
    ctx.fillStyle = p.color + '33';
    ctx.fill();
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = p.color;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.font = 'bold 10px Orbitron, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = p.color;
    ctx.shadowBlur = 6;
    ctx.fillText((p.name || 'P').slice(0, 8), sx, sy - 20);
    if (p.maxHp > 0) {
      const bw = 28, bh = 3, ratio = Math.max(0, p.hp / p.maxHp);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(sx - bw / 2, sy + 17, bw, bh);
      ctx.fillStyle = p.color;
      ctx.fillRect(sx - bw / 2, sy + 17, bw * ratio, bh);
    }
    ctx.restore();
  }
}

function drawMpScoreboard(ctx, w, h) {
  const entries = Object.entries(mpPlayers).sort((a, b) => b[1].kills - a[1].kills);
  if (entries.length === 0) return;
  const panelW = 168, rowH = 18, padX = 8, padY = 6;
  const panelH = padY * 2 + rowH * (entries.length + 1);
  const px = w - panelW - 10, py = 60;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.fillRect(px, py, panelW, panelH);
  ctx.strokeStyle = mpGameMode === 'battle' ? 'rgba(255,68,102,0.4)' : 'rgba(0,240,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px, py, panelW, panelH);
  ctx.font = 'bold 9px Orbitron, monospace';
  ctx.fillStyle = mpGameMode === 'battle' ? '#ff4466' : '#00f0ff';
  ctx.textAlign = 'left';
  ctx.fillText(mpGameMode === 'battle' ? '⚔ BATTLE ROYALE' : '🤝 CO-OP', px + padX, py + padY + 8);
  entries.forEach(([id, p], i) => {
    const alive = p.alive !== false;
    ctx.fillStyle = alive ? p.color : '#555';
    ctx.font = '9px Rajdhani, monospace';
    const tag = id === mpMyId ? '▶' : (alive ? '●' : '✖');
    ctx.fillText(
      `${tag} ${(p.name || 'P').slice(0, 7).padEnd(7)}  Lv${p.level}  ${p.kills}K`,
      px + padX, py + padY + rowH + rowH * i + 12
    );
  });
  ctx.restore();
}

// ============================================================
// 글로벌 리더보드 (Firebase RTDB)
// ============================================================
function submitLeaderboard(isVictory) {
  if (!_fbDb && !_mpInitFirebase()) return;
  if (!_fbDb) return;
  const uid  = _authUser ? _authUser.uid : ('anon_' + (localStorage.getItem('ns_anon_id') || (() => { const id = Math.random().toString(36).slice(2); localStorage.setItem('ns_anon_id', id); return id; })()));
  const name = (document.getElementById('player-name-input')?.value.trim()) ||
               (_authUser?.displayName) || '익명';
  _fbDb.ref(`antisurge_lb/${uid}`).transaction(cur => {
    if (!cur || currentStage >= (cur.stage || 0)) {
      return { name: name.slice(0, 12), stage: currentStage, kills: killCount,
               time: gameTime, cls: player?.classId || '?', asc: ascensionLevel,
               victory: isVictory ? 1 : 0, ts: Date.now() };
    }
    return cur;
  }).catch(e => console.warn('[LB] 기록 실패:', e.message));
}

function openLeaderboardModal() {
  const modal = document.getElementById('leaderboard-modal');
  if (!modal) return;
  modal.classList.add('active');
  const list = document.getElementById('lb-list');
  list.innerHTML = '<div style="color:#64748b;padding:16px 0">불러오는 중...</div>';

  if (!_fbDb && !_mpInitFirebase()) {
    list.innerHTML = '<div style="color:#64748b;padding:16px 0">Firebase 미연결 — 로그인 후 이용 가능합니다.</div>';
    return;
  }
  _fbDb.ref('antisurge_lb').orderByChild('stage').limitToLast(10).once('value', snap => {
    const rows = [];
    snap.forEach(c => rows.push(c.val()));
    rows.sort((a, b) => b.stage - a.stage || b.kills - a.kills);
    if (rows.length === 0) {
      list.innerHTML = '<div style="color:#64748b;padding:16px 0">아직 기록이 없습니다. 첫 주인공이 되세요!</div>';
      return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    const clsIcons = { hacker:'💻', cyborg:'🤖', ghost:'👻', engineer:'🔧', sniper:'🎯', support:'💊' };
    const fmtTime = s => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
    list.innerHTML = rows.map((r, i) => `
      <div class="lb-row">
        <span class="lb-rank">${medals[i] || `#${i+1}`}</span>
        <span class="lb-name">${(clsIcons[r.cls] || '?')} ${r.name || '익명'}</span>
        <span class="lb-stage">S${r.stage}${r.victory ? ' ★' : ''}</span>
        <span class="lb-kills">${(r.kills||0).toLocaleString()}킬</span>
        <span class="lb-time">${fmtTime(r.time||0)}</span>
        ${r.asc > 0 ? `<span class="lb-asc">✨${r.asc}</span>` : ''}
      </div>`).join('');
  }).catch(() => {
    list.innerHTML = '<div style="color:#64748b;padding:16px 0">기록 로드 실패</div>';
  });
}

function closeLeaderboardModal() {
  const modal = document.getElementById('leaderboard-modal');
  if (modal) modal.classList.remove('active');
}

// 저장 데이터 로드 (스크립트 초기화 시)
saveData = loadSaveData();
ascensionLevel = saveData.ascensionLevel || 0;
updateMenuMetaBadge();
_initAuth();

// 터치 컨트롤 초기화
initTouchControls();

// 난이도 로드
loadDifficulty();

// 메뉴 BGM: 첫 상호작용 시 자동 시작
document.addEventListener('click',   tryStartMenuBgm);
document.addEventListener('keydown', tryStartMenuBgm);
