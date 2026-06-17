// game.js — Neon Survivors v0.01 ALPHA

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

// ============================================================
// 클래스 정의
// ============================================================
const CLASS_DEFS = {
  hacker: {
    name: '해커', icon: '💻', color: '#00f0ff',
    desc: '올라운더. 균형 잡힌 스탯. XP 획득 +10%, 리롤 +1회.',
    hp: 100, speed: 3.2, damageMult: 1.0, magnetRadius: 90,
    startWeapon: 'flare', rerolls: 3, xpBonus: 1.1
  },
  cyborg: {
    name: '사이보그', icon: '🤖', color: '#b026ff',
    desc: '방어형. HP가 높고 오비터로 근접 방어. 실드 지속 +3초.',
    hp: 160, speed: 2.4, damageMult: 0.9, magnetRadius: 75,
    startWeapon: 'orbiter', rerolls: 2, xpBonus: 1.0
  },
  ghost: {
    name: '고스트', icon: '👻', color: '#39ff14',
    desc: '공격형. 이동속도 +40%, 피해량 +25%. HP가 낮음.',
    hp: 70, speed: 4.5, damageMult: 1.25, magnetRadius: 70,
    startWeapon: 'flare', rerolls: 2, xpBonus: 1.0
  },
  engineer: {
    name: '엔지니어', icon: '🔧', color: '#ffe600',
    desc: '지원형. 존으로 시작. 자석 범위 2배, 회복 아이템 +50%.',
    hp: 110, speed: 3.0, damageMult: 1.0, magnetRadius: 180,
    startWeapon: 'zone', rerolls: 2, xpBonus: 1.0
  }
};

let gameState    = STATE_MENU;
let selectedClass = 'hacker';
let keys = {};
let lastTime = 0;
let gameTime = 0;
let timeAccumulator = 0;
let killCount = 0;

// 엔티티 배열
let player;
let enemies    = [];
let projectiles = [];
let gems       = [];
let particles  = [];
let fieldItems = [];
let floatingTexts = [];

// ============================================================
// 2. 스테이지 시스템
// ============================================================
let currentStage     = 1;
let stageKillProgress = 0;
let stageKillGoal    = 20;
let isBossStage      = false;
let isEndlessMode    = false;
let endlessModeStartTime = 0;
let isStageClearAnim = false;   // 클리어 연출 진행 중 여부

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

// 리롤 잔여 횟수
let rerollUses = 2;

// 골드 & 상점
let shopTimer = 0;
let goldCoins = [];

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

// 필드 아이템 타입
const FIELD_ITEM_TYPES = {
  health:  { icon: '💊', color: '#ff4466', name: '회복 팩',    effect: 'HP +40 즉시 회복' },
  magnet:  { icon: '🧲', color: '#b026ff', name: 'XP 자석',   effect: '화면 내 모든 젬 흡수' },
  nuke:    { icon: '☢️', color: '#ffe600', name: '데이터 핵',  effect: '화면 내 모든 적 제거' },
  shield:  { icon: '🛡️', color: '#00f0ff', name: '실드 버블',  effect: '5초간 피격 무적' },
  surge:   { icon: '⚡', color: '#39ff14', name: '오버클럭',   effect: '8초간 이동속도 2배' }
};

