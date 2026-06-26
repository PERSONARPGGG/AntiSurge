// ============================================================
// AntiSurge i18n — EN / KO Bilingual Support
// MUST be loaded before all other src/ modules
// ============================================================

let LANG = localStorage.getItem('ns_lang') || 'en';

function t(key) {
  return (STRINGS[LANG]?.[key]) ?? (STRINGS['en']?.[key]) ?? key;
}

// Lookup English translation for game entity field (weapons, missions, etc.)
function tGame(category, key, field, idx) {
  if (LANG !== 'en') return null;
  const entry = EN_GAME[category]?.[key];
  if (!entry) return null;
  if (idx !== undefined) return Array.isArray(entry[field]) ? (entry[field][idx] ?? null) : null;
  return entry[field] ?? null;
}

function setLang(lang) {
  LANG = lang;
  localStorage.setItem('ns_lang', lang);
  applyI18n();
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (val !== key) el.textContent = val;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const val = t(key);
    if (val !== key) el.placeholder = val;
  });
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('lang-active', btn.dataset.lang === LANG);
  });
  const htmlEl = document.documentElement;
  if (htmlEl) htmlEl.lang = LANG === 'en' ? 'en' : 'ko';
}

// ── UI Strings ────────────────────────────────────────────────
const STRINGS = {
  en: {
    // Menu
    'menu.title.sub': 'CYBERPUNK VIRUS SURVIVAL',
    'menu.start': '▶ START GAME',
    'menu.meta': '⚡ PERMANENT UPGRADES',
    'menu.record': '— BEST RECORD —',
    'menu.multi': 'MULTIPLAYER',
    'menu.daily': 'DAILY RUN',
    'menu.leaderboard': 'LEADERBOARD',
    'menu.achievements': 'ACHIEVEMENTS',
    'menu.archive': 'LOG ARCHIVE',
    'menu.settings': 'SETTINGS',
    'menu.auth.local': 'Local save (Login for cloud sync)',
    'menu.auth.login': '🔑 Google Login',
    'menu.controls.move': 'MOVE',
    'menu.controls.skill': 'SKILL',
    'menu.controls.pause': 'PAUSE',
    'menu.controls.bgm': 'BGM',
    'menu.controls.drag': 'Drag to Move',
    'menu.controls.skillbtn': 'Skill Button',
    'menu.controls.pausebtn': 'Pause',

    // Class select
    'class.select.title': 'SELECT VACCINE',
    'class.select.hint': 'Choose your combat style. Click a card for details.',
    'class.confirm.hint': 'Vaccine selected',
    'class.confirm.back': '← BACK',
    'class.confirm.start': '▶ DEPLOY',
    'class.hidden': '??? HIDDEN CLASS',

    // Mid-run restore
    'midrun.label': '⚡ PREVIOUS RUN DETECTED',
    'midrun.resume': '▶ CONTINUE',
    'midrun.new': '✕ NEW GAME',

    // Upgrade card tags
    'card.tag.new_weapon': 'NEW WEAPON',
    'card.tag.fusion': '🔮 WEAPON FUSION',
    'card.tag.revival': '💀 EPIC REVIVAL',
    'card.tag.class_new': '⭐ CLASS EXCLUSIVE',
    'card.tag.stat': 'SYSTEM BOOST',
    'card.tag.passive_new': 'NEW PASSIVE',
    'card.tag.legendary': '⭐ LEGENDARY',
    'card.rarity.effect': 'Effect ×',

    // Level up
    'levelup.title': 'SYSTEM UPGRADE DETECTED',
    'levelup.desc': 'Select an upgrade module.',
    'levelup.reroll': '🔄 REROLL',

    // Shop
    'shop.title': '🛒 DATA MARKET',
    'shop.gold': '💰 GOLD:',
    'shop.desc': 'Purchase items. Multiple buys allowed.',
    'shop.bought': '×{n} bought',
    'shop.next': 'Next: {n}G',
    'shop.continue': 'CONTINUE',

    // Curse
    'curse.title': '🦠 INFECTION CONTRACT',
    'curse.desc': 'Virus core analyzed. Accept infection risk to extract enhancement data?',
    'curse.accept': '🦠 ACCEPT RISK',
    'curse.decline': '🛡 QUARANTINE',
    'curse.key': 'Y Accept · N / ESC Reject',
    'curse.neardeath': '⚠ CRISIS INFECTION — SURVIVE FIRST',

    // Stage bonus
    'bonus.title': '★ STAGE REWARD ★',
    'bonus.desc': 'Choose one.',

    // Mission
    'mission.title': '📋 MISSION',
    'mission.done': 'DONE! Reward: ',
    'mission.reward.cores': ' Cores',
    'mission.reward.xp': 'XP',

    // Result screen
    'result.gameover': 'SYSTEM OVERLOAD',
    'result.time': 'SURVIVAL TIME',
    'result.stage': 'STAGE REACHED',
    'result.kills': 'VIRUSES DESTROYED',
    'result.level': 'FINAL LEVEL',
    'result.maxcombo': 'MAX COMBO',
    'result.evolutions': 'WEAPON EVOLUTIONS',
    'result.retry': 'RESTART SYSTEM',
    'result.home': 'MAIN MENU',
    'result.share': '📤 SHARE RESULT',
    'result.upgrades': '[ UPGRADE LOG & WEAPON CONTRIBUTION ]',
    'result.nickname': 'Enter nickname (optional)',
    'result.ascension': 'ASCENSION DISPLAY',
    'result.ng_plus': '✨ START NG+1',
    'result.ng_plus_btn': '✨ START NG+{n}',

    // Settings
    'settings.title': '⚙ OPTIONS',
    'settings.display': 'DISPLAY',
    'settings.fullscreen': 'Fullscreen',
    'settings.fps': 'FPS Counter',
    'settings.audio': 'AUDIO',
    'settings.bgm': 'Background Music',
    'settings.bgm.track': 'BGM Track',
    'settings.language': 'LANGUAGE',
    'settings.shortcuts': 'SHORTCUTS',
    'settings.touch': 'TOUCH CONTROLS',
    'settings.close': '← CLOSE',
    'settings.resume': '▶ RESUME',
    'settings.menu': '🏠 MAIN MENU',
    'settings.toggle.full': '⛶ TOGGLE',
    'settings.toggle.fps.on': '📊 ON',
    'settings.toggle.fps.off': '📊 OFF',
    'settings.toggle.bgm.on': '🎵 ON',
    'settings.toggle.bgm.off': '🎵 OFF',
    'settings.shortcuts.move': 'Move',
    'settings.shortcuts.skill': 'Class Skill',
    'settings.shortcuts.bgm': 'Toggle BGM',
    'settings.shortcuts.pause': 'Pause',
    'settings.shortcuts.fs': 'Fullscreen',
    'settings.touch.drag': 'Drag screen — Move',
    'settings.touch.skill': 'Skill button — Class Skill',
    'settings.touch.pause': 'HUD ⚙ — Pause',
    'settings.touch.bgm': 'HUD 🎵 — Toggle BGM',

    // Meta
    'meta.title': '⚡ PERMANENT UPGRADES',
    'meta.cores': '💾 DATA CORES: ',
    'meta.desc': 'Spend Data Cores earned after runs to permanently boost your abilities.',
    'meta.slot1': 'SLOT 1',
    'meta.slot2': 'SLOT 2',
    'meta.slot3': 'SLOT 3',
    'meta.back': '← BACK',

    // Multiplayer
    'mp.title': '🎮 MULTIPLAYER',
    'mp.coop': '🤝 CREATE COOP ROOM',
    'mp.battle': '⚔ CREATE BATTLE ROOM',
    'mp.or': '— OR —',
    'mp.join': '🚪 JOIN',
    'mp.code.placeholder': '6-digit invite code',
    'mp.back': '← MAIN MENU',
    'mp.start': '▶ START GAME',
    'mp.leave': 'LEAVE',

    // Achievements
    'ach.title': '🏆 ACHIEVEMENTS',
    'ach.basic': 'Basic',
    'ach.cloud': 'Challenge',
    'ach.stats': 'Stats',
    'ach.back': '← CLOSE',

    // Archive
    'archive.title': 'ANTISURGE — QUARANTINE LOG ARCHIVE',
    'archive.subtitle': 'Operative records / Unclassified data',
    'archive.placeholder': 'Select a class',
    'archive.close': 'CLOSE',

    // Leaderboard
    'lb.title': '🏅 GLOBAL LEADERBOARD',
    'lb.desc': 'All-time TOP 10 (by stage)',
    'lb.back': '← CLOSE',

    // Confirm dialog
    'confirm.ok': 'CONFIRM',
    'confirm.cancel': 'CANCEL',

    // Version
    'version.badge': 'β v0.11 BETA',
  },

  ko: {
    'menu.title.sub': '사이버펑크 바이러스 서바이벌',
    'menu.start': '▶ 게임 시작',
    'menu.meta': '⚡ 영구 업그레이드',
    'menu.record': '— 최고 기록 —',
    'menu.multi': '멀티플레이',
    'menu.daily': '일일 도전',
    'menu.leaderboard': '리더보드',
    'menu.achievements': '업적',
    'menu.archive': '격리 로그',
    'menu.settings': '옵션 설정',
    'menu.auth.local': '로컬 저장 중 (로그인 시 클라우드 동기화)',
    'menu.auth.login': '🔑 Google 로그인',
    'menu.controls.move': '이동',
    'menu.controls.skill': '스킬',
    'menu.controls.pause': '일시정지',
    'menu.controls.bgm': 'BGM',
    'menu.controls.drag': '✋ 드래그 이동',
    'menu.controls.skillbtn': '⚡ 스킬',
    'menu.controls.pausebtn': '⚙ 정지',

    'class.select.title': '백신 선택',
    'class.select.hint': '전투 스타일을 선택하세요. 카드를 클릭하면 상세 정보를 확인할 수 있습니다.',
    'class.confirm.hint': '백신 선택',
    'class.confirm.back': '← 뒤로',
    'class.confirm.start': '▶ 배포 시작',
    'class.hidden': '??? 히든 직업',

    'midrun.label': '⚡ 이전 런이 감지됐습니다',
    'midrun.resume': '▶ 이어서 하기',
    'midrun.new': '✕ 새 게임',

    'card.tag.new_weapon': '신규 무기',
    'card.tag.fusion': '🔮 무기 융합',
    'card.tag.revival': '💀 에픽 부활',
    'card.tag.class_new': '⭐ 클래스 전용',
    'card.tag.stat': '시스템 강화',
    'card.tag.passive_new': '패시브 신규',
    'card.tag.legendary': '⭐ 전설',
    'card.rarity.effect': '효과 x',

    'levelup.title': '시스템 업그레이드 감지',
    'levelup.desc': '업그레이드 모듈을 선택하세요.',
    'levelup.reroll': '🔄 리롤',

    'shop.title': '🛒 데이터 마켓',
    'shop.gold': '보유 골드: 💰',
    'shop.desc': '아이템을 구매하세요. 여러 개 구매 가능합니다.',
    'shop.bought': '×{n} 구매됨',
    'shop.next': '다음: {n}G',
    'shop.continue': '계속 진행',

    'curse.title': '🦠 감염 협약',
    'curse.desc': '바이러스 코어를 분석했습니다. 감염 위험을 감수하고 강화 데이터를 추출하시겠습니까?',
    'curse.accept': '🦠 감염 감수',
    'curse.decline': '🛡 격리',
    'curse.key': 'Y 감수 · N / ESC 격리',
    'curse.neardeath': '⚠ 위기 감염 협약 — 생존 우선',

    'bonus.title': '★ 스테이지 보상 선택 ★',
    'bonus.desc': '하나를 선택하세요.',

    'mission.title': '📋 MISSION',
    'mission.done': '완료! 보상: ',
    'mission.reward.cores': '코어',
    'mission.reward.xp': 'XP',

    'result.gameover': 'SYSTEM OVERLOAD',
    'result.time': '생존 시간',
    'result.stage': '도달 스테이지',
    'result.kills': '파괴된 바이러스',
    'result.level': '최종 레벨',
    'result.maxcombo': '최대 콤보',
    'result.evolutions': '무기 진화',
    'result.retry': '시스템 재가동',
    'result.home': '메인 화면으로',
    'result.share': '📤 결과 공유',
    'result.upgrades': '[ 업그레이드 이력 및 무기 기여도 ]',
    'result.nickname': '닉네임 입력 (선택)',
    'result.ng_plus': '✨ NG+1 시작',

    'settings.title': '⚙ 옵션',
    'settings.display': '화면',
    'settings.fullscreen': '전체화면',
    'settings.fps': 'FPS 표시',
    'settings.audio': '오디오',
    'settings.bgm': '배경음악',
    'settings.bgm.track': 'BGM 트랙',
    'settings.language': '언어',
    'settings.shortcuts': '단축키',
    'settings.touch': '터치 조작',
    'settings.close': '← 닫기',
    'settings.resume': '▶ 계속하기',
    'settings.menu': '🏠 메인으로',
    'settings.toggle.full': '⛶ 전환',
    'settings.toggle.fps.on': '📊 켜짐',
    'settings.toggle.fps.off': '📊 꺼짐',
    'settings.toggle.bgm.on': '🎵 켜짐',
    'settings.toggle.bgm.off': '🎵 꺼짐',
    'settings.shortcuts.move': '이동',
    'settings.shortcuts.skill': '클래스 스킬',
    'settings.shortcuts.bgm': 'BGM 끄기/켜기',
    'settings.shortcuts.pause': '일시정지',
    'settings.shortcuts.fs': '전체화면',
    'settings.touch.drag': '✋ 화면 드래그 — 이동',
    'settings.touch.skill': '⚡ 스킬 버튼 — 클래스 스킬',
    'settings.touch.pause': '⚙ HUD 우상단 — 일시정지',
    'settings.touch.bgm': '🎵 HUD 🎵 — BGM 켜기/끄기',

    'meta.title': '⚡ 영구 업그레이드',
    'meta.cores': '💾 보유 데이터 코어: ',
    'meta.desc': '런 종료 후 획득한 데이터 코어로 영구 능력을 강화하세요.',
    'meta.slot1': '슬롯 1',
    'meta.slot2': '슬롯 2',
    'meta.slot3': '슬롯 3',
    'meta.back': '← 돌아가기',

    'mp.title': '🎮 멀티플레이어',
    'mp.coop': '🤝 협동 방 만들기',
    'mp.battle': '⚔ 경쟁 방 만들기',
    'mp.or': '— 또는 —',
    'mp.join': '🚪 참가',
    'mp.code.placeholder': '초대 코드 6자리',
    'mp.back': '← 메인으로',
    'mp.start': '▶ 게임 시작',
    'mp.leave': '나가기',

    'ach.title': '🏆 업적',
    'ach.basic': '기본',
    'ach.cloud': '도전',
    'ach.stats': '통계',
    'ach.back': '← 닫기',

    'archive.title': 'ANTISURGE — 격리 로그 아카이브',
    'archive.subtitle': '각 운영자의 격리 기록 / 분류 불가 데이터',
    'archive.placeholder': '클래스를 선택하세요',
    'archive.close': '닫기',

    'lb.title': '🏅 글로벌 리더보드',
    'lb.desc': '전체 플레이어 최고 기록 TOP 10 (스테이지 기준)',
    'lb.back': '← 닫기',

    'confirm.ok': '확인',
    'confirm.cancel': '취소',

    'version.badge': 'β v0.11 BETA',
  }
};

