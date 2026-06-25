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
updateMenuAscensionBadge();
_initAuth();

// 터치 컨트롤 초기화
initTouchControls();

// 난이도 로드
loadDifficulty();

// 메뉴 BGM: 첫 상호작용 시 자동 시작
document.addEventListener('click',   tryStartMenuBgm);
document.addEventListener('keydown', tryStartMenuBgm);
