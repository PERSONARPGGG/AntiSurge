// ============================================================
// 일일도전 변이 시스템
// ============================================================
const DAILY_CURSES = [
  { id:'slow',          name:'데이터 지연',   nameEn:'Data Lag',        desc:'이동속도 -25%',          descEn:'Move speed -25%',          icon:'🐢' },
  { id:'glass',         name:'취약 코드',     nameEn:'Glass Code',      desc:'최대 HP -35%',           descEn:'Max HP -35%',              icon:'💔' },
  { id:'enemy_speed',   name:'바이러스 과부하',nameEn:'Virus Overload',  desc:'적 이동속도 +40%',       descEn:'Enemy speed +40%',         icon:'⚡' },
  { id:'enemy_hp',      name:'강화 프로토콜', nameEn:'Hardened Protocol',desc:'적 HP +60%',             descEn:'Enemy HP +60%',            icon:'🛡' },
  { id:'no_heal',       name:'회복 차단',     nameEn:'Heal Block',      desc:'필드 아이템 효과 없음',   descEn:'Field items have no effect',icon:'⛔' },
  { id:'double_spawn',  name:'폭발 감염',     nameEn:'Viral Surge',     desc:'적 스폰 속도 +70%',      descEn:'Enemy spawn rate +70%',    icon:'👾' },
];
const DAILY_BUFFS = [
  { id:'double_gold',   name:'골드 채굴기',   nameEn:'Gold Miner',      desc:'골드 획득 2배',          descEn:'2× gold pickup',           icon:'💰' },
  { id:'xp_boost',      name:'경험치 가속',   nameEn:'XP Boost',        desc:'경험치 +60%',            descEn:'XP +60%',                  icon:'⬆' },
  { id:'extra_hp',      name:'강화 방어막',   nameEn:'Hardened Shield', desc:'최대 HP +60%',           descEn:'Max HP +60%',              icon:'❤' },
  { id:'speed_boost',   name:'오버클럭',      nameEn:'Overclock',       desc:'이동속도 +25%',          descEn:'Move speed +25%',          icon:'🚀' },
  { id:'pierce',        name:'관통 탄환',     nameEn:'Pierce Rounds',   desc:'모든 투사체 관통+1',      descEn:'All projectiles pierce +1', icon:'➡' },
];
const DAILY_EVENTS = ['gold_rush','blizzard','swarm','elite_wave','dark'];

function _dailySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth()+1) * 100 + d.getDate();
}
function _seededNext(s) { return Math.abs((Math.imul(s, 1664525) + 1013904223) | 0); }

function selectDailyMutations() {
  let s = _dailySeed();
  const cursePick = [];
  let ci = _seededNext(s) % DAILY_CURSES.length; cursePick.push(ci);
  s = _seededNext(s+1); let ci2 = s % DAILY_CURSES.length;
  while (ci2 === ci) { s = _seededNext(s+1); ci2 = s % DAILY_CURSES.length; }
  cursePick.push(ci2);
  s = _seededNext(s+2);
  const bi = s % DAILY_BUFFS.length;
  dailyMutations = { curses: [DAILY_CURSES[cursePick[0]], DAILY_CURSES[cursePick[1]]], buff: DAILY_BUFFS[bi] };
}

