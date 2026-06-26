// ============================================================
// src/finalstage.js — 패러사이트 트루 엔딩 / 파이널 스테이지
// ============================================================

let _endingCutsceneIds = [];

// ============================================================
// 파이널 스테이지 전용 보스 — 바이러스 코어 (WAVE 2)
// ============================================================
class VirusCoreEnemy {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.type = 'boss'; this.radius = 60;
    const asc = saveData?.ascensionLevel || 0;
    this.maxHp = Math.floor(6000 * (1 + asc * 0.25));
    this.hp    = this.maxHp;
    this.damage = 35;
    this.baseSpeed = 1.6;
    this.speedMultiplier = 1.0;
    this.flashTimer = 0; this.stunTimer = 0;
    this.dead = false;
    this.minionTimer = 0; this.minionCooldown = 4000;
    this.pulseTimer  = 0; this.pulseCooldown  = 5500;
    this.phase = 1;
    this.name = '바이러스 코어';
  }

  takeDamage(amount, sourceKey) {
    if (this.dead) return false;
    if (this.stunTimer > 0) amount *= 1.3;
    this.hp -= amount; this.flashTimer = 60;
    if (weaponStats[sourceKey]) weaponStats[sourceKey].damage += amount;
    if (this.hp <= 0) { this.die(); return true; }
    return false;
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    finalWaveVirusCore = null;
    createExplosionParticles(this.x, this.y, '#88ff44', 60);
    createExplosionParticles(this.x, this.y, '#00f0ff', 30);
    triggerScreenShake(22, 1200);
    addFloatingText(this.x, this.y - 90, '☠ VIRUS CORE 파괴!', '#88ff44', 22);
    playSynthSound([300, 150, 80, 40], 0.7, 'sawtooth', 0.18);
    killCount++; stageKillProgress++;
    setTimeout(() => advanceFinalStageWave(3), 3000);
  }

  update(dt) {
    if (this.dead) return;
    if (this.stunTimer > 0) { this.stunTimer -= dt; return; }
    if (this.flashTimer > 0) this.flashTimer -= dt;

    // 페이즈 2 전환
    if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
      this.phase = 2; this.baseSpeed *= 1.4;
      this.minionCooldown = 2500; this.pulseCooldown = 3500;
      createExplosionParticles(this.x, this.y, '#ff0044', 30);
      addFloatingText(this.x, this.y - 80, '⚠ PHASE 2!', '#ff0044', 18);
      triggerScreenShake(14, 700);
    }

    // 플레이어 추적
    if (player) {
      let dx = player.x - this.x, dy = player.y - this.y;
      let d = Math.sqrt(dx*dx + dy*dy) || 1;
      if (d > this.radius + player.radius) {
        this.x += (dx/d) * this.baseSpeed * (dt/16.66);
        this.y += (dy/d) * this.baseSpeed * (dt/16.66);
      }
    }

    // 미니언 소환
    this.minionTimer += dt;
    if (this.minionTimer >= this.minionCooldown) {
      this.minionTimer = 0;
      const cnt = this.phase >= 2 ? 6 : 4;
      for (let i = 0; i < cnt; i++) {
        const ang = (i/cnt)*Math.PI*2, r = 110+Math.random()*70;
        enemies.push(new Enemy(
          Math.max(20,Math.min(MAP_WIDTH-20,  this.x+Math.cos(ang)*r)),
          Math.max(20,Math.min(MAP_HEIGHT-20, this.y+Math.sin(ang)*r)),
          this.phase >= 2 ? 'elite' : 'tank'
        ));
      }
      addFloatingText(this.x, this.y-65, '☣ 바이러스 방출!', '#88ff44', 12);
      playSynthSound([80, 160], 0.3, 'sawtooth', 0.1);
    }

    // 코어 펄스 피해
    this.pulseTimer += dt;
    if (this.pulseTimer >= this.pulseCooldown && player) {
      this.pulseTimer = 0;
      if (dist(this.x, this.y, player.x, player.y) < 220) {
        player.hp -= this.damage; player.flashTimer = 90;
        addFloatingText(player.x, player.y-35, `-${this.damage} 코어 펄스!`, '#88ff44', 12);
        if (player.hp <= 0) endGame(false);
      }
      createExplosionParticles(this.x, this.y, '#88ff44', 18);
      playSynthSound([120, 240], 0.4, 'square', 0.1);
      triggerScreenShake(9, 450);
    }
  }

  draw(ctx, camera) {
    if (this.dead) return;
    const sx = this.x-camera.x, sy = this.y-camera.y;
    const flash = this.flashTimer > 0 && Math.floor(this.flashTimer/8)%2 === 0;
    const hpPct = Math.max(0, this.hp/this.maxHp);
    const t = Date.now()*0.002;
    ctx.save();
    ctx.globalAlpha = flash ? 0.3 : 1.0;
    ctx.shadowBlur = 28; ctx.shadowColor = '#88ff44';
    ctx.fillStyle = 'rgba(8,35,8,0.95)';
    ctx.strokeStyle = '#88ff44'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(sx, sy, this.radius, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    for (let ring = 1; ring <= 2; ring++) {
      const rr = this.radius*(0.4+ring*0.22)+Math.sin(t+ring)*7;
      ctx.globalAlpha = (flash?0.3:1)*(0.15+ring*0.1);
      ctx.beginPath(); ctx.arc(sx, sy, rr, 0, Math.PI*2); ctx.stroke();
    }
    ctx.globalAlpha = flash ? 0.3 : 1.0;
    ctx.font = '22px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('🧬', sx, sy+8);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000'; ctx.fillRect(sx-58, sy-this.radius-20, 116, 10);
    ctx.fillStyle = hpPct>0.5 ? '#88ff44' : '#ff0044';
    ctx.fillRect(sx-58, sy-this.radius-20, 116*hpPct, 10);
    ctx.strokeStyle = '#88ff44'; ctx.lineWidth = 1;
    ctx.strokeRect(sx-58, sy-this.radius-20, 116, 10);
    ctx.font = 'bold 9px Orbitron,monospace'; ctx.fillStyle = '#88ff44'; ctx.textAlign = 'center';
    ctx.fillText('☣ VIRUS CORE', sx, sy-this.radius-24);
    ctx.restore();
  }
}

