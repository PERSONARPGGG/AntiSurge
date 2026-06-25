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