// ============================================================
// 패시브 아이템 정의
// ============================================================
const PASSIVE_DEFS = {
  regen:     { name: '회생 코어',   icon: '🔋', desc: ['체력 3초마다 +1 자동 회복',           '회복량 3배 증가 (+3/3s)'] },
  shield:    { name: '방어막 칩',   icon: '💠', desc: ['받는 피해 10% 감소',                  '피해 감소 22%로 강화'] },
  nanobots:  { name: '나노봇 군단', icon: '🦠', desc: ['젬 흡수 시 20% 확률로 HP +3 회복',    '확률 40%, 회복량 +5로 증가'] },
  overclock: { name: '과부하 회로', icon: '⚙️', desc: ['모든 무기 피해량 +12%',               '피해량 추가 +28% (합계 +40%)'] },
  resonance: { name: '공명 코어',   icon: '🔮', desc: ['젬 XP +20% 추가 획득',               'XP +45%로 증가'] },
  thorns:    { name: '복수의 가시', icon: '⚔️', desc: ['피격 시 반경 120 내 적에게 15 피해',  '피해 25, 반경 160으로 강화'] }
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

// 보스 이름 테이블
const BOSS_NAMES = [
  'VIRUS ALPHA',     'MALWARE CORE',    'TROJAN PRIME',    'ROOTKIT ZERO',
  'RANSOMWARE-X',    'CRYPTO WYRM',     'NEURAL CORRUPTOR','DAEMON KING',
  'QUANTUM GHOST',   'FINAL PROTOCOL'
];

// 무기 통계 (결과 화면용)
let weaponStats = {
  flare:   { level: 0, damage: 0, kills: 0 },
  orbiter: { level: 0, damage: 0, kills: 0 },
  zone:    { level: 0, damage: 0, kills: 0 },
  laser:   { level: 0, damage: 0, kills: 0 }
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
let bgmMuted          = false;
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
    const step = bgmCurrentStep % BGM_TOTAL_STEPS;
    const t    = bgmNextNoteTime;
    if (BGM_BASS[step] !== null) bgmPlayTone(midiToFreq(BGM_BASS[step] - 12), BGM_STEP * 1.7, 'sawtooth', 0.17, t);
    if (BGM_PAD[step]  !== null) {
      bgmPlayTone(midiToFreq(BGM_PAD[step]),     BGM_STEP * 3.8, 'sawtooth', 0.045, t);
      bgmPlayTone(midiToFreq(BGM_PAD[step] + 7), BGM_STEP * 3.8, 'sawtooth', 0.03,  t);
    }
    if (BGM_LEAD[step] !== null) bgmPlayTone(midiToFreq(BGM_LEAD[step]), BGM_STEP * 0.85, 'square', 0.055, t);
    if (BGM_KICK[step])  bgmPlayKick(t);
    if (BGM_SNARE[step]) bgmPlaySnare(t);
    if (BGM_HIHAT[step]) bgmPlayHihat(t);
    bgmCurrentStep++;
    bgmNextNoteTime += BGM_STEP;
  }
  bgmSchedulerTimer = setTimeout(bgmSchedule, BGM_SCHEDULER_MS);
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
    try { bgmGainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.08); } catch(e) {}
    setTimeout(() => { if (bgmGainNode) { bgmGainNode.disconnect(); bgmGainNode = null; } }, 200);
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
    this.passives        = { regen: 0, shield: 0, nanobots: 0, overclock: 0, resonance: 0, thorns: 0 };
    this.regenTimer      = 0;
    this.damageReduction = 0.0;
    this.passiveXpMult   = 1.0;
    this.thornsTrigger   = false;

    // 골드
    this.gold = 0;

    this.weapons = {
      flare:   new FlareWeapon(this),
      orbiter: new OrbiterWeapon(this),
      zone:    new ZoneWeapon(this),
      laser:   new LaserWeapon(this)
    };
    const startW = cls.startWeapon || 'flare';
    this.weapons[startW].level = 1;
    weaponStats[startW].level  = 1;
  }

  update(dt) {
    let dx = 0, dy = 0;
    if (keys['w'] || keys['W'] || keys['ArrowUp'])    dy -= 1;
    if (keys['s'] || keys['S'] || keys['ArrowDown'])  dy += 1;
    if (keys['a'] || keys['A'] || keys['ArrowLeft'])  dx -= 1;
    if (keys['d'] || keys['D'] || keys['ArrowRight']) dx += 1;
    if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }

    let spd = this.speed * (this.surgeTimer > 0 ? 2.0 : 1.0);
    this.x += dx * spd * (dt / 16.66);
    this.y += dy * spd * (dt / 16.66);
    this.x = Math.max(this.radius, Math.min(MAP_WIDTH  - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(MAP_HEIGHT - this.radius, this.y));

    if (this.shieldTimer > 0) this.shieldTimer -= dt;
    if (this.surgeTimer  > 0) this.surgeTimer  -= dt;
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

    // 패시브: 복수의 가시 (피격 지연 처리)
    if (this.thornsTrigger) {
      this.thornsTrigger = false;
      const thornDmg = this.passives.thorns === 2 ? 25 : 15;
      const thornR   = this.passives.thorns === 2 ? 160 : 120;
      for (let i = enemies.length - 1; i >= 0; i--) {
        if (dist(this.x, this.y, enemies[i].x, enemies[i].y) < thornR) {
          if (enemies[i].takeDamage(thornDmg, 'thorns')) killCount++;
        }
      }
    }

    for (let key in this.weapons) {
      if (this.weapons[key].level > 0) this.weapons[key].update(dt);
    }
  }

  draw(ctx, camera) {
    ctx.save();
    // 실드 활성화 시 추가 외곽 링
    if (this.shieldTimer > 0) {
      ctx.shadowBlur  = 25;
      ctx.shadowColor = '#00f0ff';
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth   = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(this.x - camera.x, this.y - camera.y, this.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.shadowBlur  = 15;
    ctx.shadowColor = this.color;
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.arc(this.x - camera.x, this.y - camera.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x - camera.x, this.y - camera.y, this.radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    for (let key in this.weapons) {
      if (this.weapons[key].level > 0 && typeof this.weapons[key].draw === 'function') {
        this.weapons[key].draw(ctx, camera);
      }
    }
  }

  gainXp(amount) {
    let mult = getXpMultiplier();
    const cls = CLASS_DEFS[this.classId];
    if (cls) mult *= cls.xpBonus;
    mult *= this.passiveXpMult;
    this.xp += amount * mult;
    if (this.xp >= this.nextLevelXp) {
      this.xp -= this.nextLevelXp;
      this.levelUp();
    }
  }

  levelUp() {
    this.level++;
    this.nextLevelXp = Math.floor(this.nextLevelXp * 1.35) + 8;
    playLevelUpSound();
    triggerLevelUpModal();
  }

  takeDamage(amount) {
    if (this.shieldTimer > 0) {
      addFloatingText(this.x, this.y - this.radius, 'BLOCKED', '#00f0ff', 12);
      return;
    }
    let dmg = amount;
    if (this.damageReduction > 0) dmg = Math.max(1, Math.floor(dmg * (1 - this.damageReduction)));
    this.hp -= dmg;
    if (this.passives.thorns > 0) this.thornsTrigger = true;
    playHitSound();
    createDamageOverlayParticles(this.x, this.y);
    triggerScreenShake(5, 250);
    if (this.hp <= 0) { this.hp = 0; endGame(false); }
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
  return {
    hpMult:    1 + (currentStage - 1) * 0.18,
    dmgMult:   1 + (currentStage - 1) * 0.10,
    speedMult: 1 + (currentStage - 1) * 0.025
  };
}

class Enemy {
  constructor(x, y, type) {
    this.x = x; this.y = y; this.type = type;
    this.speedMultiplier = 1.0;
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
    let dx = player.x - this.x, dy = player.y - this.y;
    let d  = Math.sqrt(dx*dx + dy*dy);
    if (d > 0) { dx /= d; dy /= d; }
    let spd = this.baseSpeed * this.speedMultiplier;
    this.x += dx * spd * (dt / 16.66);
    this.y += dy * spd * (dt / 16.66);
    this.speedMultiplier = 1.0;
    if (this.flashTimer > 0) this.flashTimer -= dt;
  }

  draw(ctx, camera) {
    ctx.save();
    if (this.type === 'bruiser' || this.flashTimer > 0) {
      ctx.shadowBlur = 10; ctx.shadowColor = this.color;
    }
    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : this.color;
    ctx.beginPath();
    ctx.arc(this.x - camera.x, this.y - camera.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke();
    if (this.hp < this.maxHp && this.hp > 0) {
      let bw = this.radius * 1.6, bh = 3;
      let bx = this.x - camera.x - bw/2, by = this.y - camera.y - this.radius - 8;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#ff0000'; ctx.fillRect(bx, by, bw * (this.hp / this.maxHp), bh);
    }
    ctx.restore();
  }

  takeDamage(amount, sourceKey) {
    this.hp -= amount;
    this.flashTimer = 80;
    if (weaponStats[sourceKey]) weaponStats[sourceKey].damage += amount;
    createExplosionParticles(this.x, this.y, this.color, 3);
    // 플로팅 데미지 숫자 (25% 확률로 표시)
    if (Math.random() < 0.25) {
      addFloatingText(this.x + (Math.random()-0.5)*20, this.y - this.radius, Math.floor(amount).toString(), '#ffffff', 11);
    }
    if (this.hp <= 0) { this.die(sourceKey); return true; }
    return false;
  }

  die(sourceKey) {
    if (this.dead) return;
    this.dead = true;
    createExplosionParticles(this.x, this.y, this.color, 12);
    playEnemyExplosionSound();
    if (weaponStats[sourceKey]) weaponStats[sourceKey].kills++;
    gems.push(new Gem(this.x, this.y, this.xpValue));

    // 스테이지 킬 진행
    stageKillProgress++;
    onEnemyKilled();
    checkStageProgress();

    // 필드 아이템 드롭 (bruiser 12%, rusher 4%, swarm 2%)
    let dropChance = this.type === 'bruiser' ? 0.12 : this.type === 'rusher' ? 0.04 : 0.02;
    if (Math.random() < dropChance && fieldItems.length < 8) {
      let dropTypes = ['health', 'health', 'magnet', 'surge'];
      let dropType  = dropTypes[Math.floor(Math.random() * dropTypes.length)];
      fieldItems.push(new FieldItem(this.x, this.y, dropType));
    }

    // 골드 드롭
    let goldAmt = 0;
    if      (this.type === 'bruiser') goldAmt = 2 + Math.floor(Math.random() * 3);
    else if (this.type === 'rusher'  && Math.random() < 0.4) goldAmt = 1 + (Math.random() < 0.3 ? 1 : 0);
    else if (this.type === 'swarm'   && Math.random() < 0.2) goldAmt = 1;
    if (goldAmt > 0) spawnGoldCoins(this.x, this.y, goldAmt);

    let idx = enemies.indexOf(this);
    if (idx !== -1) enemies.splice(idx, 1);
  }
}

// ============================================================
// 10. 보스 클래스
// ============================================================
class Boss {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.type   = 'boss';
    this.radius = 50;
    this.speedMultiplier = 1.0;
    this.flashTimer = 0;
    this.pulseTimer = 0;

    let bossIdx = Math.floor(currentStage / 10) - 1;
    let scale   = 1 + bossIdx * 0.65;
    this.maxHp  = Math.floor(450 * scale);
    this.hp     = this.maxHp;
    this.damage = Math.floor(22 * (1 + bossIdx * 0.25));
    this.xpValue = 40 + bossIdx * 15;
    this.baseSpeed = 1.3;
    this.name   = BOSS_NAMES[Math.min(bossIdx, BOSS_NAMES.length - 1)];
    this.phase  = 1;

    // 돌진 공격
    this.chargeTimer    = 0;
    this.chargeCooldown = 4500;
    this.isCharging     = false;
    this.chargeVx = 0; this.chargeVy = 0;
    this.chargeDuration = 0;

    // 미니언 소환
    this.minionTimer    = 0;
    this.minionCooldown = 8000;
  }

  update(dt) {
    this.pulseTimer += dt;
    this.speedMultiplier = 1.0;
    if (this.flashTimer > 0) this.flashTimer -= dt;

    // 페이즈 2 전환 (HP 50% 이하)
    if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
      this.phase = 2;
      this.baseSpeed    *= 1.5;
      this.chargeCooldown = 2500;
      this.minionCooldown = 5000;
      createExplosionParticles(this.x, this.y, '#ff0000', 25);
      triggerScreenShake(8, 500);
      addFloatingText(this.x, this.y - 70, 'PHASE 2!', '#ff6600', 18);
      playSynthSound([80, 200], 0.5, 'sawtooth', 0.12);
    }

    if (this.isCharging) {
      this.x += this.chargeVx * (dt / 16.66);
      this.y += this.chargeVy * (dt / 16.66);
      this.chargeDuration -= dt;
      if (this.chargeDuration <= 0) {
        this.isCharging = false;
        this.baseSpeed  = this.phase === 2 ? 1.95 : 1.3;
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
      this.startCharge();
    }

    this.minionTimer += dt;
    if (this.minionTimer >= this.minionCooldown) {
      this.minionTimer = 0;
      this.spawnMinions();
    }
  }

  startCharge() {
    if (!player) return;
    let dx = player.x - this.x, dy = player.y - this.y;
    let d  = Math.sqrt(dx*dx + dy*dy);
    if (d > 0) { dx /= d; dy /= d; }
    let chargeSpd = this.phase === 2 ? 14 : 9;
    this.chargeVx = dx * chargeSpd;
    this.chargeVy = dy * chargeSpd;
    this.isCharging     = true;
    this.chargeDuration = 600;
    this.baseSpeed      = 0;
    addFloatingText(this.x, this.y - 60, '⚡ CHARGE!', '#ff6600', 13);
    playSynthSound([200, 600], 0.3, 'sawtooth', 0.1);
    triggerScreenShake(4, 300);
  }

  spawnMinions() {
    let count = this.phase === 2 ? 4 : 2;
    for (let i = 0; i < count; i++) {
      let angle = Math.random() * Math.PI * 2;
      let r  = 80 + Math.random() * 60;
      let ex = Math.max(20, Math.min(MAP_WIDTH  - 20, this.x + Math.cos(angle) * r));
      let ey = Math.max(20, Math.min(MAP_HEIGHT - 20, this.y + Math.sin(angle) * r));
      enemies.push(new Enemy(ex, ey, 'rusher'));
    }
    addFloatingText(this.x, this.y - 60, '▶ 소환!', '#ff0044', 12);
  }

  draw(ctx, camera) {
    ctx.save();
    let pulse    = Math.sin(this.pulseTimer * 0.006) * 5;
    let drawR    = this.radius + pulse;
    let bx = this.x - camera.x, by = this.y - camera.y;
    let glowColor = this.phase === 2 ? '#ff6600' : '#ff0044';

    ctx.shadowBlur  = 35;
    ctx.shadowColor = glowColor;
    ctx.fillStyle   = this.flashTimer > 0 ? '#ffffff' : (this.phase === 2 ? '#ff4400' : '#ff0044');
    ctx.beginPath(); ctx.arc(bx, by, drawR, 0, Math.PI * 2); ctx.fill();

    ctx.shadowBlur  = 15;
    ctx.fillStyle   = this.phase === 2 ? '#ff8800' : '#ff4466';
    ctx.beginPath(); ctx.arc(bx, by, drawR * 0.55, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();

    // 보스 이름 표시
    ctx.font      = 'bold 11px Orbitron, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.shadowBlur  = 5; ctx.shadowColor = '#ff0044';
    ctx.fillText(this.name, bx, by - drawR - 12);

    // HP 바 (보스 위)
    let barW = this.radius * 2.5, barH = 6;
    let barX = bx - barW / 2, barY = by - drawR - 22;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(barX, barY, barW, barH);
    let pct = Math.max(this.hp / this.maxHp, 0);
    ctx.fillStyle = pct > 0.5 ? '#ff0044' : pct > 0.25 ? '#ff6600' : '#ff0000';
    ctx.fillRect(barX, barY, barW * pct, barH);

    ctx.restore();
  }

  takeDamage(amount, sourceKey) {
    this.hp -= amount;
    this.flashTimer = 80;
    if (weaponStats[sourceKey]) weaponStats[sourceKey].damage += amount;
    createExplosionParticles(this.x, this.y, '#ff0044', 2);
    // 보스는 항상 데미지 숫자 표시
    addFloatingText(this.x + (Math.random()-0.5)*30, this.y - this.radius, Math.floor(amount).toString(), '#ff4466', 13);
    if (this.hp <= 0) { this.hp = 0; this.die(sourceKey); return true; }
    return false;
  }

  die(sourceKey) {
    if (this.dead) return;
    this.dead = true;
    createExplosionParticles(this.x, this.y, '#ff0044', 35);
    createExplosionParticles(this.x, this.y, '#ffe600', 25);
    triggerScreenShake(18, 900);
    if (weaponStats[sourceKey]) weaponStats[sourceKey].kills++;
    // 대량 XP 젬 생성
    for (let i = 0; i < 12; i++) {
      let ang = Math.random() * Math.PI * 2;
      let r   = Math.random() * 70;
      gems.push(new Gem(this.x + Math.cos(ang)*r, this.y + Math.sin(ang)*r, this.xpValue));
    }
    // killCount는 무기 코드/충돌 판정에서 집계 (여기서는 제외)
    playBossDeathSound();
    spawnGoldCoins(this.x, this.y, 12 + Math.floor(Math.random() * 9));
    activeBoss = null;
    isBossStage = false;
    triggerStageClear();
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
    enemies = [];
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
    if (this.isAttracted || d < player.magnetRadius) {
      this.isAttracted = true;
      let dx = player.x - this.x, dy = player.y - this.y;
      if (d > 0) { dx /= d; dy /= d; }
      this.speed += 0.35 * (dt / 16.66);
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
  for (let i = 0; i < count; i++) {
    let speed = 1.0 + Math.random() * 3.5;
    let angle = Math.random() * Math.PI * 2;
    particles.push(new Particle(x, y, Math.cos(angle)*speed, Math.sin(angle)*speed, color, 250 + Math.random()*250));
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
  if (stage % 10 === 0) return 0; // 보스 스테이지는 목표 없음
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
  gameState = STATE_STAGE_CLEAR;

  // 남은 적들 젬 드롭 후 제거 (젬은 필드에 유지)
  for (let e of enemies) {
    gems.push(new Gem(e.x, e.y, e.xpValue));
    createExplosionParticles(e.x, e.y, e.color, 5);
  }
  enemies = [];
  projectiles = [];

  showStageOverlay(
    `STAGE ${currentStage} CLEAR!`,
    currentStage >= 100 ? '★ ENDLESS MODE 진입! ★' : `보너스 보상을 선택하세요!`,
    currentStage >= 100 ? '#ffe600' : '#39ff14'
  );
  playStageClearSound();
  spawnRandomFieldItem();

  setTimeout(() => {
    hideStageOverlay();
    showStageBonusModal();
  }, 2200);
}

function advanceToNextStage() {
  currentStage++;

  if (currentStage > 100 && !isEndlessMode) {
    isEndlessMode = true;
    endlessModeStartTime = gameTime;
  }

  if (currentStage % 10 === 0) {
    isBossStage      = true;
    stageKillGoal    = 0;
    stageKillProgress = 0;
    showBossWarning();
  } else {
    isBossStage       = false;
    stageKillProgress = 0;
    stageKillGoal     = getStageKillGoal(currentStage);
    gameState = STATE_PLAYING;
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
  gameState = STATE_STAGE_BONUS;
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
  showStageOverlay(`⚠ BOSS STAGE ${currentStage} ⚠`, bossName, '#ff0044');
  triggerScreenShake(6, 400);

  setTimeout(() => {
    hideStageOverlay();
    spawnBossEnemy();
    gameState = STATE_PLAYING;
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
  updateComboDisplay();
}

function updateComboSystem(dt) {
  if (comboCount > 0) {
    comboTimer -= dt;
    if (comboTimer <= 0) { comboCount = 0; comboTimer = 0; hideComboDisplay(); }
    else updateComboDisplay();
  }
}

function getXpMultiplier() {
  if (comboCount < 5)  return 1.0;
  if (comboCount < 15) return 1.25;
  if (comboCount < 30) return 1.5;
  if (comboCount < 60) return 2.0;
  return 2.5;
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
  if (enemySpawnTimer >= enemySpawnInterval) {
    enemySpawnTimer = 0;
    spawnEnemyPack();
  }
}

function spawnEnemyPack() {
  if (!player) return;
  let count = 1 + Math.floor(Math.random() * 2);
  if (gameTime > 120 || currentStage > 5)  count += 1;
  if (gameTime > 240 || currentStage > 15) count += 2;

  for (let i = 0; i < count; i++) {
    let angle = Math.random() * Math.PI * 2;
    let d     = 450 + Math.random() * 150;
    let sx = Math.max(20, Math.min(MAP_WIDTH  - 20, player.x + Math.cos(angle) * d));
    let sy = Math.max(20, Math.min(MAP_HEIGHT - 20, player.y + Math.sin(angle) * d));

    let type = 'swarm';
    let rand = Math.random();
    if (gameTime > 180 || currentStage > 10) {
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
    let p = projectiles[i];
    let allTargets = [...enemies];
    if (activeBoss) allTargets.push(activeBoss);

    for (let e of allTargets) {
      if (p.hitEnemies.has(e)) continue;
      if (dist(p.x, p.y, e.x, e.y) < p.radius + e.radius) {
        let isDead = e.takeDamage(p.damage, p.weaponKey);
        if (isDead) killCount++;
        p.hitEnemies.add(e);
        p.pierce--;
        if (p.pierce <= 0) { projectiles.splice(i, 1); break; }
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
        player.takeDamage(e.damage);
        player.lastHitTime = now;
        break;
      }
    }
  }
}

// ============================================================
// 20. 맵 격자 렌더링
// ============================================================
function drawGrid(ctx, camera, width, height) {
  ctx.save();
  ctx.strokeStyle = '#1e1b4b';
  ctx.lineWidth   = 1;
  ctx.globalAlpha = 0.6;
  const gridSize = 100;
  let startX = Math.floor(camera.x / gridSize) * gridSize;
  let startY = Math.floor(camera.y / gridSize) * gridSize;
  for (let x = startX; x < startX + width + gridSize; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x - camera.x, 0); ctx.lineTo(x - camera.x, height); ctx.stroke();
  }
  for (let y = startY; y < startY + height + gridSize; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, y - camera.y); ctx.lineTo(width, y - camera.y); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255, 0, 127, 0.4)';
  ctx.lineWidth   = 4;
  ctx.globalAlpha = 1.0;
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
  keys[e.key] = true;
  if (e.key === 'm' || e.key === 'M') toggleBGM();
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

// 클래스 선택 카드 이벤트
document.querySelectorAll('.class-card').forEach(card => {
  card.addEventListener('click', () => {
    selectedClass = card.dataset.class;
    document.getElementById('class-select-screen').classList.remove('active');
    startGame();
  });
});

function showScreen(state) {
  gameState = state;
  menuScreen.classList.remove('active');
  gameScreen.classList.remove('active');
  levelUpModal.classList.remove('active');
  gameOverModal.classList.remove('active');
  document.getElementById('stage-bonus-modal').classList.remove('active');
  document.getElementById('shop-modal').classList.remove('active');
  if (state === STATE_MENU) { menuScreen.classList.add('active'); stopBGM(); }
  else if (state === STATE_PLAYING || state === STATE_STAGE_CLEAR || state === STATE_STAGE_BONUS) {
    gameScreen.classList.add('active');
  }
}

function startGame() {
  showScreen(STATE_PLAYING);

  // 전체 리셋
  killCount = 0; gameTime = 0; timeAccumulator = 0;
  enemies = []; projectiles = []; gems = []; particles = [];
  activeLasersArr = []; fieldItems = []; floatingTexts = [];
  activeBoss  = null;
  currentStage = 1;
  stageKillProgress = 0;
  stageKillGoal     = getStageKillGoal(1);
  isBossStage       = false;
  isEndlessMode     = false;
  endlessModeStartTime = 0;
  isStageClearAnim  = false;
  screenShake       = { x: 0, y: 0, intensity: 0, duration: 0 };
  comboCount = 0; comboTimer = 0;
  fieldItemTimer  = 0;
  shopTimer       = 0;
  goldCoins       = [];
  rerollUses      = (CLASS_DEFS[selectedClass] || CLASS_DEFS.hacker).rerolls;
  enemySpawnTimer = 0;
  hideComboDisplay();
  hideStageOverlay();

  for (let k in weaponStats) weaponStats[k] = { level: 0, damage: 0, kills: 0 };

  player = new Player(MAP_WIDTH / 2, MAP_HEIGHT / 2);
  resizeCanvas();
  camera.x = player.x - camera.width  / 2;
  camera.y = player.y - camera.height / 2;

  startBGM();
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

// ============================================================
// 22. 메인 게임 루프
// ============================================================
function gameLoop(time) {
  if (gameState !== STATE_PLAYING && gameState !== STATE_LEVEL_UP &&
      gameState !== STATE_STAGE_CLEAR && gameState !== STATE_STAGE_BONUS &&
      gameState !== STATE_SHOP) return;
  let dt = time - lastTime;
  if (dt > 100) dt = 16.66;
  lastTime = time;

  if (gameState === STATE_PLAYING) update(dt);

  draw();
  requestAnimationFrame(gameLoop);
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

  // 카메라 추종
  let targetCamX = player.x - camera.width  / 2;
  let targetCamY = player.y - camera.height / 2;
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
    if (projectiles[i].life <= 0) projectiles.splice(i, 1);
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

  // 적 스폰
  updateEnemySpawning(dt);

  // 충돌
  checkCollisions();

  // 콤보
  updateComboSystem(dt);

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

  // HUD 동기화
  updateHUD();
}

// ============================================================
// 23. 그리기
// ============================================================
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

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

  for (let e of enemies) e.draw(ctx, camera);

  if (activeBoss) activeBoss.draw(ctx, camera);

  for (let item of fieldItems) item.draw(ctx, camera);
  for (let coin of goldCoins)  coin.draw(ctx, camera);

  player.draw(ctx, camera);

  // 플로팅 텍스트
  for (let ft of floatingTexts) ft.draw(ctx, camera);

  ctx.restore(); // 화면 진동 해제
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
    stageBarText.innerText    = isEndlessMode ? `∞ ENDLESS` : `${stageKillProgress} / ${stageKillGoal}`;
  }

  // 무기 슬롯
  let wc = document.getElementById('weapons-list');
  wc.innerHTML = '';
  for (let key in player.weapons) {
    let w = player.weapons[key];
    if (w.level > 0) {
      let slot = document.createElement('div');
      slot.className = 'weapon-slot active';
      slot.innerHTML = `${UPGRADES.weapons[key].icon}<span class="weapon-level">Lv.${w.level}</span>`;
      wc.appendChild(slot);
    }
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

function triggerLevelUpModal() {
  gameState = STATE_LEVEL_UP;
  levelUpModal.classList.add('active');
  renderUpgradeCards(generateUpgradeChoices());

  const rerollBtn  = document.getElementById('reroll-btn');
  const rerollUsesEl = document.getElementById('reroll-uses');
  rerollBtn.disabled = (rerollUses <= 0);
  if (rerollUsesEl) rerollUsesEl.textContent = `(${rerollUses}회)`;

  rerollBtn.onclick = () => {
    if (rerollUses <= 0) return;
    rerollUses--;
    renderUpgradeCards(generateUpgradeChoices());
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
    if      (choice.type === 'stat')                        tagText = '시스템 강화';
    else if (choice.type === 'passive' && !choice.isUpgrade) tagText = '패시브 신규';
    else if (choice.type === 'passive' && choice.isUpgrade)  tagText = `패시브 Lv${choice.nextLevel}`;
    else if (choice.isUpgrade)                               tagText = `업그레이드 Lv.${choice.nextLevel}`;
    else if (choice.type === 'legendary')                    tagText = '⭐ 전설';

    let descText = choice.desc;
    if (choice.rarityMult > 1.0 && choice.type === 'stat') {
      descText += ` <span style="color:${rd.color}">[${rd.name}: 효과 x${choice.rarityMult}]</span>`;
    }

    card.innerHTML = `
      <div class="card-icon">${choice.icon}</div>
      <div class="card-details">
        <div class="card-title-row">
          <span class="card-name" style="color:${choice.rarity === 'legendary' ? '#ffe600' : '#fff'}">${choice.name}</span>
          <span class="card-tag tag-${choice.rarity || 'common'}">${tagText}</span>
        </div>
        <div class="card-desc">${descText}</div>
      </div>
    `;

    card.addEventListener('click', () => {
      applyUpgrade(choice);
      levelUpModal.classList.remove('active');
      gameState = STATE_PLAYING;
      lastTime  = performance.now();
    });

    container.appendChild(card);
  });
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

  if (choice.type === 'weapon') {
    let weapon = player.weapons[choice.key];
    weapon.level = choice.nextLevel;
    weaponStats[choice.key].level = choice.nextLevel;
    if (choice.nextLevel === 5) {
      let evolvedName = UPGRADES.weapons[choice.key].evolvedName || UPGRADES.weapons[choice.key].name;
      showEvolutionNotification(UPGRADES.weapons[choice.key].icon, evolvedName);
    } else {
      playSynthSound([600, 1200], 0.15, 'sine', 0.05);
    }
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
  }
}

// ============================================================
// 상점 시스템
// ============================================================
function triggerShopModal() {
  gameState = STATE_SHOP;
  const modal    = document.getElementById('shop-modal');
  const goldDisp = document.getElementById('shop-gold-display');
  if (goldDisp) goldDisp.textContent = `보유 골드: 💰 ${player.gold}G`;
  const shuffled = [...SHOP_ITEMS].sort(() => Math.random() - 0.5).slice(0, 3);
  renderShopItems(shuffled);
  modal.classList.add('active');
}

function renderShopItems(items) {
  const list     = document.getElementById('shop-items-list');
  const goldDisp = document.getElementById('shop-gold-display');
  if (goldDisp) goldDisp.textContent = `보유 골드: 💰 ${player.gold}G`;
  list.innerHTML = '';
  items.forEach(item => {
    const canAfford = player.gold >= item.cost;
    const btn = document.createElement('button');
    btn.className = `shop-item-card${canAfford ? '' : ' shop-cant-afford'}`;
    btn.innerHTML = `
      <div class="shop-item-icon">${item.icon}</div>
      <div class="shop-item-details">
        <div class="shop-item-name">${item.name}</div>
        <div class="shop-item-desc">${item.desc}</div>
      </div>
      <div class="shop-item-cost ${canAfford ? 'can-afford' : 'cant-afford'}">💰 ${item.cost}G</div>
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
  if (player.gold < item.cost) return;
  player.gold -= item.cost;
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
  gameState = STATE_PLAYING;
  shopTimer = 0;
  lastTime  = performance.now();
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
  gameOverModal.classList.add('active');

  const title    = document.getElementById('result-title');
  const subtitle = document.getElementById('result-subtitle');

  if (isEndlessMode) {
    title.innerText = 'ENDLESS TERMINATED';
    title.style.textShadow = '0 0 10px #ffe600, 0 0 20px #ffe600';
    title.style.color = '#fff';
    subtitle.innerText = `★ STAGE ${currentStage} 도달! STAGE 100 돌파 후 무한 생존! ★`;
  } else {
    title.innerText = 'SYSTEM OVERLOAD';
    title.style.textShadow = '0 0 10px var(--color-neon-pink), 0 0 20px var(--color-neon-pink)';
    title.style.color = '#fff';
    subtitle.innerText = `STAGE ${currentStage}에서 바이러스에 감염되었습니다.`;
    playGameOverSound();
  }

  let minutes = Math.floor(gameTime / 60);
  let seconds = gameTime % 60;
  document.getElementById('stat-time').innerText  = `${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
  document.getElementById('stat-kills').innerText  = killCount;
  document.getElementById('stat-level').innerText  = `Lv. ${player.level}`;
  document.getElementById('stat-stage').innerText  = `S${currentStage}${isEndlessMode ? ' ∞' : ''}`;

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
// 27. 유틸리티
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