// ============================================================
// 파이널 스테이지 전용 보스 — 바이러스 원점 (WAVE 3)
// ============================================================
class VirusOriginBoss {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.type = 'boss'; this.radius = 85;
    const asc = saveData?.ascensionLevel || 0;
    this.maxHp = Math.floor(20000 * (1 + asc * 0.3));
    this.hp    = this.maxHp;
    this.damage = 50;
    this.baseSpeed = 1.3;
    this.speedMultiplier = 1.0;
    this.flashTimer = 0; this.stunTimer = 0;
    this.dead = false;
    // 흡수 게이지
    this.absorbGauge  = 0;
    this.reversals    = 0;
    this._reversalInProgress = false;
    this._dmgPerGauge = this.maxHp / 3;
    // 공격 타이머
    this.minionTimer  = 0; this.minionCooldown = 3500;
    this.chargeTimer  = 0; this.chargeCooldown = 5000;
    this.isCharging   = false; this.chargeDuration = 0;
    this.chargeVx = 0; this.chargeVy = 0; this._savedBaseSpeed = this.baseSpeed;
    this.orbTimer = 0; this.orbCooldown = 4500;
    this.name = '바이러스 원점';
    this.isFinalBoss = false; this.isMini = false;
  }

  takeDamage(amount, sourceKey) {
    if (this.dead || this._reversalInProgress) return false;
    if (this.stunTimer > 0) amount *= 1.3;
    this.hp = Math.max(1, this.hp - amount);
    this.flashTimer = 60;
    if (weaponStats[sourceKey]) weaponStats[sourceKey].damage += amount;
    this.absorbGauge += (amount / this._dmgPerGauge) * 100;
    if (this.absorbGauge >= 100 && !this._reversalInProgress) {
      this.absorbGauge = 0;
      this._triggerReversal();
    }
    return false; // 직접 사망 없음, 역전으로만 사망
  }

  _triggerReversal() {
    this._reversalInProgress = true;
    this.reversals++;
    triggerScreenShake(28, 1500);
    createExplosionParticles(this.x, this.y, '#88ff44', 70);
    createExplosionParticles(this.x, this.y, '#ffffff', 40);
    addFloatingText(this.x, this.y-110, `🧬 감염 역전 ${this.reversals}/3!`, '#88ff44', 26);
    playSynthSound([200,400,800,1600,3200], 0.7, 'sine', 0.22);
    this.stunTimer = 2500;
    this.hp = Math.max(1, this.hp - this.maxHp * 0.22);
    for (const e of enemies) {
      if (!e.dead) { e.hp = Math.floor(e.hp * 0.1); createExplosionParticles(e.x, e.y, '#88ff44', 4); }
    }
    if (this.reversals >= 3) {
      setTimeout(() => this._finalKill(), 2800);
    } else {
      this.baseSpeed *= 1.25;
      if (this.reversals === 1) { this.minionCooldown = 2500; this.chargeCooldown = 3800; }
      if (this.reversals === 2) { this.minionCooldown = 1800; this.orbCooldown = 3000; }
      setTimeout(() => { this._reversalInProgress = false; }, 2600);
    }
  }

  _finalKill() {
    this.dead = true; finalWaveVirusOrigin = null;
    triggerScreenShake(40, 2000);
    createExplosionParticles(this.x, this.y, '#88ff44', 120);
    createExplosionParticles(this.x, this.y, '#00f0ff', 80);
    createExplosionParticles(this.x, this.y, '#ffe600', 60);
    addFloatingText(this.x, this.y-120, '☠ VIRUS ORIGIN 소멸!', '#ffe600', 32);
    playSynthSound([400,600,800,1200,2000,3200], 0.9, 'sine', 0.3);
    killCount++;
    setTimeout(() => showParasiteEnding(), 3500);
  }

  update(dt) {
    if (this.dead) return;
    if (this.flashTimer > 0) this.flashTimer -= dt;
    if (this.stunTimer > 0) { this.stunTimer -= dt; return; }
    if (player && !this.isCharging) {
      let dx = player.x-this.x, dy = player.y-this.y;
      let d = Math.sqrt(dx*dx+dy*dy)||1;
      if (d > this.radius+player.radius+10) {
        this.x += (dx/d)*this.baseSpeed*this.speedMultiplier*(dt/16.66);
        this.y += (dy/d)*this.baseSpeed*this.speedMultiplier*(dt/16.66);
      }
    }
    this.minionTimer += dt;
    if (this.minionTimer >= this.minionCooldown) {
      this.minionTimer = 0;
      const cnt = 4 + this.reversals*2;
      for (let i = 0; i < cnt; i++) {
        const ang = (i/cnt)*Math.PI*2, r = 130+Math.random()*60;
        enemies.push(new Enemy(
          Math.max(20,Math.min(MAP_WIDTH-20,  this.x+Math.cos(ang)*r)),
          Math.max(20,Math.min(MAP_HEIGHT-20, this.y+Math.sin(ang)*r)),
          i % 2 === 0 ? 'elite' : 'tank'
        ));
      }
    }
    if (this.isCharging) {
      this.x += this.chargeVx*(dt/16.66); this.y += this.chargeVy*(dt/16.66);
      this.chargeDuration -= dt;
      if (this.chargeDuration <= 0) { this.isCharging = false; this.baseSpeed = this._savedBaseSpeed; }
    } else {
      this.chargeTimer += dt;
      if (this.chargeTimer >= this.chargeCooldown && player) {
        this.chargeTimer = 0;
        this._savedBaseSpeed = this.baseSpeed;
        const dx = player.x-this.x, dy = player.y-this.y, d = Math.sqrt(dx*dx+dy*dy)||1;
        this.chargeVx = (dx/d)*22; this.chargeVy = (dy/d)*22;
        this.isCharging = true; this.chargeDuration = 550;
        addFloatingText(this.x, this.y-80, '☣ 바이러스 돌진!', '#88ff44', 15);
        triggerScreenShake(8, 350);
      }
    }
    this.orbTimer += dt;
    if (this.orbTimer >= this.orbCooldown && player) {
      this.orbTimer = 0;
      const cnt = 10+this.reversals*4;
      for (let i = 0; i < cnt; i++) {
        const ang = (i/cnt)*Math.PI*2;
        bossProjectiles.push(new BossProjectile(
          this.x, this.y, Math.cos(ang)*5.5, Math.sin(ang)*5.5,
          this.damage, 9, '#88ff44', false
        ));
      }
      addFloatingText(this.x, this.y-75, '🦠 바이러스 방사!', '#88ff44', 13);
      playSynthSound([150, 80], 0.2, 'square', 0.08);
    }
  }

  draw(ctx, camera) {
    if (this.dead) return;
    const sx = this.x-camera.x, sy = this.y-camera.y;
    const flash = this.flashTimer>0 && Math.floor(this.flashTimer/8)%2===0;
    const alpha = flash ? 0.25 : 1.0;
    const hpPct = Math.max(0, this.hp/this.maxHp);
    const gPct  = Math.min(this.absorbGauge/100, 1);
    const t = Date.now()*0.0018;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.shadowBlur = 40+Math.sin(t)*15; ctx.shadowColor = '#88ff44';
    ctx.fillStyle = 'rgba(5,30,5,0.97)';
    ctx.strokeStyle = this._reversalInProgress ? '#ffffff' : '#88ff44';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(sx, sy, this.radius, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    for (let ring = 0; ring < 4; ring++) {
      const rr = this.radius*(0.25+ring*0.2)+Math.sin(t+ring*1.3)*8;
      ctx.globalAlpha = alpha*(0.1+ring*0.05);
      ctx.strokeStyle = '#88ff44'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(sx, sy, rr, 0, Math.PI*2); ctx.stroke();
    }
    ctx.globalAlpha = alpha;
    ctx.font = '32px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('🦠', sx, sy+12);
    ctx.shadowBlur = 0;
    // HP 바
    ctx.fillStyle = '#000'; ctx.fillRect(sx-70, sy-this.radius-26, 140, 10);
    ctx.fillStyle = hpPct>0.5 ? '#88ff44' : hpPct>0.25 ? '#ff8800' : '#ff0044';
    ctx.fillRect(sx-70, sy-this.radius-26, 140*hpPct, 10);
    ctx.strokeStyle = '#44aa44'; ctx.lineWidth = 1;
    ctx.strokeRect(sx-70, sy-this.radius-26, 140, 10);
    // 흡수 게이지
    ctx.fillStyle = '#001200'; ctx.fillRect(sx-70, sy-this.radius-42, 140, 10);
    ctx.fillStyle = gPct >= 0.8 ? '#ffe600' : '#88ff44';
    if (gPct > 0) ctx.fillRect(sx-70, sy-this.radius-42, 140*gPct, 10);
    ctx.strokeStyle = '#88ff44'; ctx.lineWidth = 1;
    ctx.strokeRect(sx-70, sy-this.radius-42, 140, 10);
    ctx.font = 'bold 8px Orbitron,monospace';
    ctx.fillStyle = gPct>=0.8 ? '#ffe600' : '#88ff44'; ctx.textAlign='center';
    ctx.fillText(`감염 역전 게이지 ${Math.round(gPct*100)}%  [${this.reversals}/3]`, sx, sy-this.radius-46);
    ctx.fillStyle = '#88ff44';
    ctx.fillText('🦠 VIRUS ORIGIN', sx, sy-this.radius-30);
    ctx.restore();
  }
}

