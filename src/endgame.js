// Priority 06 — 스테이지 100 엔딩 + NG+
// ============================================================
function triggerFinalVictory() {
  gameState = STATE_GAME_OVER;
  clearMidRun();
  _stopMidRunAutoSave();
  stopBGM();
  const _hudEl = document.getElementById('hud');
  if (_hudEl) _hudEl.style.visibility = 'hidden';
  const _mpEl = document.getElementById('mission-panel');
  if (_mpEl) _mpEl.style.display = 'none';

  if (!isDailyRun) {
    _statAdd('totalKills', killCount);
    _statAdd('totalGamesPlayed', 1);
    _statSet('maxStage', 100);
    _statSet('maxSurviveTime', gameTime);
    _statSet('maxCombo', maxCombo);
    if (!player) return;
    const cls = player.classId;
    _statAdd(`cls_${cls}_games`, 1);
    _statSet(`cls_${cls}_maxStage`, 100);
    _statAdd(`cls_${cls}_kills`, killCount);
    _checkCloudAchievements();
    _checkClassUnlocks();
    _checkClassDiscovery();
    _checkHiddenClassClears();
    _syncToCloud();
    submitLeaderboard(true);
  }
  if (100 > (saveData.bestStage || 0)) { saveData.bestStage = 100; }
  if (killCount > (saveData.bestKills || 0)) { saveData.bestKills = killCount; }
  saveData.completions = (saveData.completions || 0) + 1;
  saveSaveData();

  // 승리 파티클 연출
  const cx = player?.x || MAP_WIDTH / 2;
  const cy = player?.y || MAP_HEIGHT / 2;
  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      createExplosionParticles(cx, cy, '#ffe600', 30);
      createExplosionParticles(cx, cy, '#00f0ff', 20);
      createExplosionParticles(cx, cy, '#b026ff', 15);
      triggerScreenShake(18, 800);
      playSynthSound([200 + i * 150, 400 + i * 100], 0.25, 'sine', 0.1);
    }, i * 500);
  }
  setTimeout(() => showVictoryScreen(), 3500);
}

function showVictoryScreen() {
  const title    = document.getElementById('result-title');
  const subtitle = document.getElementById('result-subtitle');
  const deathRow = document.getElementById('death-cause-row');
  const victoryExtra = document.getElementById('victory-extra');
  const coresRow = document.getElementById('cores-earned-row');
  const bestRow  = document.getElementById('best-record-row');

  const bm = Math.floor(gameTime / 60000), bs = Math.floor((gameTime % 60000) / 1000);
  const statTime   = document.getElementById('stat-time');
  const statStage  = document.getElementById('stat-stage');
  const statKills  = document.getElementById('stat-kills');
  const statLevel  = document.getElementById('stat-level');
  const statCombo  = document.getElementById('stat-maxcombo');
  const statEvo    = document.getElementById('stat-evolutions');
  if (statTime)  statTime.textContent  = `${String(bm).padStart(2,'0')}:${String(bs).padStart(2,'0')}`;
  if (statStage) statStage.textContent = '100';
  if (statKills) statKills.textContent = killCount;
  if (statLevel) statLevel.textContent = `Lv. ${player?.level || 1}`;
  if (statCombo) statCombo.textContent = maxCombo;
  if (statEvo)   statEvo.textContent   = evolutionCount;

  if (title) {
    title.textContent = '🏆 PROTOCOL COMPLETE';
    title.style.color = '#ffe600';
    title.style.textShadow = '0 0 12px #ffe600, 0 0 40px #ffe600, 0 0 80px #ff8800';
  }
  if (subtitle) subtitle.textContent = '시스템 위협 완전 제압. 승천 레벨 해금!';
  if (deathRow) deathRow.style.display = 'none';

  const coresBonus = 30 + (saveData.completions || 1) * 5;
  saveData.dataCores += coresBonus;
  saveSaveData();
  if (coresRow) { coresRow.textContent = `+${coresBonus} 데이터 코어 획득`; coresRow.style.color = '#00f0ff'; }
  if (bestRow)  bestRow.textContent = '';

  const nextAsc = (saveData.ascensionLevel || 0) + 1;
  const ngBtn   = document.getElementById('ng-plus-btn');
  const ascDisp = document.getElementById('ascension-display');
  if (ngBtn)   ngBtn.textContent = `✨ NG+${nextAsc} 시작`;
  if (ascDisp) ascDisp.textContent = `승천 Lv.${saveData.ascensionLevel || 0} → Lv.${nextAsc}  |  적 HP +${nextAsc * 25}%  |  플레이어 +${nextAsc * 15} HP`;
  if (victoryExtra) victoryExtra.style.display = 'block';

  gameOverModal.classList.add('active');
  playSynthSound([300, 500, 700, 1000, 700, 500, 300], 0.3, 'triangle', 0.15);
}