// ── English game-data translations ─────────────────────────────
const EN_GAME = {
  weapons: {
    flare: {
      name: 'Neon Flare', evolvedName: 'Plasma Cannon',
      desc: [
        'Fires luminous projectiles at the nearest enemy',
        'Projectile count +1',
        'Increased damage and projectile speed',
        'Projectile count +1, adds piercing',
        '【EVOLVED】Plasma Cannon — large explosive rounds, area pierce'
      ]
    },
    orbiter: {
      name: 'Cyber Orbiter', evolvedName: 'Void Ring',
      desc: [
        'Generates neon orbs orbiting the player',
        'Orb count +1',
        'Faster rotation and increased damage',
        'Orb count +1',
        '【EVOLVED】Void Ring — larger orbs with neon afterimage trails'
      ]
    },
    zone: {
      name: 'Electro Zone', evolvedName: 'Cyber Storm',
      desc: [
        'Activates an electric field dealing continuous damage nearby',
        'Increased damage and zone radius',
        'Enemies in zone slowed by 25%',
        'Greatly increased damage and max radius',
        '【EVOLVED】Cyber Storm — periodically releases shockwaves'
      ]
    },
    laser: {
      name: 'Laser Strike', evolvedName: 'Cross Laser',
      desc: [
        'Fires a piercing laser beam in a random direction',
        'Reduced cooldown',
        'Wider laser with increased damage',
        'Greatly reduced cooldown',
        '【EVOLVED】Cross Laser — fires in 4 directions simultaneously'
      ]
    },
    boomerang: {
      name: 'Cyber Boomerang', evolvedName: 'Photon Cross',
      desc: [
        'Throws a boomerang that pierces enemies on return',
        'Faster return and increased damage',
        'Shorter interval, enhanced piercing',
        'Greatly increased size and damage',
        '【EVOLVED】Photon Cross — fires in 4 directions simultaneously'
      ]
    },
    drone: {
      name: 'Data Drone', evolvedName: 'Hexa Drone',
      desc: [
        'Summons autonomous drones that fire at nearby enemies',
        'Increased drone fire rate',
        'Additional drone +1',
        'Greatly increased damage and range',
        '【EVOLVED】Hexa Drone — 3 drones, 3-shot burst'
      ]
    },
    missile: {
      name: 'Cyber Missile', evolvedName: 'Quad Launcher',
      desc: [
        'Launches homing missiles that explode on impact',
        'Shorter interval, increased explosion damage',
        'Fires 2 missiles simultaneously',
        'Greatly increased damage, enhanced tracking',
        '【EVOLVED】Quad Launcher — 4 simultaneous, massive explosion'
      ]
    },
    ring: {
      name: 'Plasma Ring', evolvedName: 'Void Nova',
      desc: [
        'Emits expanding rings that damage enemies on contact',
        'Increased ring radius and damage',
        '2 rings generated simultaneously',
        'Greatly increased damage and expansion speed',
        '【EVOLVED】Void Nova — triple rings, pull then explode'
      ]
    },
    chain: {
      name: 'Virus Chain', evolvedName: 'Neural Virus',
      desc: [
        'Strikes nearest enemy with lightning, chains to 1 nearby',
        'Chain count +1 (max 3)',
        'Increased damage, expanded chain range',
        'Chain count +1 (max 4)',
        '【EVOLVED】Neural Virus — chains 5 enemies, kills trigger chain explosions'
      ]
    },
    mine: {
      name: 'Landmine', evolvedName: 'Plasma Cluster',
      desc: [
        'Plants explosive mines along your path',
        'Mine count +1, increased damage',
        'Larger explosion radius, shorter cooldown',
        'Mine count +1 (max 4)',
        '【EVOLVED】Plasma Cluster — explosions scatter 3 mini mines'
      ]
    },
    blackhole: {
      name: 'Black Hole Generator', evolvedName: 'Event Horizon',
      desc: [
        'Creates a gravity field that pulls and damages enemies',
        'Increased gravity radius and duration',
        'Collapse explosion damage ×2',
        '2 black holes simultaneously',
        '【EVOLVED】Event Horizon — 2 simultaneous, collapse triggers instant-kill'
      ]
    },
    command_dance: {
      name: 'Command Dancer', evolvedName: 'Dance Master',
      desc: [
        '2-dir command success: omnidirectional explosion (350 dmg)',
        'Explosion radius +50px',
        'Success: chain lightning to 2 enemies',
        '4-dir command, success restores +5 HP',
        '【EVOLVED】Dance Master — 5-dir, explosion fires 8-way projectiles'
      ]
    },
    echo_record: {
      name: 'Echo Recorder', evolvedName: 'Chaos Echo',
      desc: [
        'Records path for 3s, summons echo clone (18s cooldown)',
        'Clone attack +40%',
        'Recording 4s, cooldown 14s',
        '2 clones simultaneously',
        '【EVOLVED】Chaos Echo — 3 clones, attack ×2'
      ]
    },
    viral_bomb: {
      name: 'Viral Bloom', evolvedName: 'Pandemic',
      desc: [
        'Infects nearest enemy, explodes after 4s (130 dmg)',
        'Infection spreads 1 additional stage',
        'Explosion damage +60',
        '2 spread stages, simultaneous infection +5',
        '【EVOLVED】Pandemic — explosion +50%, infection radius +40px'
      ]
    },
    resonance: {
      name: 'Resonance Amplifier', evolvedName: 'Critical Collapse',
      desc: [
        'Fires resonance pulses; 3 hits on same enemy triggers explosion (×4)',
        'Resonance stack duration +1s',
        'Explosion damage multiplier ×5',
        'Boss/elite stack threshold -1',
        '【EVOLVED】Critical Collapse — explosions transfer 2 stacks to nearby enemies'
      ]
    },
    hack_gun: {
      name: 'Hack Implanter', evolvedName: 'Virus Takeover',
      desc: [
        'Instantly hacks strongest enemy, converts for 8s (20 melee dmg/s)',
        'Hack duration +4s',
        'Simultaneous hacks: 2',
        'Hack expiry triggers 200 explosion damage',
        '【EVOLVED】Virus Takeover — hacked enemy death instantly infects nearby'
      ]
    },
    overcharge: {
      name: 'Overcharge Condenser', evolvedName: 'Critical Discharge',
      desc: [
        'Auto-charges then discharges; scales with charge (100%=300 dmg)',
        'Charge speed +30%',
        'Discharge radius +40px',
        'Overcharge (200%) removes self-damage (safe discharge)',
        '【EVOLVED】Critical Discharge — discharge chains to 4 additional enemies'
      ]
    }
  },

  stats: {
    stat_hp:     { name: 'Memory Expansion',    desc: 'Max HP +20 and minor HP recovery' },
    stat_speed:  { name: 'Overclock Movement',  desc: 'Movement speed +10%' },
    stat_damage: { name: 'Core Voltage Surge',  desc: 'All weapon damage +15%' },
    stat_magnet: { name: 'Gravity Field Boost', desc: 'XP core magnet range +30%' },
  },

  passives: {
    regen:     { name: 'Regen Core',         desc: ['Auto-recover +1 HP every 3s',             'Recovery tripled (+3/3s)'] },
    shield:    { name: 'Armor Chip',         desc: ['Incoming damage -10%',                    'Damage reduction up to 22%'] },
    nanobots:  { name: 'Nanobot Swarm',      desc: ['20% chance: +3 HP on gem pickup',         'Chance 40%, recovery +5'] },
    overclock: { name: 'Overload Circuit',   desc: ['All weapon damage +12%',                  'Damage additional +28% (total +40%)'] },
    resonance: { name: 'Resonance Core',     desc: ['Gem XP pickup +20%',                      'XP up to +45%'] },
    thorns:    { name: 'Retribution Spines', desc: ['On hit: 15 dmg in radius 120',            'Damage 25, radius 160'] },
    critical:  { name: 'Critical Core',      desc: ['15% crit chance, 2.5× damage',            'Crit 25%, damage ×3'] },
    explosive: { name: 'Chain Burst',        desc: ['30% on kill: chain explosion radius 120', 'Chance 50%, radius 160'] },
    barrier:   { name: 'Shock Barrier',      desc: ['Every 5s: stun radius 150 for 1.5s',      'Every 3s, stun 2.5s'] }
  },

  class_passives: {
    hk_skill: { name: 'Hack Acceleration',     desc: ['Q cooldown -25%',                              'Q cooldown -45%'] },
    hk_xp:    { name: 'Data Collection',       desc: ['XP gain +20%',                                 'XP gain +40%'] },
    fw_armor: { name: 'Reinforced Armor',      desc: ['Damage taken -12%',                            'Damage taken -22%'] },
    fw_regen: { name: 'Self-Repair',           desc: ['+2 HP/s regeneration',                         '+4 HP/s, ×2 during boss'] },
    rk_evade: { name: 'Phase Dodge',           desc: ['8% chance to negate a hit',                    '18% chance to negate'] },
    rk_speed: { name: 'High-Speed Infiltrate', desc: ['Move speed +0.5',                              'Move speed +1.2'] },
    dr_dmg:   { name: 'Drone Overload',        desc: ['Drone damage +30%',                            'Drone damage +60%'] },
    dr_count: { name: 'Extra Deployment',      desc: ['Deploy +1 drone',                              'Deploy +2 drones'] },
    sc_crit:  { name: 'Lethal Aim',            desc: ['Crit chance +15%',                             'Crit chance +28%'] },
    sc_magnet:{ name: 'Area Detection',        desc: ['XP magnet range +60%',                         'Magnet +120%, boss revealed'] },
    pb_maxhp: { name: 'Core Boost',            desc: ['Max HP +40 & instant recovery',                'HP +40, level-up recovers 20% HP'] },
    pb_triage:{ name: 'Emergency Triage',      desc: ['After hit: +4 HP/s for 5s',                   'After hit: +8 HP/s for 5s'] },
    ck_zombie:{ name: 'Zombie Protocol',       desc: ['Hacked dmg +40%, duration +3s',                'Hacked dmg +70%, duration +5s'] },
    ck_blast: { name: 'Suicide Command',       desc: ['Hack expire: radius 130 explosion (150 dmg)',  'Radius 180, 280 dmg + chain-hack 1 nearby'] },
    gd_rhythm:{ name: 'Rhythm Boost',          desc: ['Dance explosion damage +30%',                  'Dance explosion damage +60%'] },
    gd_burst: { name: 'Burst Chain',           desc: ['After Q: dance cooldown reset for 3s',         'After Q: dance cooldown reset for 5s'] },
    ps_absorb:{ name: 'Enhanced Absorb',       desc: ['Absorb recovers +3 HP',                        'Absorb +6 HP + absorb slot +1'] },
    ps_surge: { name: 'Discharge Surge',       desc: ['Q explosion radius +50px',                     'Q explosion radius +100px'] },
    jm_wave:  { name: 'Broadband Jamming',     desc: ['Pulse range +40px, debuff +2s',                'Pulse range +80px, debuff +4s'] },
    jm_static:{ name: 'Static Buildup',        desc: ['Pulse contact: 10 damage',                     '20 damage + 25% chance 0.5s stun'] },
  },

  fusions: {
    arc_flare:          { name: 'Arc Flare',          desc: 'Flare projectile hit chains lightning to 2 nearby enemies. +2 chains per projectile!' },
    hellfire_drone:     { name: 'Hellfire Drone',     desc: 'Drones fire homing missiles instead of bullets. Each drone fires a tracking missile!' },
    nova_collapse:      { name: 'Nova Collapse',      desc: 'Black hole collapse fires 12-way explosive projectiles. Chain-kill over huge area!' },
    spectrum_blade:     { name: 'Spectrum Blade',     desc: 'Laser fire launches 2 perpendicular boomerangs simultaneously. Wide area + spin combo!' },
    mine_orbital:       { name: 'Mine Orbital',       desc: 'Orbiters auto-drop mines when enemies approach. Automatic minefield while orbiting!' },
    dance_master:       { name: 'Dance Master',       desc: 'Successful command fires 8-way projectiles. Orbiter syncs with dance explosion!' },
    pandemic:           { name: 'Pandemic',           desc: 'Viral explosion +50%, infection radius +40px. Mine + infection area control!' },
    critical_collapse:  { name: 'Critical Collapse',  desc: 'Resonance explosions transfer 2 stacks to adjacent enemies. Black hole + resonance combo!' },
    virus_takeover:     { name: 'Virus Takeover',     desc: 'Hacked enemy death instantly infects 1 nearby enemy. Infinite hack + virus chain!' },
    critical_discharge: { name: 'Critical Discharge', desc: 'Discharge chains lightning to 4 additional enemies. Overcharge + chain max area!' },
  },

  legendaries: {
    leg_all_up:    { name: 'System Override',    desc: 'All owned weapons level +1' },
    leg_hp:        { name: 'Core Reinforcement', desc: 'Max HP +80 and full recovery' },
    leg_nuke:      { name: 'Data Nuke',          desc: 'Instantly eliminate all enemies on screen' },
    leg_overclock: { name: 'Overvoltage Frenzy', desc: 'All damage +50%, movement speed +25%' },
  },

  revivals: {
    rev_restore:   { name: 'Data Restore',     desc: 'On death: instantly revive at 30% HP (once per run)' },
    rev_backup:    { name: 'Emergency Backup', desc: 'Below 15% HP: auto-recover 50% HP instantly (once per run)' },
    rev_laststand: { name: 'Last Stand',       desc: 'On death: 4s shield + recover 20% HP (2× per run)' },
    rev_counter:   { name: 'Death Strike',     desc: 'On death: 200 dmg to all nearby, recover 30% HP (1×)' },
    rev_void:      { name: 'Void Awakening',   desc: 'On death: 8s invincibility + damage ×2.5 (1×)' },
  },

  missions: {
    kill_50:   { name: 'Quarantine Op',    desc: 'Eliminate 50 viruses' },
    kill_100:  { name: 'Mass Quarantine',  desc: 'Eliminate 100 viruses' },
    stun_kill: { name: 'Stun & Eliminate', desc: 'Kill 8 enemies while stunned' },
    combo_20:  { name: 'Chain Execution',  desc: 'Reach combo ×20' },
    nodmg_20:  { name: 'Perfect Evasion',  desc: 'Survive 20s without being hit' },
    highHp_90: { name: 'High HP Maintain', desc: 'Keep HP above 60% for 90s' },
    boss_fast: { name: 'Swift Quarantine', desc: 'Defeat boss within 60s' },
    stage_10:  { name: 'Deep Infiltration',desc: 'Reach stage 10' },
    boss_2:    { name: 'Core Annihilation',desc: 'Defeat 2 bosses this run' },
  },

  curses: {
    curse_hp:     { debuff: 'Max HP -25%',           reward: 'All owned weapons instantly level up' },
    curse_speed:  { debuff: 'Movement speed -25%',   reward: 'Permanent damage +50%' },
    curse_dmg:    { debuff: 'Damage taken +40%',     reward: 'Rerolls +5, Gold +30' },
    curse_magnet: { debuff: 'XP magnet range -50%',  reward: 'Gold +40' },
  },

  meta: {
    meta_hp:     { name: 'System Reinforcement', desc: ['Max HP +20', '+40 (cumulative)', '+70 (cumulative)', '+110 (cumulative)'] },
    meta_speed:  { name: 'Overclock Drive',      desc: ['Move speed +5%', '+10%', '+20%'] },
    meta_magnet: { name: 'Gravity Core',         desc: ['Magnet range +10%', '+25%', '+50%'] },
    meta_damage: { name: 'Combat Protocol',      desc: ['Damage +5%', '+12%', '+25%'] },
    meta_reroll: { name: 'Reroll Expansion',     desc: ['Start rerolls +1', '+2 (cumulative)', '+3 (cumulative)'] },
    meta_gold:   { name: 'Gold Starter',         desc: ['Start gold +5', '+12 (cumulative)', '+22 (cumulative)'] },
    meta_xp:     { name: 'XP Booster',           desc: ['XP gain +8%', '+18%', '+35%'] },
    meta_shop:   { name: 'Hacker Market',        desc: ['Shop prices -10%', '-20% (cumulative)', '-30% (cumulative)'] },
    meta_crit:   { name: 'Critical Protocol',    desc: ['Crit chance +5%', '+10% (cumulative)', '+18% (cumulative)'] },
    meta_regen:  { name: 'Regen Drive',          desc: ['After hit: +1 HP/s regen 3s', 'Regen up to +2 HP/s'] },
    meta_weapon: { name: 'Preload Module',       desc: ['Start weapon at Lv+1', 'Start weapon at Lv+2 (cumulative)'] },
    meta_curse:  { name: 'Infection Block Core', desc: ['Infection penalty -20%', 'Infection penalty -40% (cumulative)'] },
  },

  shop: {
    shop_hp:     { name: 'Emergency Repair',  desc: 'Instantly restore 50% max HP' },
    shop_damage: { name: 'Combat Module',     desc: 'Permanent damage +20%' },
    shop_speed:  { name: 'Speed Booster',     desc: 'Permanent speed +15%' },
    shop_magnet: { name: 'Magnet Upgrade',    desc: 'XP magnet range ×1.4' },
    shop_reroll: { name: 'Reroll Supply',     desc: 'Gain 2 extra rerolls' },
    shop_maxhp:  { name: 'HP Expansion',      desc: 'Max HP +30 and restore 30 HP' },
  },
};

// Auto-apply translations on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyI18n);
} else {
  applyI18n();
}