// ============================================================
// 진입 조건 체크
// ============================================================
function checkFinalStageConditions() {
  if (!player || player.classId !== 'parasite') return false;
  if ((player._totalAbsorptions || 0) < 50) return false;
  const clears = saveData._hiddenClassClears || {};
  return !!(clears.jammer && clears.cracker && clears.glitch_dancer);
}

// ============================================================
// 파이널 스테이지 시작
// ============================================================
function triggerParasiteFinalStage() {
  isFinalStage = true;
  finalStageWave = 0;
  finalWave1Kills = 0;
  finalWave1SpawnTimer = 0;
  finalWaveVirusCore = null;
  finalWaveVirusOrigin = null;
  _endingCutsceneIds.forEach(id => clearTimeout(id));
  _endingCutsceneIds = [];
  gameState = STATE_PLAYING;
  stopBGM();
  playSynthSound([55, 110], 0.15, 'sawtooth', 0.6);
  const hud = document.getElementById('hud');
  if (hud) hud.style.visibility = 'visible';
  enemies.length = 0;
  bossProjectiles.length = 0;
  activeBoss = null;
  isBossStage = false;
  isStageClearAnim = false;
  showStageOverlay('🦠 PARASITE PROTOCOL', '안티 바이러스 감염 시퀀스 개시...', '#88ff44');
  triggerScreenShake(12, 800);
  setTimeout(() => { hideStageOverlay(); advanceFinalStageWave(1); }, 3000);
  ensureGameLoopRunning();
}

