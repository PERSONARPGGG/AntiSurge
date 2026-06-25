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