function startNewGamePlus() {
  saveData.ascensionLevel = (saveData.ascensionLevel || 0) + 1;
  saveSaveData();
  gameOverModal.classList.remove('active');
  // 빅토리 extra 숨김 + 타이틀 초기화 (다음 게임오버 때 일반 화면 나오도록)
  const ve = document.getElementById('victory-extra');
  if (ve) ve.style.display = 'none';
  const title = document.getElementById('result-title');
  if (title) { title.style.color = ''; title.style.textShadow = ''; }
  // 클래스 선택 화면으로 (클래스는 재선택 가능)
  menuScreen.classList.remove('active');
  document.getElementById('class-select-screen').classList.add('active');
  refreshClassCardLockState();
  updateMenuAscensionBadge();
}

function updateMenuAscensionBadge() {
  const badge = document.getElementById('ascension-menu-badge');
  if (!badge) return;
  const lv = saveData.ascensionLevel || 0;
  badge.style.display = lv > 0 ? 'inline-block' : 'none';
  badge.textContent   = `NG+${lv}`;
}

function _checkClassUnlocks() {
  for (const [cls, def] of Object.entries(CLASS_UNLOCK_DEFS)) {
    if (!def) continue;
    if (saveData._unlockedClasses && saveData._unlockedClasses[cls]) continue;
    if (isClassUnlocked(cls)) {
      if (!saveData._unlockedClasses) saveData._unlockedClasses = {};
      saveData._unlockedClasses[cls] = true;
      saveSaveData();
      const info = CLASS_DEFS[cls];
      setTimeout(() => {
        _showAchievementToast({ icon: info.icon, name: `${info.name} 해금!`, desc: `${def.label} 달성으로 새 히든 클래스 개방!` });
      }, 1200);
    }
  }
}

function _checkHiddenClassClears() {
  if (isDailyRun || !player) return;
  const cls = player.classId;
  if (['jammer','cracker','glitch_dancer'].includes(cls) && currentStage >= 100) {
    if (!saveData._hiddenClassClears) saveData._hiddenClassClears = {};
    if (!saveData._hiddenClassClears[cls]) {
      saveData._hiddenClassClears[cls] = true;
      saveSaveData();
      const info = CLASS_DEFS[cls];
      setTimeout(() => {
        _showAchievementToast({ icon: info?.icon||'🏆', name: `${info?.name||cls} 마스터!`, desc: `히든 클래스로 스테이지 100 클리어 — 패러사이트 해금 조건 진행!` });
      }, 2000);
    }
  }
}

// 아래 파이널 스테이지 함수들은 src/finalstage.js 에 정의됨
// checkFinalStageConditions, triggerParasiteFinalStage, advanceFinalStageWave
// showParasiteEnding, _runEndingCutscene, _showParasiteVictoryModal

// ============================================================
// 클래스 코덱 해금 체크
// ============================================================
// ── 새 클래스 발견 알림 (진행 시스템) ──────────────────────
function _checkClassDiscovery() {
  if (isDailyRun) return;
  if (!saveData._classDiscovered) saveData._classDiscovered = {};
  const stats = _getStats();

  const tiers = [
    {
      key: 'tier2',
      condition: (stats.totalGamesPlayed || 0) >= 1,
      classes: ['cyborg','ghost'],
      msg: '방화벽 · 루트킷 해금!'
    },
    {
      key: 'tier3',
      condition: ((stats.cls_cyborg_games||0) + (stats.cls_ghost_games||0)) >= 1,
      classes: ['engineer','sniper','support'],
      msg: '드론.exe · 스캐너 · 패치봇 해금!'
    }
  ];

  tiers.forEach(tier => {
    if (saveData._classDiscovered[tier.key]) return;
    if (!tier.condition) return;
    saveData._classDiscovered[tier.key] = true;
    setTimeout(() => {
      _showAchievementToast({ icon: '🔓', name: '새 직업 해금', desc: tier.msg });
    }, 2400);
  });

  // 히든 클래스 개별 발견 알림
  const hiddenClasses = ['jammer','cracker','glitch_dancer','parasite'];
  hiddenClasses.forEach(cls => {
    const key = `hidden_${cls}`;
    if (saveData._classDiscovered[key]) return;
    if (!isClassUnlocked(cls)) return;
    saveData._classDiscovered[key] = true;
    const info = CLASS_DEFS[cls];
    setTimeout(() => {
      _showAchievementToast({ icon: info?.icon||'🔓', name: `히든 클래스 해금`, desc: `${info?.name||cls} — 선택 화면에서 확인하세요!` });
    }, 3200);
  });
}