// ============================================================
// 웨이브 전환
// ============================================================
function advanceFinalStageWave(wave) {
  if (!isFinalStage) return;
  finalStageWave = wave;
  enemies.length = 0;
  bossProjectiles.length = 0;
  finalWaveVirusCore   = null;
  finalWaveVirusOrigin = null;

  if (wave === 1) {
    finalWave1Kills = 0; finalWave1SpawnTimer = 0;
    showStageOverlay('⚠ WAVE 1 — 바이러스 대군', '바이러스 80마리를 처치하라!', '#ff4466');
    setTimeout(hideStageOverlay, 2800);
    if (player) addFloatingText(player.x, player.y-60, '☣ 대군 출현!', '#ff4466', 20);
    playSynthSound([80,40], 0.5, 'sawtooth', 0.12);
    triggerScreenShake(10, 600);

  } else if (wave === 2) {
    showStageOverlay('⚠ WAVE 2 — 바이러스 코어', '핵심 코어를 파괴하라!', '#88ff44');
    setTimeout(hideStageOverlay, 2800);
    setTimeout(() => {
      if (!isFinalStage || finalStageWave !== 2) return;
      const angle = Math.random()*Math.PI*2;
      const bx = Math.max(150,Math.min(MAP_WIDTH-150,  (player?.x||MAP_WIDTH/2)+Math.cos(angle)*550));
      const by = Math.max(150,Math.min(MAP_HEIGHT-150, (player?.y||MAP_HEIGHT/2)+Math.sin(angle)*550));
      finalWaveVirusCore = new VirusCoreEnemy(bx, by);
      addFloatingText(bx, by-80, '🧬 바이러스 코어 출현!', '#88ff44', 22);
      playSynthSound([60,120,240], 0.6, 'sawtooth', 0.14);
      triggerScreenShake(16, 900);
    }, 2500);

  } else if (wave === 3) {
    showStageOverlay('★ FINAL WAVE — 바이러스 원점', '모든 감염의 원천을 소멸시켜라!', '#ffe600');
    setTimeout(hideStageOverlay, 3200);
    setTimeout(() => {
      if (!isFinalStage || finalStageWave !== 3) return;
      const angle = Math.random()*Math.PI*2;
      const bx = Math.max(180,Math.min(MAP_WIDTH-180,  (player?.x||MAP_WIDTH/2)+Math.cos(angle)*600));
      const by = Math.max(180,Math.min(MAP_HEIGHT-180, (player?.y||MAP_HEIGHT/2)+Math.sin(angle)*600));
      finalWaveVirusOrigin = new VirusOriginBoss(bx, by);
      addFloatingText(bx, by-100, '🦠 바이러스 원점 출현!', '#ffe600', 26);
      playSynthSound([40,80,160], 0.8, 'sawtooth', 0.2);
      triggerScreenShake(22, 1200);
    }, 3000);
  }
}