function getDailyEventForStage(stage) {
  const s = _seededNext(_dailySeed() + stage * 97);
  return DAILY_EVENTS[s % DAILY_EVENTS.length];
}

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
    isEntry             ? '🏆 PROTOCOL COMPLETE' : `STAGE ${currentStage} CLEAR!`,
    currentStage > 100  ? (LANG === 'en' ? '∞ Entering next wave!' : '∞ 다음 파동으로 진입!') :
    isEntry             ? (LANG === 'en' ? '★ Final virus core isolated! ★' : '★ 최종 바이러스 코어 격리 완료! ★') : (LANG === 'en' ? 'Choose a bonus reward!' : '보너스 보상을 선택하세요!'),
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
  checkZoneTransition();

  // 스테이지 100 클리어 → 파이널 or 빅토리
  if (currentStage === 101) {
    if (checkFinalStageConditions()) {
      triggerParasiteFinalStage();
    } else {
      triggerFinalVictory();
    }
    return;
  }

  if (currentStage > 101 && !isEndlessMode) {
    isEndlessMode = true;
    endlessModeStartTime = gameTime;
  }

  // ── 일일도전 15스테이지: 광전사 (보스 체크보다 먼저) ──
  if (isDailyRun && currentStage === 15) {
    isBossStage = false; isMiniBossStage = false;
    stageKillProgress = 0; stageKillGoal = getStageKillGoal(15);
    gameState = STATE_PLAYING;
    setTimeout(() => spawnDailyRival('berserker'), 2500);
    spawnStageObstacles(); return;
  }

  // ── 일일도전: 3스테이지마다 보스 ──
  if (isDailyRun && currentStage % 3 === 0) {
    isBossStage      = true;
    stageKillGoal    = 0;
    stageKillProgress = 0;
    bossStageStartMs  = Date.now();
    gameState = STATE_PLAYING;
    dailyEventStage  = '';
    if (currentStage % 6 === 0) {
      // 짝수 배수(6·12·18…): 정규 보스
      isMiniBossStage = false;
      showBossWarning();
    } else {
      // 홀수 배수(3·9·15…): 미니보스
      isMiniBossStage = true;
      setTimeout(() => spawnMiniBoss(), 1500);
    }
    return;
  }

  // ── 일일도전 10스테이지: 저격수 ──
  if (isDailyRun && currentStage === 10) {
    isBossStage = false; isMiniBossStage = false;
    stageKillProgress = 0; stageKillGoal = getStageKillGoal(10);
    gameState = STATE_PLAYING;
    setTimeout(() => spawnDailyRival('sniper'), 2200);
    spawnStageObstacles(); return;
  }

  // ── 일일도전 스테이지 5: 영웅 난입 (미니보스 대신) ──
  if (isDailyRun && currentStage === 5) {
    isBossStage       = false;
    isMiniBossStage   = false;
    stageKillProgress = 0;
    stageKillGoal     = getStageKillGoal(5);
    gameState = STATE_PLAYING;
    setTimeout(() => spawnDailyHero(), 2200);
    spawnStageObstacles();
    return;
  }

  if (currentStage % 10 === 0) {
    isBossStage      = true;
    isMiniBossStage  = false;
    stageKillGoal    = 0;
    stageKillProgress = 0;
    bossStageStartMs  = Date.now();
    gameState = STATE_PLAYING;
    dailyEventStage  = '';
    // 일반 모드에서 50% 확률로 라이벌이 보스 대체
    if (!isDailyRun && Math.random() < 0.5) {
      const angle = Math.random() * Math.PI * 2;
      const hx = Math.max(150, Math.min(MAP_WIDTH-150, player.x + Math.cos(angle)*550));
      const hy = Math.max(150, Math.min(MAP_HEIGHT-150, player.y + Math.sin(angle)*550));
      let hero;
      if (currentStage >= 30) {
        hero = new DailyRivalBerserker(hx, hy);
      } else if (currentStage >= 20) {
        hero = new DailyRivalSniper(hx, hy);
      } else {
        hero = new DailyHeroEnemy(hx, hy);
      }
      hero.isStageBoss = true;
      hero.heroLabel = LANG === 'en' ? 'Stage Rival' : '스테이지 라이벌';
      hero.hp = Math.floor(hero.maxHp * 2.2);
      hero.maxHp = hero.hp;
      dailyHeroes.push(hero);
      showStageOverlay('⚔ RIVAL BOSS', LANG === 'en' ? 'Rival has become a boss!' : '라이벌이 보스로 등장했습니다!', '#ff4466');
      triggerScreenShake(12, 600);
      createExplosionParticles(hx, hy, '#ff4466', 28);
      playSynthSound([300, 500, 700, 500], 0.22, 'sawtooth', 0.10);
      setTimeout(hideStageOverlay, 3000);
    } else {
      showBossWarning();
    }
  } else if (currentStage % 10 === 5) {
    isBossStage      = true;
    isMiniBossStage  = true;
    stageKillGoal    = 0;
    stageKillProgress = 0;
    bossStageStartMs  = Date.now();
    gameState = STATE_PLAYING;
    dailyEventStage  = '';
    setTimeout(() => spawnMiniBoss(), 1500);
  } else {
    isBossStage       = false;
    isMiniBossStage   = false;
    stageKillProgress = 0;
    stageKillGoal     = getStageKillGoal(currentStage);
    gameState = STATE_PLAYING;
    if (currentStage % 3 === 0 && currentStage > 3) {
      setTimeout(() => spawnEliteEnemy(), 2000);
    }
    // ── 일일도전 이벤트 스테이지 (짝수, 보스 없는 스테이지) ──
    if (isDailyRun && currentStage > 1 && currentStage % 2 === 0 &&
        currentStage !== 10 && currentStage !== 15) {
      dailyEventStage = getDailyEventForStage(currentStage);
      _showDailyEventOverlay(dailyEventStage);
    } else if (isDailyRun) {
      dailyEventStage = '';
    }
    // 일반 모드 8스테이지: 성장하는 추격자 등장
    if (!isDailyRun && currentStage === 8) {
      setTimeout(() => {
        if (!player || gameState !== STATE_PLAYING) return;
        const angle = Math.random() * Math.PI * 2;
        const hx = Math.max(150, Math.min(MAP_WIDTH-150, player.x + Math.cos(angle)*650));
        const hy = Math.max(150, Math.min(MAP_HEIGHT-150, player.y + Math.sin(angle)*650));
        const pursuer = new DailyHeroEnemy(hx, hy);
        pursuer.heroLabel = LANG === 'en' ? 'Pursuer' : '추격자';
        pursuer._passive  = true;
        pursuer.speed     = 1.0;
        pursuer.hp = 380; pursuer.maxHp = 380;
        dailyHeroes.push(pursuer);
        showStageOverlay(LANG === 'en' ? '👁 PURSUER DETECTED' : '👁 추격자 출현', LANG === 'en' ? 'Unknown pursuer appears...' : '정체불명의 추격자가 나타났습니다...', '#888888');
        createExplosionParticles(hx, hy, '#888888', 16);
        setTimeout(hideStageOverlay, 2800);
      }, 3000);
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
  showStageOverlay('⚠ ELITE VIRUS!', LANG === 'en' ? 'Elite virus incoming!' : '정예 바이러스 침투!', '#ff6600');
  setTimeout(hideStageOverlay, 2000);
}

function spawnDailyHero() { spawnDailyRival('hero'); }

function spawnDailyRival(type) {
  if (!player || !isDailyRun) return;
  if (gameState !== STATE_PLAYING) { setTimeout(() => spawnDailyRival(type), 600); return; }
  const angle = Math.random() * Math.PI * 2;
  const hx = Math.max(120, Math.min(MAP_WIDTH  - 120, player.x + Math.cos(angle) * 580));
  const hy = Math.max(120, Math.min(MAP_HEIGHT - 120, player.y + Math.sin(angle) * 580));

  let hero, label, color, sound;
  if (type === 'sniper') {
    hero = new DailyRivalSniper(hx, hy);
    label = LANG === 'en' ? '🎯 SNIPER INTRUSION!' : '🎯 저격수 난입!'; color = '#00ccff';
    sound = [800, 1100, 900, 600];
  } else if (type === 'berserker') {
    hero = new DailyRivalBerserker(hx, hy);
    label = LANG === 'en' ? '💀 BERSERKER INTRUSION!' : '💀 광전사 난입!'; color = '#ff2255';
    sound = [300, 200, 150, 100];
  } else {
    hero = new DailyHeroEnemy(hx, hy);
    label = '⚔ RIVAL INTRUSION'; color = '#ffe600';
    sound = [600, 900, 750, 500];
  }
  dailyHeroes.push(hero);

  showStageOverlay(label, LANG === 'en' ? 'New rival has appeared!' : '새로운 라이벌이 난입했습니다!', color);
  triggerScreenShake(13, 650);
  createExplosionParticles(hx, hy, color, 32);
  playSynthSound(sound, 0.22, 'triangle', 0.10);
  setTimeout(() => createExplosionParticles(hx, hy, '#ffffff', 16), 350);
  setTimeout(hideStageOverlay, 3200);
}

function spawnBountyRival() {
  if (!player || gameState !== STATE_PLAYING) return;
  if (dailyHeroes.length >= 3) return;
  const angle = Math.random() * Math.PI * 2;
  const hx = Math.max(120, Math.min(MAP_WIDTH  - 120, player.x + Math.cos(angle) * 600));
  const hy = Math.max(120, Math.min(MAP_HEIGHT - 120, player.y + Math.sin(angle) * 600));

  let hero, label, color, sound;
  if (_bountyLevel <= 2) {
    hero = new DailyHeroEnemy(hx, hy);
    hero.heroLabel = LANG === 'en' ? 'Bounty Rival' : '현상금 라이벌';
    label = LANG === 'en' ? `⚠ BOUNTY Lv.${_bountyLevel + 1}` : `⚠ 현상금 Lv.${_bountyLevel + 1}`; color = '#ffe600';
    sound = [500, 700, 600, 400];
  } else if (_bountyLevel <= 5) {
    hero = new DailyRivalSniper(hx, hy);
    hero.heroLabel = LANG === 'en' ? 'Bounty Sniper' : '현상금 저격수';
    hero.hp = Math.floor(hero.hp * (1 + (_bountyLevel - 2) * 0.18));
    hero.maxHp = hero.hp;
    label = LANG === 'en' ? `⚠ BOUNTY Lv.${_bountyLevel + 1}` : `⚠ 현상금 Lv.${_bountyLevel + 1}`; color = '#00ccff';
    sound = [800, 1100, 900];
  } else {
    hero = new DailyRivalBerserker(hx, hy);
    hero.heroLabel = LANG === 'en' ? 'Bounty Berserker' : '현상금 광전사';
    hero.hp = Math.floor(hero.hp * (1 + (_bountyLevel - 5) * 0.22));
    hero.maxHp = hero.hp;
    label = LANG === 'en' ? `⚠ BOUNTY Lv.${_bountyLevel + 1}` : `⚠ 현상금 Lv.${_bountyLevel + 1}`; color = '#ff2255';
    sound = [200, 140, 90];
  }
  dailyHeroes.push(hero);

  showStageOverlay(label, LANG === 'en' ? 'Bounty rival appeared!' : '현상금 라이벌이 등장했습니다!', color);
  triggerScreenShake(10, 500);
  createExplosionParticles(hx, hy, color, 24);
  playSynthSound(sound, 0.20, 'triangle', 0.09);
  setTimeout(hideStageOverlay, 2800);

  _bountyThreshold += 150;
  _bountyLevel++;
}

function _showDailyEventOverlay(type) {
  const info = LANG === 'en' ? {
    gold_rush:  ['🏆 GOLD RUSH',     'This stage: 3× gold drop!',          '#ffd700'],
    blizzard:   ['❄ ICE AGE',        'Enemy speed ↓ / Enemy HP ↑',         '#88ddff'],
    swarm:      ['🦠 SWARM',         'Enemy count ×2! But low HP.',        '#00ff88'],
    elite_wave: ['⚡ ELITE WAVE',    'Elite enemies only!',                 '#ff8800'],
    dark:       ['🌑 DARK PROTOCOL', 'Vision limited. Be cautious!',        '#aa88ff'],
  } : {
    gold_rush:  ['🏆 골드 러시',   '이번 스테이지: 골드 3배 드롭!',     '#ffd700'],
    blizzard:   ['❄ 빙하기',       '적 이동속도 ↓ / 적 체력 ↑',         '#88ddff'],
    swarm:      ['🦠 대군 침공',    '적 수가 2배! 단, HP가 낮습니다.',    '#00ff88'],
    elite_wave: ['⚡ 정예 침공',    '엘리트 등급 적만 등장!',             '#ff8800'],
    dark:       ['🌑 암흑 프로토콜','시야가 제한됩니다. 조심하세요!',     '#aa88ff'],
  };
  const [title, desc, col] = info[type] || (LANG === 'en' ? ['EVENT', '', '#ffffff'] : ['이벤트', '', '#ffffff']);
  showStageOverlay(title, desc, col);
  setTimeout(hideStageOverlay, 3000);
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
  miniBoss.maxHp  = Math.floor(miniBoss.maxHp * 0.55);
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
  { id: 'repair',  icon: '💊', name: '응급 수리',   nameEn: 'Emergency Repair', desc: 'HP를 최대치의 40% 즉시 회복', descEn: 'Instantly restore 40% max HP' },
  { id: 'surge',   icon: '⚡', name: '데이터 서지', nameEn: 'Data Surge',       desc: '20초간 모든 무기 피해량 ×1.8', descEn: 'All weapon damage ×1.8 for 20s' },
  { id: 'supply',  icon: '📦', name: '비상 보급',   nameEn: 'Emergency Supply', desc: '랜덤 필드 아이템 3개 즉시 생성', descEn: 'Spawn 3 random field items instantly' }
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
    btn.innerHTML = `<span class="bonus-icon">${b.icon}</span><span class="bonus-name">${LANG === 'en' ? (b.nameEn || b.name) : b.name}</span><span class="bonus-desc">${LANG === 'en' ? (b.descEn || b.desc) : b.desc}</span>`;
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
    addFloatingText(player.x, player.y - 40, LANG === 'en' ? `+${heal} HP Restored` : `+${heal} HP 회복`, '#ff4466', 18);
    playSynthSound([600, 1200], 0.15, 'sine', 0.08);

  } else if (id === 'surge') {
    if (player.attackSurgeTimer <= 0) {
      player.attackSurgeMult  = 1.8;
      player.damageMultiplier *= 1.8;
    }
    player.attackSurgeTimer = 20000;
    addFloatingText(player.x, player.y - 40, LANG === 'en' ? '⚡ Data Surge 20s!' : '⚡ 데이터 서지 20초!', '#ffe600', 16);
    playSynthSound([300, 800], 0.2, 'sawtooth', 0.08);
    triggerScreenShake(5, 300);

  } else if (id === 'supply') {
    for (let i = 0; i < 3; i++) spawnRandomFieldItem();
    addFloatingText(player.x, player.y - 40, LANG === 'en' ? '📦 Supply Drop!' : '📦 보급 도착!', '#39ff14', 16);
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
  // 현상금 라이벌 체크 (일반 모드 + 멀티 모드)
  if (!isDailyRun && player) {
    bountyKills++;
    if (bountyKills >= _bountyThreshold) {
      bountyKills = 0;
      setTimeout(() => spawnBountyRival(), 1200);
    }
    // 멀티: 킬 격차 80 이상이면 균형추 라이벌 추가 소환
    if (mpMode && dailyHeroes.length === 0) {
      const partners = Object.entries(mpPlayers).filter(([id]) => id !== mpMyId);
      const maxPartnerKills = partners.length > 0 ? Math.max(...partners.map(([,p]) => p.kills || 0)) : 0;
      if (killCount - maxPartnerKills === 80) {
        setTimeout(() => spawnBountyRival(), 2000);
      }
    }
  }
}

function checkComboMilestone(count) {
  if (!player) return;
  const banner = document.getElementById('combo-milestone-banner');
  if (count === 10) {
    showComboMilestoneBanner('🔥 KILLING SPREE! x10', '#ff8800');
    player.damageMultiplier *= 1.25;
    setTimeout(() => { if (player) player.damageMultiplier /= 1.25; }, 5000);
    addFloatingText(player.x, player.y - 60, LANG === 'en' ? '🔥 DMG +25% (5s)!' : '🔥 피해 +25% (5초)!', '#ff8800', 14);
    playSynthSound([400, 800, 1200], 0.18, 'sawtooth', 0.07);
  } else if (count === 25) {
    showComboMilestoneBanner('💀 MASSACRE! x25', '#ff4466');
    triggerScreenShake(10, 600);
    createExplosionParticles(player.x, player.y, '#ff4466', 25);
    player.damageMultiplier *= 1.4;
    setTimeout(() => { if (player) player.damageMultiplier /= 1.4; }, 7000);
    addFloatingText(player.x, player.y - 60, LANG === 'en' ? '💀 DMG +40% (7s)!' : '💀 피해 +40% (7초)!', '#ff4466', 16);
    playSynthSound([200, 600, 1400], 0.22, 'sawtooth', 0.09);
  } else if (count === 50) {
    showComboMilestoneBanner('☢ CYBER RAMPAGE! x50', '#ffe600');
    triggerScreenShake(18, 900);
    // 화면 내 모든 적 50 피해
    for (let e of [...enemies]) { if (e.takeDamage(50, 'combo')) killCount++; }
    createExplosionParticles(player.x, player.y, '#ffe600', 35);
    addFloatingText(player.x, player.y - 70, LANG === 'en' ? '☢ Full Detonation!' : '☢ 전체 폭발!', '#ffe600', 20);
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

// ── 중간 저장 (강제종료/백그라운드 대응) ─────────────────────
const MID_RUN_KEY = 'ns_midrun_v1';

function saveMidRun() {
  if (!player || isDailyRun) return;
  if (gameState !== STATE_PLAYING && gameState !== STATE_LEVEL_UP &&
      gameState !== STATE_STAGE_CLEAR && gameState !== STATE_SHOP &&
      gameState !== STATE_PAUSED) return;
  try {
    const weaponLevels = {};
    for (const k in player.weapons) weaponLevels[k] = player.weapons[k].level || 0;
    localStorage.setItem(MID_RUN_KEY, JSON.stringify({
      ts:              Date.now(),
      classId:         player.classId,
      difficulty:      gameDifficulty,
      saveSlot:        currentSaveSlot,
      stage:           currentStage,
      gameTime,
      killCount,
      rerollUses,
      evolutionCount,
      maxCombo,
      activeSynergies: [...activeSynergies],
      weaponStats:     JSON.parse(JSON.stringify(weaponStats)),
      weaponLevels,
      hp:               player.hp,
      maxHp:            player.maxHp,
      xp:               player.xp,
      level:            player.level,
      nextLevelXp:      player.nextLevelXp,
      gold:             player.gold,
      speed:            player.speed,
      damageMultiplier: player.damageMultiplier,
      magnetRadius:     player.magnetRadius,
      damageReduction:  player.damageReduction,
      passiveXpMult:    player.passiveXpMult,
      passives:         { ...player.passives },
      classPassives:    { ...player.classPassives },
      fusions:          { ...player.fusions },
      revivals:         { ...player.revivals },
      _shopPurchases:   { ...(player._shopPurchases || {}) },
    }));
  } catch(e) {}
}

function clearMidRun() {
  localStorage.removeItem(MID_RUN_KEY);
}

function getMidRun() {
  try {
    const raw = localStorage.getItem(MID_RUN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
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
  const clears = saveData._hiddenClassClears || {};
  const conds = {
    ach_first:       () => killCount >= 1,
    ach_hunter:      () => killCount >= 100,
    ach_survivor:    () => currentStage >= 5,
    ach_stage10:     () => currentStage >= 10,
    ach_evolved:     () => Object.values(player.weapons).some(w => w.level >= 5),
    ach_combo:       () => comboCount >= 25,
    ach_gold:        () => player.gold >= 50,
    ach_endless:     () => isEndlessMode,
    ach_absorb30:    () => player.classId === 'parasite' && (player._totalAbsorptions||0) >= 30,
    ach_hidden_trio: () => !!(clears.jammer && clears.cracker && clears.glitch_dancer),
    ach_true_ending: () => !!saveData._parasiteEnding
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
  el.querySelector('.ach-name').textContent      = LANG === 'en' ? (ach.nameEn || ach.name) : ach.name;
  el.querySelector('.ach-desc-el').textContent   = LANG === 'en' ? (ach.descEn || ach.desc) : ach.desc;
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
  if (killsEl) killsEl.textContent = saveData.bestKills ? `${saveData.bestKills.toLocaleString()} ${LANG === 'en' ? 'kills' : '킬'}` : (LANG === 'en' ? '— kills' : '— 킬');
  if (timeEl)  timeEl.textContent  = saveData.bestStage
    ? `${bm.toString().padStart(2, '0')}:${bs.toString().padStart(2, '0')}` : '—:——';
}

function renderMetaGrid() {
  const grid = document.getElementById('meta-upgrade-grid');
  const disp = document.getElementById('meta-cores-display');
  if (!grid) return;
  if (disp) disp.textContent = `${typeof t !== 'undefined' ? t('meta.cores') : '💾 보유 데이터 코어: '}${saveData.dataCores}`;
  grid.innerHTML = '';
  for (const upg of META_UPGRADES) {
    const lvl   = saveData.metaLevels[upg.id] || 0;
    const maxed = lvl >= upg.maxLevel;
    const cost  = maxed ? null : upg.costs[lvl];
    const canBuy = !maxed && saveData.dataCores >= cost;
    const stars  = '★'.repeat(lvl) + '☆'.repeat(upg.maxLevel - lvl);
    const card = document.createElement('div');
    card.className = `meta-card${maxed ? ' meta-maxed' : ''}`;
    const metaName = (typeof tGame !== 'undefined' ? tGame('meta', upg.id, 'name') : null) || upg.name;
    const metaDesc = maxed ? null : ((typeof tGame !== 'undefined' ? tGame('meta', upg.id, 'desc', lvl) : null) || upg.desc[lvl]);
    const maxedLabel = (typeof LANG !== 'undefined' && LANG === 'en') ? '✓ MAXED' : '✓ 최대 강화';
    card.innerHTML = `
      <div class="meta-icon">${upg.icon}</div>
      <div class="meta-info">
        <div class="meta-name">${metaName}</div>
        <div class="meta-stars">${stars}</div>
        <div class="meta-effect">${maxed ? maxedLabel : metaDesc}</div>
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
  // 가중치 기반 선택: nuke는 희귀하게, health는 자주
  const itemWeights = { health: 3, magnet: 2, nuke: 1, shield: 2, surge: 2, reflect: 1 };
  let roll = Math.random() * 11;
  let type = 'health';
  for (const [t, w] of Object.entries(itemWeights)) { roll -= w; if (roll <= 0) { type = t; break; } }
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
  // 이벤트 스테이지 스폰 수 조정
  if (isDailyRun && dailyEventStage === 'swarm')     count = Math.floor(count * 2.2);
  if (isDailyRun && dailyEventStage === 'gold_rush') count = Math.floor(count * 1.6);
  // 일일 저주: 대량 스폰
  if (isDailyRun && dailyMutations.curses.find(c => c.id === 'double_spawn')) count = Math.floor(count * 1.7);
  count = Math.min(count, MAX_ENEMIES - enemies.length);

  for (let i = 0; i < count; i++) {
    let angle = Math.random() * Math.PI * 2;
    let d     = 450 + Math.random() * 150;
    let sx = Math.max(20, Math.min(MAP_WIDTH  - 20, player.x + Math.cos(angle) * d));
    let sy = Math.max(20, Math.min(MAP_HEIGHT - 20, player.y + Math.sin(angle) * d));

    let type = 'swarm';
    let rand = Math.random();

    // 정예 침공 이벤트: 모두 엘리트
    if (isDailyRun && dailyEventStage === 'elite_wave') {
      type = 'elite';
    } else {
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
    if (finalWaveVirusCore)   allTargets.push(finalWaveVirusCore);
    if (finalWaveVirusOrigin) allTargets.push(finalWaveVirusOrigin);

    for (let e of allTargets) {
      if (p.hitEnemies.has(e)) continue;
      if (dist(p.x, p.y, e.x, e.y) < p.radius + e.radius) {
        let isDead = e.takeDamage(p.damage, p.weaponKey);
        if (isDead) killCount++;
        p.hitEnemies.add(e);
        // arc_flare 융합: 플레어 충돌 시 주변 2체 연쇄 전격
        if (p.weaponKey === 'flare' && player && player.fusions && player.fusions.arc_flare) {
          const arcTargets = [...enemies].filter(en => !p.hitEnemies.has(en) && dist(p.x, p.y, en.x, en.y) < 170);
          arcTargets.slice(0, 2).forEach(en => {
            if (en.takeDamage(p.damage * 0.55, 'chain')) killCount++;
            p.hitEnemies.add(en);
            createExplosionParticles(en.x, en.y, '#00f0ff', 4);
            addFloatingText((p.x+en.x)/2, (p.y+en.y)/2 - 10, '⚡', '#00f0ff', 11);
          });
        }
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
        lastDamageSource = LANG === 'en' ? 'Boss Projectile' : '보스 발사체';
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
    if (finalWaveVirusCore)   allTargets.push(finalWaveVirusCore);
    if (finalWaveVirusOrigin) allTargets.push(finalWaveVirusOrigin);
    for (let e of allTargets) {
      if (e._hacked) continue; // 해킹 아군은 플레이어와 충돌 피해 없음
      if (dist(player.x, player.y, e.x, e.y) < player.radius + e.radius) {
        lastDamageSource = LANG === 'en' ? (e === activeBoss ? 'Boss Collision' : 'Virus Collision') : (e === activeBoss ? '보스 충돌' : '바이러스 충돌');
        player.takeDamage(e.damage);
        player.lastHitTime = now;
        break;
      }
    }
  }

  // 플레이어 투사체 vs 라이벌 영웅들
  for (const hero of [...dailyHeroes]) {
    if (hero.isAlly) continue; // 동맹 중엔 피해 없음
    for (let i = projectiles.length - 1; i >= 0; i--) {
      if (!dailyHeroes.includes(hero)) break; // 루프 중 사망 시 중단
      const p = projectiles[i];
      if (!p || p.hitEnemies.has(hero)) continue;
      if (dist(p.x, p.y, hero.x, hero.y) < p.radius + hero.radius) {
        hero.takeDamage(p.damage, true);
        if (!dailyHeroes.includes(hero)) { projectiles.splice(i, 1); break; }
        p.hitEnemies.add(hero);
        p.pierce--;
        if (p.pierce <= 0) { projectiles.splice(i, 1); }
      }
    }
    if (dailyHeroes.includes(hero) && now - player.lastHitTime > 250 &&
        dist(player.x, player.y, hero.x, hero.y) < player.radius + hero.radius) {
      player.takeDamage(hero instanceof DailyRivalBerserker ? 28 : 20);
      lastDamageSource = LANG === 'en' ? `${hero.heroLabel} Collision` : `${hero.heroLabel} 충돌`;
      player.lastHitTime = now;
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