function _checkCodecUnlocks() {
  if (isDailyRun || !player) return [];
  if (!saveData._codec) saveData._codec = {};
  const cls = player.classId;
  if (!CLASS_CODEC[cls]) return [];

  const wStats  = weaponStats;
  const newLogs = [];

  CLASS_CODEC[cls].forEach((log, i) => {
    const key = `${cls}_${i}`;
    if (saveData._codec[key]) return;

    let met = false;
    switch (log.cond) {
      case 'first_play':    met = true; break;
      case 'stage_30':      met = currentStage >= 30; break;
      case 'stage_50':      met = currentStage >= 50; break;
      case 'stage_60':      met = currentStage >= 60; break;
      case 'stage_70':      met = currentStage >= 70; break;
      case 'stage_80':      met = currentStage >= 80; break;
      case 'hack_50kills':  met = (wStats.hack_gun?.kills || 0) >= 50; break;
      case 'drone_100kills':met = (wStats.drone?.kills || 0) >= 100; break;
      case 'laser_lv5':     met = (player.weapons?.laser?.level || 0) >= 5; break;
      case 'evolved3': {
        const fused = Object.values(player.fusions || {}).filter(Boolean).length;
        met = fused >= 3;
        break;
      }
      case 'dance_100kills':met = (wStats.command_dance?.kills || 0) >= 100; break;
      case 'absorb_50':     met = (player._totalAbsorptions || 0) >= 50; break;
    }

    if (met) {
      saveData._codec[key] = true;
      newLogs.push({ cls, idx: i, log });
    }
  });

  if (newLogs.length > 0) saveSaveData();
  return newLogs;
}

function endGame(isVictory) {
  gameState = STATE_GAME_OVER;
  clearMidRun();
  _stopMidRunAutoSave();
  stopBGM();
  // 캔버스 클리어 (마지막 프레임의 미니맵/스코어보드가 뒤에 비치는 문제 방지)
  if (typeof canvas !== 'undefined' && canvas) {
    const _c2 = canvas.getContext('2d');
    _c2.fillStyle = '#000007';
    _c2.fillRect(0, 0, canvas.width, canvas.height);
  }
  const _hudEl = document.getElementById('hud');
  if (_hudEl) _hudEl.style.visibility = 'hidden';
  const _mpEl = document.getElementById('mission-panel');
  if (_mpEl) _mpEl.style.display = 'none';
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
    _checkClassUnlocks();
    _checkClassDiscovery();
    _checkHiddenClassClears();
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
  const _newCodecLogs = _checkCodecUnlocks();
  if (_newCodecLogs.length > 0) {
    const clsInfo = CLASS_DEFS[player?.classId] || {};
    const logEl = document.getElementById('codec-unlock-row');
    if (logEl) {
      logEl.innerHTML = _newCodecLogs.map(({ idx, log }) =>
        `<span class="codec-new-badge">[LOG-0${idx+1}]</span> ${log.title}`
      ).join('<br>');
      logEl.style.display = 'block';
    }
    setTimeout(() => {
      _newCodecLogs.forEach(({ idx }) => {
        _showAchievementToast({ icon: '🗃', name: `새 격리 로그 해금`, desc: `${clsInfo.name||player?.classId} LOG-0${idx+1} 해독 가능 — 아카이브에서 확인` });
      });
    }, 1800);
  } else {
    const logEl = document.getElementById('codec-unlock-row');
    if (logEl) logEl.style.display = 'none';
  }
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
    `⚡ AntiSurge β v0.10\n` +
    `👤 ${name} [${clsInfo?.icon || ''}${clsInfo?.name || ''}] [${diffLabel}]\n` +
    `🏆 STAGE ${stageStr} 도달\n` +
    `💀 ${killCount}마리 제거  ⭐ Lv.${player?.level ?? '?'}\n` +
    `⏱ ${timeStr}  💥 최대콤보 ${maxCombo}\n` +
    `🔗 시너지: ${synergyStr}\n` +
    (ascensionLevel > 0 ? `✨ 승천 Lv.${ascensionLevel}\n` : '') +
    `\n#AntiSurge #사이버펑크서바이벌`;

  const btn = document.getElementById('share-btn');
  if (navigator.share) {
    navigator.share({ title: 'AntiSurge β v0.10', text }).catch(() => {});
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