// ============================================================
// 트루 엔딩 컷씬
// ============================================================
function showParasiteEnding() {
  gameState = STATE_GAME_OVER;
  stopBGM();
  isFinalStage = false;
  finalWaveVirusCore = null; finalWaveVirusOrigin = null;

  if (!isDailyRun) {
    _statAdd('totalKills', killCount);
    _statAdd('totalGamesPlayed', 1);
    _statSet('maxStage', 100);
    _statSet('maxSurviveTime', gameTime);
    _statAdd('cls_parasite_games', 1);
    _statSet('cls_parasite_maxStage', 100);
    if (!saveData._parasiteEnding) { saveData._parasiteEnding = true; }
    if (!saveData._hiddenClassClears) saveData._hiddenClassClears = {};
    saveData._hiddenClassClears.parasite_ending = true;
    saveSaveData();
    _checkClassUnlocks();
    _syncToCloud();
    submitLeaderboard(true);
  }

  const hud = document.getElementById('hud');
  if (hud) hud.style.visibility = 'hidden';
  const mp = document.getElementById('mission-panel');
  if (mp) mp.style.display = 'none';

  const endingScreen = document.getElementById('parasite-ending-screen');
  if (!endingScreen) { triggerFinalVictory(); return; }
  endingScreen.classList.add('active');
  _runEndingCutscene(endingScreen);
}

