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
  refreshClassCardLockState();
});
retryBtn.addEventListener('click', () => { startGame(); });
homeBtn.addEventListener('click',  () => {
  document.getElementById('class-select-screen').classList.remove('active');
  showScreen(STATE_MENU);
});
document.getElementById('mute-btn').addEventListener('click', () => toggleBGM());

// 클래스 선택 카드 이벤트 (2단계 선택 흐름)
function refreshClassCardLockState() {
  document.querySelectorAll('.class-card').forEach(card => {
    const cls = card.dataset.class;
    if (!cls) return;
    const unlocked = isClassUnlocked(cls);
    card.classList.toggle('class-locked', !unlocked);
    let badge = card.querySelector('.class-lock-badge');
    if (!unlocked) {
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'class-lock-badge';
        card.appendChild(badge);
      }
      const def = CLASS_UNLOCK_DEFS[cls];
      badge.innerHTML = `🔒 <span>${def.label}</span>`;
    } else if (badge) {
      badge.remove();
    }
  });
}

document.querySelectorAll('.class-card').forEach(card => {
  card.addEventListener('click', () => {
    const cls = card.dataset.class;
    if (!isClassUnlocked(cls)) return; // 잠긴 클래스 선택 차단
    document.querySelectorAll('.class-card').forEach(c => c.classList.remove('class-selected'));
    card.classList.add('class-selected');
    selectedClass = cls;
    const hint = document.getElementById('class-selected-hint');
    const confirmBtn = document.getElementById('class-confirm-btn');
    const names = { hacker:'해커', cyborg:'방화벽', ghost:'루트킷', engineer:'드론.exe', sniper:'스캐너', support:'패치봇' };
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
  _lastZoneIdx = -1; // 존 초기화 (첫 스테이지엔 오버레이 없이 배지만)
  initMissions();
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