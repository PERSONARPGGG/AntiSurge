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

  // 미션 진행 업데이트
  updateMissions(dt);

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
  // 존 배지 (매 HUD 업데이트 시 현재 테마 반영)
  updateZoneHUDBadge(getCurrentBgTheme());
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