function _runEndingCutscene(el) {
  _endingCutsceneIds.forEach(id => clearTimeout(id));
  _endingCutsceneIds = [];

  const bm = Math.floor(gameTime/60000), bs = Math.floor((gameTime%60000)/1000);
  const timeStr = `${String(bm).padStart(2,'0')}:${String(bs).padStart(2,'0')}`;

  const statsEl = el.querySelector('#ending-stats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="ending-stat-row">⏱ 클리어 타임 <span>${timeStr}</span></div>
      <div class="ending-stat-row">☠ 총 킬 <span>${killCount.toLocaleString()}</span></div>
      <div class="ending-stat-row">🧬 흡수 횟수 <span>${player?._totalAbsorptions||0}</span></div>
      <div class="ending-stat-row">💀 감염 역전 <span>3 / 3</span></div>
    `;
  }

  const sceneIds = ['ending-scene-1','ending-scene-2','ending-scene-3','ending-scene-4'];
  const delays   = [0, 12000, 26000, 40000];

  // BGM 드론 (3회 점층)
  _endingCutsceneIds.push(setTimeout(() => playSynthSound([220,440,880],  0.25, 'sine', 2.5), 2000));
  _endingCutsceneIds.push(setTimeout(() => playSynthSound([330,660,1320], 0.20, 'sine', 3.0), 16000));
  _endingCutsceneIds.push(setTimeout(() => playSynthSound([440,880,1760], 0.30, 'triangle', 4.0), 32000));

  for (let i = 0; i < sceneIds.length; i++) {
    const id = sceneIds[i], delay = delays[i];
    _endingCutsceneIds.push(setTimeout(() => {
      el.querySelectorAll('.ending-scene').forEach(s => s.classList.remove('active'));
      const sceneEl = el.querySelector(`#${id}`);
      if (sceneEl) { sceneEl.classList.add('active'); triggerScreenShake(6, 500); }
    }, delay));
  }

  _endingCutsceneIds.push(setTimeout(() => {
    el.classList.remove('active');
    _showParasiteVictoryModal(timeStr);
  }, 62000));
}

function _showParasiteVictoryModal(timeStr) {
  _endingCutsceneIds.forEach(id => clearTimeout(id));
  _endingCutsceneIds = [];
  const endingEl = document.getElementById('parasite-ending-screen');
  if (endingEl) endingEl.classList.remove('active');

  const gameOverModal = document.getElementById('game-over-modal');
  if (!gameOverModal) return;
  const title     = document.getElementById('result-title');
  const subtitle  = document.getElementById('result-subtitle');
  const deathRow  = document.getElementById('death-cause-row');
  const ve        = document.getElementById('victory-extra');
  const statTime  = document.getElementById('stat-time');
  const statStage = document.getElementById('stat-stage');
  const statKills = document.getElementById('stat-kills');
  const statLevel = document.getElementById('stat-level');

  if (title)    { title.textContent = '🦠 PARASITE PROTOCOL — COMPLETE'; title.style.color = '#88ff44'; title.style.textShadow = '0 0 20px #88ff44, 0 0 60px #88ff44'; }
  if (subtitle) subtitle.textContent = '바이러스 원점 소멸. 네트워크 정화 완료. 패러사이트 프로토콜 성공.';
  if (deathRow) deathRow.style.display = 'none';
  if (statTime) statTime.textContent = timeStr;
  if (statStage)statStage.textContent = '100 ★ TRUE ENDING';
  if (statKills)statKills.textContent = killCount;
  if (statLevel)statLevel.textContent = `Lv. ${player?.level||1}`;
  if (ve)       ve.style.display = 'none';

  const coresBonus = 100 + (saveData.completions||0) * 10;
  saveData.dataCores += coresBonus;
  saveData.completions = (saveData.completions||0) + 1;
  saveSaveData();
  const coresEl = document.getElementById('cores-earned-row');
  if (coresEl) { coresEl.textContent = `✨ TRUE ENDING 보상: +${coresBonus} 데이터 코어`; coresEl.style.color = '#88ff44'; }
  gameOverModal.classList.add('active');
  buildWeaponContributionList();
  playSynthSound([440,880,1320,2200,1760,1320,880,440], 0.3, 'triangle', 0.12);
}
