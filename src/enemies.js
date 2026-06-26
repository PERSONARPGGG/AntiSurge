// ============================================================
// 바이러스 변이 정의 (15% 확률로 일반 적에게 부여)
// ============================================================
const VIRUS_MUTATIONS = [
  { id: 'shield',    label: '방어막',  icon: '🛡', color: '#00f0ff', weight: 30 },
  { id: 'split',     label: '분열',    icon: '🔱', color: '#ffe600', weight: 25 },
  { id: 'explosive', label: '자폭',    icon: '💥', color: '#ff4466', weight: 25 },
  { id: 'regen',     label: '재생',    icon: '♻', color: '#00ffaa', weight: 20 },
];
const _MUTATION_TOTAL = VIRUS_MUTATIONS.reduce((s, m) => s + m.weight, 0);

function _pickMutation() {
  let r = Math.random() * _MUTATION_TOTAL;
  for (const m of VIRUS_MUTATIONS) { r -= m.weight; if (r <= 0) return m; }
  return VIRUS_MUTATIONS[0];
}

// ============================================================
function getEnemyStageScale() {
  const diff = DIFFICULTY_SETTINGS[gameDifficulty] || DIFFICULTY_SETTINGS.normal;
  const asc  = getAscensionScale();
  return {
    hpMult:    (1 + (currentStage - 1) * 0.18) * diff.enemyHpMult * asc,
    dmgMult:   (1 + (currentStage - 1) * 0.10) * diff.enemyHpMult,
    speedMult: (1 + (currentStage - 1) * 0.025) * diff.enemySpeedMult
  };
}

class Enemy {
  constructor(x, y, type) {
    this.x = x; this.y = y; this.type = type;
    this.speedMultiplier = 1.0;
    this.stunTimer = 0;
    this.stormDX = 0; this.stormDY = 0; this.stormTimer = 0;
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
      case 'elite':
        this.radius = 18; this.color = '#ff6600'; this.baseSpeed = 2.1;
        this.hp = 140; this.maxHp = 140; this.damage = 20; this.xpValue = 12;
        this.isElite = true;
        this.eliteName = ELITE_NAMES[Math.floor(Math.random() * ELITE_NAMES.length)];
        break;
    }
    // 스테이지 스케일링 적용
    let s = getEnemyStageScale();
    this.hp      = Math.floor(this.hp    * s.hpMult);
    this.maxHp   = this.hp;
    this.damage  = Math.ceil(this.damage * s.dmgMult);
    this.baseSpeed *= s.speedMult;
    this.speed   = this.baseSpeed;
    this.flashTimer = 0;
    // 특수 무기 상태 (초기화 필수)
    this._infected = false; this._infectTimer = 0; this._infectChain = 0; this._infectDmg = 0;
    this._resStack = 0; this._resTimer = 0;
    this._hacked = false; this._hackTimer = 0; this._hackDmgTimer = 0; this._hackShootTimer = 0; this._hackExplosion = 0;
    this._jammed = false; this._jamTimer = 0;

    // ── 바이러스 변이 부여 (15%, 엘리트/파이널스테이지/분열 자식 제외) ─────
    this._mutation      = null;
    this._shieldActive  = false;
    this._splitChild    = false; // 분열로 생성된 자식은 재분열 안 함
    this._explodeArmed  = false;
    this._regenTimer    = 0;

    // 일일 변이 적용
    if (isDailyRun && dailyMutations.curses.length) {
      if (dailyMutations.curses.find(c => c.id === 'enemy_hp')) {
        this.hp = Math.floor(this.hp * 1.60); this.maxHp = this.hp;
      }
      if (dailyMutations.curses.find(c => c.id === 'enemy_speed')) {
        this.baseSpeed *= 1.40; this.speed = this.baseSpeed;
      }
    }
    // 이벤트 스테이지 적용
    if (isDailyRun && dailyEventStage) {
      if (dailyEventStage === 'blizzard') {
        this.baseSpeed *= 0.50; this.speed = this.baseSpeed;
        this.hp = Math.floor(this.hp * 1.90); this.maxHp = this.hp;
      } else if (dailyEventStage === 'swarm') {
        this.hp = Math.floor(this.hp * 0.35); this.maxHp = this.hp;
        this.radius = Math.max(7, Math.floor(this.radius * 0.72));
      } else if (dailyEventStage === 'elite_wave' && this.type !== 'elite') {
        this.hp = Math.floor(this.hp * 1.25); this.maxHp = this.hp;
        this.xpValue = Math.floor(this.xpValue * 1.5);
        this.isElite = true;
      }
    }
    // ── 바이러스 변이 부여 ────────────────────────────────────────
    // 분열 자식·엘리트·파이널스테이지·스테이지 5 미만 제외, 15% 확률
    if (!this._splitChild && !this.isElite && !isFinalStage &&
        currentStage >= 5 && Math.random() < 0.15) {
      this._applyMutation(_pickMutation());
    }
  }

  _applyMutation(mut) {
    this._mutation = mut;
    if (mut.id === 'shield')    { this._shieldActive = true; }
    if (mut.id === 'explosive') { this._explodeArmed = true; }
  }

  update(dt) {
    if (!player) return;
    // ── 변이: 재생 ─────────────────────────────────────────────────
    if (this._mutation?.id === 'regen' && this.hp > 0 && this.hp < this.maxHp) {
      this._regenTimer += dt;
      if (this._regenTimer >= 500) {
        this._regenTimer = 0;
        this.hp = Math.min(this.maxHp, this.hp + Math.max(1, Math.floor(this.maxHp * 0.005)));
      }
    }
    // ── 변이: 자폭 — 플레이어 근접 시 폭발 ───────────────────────
    if (this._mutation?.id === 'explosive' && this._explodeArmed && player) {
      if (dist(this.x, this.y, player.x, player.y) < this.radius + player.radius + 70) {
        this._explodeArmed = false;
        createExplosionParticles(this.x, this.y, '#ff4466', 22);
        createExplosionParticles(this.x, this.y, '#ff8800', 12);
        const explDmg = Math.ceil(this.damage * 3.5);
        if (player) { player.hp -= explDmg; player.flashTimer = 120; lastDamageSource = LANG === 'en' ? 'Explosive Virus' : '자폭 바이러스'; if (player.hp <= 0) endGame(false); }
        addFloatingText(this.x, this.y - 30, LANG === 'en' ? `💥 SELF-DESTRUCT! -${explDmg}` : `💥 자폭! -${explDmg}`, '#ff4466', 15);
        playSynthSound([300, 150, 80], 0.35, 'sawtooth', 0.1);
        triggerScreenShake(8, 350);
        for (const e of enemies) {
          if (e !== this && dist(this.x, this.y, e.x, e.y) < 80) e.takeDamage(30, 'virus_explode');
        }
        this.hp = 0; this.die('virus_explode'); return;
      }
    }
    // 스턴 처리
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      this.flashTimer = 60;
      return;
    }
    // ── 감염 카운트다운 (바이러스 증식) ─────────────────────────
    if (this._infected && this._infectTimer > 0) {
      this._infectTimer -= dt;
      if (this._infectTimer <= 0) {
        this._infected = false;
        const exDmg = this._infectDmg;
        const exR   = player?.fusions?.pandemic ? 160 : 120;
        const exFin = player?.fusions?.pandemic ? exDmg * 1.5 : exDmg;
        createExplosionParticles(this.x, this.y, '#33ff33', Math.min(10, MAX_PARTICLES - particles.length));
        playSynthSound([200, 80], 0.12, 'sawtooth', 0.06);
        const snap = [...enemies]; if (activeBoss) snap.push(activeBoss);
        for (const e of snap) {
          if (e === this) continue;
          if (dist(this.x, this.y, e.x, e.y) < exR) {
            if (e === activeBoss) activeBoss.takeDamage(Math.floor(exFin * 0.3), 'viral_bomb');
            else if (e.takeDamage(exFin, 'viral_bomb')) { killCount++; stageKillProgress++; }
            if (this._infectChain > 0 && !e._infected) {
              e._infected = true; e._infectTimer = 4000;
              e._infectChain = this._infectChain - 1; e._infectDmg = exDmg;
            }
          }
        }
      }
    }
    // ── 공명 스택 감쇠 ───────────────────────────────────────────
    if (this._resStack > 0) { this._resTimer -= dt; if (this._resTimer <= 0) this._resStack = 0; }
    // ── 해킹 아군화 업데이트 ─────────────────────────────────────
    if (this._hacked && this._hackTimer > 0) {
      this._hackTimer -= dt;
      this._hackDmgTimer  += dt;
      this._hackShootTimer += dt;

      const zombieLvl = player?.classPassives?.ck_zombie || 0;
      const hackLv    = player?.weapons?.hack_gun?.level || 1;
      const dmgMult   = zombieLvl >= 2 ? 1.70 : zombieLvl >= 1 ? 1.40 : 1.0;

      // 근접 타격 (500ms, 반경 40 이내)
      if (this._hackDmgTimer >= 500) {
        this._hackDmgTimer = 0;
        const meleeDmg = Math.floor(20 * dmgMult * (player?.damageMultiplier || 1));
        let hitCount = 0;
        for (const e2 of [...enemies]) {
          if (e2 === this || e2._hacked || hitCount >= 2) continue;
          if (dist(this.x, this.y, e2.x, e2.y) < this.radius + e2.radius + 40) {
            if (e2.takeDamage(meleeDmg, 'hack_ally')) { killCount++; stageKillProgress++; }
            hitCount++;
          }
        }
      }

      // 원거리 사격 (1200ms, 범위 300px)
      if (this._hackShootTimer >= 1200 && projectiles.length < MAX_PROJECTILES) {
        this._hackShootTimer = 0;
        const shootDmg = Math.floor((22 + hackLv * 12) * dmgMult * (player?.damageMultiplier || 1));
        let shootTarget = null, minShotD = 320;
        const shotCandidates = [...enemies];
        if (activeBoss) shotCandidates.push(activeBoss);
        for (const e2 of shotCandidates) {
          if (e2 === this || e2._hacked) continue;
          const d2 = dist(this.x, this.y, e2.x, e2.y);
          if (d2 < minShotD) { minShotD = d2; shootTarget = e2; }
        }
        if (shootTarget) {
          const sa = Math.atan2(shootTarget.y - this.y, shootTarget.x - this.x);
          projectiles.push(new Projectile(this.x, this.y, Math.cos(sa)*10, Math.sin(sa)*10, shootDmg, 5, '#00ddff', 1, 'hack_ally'));
          addFloatingText(this.x, this.y - this.radius - 14, '💻', '#00ddff', 11);
          playSynthSound([1200, 700], 0.06, 'square', 0.03);
        }
      }
      if (this._hackTimer <= 0) {
        this._hacked = false;
        const blastLvl = player?.classPassives?.ck_blast || 0;
        const blastDmg = blastLvl >= 2 ? 280 : blastLvl >= 1 ? 150 : 0;
        const blastR   = blastLvl >= 2 ? 180 : 130;
        const finalExpl = Math.max(this._hackExplosion, blastDmg);
        if (finalExpl > 0) {
          const exColor = blastLvl > 0 ? '#ff6600' : '#00ccff';
          createExplosionParticles(this.x, this.y, exColor, Math.min(12, MAX_PARTICLES - particles.length));
          const snap2 = [...enemies]; if (activeBoss) snap2.push(activeBoss);
          for (const e3 of snap2) {
            if (e3 === this) continue;
            if (dist(this.x, this.y, e3.x, e3.y) < blastR) {
              if (e3 === activeBoss) activeBoss.takeDamage(Math.floor(finalExpl * 0.25), 'hack_gun');
              else if (e3.takeDamage(finalExpl, 'hack_gun')) { killCount++; stageKillProgress++; }
            }
          }
          // ck_blast Lv2: 인근 1체 연쇄 해킹
          if (blastLvl >= 2) {
            const chain = [...enemies].filter(e => !e._hacked && e !== this);
            if (chain.length > 0) {
              const ct = chain.reduce((a, b) => dist(this.x, this.y, a.x, a.y) <= dist(this.x, this.y, b.x, b.y) ? a : b);
              ct._hacked = true; ct._hackTimer = 4000; ct._hackDmgTimer = 0;
              ct._hackExplosion = 0; ct._hackEvolved = !!(player?.fusions?.virus_takeover);
              addFloatingText(ct.x, ct.y - 40, LANG === 'en' ? '🔗 Chain Hack!' : '🔗 연쇄 해킹!', '#ff6600', 12);
            }
          }
        }
      }
    }

    // 데이터 폭풍: 불규칙 이동
    if (activeFieldEvent?.id === 'data_storm') {
      this.stormTimer -= dt;
      if (this.stormTimer <= 0) {
        const a = Math.random() * Math.PI * 2;
        this.stormDX = Math.cos(a); this.stormDY = Math.sin(a);
        this.stormTimer = 600 + Math.random() * 800;
      }
      let spd = this.baseSpeed * 1.1 * this.speedMultiplier;
      this.x += this.stormDX * spd * (dt / 16.66);
      this.y += this.stormDY * spd * (dt / 16.66);
      this.speedMultiplier = 1.0;
      if (this.flashTimer > 0) this.flashTimer -= dt;
      return;
    }
    let dx, dy;
    // 해킹 아군: 가장 가까운 적을 추적
    if (this._hacked) {
      let target = null, minD = Infinity;
      for (const e2 of enemies) {
        if (e2 === this || e2._hacked) continue;
        const d2 = dist(this.x, this.y, e2.x, e2.y);
        if (d2 < minD) { minD = d2; target = e2; }
      }
      if (activeBoss) {
        const bd = dist(this.x, this.y, activeBoss.x, activeBoss.y);
        if (!target || bd < minD) target = activeBoss;
      }
      if (target) {
        const dd = Math.sqrt((target.x-this.x)**2 + (target.y-this.y)**2) || 1;
        dx = (target.x - this.x) / dd;
        dy = (target.y - this.y) / dd;
      } else {
        dx = 0; dy = 0;
      }
    // 팬텀 시프트 이벤트: 적 AI 오작동 — 랜덤 방향으로 이동
    } else if (activeFieldEvent?.id === 'phantom_shift') {
      if (!this._phantomAngle) this._phantomAngle = Math.random() * Math.PI * 2;
      this._phantomAngle += (Math.random() - 0.5) * 0.15;
      dx = Math.cos(this._phantomAngle);
      dy = Math.sin(this._phantomAngle);
    } else {
      dx = player.x - this.x; dy = player.y - this.y;
      let d = Math.sqrt(dx*dx + dy*dy);
      if (d > 0) { dx /= d; dy /= d; }
    }
    // 재머 디버프
    if (this._jammed && this._jamTimer > 0) {
      this._jamTimer -= dt;
      if (this._jamTimer <= 0) { this._jammed = false; }
      else this.speedMultiplier *= 0.70;
    }
    let spd = this.baseSpeed * this.speedMultiplier;
    // 바이러스 광란 이벤트
    if (activeFieldEvent?.id === 'virus_frenzy') spd *= 1.7;
    // 엘리트 침공 이벤트: 20% 속도 증가
    if (activeFieldEvent?.id === 'elite_invasion') spd *= 1.2;
    // 프리즈 존: 적 속도 -60%
    if (activeFieldEvent?.id === 'freeze_zone') spd *= 0.4;
    this.x += dx * spd * (dt / 16.66);
    this.y += dy * spd * (dt / 16.66);
    this.speedMultiplier = 1.0;
    if (this.flashTimer > 0) this.flashTimer -= dt;
  }

  draw(ctx, camera) {
    const bx = this.x - camera.x, by = this.y - camera.y;
    const r  = this.radius;
    const t  = this.type;
    const fl = this.flashTimer > 0;
    const col = fl ? '#ffffff' : this.color;

    ctx.save();

    if (t === 'swarm') {
      // 육각형 (shadowBlur 없음 — 성능)
      ctx.fillStyle = col;
      ctx.strokeStyle = fl ? '#ffffff' : '#39ff14';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i/6)*Math.PI*2 - Math.PI/6;
        i === 0 ? ctx.moveTo(bx+Math.cos(a)*r, by+Math.sin(a)*r)
                : ctx.lineTo(bx+Math.cos(a)*r, by+Math.sin(a)*r);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      if (this.hp < this.maxHp && this.hp > 0) {
        const bw=r*1.6, bh=2;
        ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(bx-bw/2, by-r-6, bw, bh);
        ctx.fillStyle='#00ff66';          ctx.fillRect(bx-bw/2, by-r-6, bw*(this.hp/this.maxHp), bh);
      }
    } else if (t === 'rusher') {
      // 뾰족 삼각형
      ctx.shadowBlur=8; ctx.shadowColor=col;
      ctx.fillStyle=col; ctx.strokeStyle='#ffffff'; ctx.lineWidth=1;
      ctx.beginPath();
      ctx.moveTo(bx,    by-r*1.3);
      ctx.lineTo(bx-r,  by+r*0.8);
      ctx.lineTo(bx+r,  by+r*0.8);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.shadowBlur=4; ctx.fillStyle='#ffffff';
      ctx.beginPath(); ctx.arc(bx, by+r*0.1, r*0.22, 0, Math.PI*2); ctx.fill();
    } else if (t === 'bruiser') {
      // 팔각형 + 스파이크
      ctx.shadowBlur=14; ctx.shadowColor=col;
      ctx.fillStyle=col; ctx.strokeStyle='#ffffff'; ctx.lineWidth=1.5;
      ctx.beginPath();
      for (let i=0;i<8;i++){
        const a=(i/8)*Math.PI*2-Math.PI/8;
        i===0?ctx.moveTo(bx+Math.cos(a)*r, by+Math.sin(a)*r)
             :ctx.lineTo(bx+Math.cos(a)*r, by+Math.sin(a)*r);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle=col; ctx.lineWidth=2;
      for(let i=0;i<4;i++){
        const a=(i/4)*Math.PI*2;
        ctx.beginPath();
        ctx.moveTo(bx+Math.cos(a)*r, by+Math.sin(a)*r);
        ctx.lineTo(bx+Math.cos(a)*(r+8), by+Math.sin(a)*(r+8));
        ctx.stroke();
      }
      if (this.hp < this.maxHp) {
        const bw=r*1.6, bh=3;
        ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(bx-bw/2, by-r-8, bw, bh);
        ctx.fillStyle='#ff007f';         ctx.fillRect(bx-bw/2, by-r-8, bw*(this.hp/this.maxHp), bh);
      }
    } else {
      // elite: 다이아몬드 + 점선 링
      ctx.shadowBlur=20; ctx.shadowColor='#ff6600';
      ctx.fillStyle=fl?'#ffffff':'#ff6600'; ctx.strokeStyle='#ffaa00'; ctx.lineWidth=2;
      ctx.beginPath();
      ctx.moveTo(bx,    by-r*1.35);
      ctx.lineTo(bx+r,  by);
      ctx.lineTo(bx,    by+r*1.35);
      ctx.lineTo(bx-r,  by);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle='rgba(255,102,0,0.45)'; ctx.lineWidth=1; ctx.setLineDash([3,3]);
      ctx.beginPath(); ctx.arc(bx, by, r+7, 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font='bold 7px Orbitron,monospace'; ctx.fillStyle='#ffaa00';
      ctx.textAlign='center'; ctx.shadowBlur=4;
      ctx.fillText(this.eliteName||'ELITE', bx, by-r-13);
      if (this.hp < this.maxHp) {
        const bw=r*1.6, bh=3;
        ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(bx-bw/2, by-r-8, bw, bh);
        ctx.fillStyle='#ff6600';         ctx.fillRect(bx-bw/2, by-r-8, bw*(this.hp/this.maxHp), bh);
      }
    }
    // 특수 상태 시각 표시
    if (this._hacked) {
      ctx.shadowBlur = 18; ctx.shadowColor = '#00ccff';
      ctx.strokeStyle = '#00ccff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bx, by, this.radius + 4, 0, Math.PI * 2); ctx.stroke();
    } else if (this._infected) {
      ctx.strokeStyle = '#33ff33'; ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(bx, by, this.radius + 3, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (this._resStack >= 2 && player?.weapons?.resonance?.level > 0) {
      ctx.fillStyle = `rgba(255,180,0,${Math.min(this._resStack * 0.15, 0.6)})`;
      ctx.beginPath(); ctx.arc(bx, by, this.radius * 0.55, 0, Math.PI * 2); ctx.fill();
    }
    // ── 변이 비주얼 ─────────────────────────────────────────────
    if (this._mutation) {
      const mc = this._mutation.color;
      const t2 = Date.now() * 0.004;
      ctx.shadowBlur = 0;
      if (this._mutation.id === 'shield' && this._shieldActive) {
        // 방어막: 견고한 사이언 링
        ctx.shadowBlur = 12; ctx.shadowColor = mc;
        ctx.strokeStyle = mc; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(bx, by, this.radius + 5, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (this._mutation.id === 'split') {
        // 분열: 황색 점선 링 + 아이콘
        ctx.strokeStyle = mc; ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(bx, by, this.radius + 4 + Math.sin(t2)*2, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      } else if (this._mutation.id === 'explosive' && this._explodeArmed) {
        // 자폭: 빨간 박동 링
        const pulse = 0.6 + Math.sin(t2 * 2) * 0.4;
        ctx.globalAlpha = pulse;
        ctx.shadowBlur = 10 + Math.sin(t2 * 2) * 8; ctx.shadowColor = mc;
        ctx.strokeStyle = mc; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(bx, by, this.radius + 5, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      } else if (this._mutation.id === 'regen') {
        // 재생: 녹색 내부 채움 (HP 비율로 투명도)
        const hpRatio = this.hp / this.maxHp;
        ctx.fillStyle = `rgba(0,255,170,${0.08 + hpRatio * 0.12})`;
        ctx.beginPath(); ctx.arc(bx, by, this.radius * 0.75, 0, Math.PI * 2); ctx.fill();
      }
      // 변이 아이콘 (우하단 구석)
      ctx.font = `${Math.floor(this.radius * 0.65)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.9;
      ctx.fillText(this._mutation.icon, bx + this.radius * 0.55, by + this.radius * 0.55 + 4);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  takeDamage(amount, sourceKey) {
    // ── 해킹 아군: 보스 발사체·적 폭발 변이 외 피해 면역 ─────────
    if (this._hacked && sourceKey !== 'boss_proj' && sourceKey !== 'explosive') {
      return false;
    }
    // ── 변이: 방어막 — 첫 타격 흡수 ─────────────────────────────
    if (this._shieldActive && sourceKey !== 'thorns' && sourceKey !== 'boss_proj') {
      this._shieldActive = false;
      this.flashTimer = 120;
      addFloatingText(this.x, this.y - this.radius - 10, LANG === 'en' ? '🛡 Shield!' : '🛡 방어막!', '#00f0ff', 13);
      playSynthSound([600, 400], 0.12, 'square', 0.06);
      createExplosionParticles(this.x, this.y, '#00f0ff', 6);
      return false;
    }
    // 크리티컬 코어 패시브 + 메타 크리티컬 보너스
    const _hasCrit = player && (player.passives.critical > 0 || (player.critBonus || 0) > 0);
    if (_hasCrit && sourceKey !== 'thorns' && sourceKey !== 'boss_proj') {
      const baseChance = player.passives.critical === 2 ? 0.25 : (player.passives.critical === 1 ? 0.15 : 0);
      const chance = Math.min(0.70, baseChance + (player.critBonus || 0));
      const mult   = player.passives.critical === 2 ? 3.0  : 2.5;
      if (Math.random() < chance) {
        amount *= mult;
        addFloatingText(this.x, this.y - this.radius - 8, '💥CRIT!', '#ffe600', 13);
      }
    }
    // 코어 과부하 이벤트: 플레이어 공격력 3배
    if (activeFieldEvent?.id === 'core_overload' && sourceKey !== 'thorns' && sourceKey !== 'boss_proj') {
      amount *= 3;
    }
    // ── 공명 스택 누적 (공명 증폭기) ────────────────────────────
    if (player?.weapons?.resonance?.level > 0 &&
        sourceKey !== 'resonance' && sourceKey !== 'viral_bomb' && sourceKey !== 'hack_gun') {
      this._resStack++;
      this._resTimer = [2500, 3000, 3500, 4000, 4500][player.weapons.resonance.level - 1] ?? 2500;
      const isHeavy = this.isElite || this === activeBoss;
      const threshold = isHeavy
        ? ([4, 4, 4, 3, 3][player.weapons.resonance.level - 1] ?? 4)
        : 3;
      if (this._resStack >= threshold) {
        this._resStack = 0; this._resTimer = 0;
        const mult   = [4, 4, 5, 5, 6][player.weapons.resonance.level - 1] ?? 4;
        const resDmg = Math.floor(amount * mult);
        createExplosionParticles(this.x, this.y, '#ffaa00', Math.min(14, MAX_PARTICLES - particles.length));
        addFloatingText(this.x, this.y - 50, LANG === 'en' ? `Resonance! ×${mult}` : `공명! ×${mult}`, '#ffaa00', 14);
        playSynthSound([800, 1200, 600], 0.15, 'triangle', 0.07);
        this.hp -= resDmg;
        if (this.hp <= 0) { this.die(sourceKey); return true; }
        if (player.fusions?.critical_collapse) {
          for (const e4 of enemies) {
            if (e4 !== this && dist(this.x, this.y, e4.x, e4.y) < 160) {
              e4._resStack = Math.max(e4._resStack, 2);
              e4._resTimer = Math.max(e4._resTimer, 2500);
            }
          }
        }
      }
    }
    this.hp -= amount;
    this.flashTimer = 80;
    if (weaponStats[sourceKey]) weaponStats[sourceKey].damage += amount;
    createExplosionParticles(this.x, this.y, this.color, 3);
    if (Math.random() < 0.25) {
      addFloatingText(this.x + (Math.random()-0.5)*20, this.y - this.radius, Math.floor(amount).toString(), '#ffffff', 11);
    }
    if (this.hp <= 0) { this.die(sourceKey); return true; }
    return false;
  }

  die(sourceKey) {
    if (this.dead) return;
    this.dead = true;
    // ── 변이: 분열 — 2마리 자식 스폰 ─────────────────────────────
    if (this._mutation?.id === 'split' && !this._splitChild && enemies.length < 60) {
      for (let i = 0; i < 2; i++) {
        const ang = (i === 0 ? -1 : 1) * (Math.PI / 4) + Math.random() * 0.4;
        const dist_ = 20 + Math.random() * 10;
        const cx = Math.max(20, Math.min(MAP_WIDTH-20,  this.x + Math.cos(ang) * dist_));
        const cy = Math.max(20, Math.min(MAP_HEIGHT-20, this.y + Math.sin(ang) * dist_));
        const child = new Enemy(cx, cy, this.type === 'elite' ? 'bruiser' : this.type);
        child._splitChild = true;
        child.maxHp = Math.max(1, Math.floor(this.maxHp * 0.35));
        child.hp    = child.maxHp;
        child.radius = Math.max(7, Math.floor(this.radius * 0.65));
        child._mutation = null;
        enemies.push(child);
      }
      addFloatingText(this.x, this.y - 28, LANG === 'en' ? '🔱 Split!' : '🔱 분열!', '#ffe600', 14);
      playSynthSound([400, 200], 0.1, 'square', 0.06);
    }
    // 미션 트래킹
    mTrack.mKills++;
    if (this.isElite) _statAdd('totalEliteKills', 1);
    if (this.stunTimer > 0) mTrack.mStunKills++;
    createExplosionParticles(this.x, this.y, this.color, this.isElite ? 20 : 12);
    playEnemyExplosionSound();
    if (weaponStats[sourceKey]) weaponStats[sourceKey].kills++;

    // 폭발 연쇄 패시브
    if (player && player.passives.explosive > 0) {
      const chance = player.passives.explosive === 2 ? 0.5 : 0.3;
      const radius = player.passives.explosive === 2 ? 160 : 120;
      const dmg    = player.passives.explosive === 2 ? 60  : 40;
      if (Math.random() < chance) {
        createExplosionParticles(this.x, this.y, '#ff8800', 14);
        // 스냅샷으로 이터레이션 중 배열 변경 방지
        const nearby = enemies.filter(e => e !== this && dist(this.x, this.y, e.x, e.y) < radius);
        for (let e of nearby) {
          if (e.takeDamage(dmg, 'explosive')) killCount++;
        }
        if (activeBoss && dist(this.x, this.y, activeBoss.x, activeBoss.y) < radius)
          activeBoss.takeDamage(dmg, 'explosive');
      }
    }

    // 리듬 비트 시스템: 비트 윈도우 안에 처치하면 XP 보너스
    if (beatWindowActive) {
      beatChain++;
      beatChainTimer = BEAT_CHAIN_DECAY;
      const beatMult = Math.min(1.0 + beatChain * 0.25, 4.0);
      gems.push(new Gem(this.x, this.y, Math.ceil(this.xpValue * beatMult)));
      addFloatingText(this.x, this.y - this.radius - 14,
        `♪ BEAT! x${beatMult.toFixed(1)}`, '#ffe600', beatChain >= 5 ? 15 : 12);
      createBeatParticles(this.x, this.y);
    } else {
      gems.push(new Gem(this.x, this.y, this.xpValue));
    }

    // 패러사이트 흡수
    if (player?.classId === 'parasite') {
      player._totalAbsorptions = (player._totalAbsorptions || 0) + 1;
      const maxS = 3 + (player.classPassives?.ps_absorb >= 2 ? 1 : 0);
      if ((player._parasiteStacks || 0) < maxS) {
        player._parasiteStacks = (player._parasiteStacks || 0) + 1;
        if (player.classPassives?.ps_absorb >= 1) {
          const h = player.classPassives.ps_absorb >= 2 ? 6 : 3;
          player.hp = Math.min(player.hp + h, player.maxHp);
        }
        addFloatingText(this.x, this.y - 30, `🧬×${player._parasiteStacks}`, '#88ff44', 11);
      }
      // 파이널 스테이지 1웨이브 킬 카운트
      if (isFinalStage && finalStageWave === 1) finalWave1Kills++;
    }

    // 스테이지 킬 진행
    stageKillProgress++;
    onEnemyKilled();
    checkStageProgress();

    // 필드 아이템 드롭 (elite 20%, bruiser 12%, rusher 4%, swarm 2%)
    let dropChance = this.isElite ? 0.20 : this.type === 'bruiser' ? 0.12 : this.type === 'rusher' ? 0.04 : 0.02;
    if (Math.random() < dropChance && fieldItems.length < 8) {
      let dropTypes = ['health', 'health', 'magnet', 'surge'];
      let dropType  = dropTypes[Math.floor(Math.random() * dropTypes.length)];
      fieldItems.push(new FieldItem(this.x, this.y, dropType));
    }

    // 골드 드롭 — 드롭률 하향 (너무 흔하면 상점 밸런스 붕괴)
    let goldMult = (activeFieldEvent?.id === 'golden_rush' || dailyEventStage === 'gold_rush') ? 3 : 1;
    if (isDailyRun && dailyMutations.buff?.id === 'double_gold') goldMult *= 2;
    let goldAmt = 0;
    if (this.isElite)                                              goldAmt = 2 + Math.floor(Math.random() * 2);  // 2-3 (이전 4-7)
    else if (this.type === 'bruiser' && Math.random() < 0.35)     goldAmt = 1 + (Math.random() < 0.4 ? 1 : 0); // 35% → 1-2 (이전 100% 2-4)
    else if (activeFieldEvent?.id === 'golden_rush')               goldAmt = 1;
    else if (this.type === 'rusher'  && Math.random() < 0.12)     goldAmt = 1;                                  // 12% (이전 40%)
    else if (this.type === 'swarm'   && Math.random() < 0.05)     goldAmt = 1;                                  // 5% (이전 20%)
    if (goldAmt > 0) spawnGoldCoins(this.x, this.y, Math.ceil(goldAmt * goldMult));

    // 바이러스 장악 진화: 해킹된 적 사망 시 주변 1체 즉시 감염
    if (this._hacked && player?.fusions?.virus_takeover) {
      const near = enemies.filter(e => !e._infected && !e._hacked)
        .sort((a, b) => dist(this.x, this.y, a.x, a.y) - dist(this.x, this.y, b.x, b.y))[0];
      if (near) {
        near._infected = true; near._infectTimer = 4000;
        near._infectChain = 0; near._infectDmg = Math.floor(120 * (player.damageMultiplier || 1));
        addFloatingText(near.x, near.y - 35, LANG === 'en' ? '🦠 Infection Transfer!' : '🦠 감염 이식!', '#33ff33', 13);
      }
    }
    let idx = enemies.indexOf(this);
    if (idx !== -1) enemies.splice(idx, 1);
  }
}

// ============================================================
// 10. 보스 클래스
// ============================================================
// 보스 타입 팔레트 (인덱스 % 4 순환)
const BOSS_TYPES = [
  { id: 'berserker', label: 'BERSERKER', outerColor: '#ff0044', innerColor: '#ff4466', glowColor: '#ff0044' },
  { id: 'sharpshooter', label: 'SNIPER',  outerColor: '#00f0ff', innerColor: '#00aaff', glowColor: '#00f0ff' },
  { id: 'summoner',  label: 'SUMMONER',  outerColor: '#b026ff', innerColor: '#cc66ff', glowColor: '#b026ff' },
  { id: 'titan',     label: 'TITAN',     outerColor: '#ffe600', innerColor: '#ffaa00', glowColor: '#ff8800' },
];

// ============================================================
// 장애물 시스템
// ============================================================
class FirewallWall {
  constructor(x1, y1, x2, y2) {
    this.x1 = x1; this.y1 = y1; this.x2 = x2; this.y2 = y2;
    this.type = 'firewall'; this.color = '#00f0ff';
    this.pulseT = Math.random() * Math.PI * 2; this.dead = false;
  }
  update(dt) { this.pulseT += dt * 0.003; }
  draw(ctx, camera) {
    const sx1 = this.x1 - camera.x, sy1 = this.y1 - camera.y;
    const sx2 = this.x2 - camera.x, sy2 = this.y2 - camera.y;
    const pulse = 0.6 + Math.sin(this.pulseT) * 0.3;
    ctx.save();
    ctx.shadowBlur = 10; ctx.shadowColor = this.color;
    ctx.strokeStyle = this.color; ctx.lineWidth = 3; ctx.globalAlpha = pulse;
    ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(sx2, sy2); ctx.stroke();
    ctx.lineWidth = 1; ctx.globalAlpha = pulse * 0.4;
    const dx = sx2-sx1, dy = sy2-sy1, len = Math.sqrt(dx*dx+dy*dy);
    const nx = -dy/len*6, ny = dx/len*6;
    const segs = Math.max(2, Math.floor(len / 40));
    for (let i = 0; i <= segs; i++) {
      const t = i/segs, mx = sx1+dx*t, my = sy1+dy*t;
      ctx.beginPath(); ctx.moveTo(mx-nx, my-ny); ctx.lineTo(mx+nx, my+ny); ctx.stroke();
    }
    ctx.restore();
  }
  collidesWithCircle(cx, cy, cr) {
    const dx = this.x2-this.x1, dy = this.y2-this.y1, lenSq = dx*dx+dy*dy;
    if (lenSq === 0) return false;
    let t = Math.max(0, Math.min(1, ((cx-this.x1)*dx+(cy-this.y1)*dy)/lenSq));
    return Math.sqrt((cx-this.x1-t*dx)**2+(cy-this.y1-t*dy)**2) < cr + 4;
  }
  pushOutVector(cx, cy, cr) {
    const dx = this.x2-this.x1, dy = this.y2-this.y1, lenSq = dx*dx+dy*dy;
    if (lenSq === 0) return {x:0,y:0};
    let t = Math.max(0, Math.min(1, ((cx-this.x1)*dx+(cy-this.y1)*dy)/lenSq));
    const nearX = this.x1+t*dx, nearY = this.y1+t*dy;
    let pvx = cx-nearX, pvy = cy-nearY;
    const d = Math.sqrt(pvx*pvx+pvy*pvy);
    if (d === 0) { pvx = -dy/Math.sqrt(lenSq); pvy = dx/Math.sqrt(lenSq); return {x:pvx*(cr+5),y:pvy*(cr+5)}; }
    return { x: pvx/d*(cr+5-d), y: pvy/d*(cr+5-d) };
  }
}

class ElectricZone {
  constructor(x, y, radius) {
    this.x = x; this.y = y; this.radius = radius;
    this.type = 'electric'; this.color = '#ffe600';
    this.on = true; this.timer = 0;
    this.ON_DUR  = 2200 + Math.random() * 800;
    this.OFF_DUR = 900  + Math.random() * 400;
    this.dmgTimer = 0; this.dead = false;
  }
  update(dt) {
    this.timer += dt;
    if (this.timer >= (this.on ? this.ON_DUR : this.OFF_DUR)) { this.timer = 0; this.on = !this.on; }
    if (this.on && player) {
      const dx = player.x-this.x, dy = player.y-this.y;
      if (Math.sqrt(dx*dx+dy*dy) < this.radius + player.radius) {
        this.dmgTimer += dt;
        if (this.dmgTimer >= 400) {
          this.dmgTimer = 0;
          player.hp -= 4; player.flashTimer = 60;
          if (player.hp <= 0) endGame(false);
          addFloatingText(player.x, player.y-20, '-4 ⚡', '#ffe600', 11);
        }
      } else { this.dmgTimer = 0; }
    }
  }
  draw(ctx, camera) {
    if (!this.on && this.timer > this.OFF_DUR * 0.7) return;
    const sx = this.x-camera.x, sy = this.y-camera.y;
    const alpha = this.on ? (0.18+Math.sin(Date.now()*0.008)*0.08) : 0.05+(1-this.timer/this.OFF_DUR)*0.08;
    ctx.save();
    ctx.shadowBlur = this.on ? 18 : 4; ctx.shadowColor = this.color;
    ctx.strokeStyle = this.color; ctx.lineWidth = 2; ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(sx, sy, this.radius, 0, Math.PI*2); ctx.stroke();
    if (this.on) {
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const a = (i/6)*Math.PI*2+Date.now()*0.002;
        ctx.beginPath();
        ctx.moveTo(sx+Math.cos(a)*this.radius*0.6, sy+Math.sin(a)*this.radius*0.6);
        ctx.lineTo(sx+Math.cos(a)*this.radius, sy+Math.sin(a)*this.radius);
        ctx.stroke();
      }
    }
    ctx.font = 'bold 8px Orbitron,monospace'; ctx.fillStyle = this.color;
    ctx.textAlign = 'center'; ctx.globalAlpha = alpha*1.5;
    ctx.fillText(this.on ? '⚡ ELECTRIC' : '[ OFF ]', sx, sy);
    ctx.restore();
  }
}

class VirusPool {
  constructor(x, y, radius) {
    this.x = x; this.y = y; this.radius = radius;
    this.type = 'pool'; this.color = '#39ff14';
    this.pulseT = Math.random()*Math.PI*2; this.dmgTimer = 0; this.dead = false;
  }
  update(dt) {
    this.pulseT += dt*0.002;
    const r = this.radius+Math.sin(this.pulseT)*8;
    if (player) {
      const dx = player.x-this.x, dy = player.y-this.y;
      if (Math.sqrt(dx*dx+dy*dy) < r+player.radius) {
        player._inVirusPool = true;
        this.dmgTimer += dt;
        if (this.dmgTimer >= 600) {
          this.dmgTimer = 0;
          player.hp -= 3; player.flashTimer = 40;
          if (player.hp <= 0) endGame(false);
          addFloatingText(player.x, player.y-20, '-3 ☣', '#39ff14', 10);
        }
      }
    }
  }
  draw(ctx, camera) {
    const sx = this.x-camera.x, sy = this.y-camera.y;
    const r  = this.radius+Math.sin(this.pulseT)*8;
    ctx.save();
    ctx.shadowBlur = 8; ctx.shadowColor = this.color;
    ctx.globalAlpha = 0.12+Math.sin(this.pulseT)*0.04;
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 0.4; ctx.strokeStyle = this.color; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = 0.15; ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const a = (i/4)*Math.PI*2+this.pulseT;
      ctx.beginPath(); ctx.moveTo(sx, sy);
      ctx.lineTo(sx+Math.cos(a)*r*0.7, sy+Math.sin(a)*r*0.7); ctx.stroke();
    }
    ctx.globalAlpha = 0.45; ctx.font = 'bold 7px Orbitron,monospace';
    ctx.fillStyle = this.color; ctx.textAlign = 'center';
    ctx.fillText('☣ POOL', sx, sy);
    ctx.restore();
  }
}

class Boss {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.type   = 'boss';
    this.speedMultiplier = 1.0;
    this.flashTimer = 0;
    this.pulseTimer = 0;
    this.stunTimer  = 0;
    this.shieldActive = false;
    this.shieldTimer  = 0;

    let bossIdx = Math.max(0, Math.floor(currentStage / 10) - 1);
    this.isFinalBoss = (currentStage === 100);

    // 반경: 스테이지 높을수록 조금씩 성장
    this.radius = this.isFinalBoss ? 90 : Math.min(50 + bossIdx * 2, 70);

    let scale   = 1 + bossIdx * 0.95;
    // 최종 보스: HP 3.5배 추가
    this.maxHp  = Math.floor(750 * scale * (this.isFinalBoss ? 3.5 : 1));
    this.hp     = this.maxHp;
    this.damage = Math.floor(32 * (1 + bossIdx * 0.35));
    this.xpValue = 60 + bossIdx * 20;
    this.baseSpeed = this.isFinalBoss ? 2.0 : Math.min(1.7 + bossIdx * 0.05, 2.4);
    this.name   = BOSS_NAMES[Math.min(bossIdx, BOSS_NAMES.length - 1)];
    this.phase  = 1;
    this.bossIdx = bossIdx;
    // 최종 보스는 TITAN 패턴 기반 (유도탄 + 전 패턴 동시 활성)
    this.patternType = this.isFinalBoss
      ? { id: 'final', label: 'FINAL PROTOCOL', outerColor: '#ffe600', innerColor: '#ff0044', glowColor: '#ffffff' }
      : BOSS_TYPES[bossIdx % 4];

    // 공격성 스케일: bossIdx 높을수록 쿨다운 최대 65% 단축
    const ag = Math.max(0.35, 1.0 - bossIdx * 0.07);

    // 돌진 공격
    this.chargeTimer    = 0;
    this.chargeCooldown = Math.round((this.isFinalBoss ? 2000 : (this.patternType.id === 'berserker' ? 2800 : 3800)) * ag);
    this.isCharging     = false;
    this.chargeVx = 0; this.chargeVy = 0;
    this.chargeDuration = 0;
    this.pendingCharges = 0;

    // 미니언 소환
    this.minionTimer    = 0;
    this.minionCooldown = Math.round((this.isFinalBoss ? 3500 : (this.patternType.id === 'summoner' ? 4000 : 6500)) * ag);

    // 궤도 사격 (bossIdx 1 이상부터 기본 활성 — 스테이지 20+)
    this.orbShotTimer    = 0;
    this.orbShotCooldown = Math.round((this.isFinalBoss ? 3000 : 4200) * ag);

    // 유도탄 (bossIdx 3 이상부터 기본 활성 — 스테이지 40+)
    this.homingTimer    = 0;
    this.homingCooldown = Math.round((this.isFinalBoss ? 3500 : 5000) * ag);

    // 방어막 (summoner + 최종 보스)
    this.shieldCooldown = Math.round((this.isFinalBoss ? 9000 : 12000) * ag);
    this.shieldCDTimer  = 0;

    // 최종 보스 전용: 엘리트 파동
    this.eliteWaveTimer    = 0;
    this.eliteWaveCooldown = 7000;
  }

  update(dt) {
    this.pulseTimer += dt;
    this.speedMultiplier = 1.0;
    if (this.flashTimer > 0) this.flashTimer -= dt;

    // 스턴 처리
    if (this.stunTimer > 0) { this.stunTimer -= dt; return; }

    // 방어막 처리
    if (this.shieldActive) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) {
        this.shieldActive = false;
        addFloatingText(this.x, this.y - 70, LANG === 'en' ? '🛡 Shield Broken!' : '🛡 방어막 해제!', '#b026ff', 13);
      }
      // 방어막 중에도 이동은 함
    }

    // 페이즈 2 전환 (HP 55% 이하, 미니보스 제외) — 더 일찍 격해짐
    if (!this.isMini && this.phase === 1 && this.hp <= this.maxHp * 0.55) {
      this.phase = 2;
      this.baseSpeed    *= 1.6;
      this.chargeCooldown = this.patternType.id === 'berserker' ? 1700 : 2200;
      this.minionCooldown = this.patternType.id === 'summoner'  ? 2500 : 4000;
      this.orbShotCooldown = 2800;
      this.homingCooldown  = 3200;
      createExplosionParticles(this.x, this.y, this.patternType.outerColor, 25);
      triggerScreenShake(8, 500);
      addFloatingText(this.x, this.y - 70, 'PHASE 2!', '#ff6600', 18);
      playSynthSound([80, 200], 0.5, 'sawtooth', 0.12);
    }

    // 페이즈 3 전환 (HP 25% 이하, bossIdx >= 2 또는 최종 보스, 미니보스 제외)
    if (!this.isMini && this.phase === 2 && (this.bossIdx >= 1 || this.isFinalBoss) && this.hp <= this.maxHp * 0.25) {
      this.phase = 3;
      this.baseSpeed    *= 1.35;
      this.chargeCooldown  = 1400;
      this.minionCooldown  = 2000;
      this.orbShotCooldown = 2000;
      this.homingCooldown  = 2000;
      createExplosionParticles(this.x, this.y, '#ffffff', 35);
      triggerScreenShake(14, 800);
      addFloatingText(this.x, this.y - 70, '⚠ PHASE 3!', '#ffffff', 20);
      playSynthSound([60, 120, 240], 0.6, 'sawtooth', 0.14);
    }

    if (this.isCharging) {
      this.x += this.chargeVx * (dt / 16.66);
      this.y += this.chargeVy * (dt / 16.66);
      this.chargeDuration -= dt;
      if (this.chargeDuration <= 0) {
        this.isCharging = false;
        const baseSpd = this.phase === 3 ? 3.0 : this.phase === 2 ? 2.4 : this.baseSpeed;
        this.baseSpeed = baseSpd;
        // 베르세르커: 연속 돌진
        if (this.patternType.id === 'berserker' && this.pendingCharges > 0) {
          this.pendingCharges--;
          setTimeout(() => { if (activeBoss === this) this.startCharge(false); }, 200);
        }
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
      this.startCharge(true);
    }

    this.minionTimer += dt;
    if (this.minionTimer >= this.minionCooldown) {
      this.minionTimer = 0;
      this.spawnMinions();
    }

    // 궤도 사격 (sharpshooter + 페이즈2 이상 + bossIdx 1 이상 = 스테이지 20+ + 최종 보스)
    if (this.patternType.id === 'sharpshooter' || this.phase >= 2 || this.bossIdx >= 1 || this.isFinalBoss) {
      this.orbShotTimer += dt;
      if (this.orbShotTimer >= this.orbShotCooldown) {
        this.orbShotTimer = 0;
        this.orbitalShot();
      }
    }

    // 유도탄 (titan + 페이즈3 + bossIdx 3 이상 = 스테이지 40+ + 최종 보스)
    if (this.patternType.id === 'titan' || this.phase >= 3 || this.bossIdx >= 3 || this.isFinalBoss) {
      this.homingTimer += dt;
      if (this.homingTimer >= this.homingCooldown) {
        this.homingTimer = 0;
        this.homingShot();
      }
    }

    // 방어막 쿨다운 (summoner + 최종 보스)
    if ((this.patternType.id === 'summoner' || this.isFinalBoss) && !this.shieldActive) {
      this.shieldCDTimer += dt;
      if (this.shieldCDTimer >= this.shieldCooldown) {
        this.shieldCDTimer = 0;
        this.activateShield();
      }
    }

    // 최종 보스 전용: 엘리트 파동
    if (this.isFinalBoss) {
      this.eliteWaveTimer += dt;
      if (this.eliteWaveTimer >= this.eliteWaveCooldown) {
        this.eliteWaveTimer = 0;
        this.spawnEliteWave();
      }
    }
  }

  startCharge(isNew) {
    if (!player) return;
    let dx = player.x - this.x, dy = player.y - this.y;
    let d  = Math.sqrt(dx*dx + dy*dy);
    if (d > 0) { dx /= d; dy /= d; }
    const phase3 = this.phase >= 3;
    let chargeSpd = phase3 ? 22 : (this.phase === 2 ? 17 : 12);
    this.chargeVx = dx * chargeSpd;
    this.chargeVy = dy * chargeSpd;
    this.isCharging     = true;
    this.chargeDuration = 600;
    this.baseSpeed      = 0;
    // 베르세르커: 연속 2-3회 돌진
    if (isNew && this.patternType.id === 'berserker') {
      this.pendingCharges = this.phase >= 2 ? 2 : 1;
    }
    addFloatingText(this.x, this.y - 60, '⚡ CHARGE!', '#ff6600', 13);
    playSynthSound([200, 600], 0.3, 'sawtooth', 0.1);
    triggerScreenShake(4, 300);
  }

  orbitalShot() {
    if (!player) return;
    const shotCount = this.phase >= 3 ? 16 : (this.phase >= 2 ? 12 : 10);
    const spd = 6.5;
    const dmg = this.damage * 0.85;
    if (bossProjectiles.length >= MAX_BOSS_PROJ) return;
    addFloatingText(this.x, this.y - 60, LANG === 'en' ? '🔵 Orbital Shot!' : '🔵 궤도 사격!', this.patternType.glowColor, 12);
    playSynthSound([500, 300, 700], 0.12, 'triangle', 0.07);
    for (let i = 0; i < shotCount; i++) {
      const angle = (i / shotCount) * Math.PI * 2;
      bossProjectiles.push(new BossProjectile(
        this.x, this.y,
        Math.cos(angle) * spd, Math.sin(angle) * spd,
        dmg, 7, this.patternType.glowColor, false
      ));
    }
  }

  homingShot() {
    if (!player) return;
    const count = this.phase >= 3 ? 4 : (this.phase >= 2 ? 3 : 2);
    const dmg = this.damage * 1.1;
    if (bossProjectiles.length >= MAX_BOSS_PROJ) return;
    addFloatingText(this.x, this.y - 60, LANG === 'en' ? '🎯 Homing Missile!' : '🎯 유도탄!', '#ff8800', 12);
    playSynthSound([150, 400], 0.15, 'sawtooth', 0.08);
    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * 0.28;
      const angle = Math.atan2(player.y - this.y, player.x - this.x) + spread;
      bossProjectiles.push(new BossProjectile(
        this.x, this.y,
        Math.cos(angle) * 4.5, Math.sin(angle) * 4.5,
        dmg, 9, '#ff8800', true
      ));
    }
  }

  activateShield() {
    this.shieldActive = true;
    this.shieldTimer  = 5000;
    addFloatingText(this.x, this.y - 70, LANG === 'en' ? '🛡 Shield Up!' : '🛡 방어막 발동!', '#b026ff', 14);
    createExplosionParticles(this.x, this.y, '#b026ff', 20);
    playSynthSound([400, 800, 1200], 0.15, 'triangle', 0.08);
  }

  spawnEliteWave() {
    if (!player) return;
    const count = this.phase >= 3 ? 8 : (this.phase === 2 ? 6 : 4);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = 180 + Math.random() * 80;
      const ex = Math.max(20, Math.min(MAP_WIDTH  - 20, this.x + Math.cos(angle) * r));
      const ey = Math.max(20, Math.min(MAP_HEIGHT - 20, this.y + Math.sin(angle) * r));
      enemies.push(new Enemy(ex, ey, 'elite'));
    }
    addFloatingText(this.x, this.y - this.radius - 20, '☠ ELITE WAVE!', '#ff0044', 15);
    triggerScreenShake(9, 500);
    playSynthSound([80, 160, 320], 0.35, 'sawtooth', 0.12);
  }

  spawnMinions() {
    const isSummoner = this.patternType.id === 'summoner';
    const count = this.phase >= 3 ? 6 : (this.phase === 2 ? 4 : (isSummoner ? 3 : 2));
    const minionType = isSummoner && this.phase >= 2 ? 'elite' : 'rusher';
    for (let i = 0; i < count; i++) {
      let angle = Math.random() * Math.PI * 2;
      let r  = 80 + Math.random() * 60;
      let ex = Math.max(20, Math.min(MAP_WIDTH  - 20, this.x + Math.cos(angle) * r));
      let ey = Math.max(20, Math.min(MAP_HEIGHT - 20, this.y + Math.sin(angle) * r));
      enemies.push(new Enemy(ex, ey, minionType));
    }
    addFloatingText(this.x, this.y - 60, LANG === 'en' ? '▶ Summon!' : '▶ 소환!', '#ff0044', 12);
  }

  draw(ctx, camera) {
    ctx.save();
    const pt  = this.patternType;
    let pulse = Math.sin(this.pulseTimer * 0.006) * (this.isFinalBoss ? 8 : 5);
    let drawR = this.radius + pulse;
    let bx = this.x - camera.x, by = this.y - camera.y;

    // 최종 보스: 회전 링 장식
    if (this.isFinalBoss) {
      const rot = this.pulseTimer * 0.002;
      const ringCols = ['#ffe600', '#ff0044', '#00f0ff', '#b026ff'];
      for (let r = 0; r < 4; r++) {
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(rot + r * Math.PI / 2);
        ctx.strokeStyle = ringCols[r];
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.6 + Math.sin(this.pulseTimer * 0.008 + r) * 0.2;
        ctx.shadowBlur = 20; ctx.shadowColor = ringCols[r];
        ctx.beginPath();
        ctx.arc(0, 0, drawR + 12 + r * 8, -0.6, 0.6);
        ctx.stroke();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    // 방어막 링
    if (this.shieldActive) {
      ctx.strokeStyle = '#b026ff'; ctx.lineWidth = 3;
      ctx.shadowBlur = 25; ctx.shadowColor = '#b026ff';
      const sAlpha = 0.4 + Math.sin(this.pulseTimer * 0.01) * 0.2;
      ctx.globalAlpha = sAlpha;
      ctx.beginPath(); ctx.arc(bx, by, drawR + 18, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    let outerCol;
    if (this.isFinalBoss) {
      // 최종 보스: 페이즈별 색상
      outerCol = this.phase >= 3 ? '#ffffff' : (this.phase === 2 ? '#ff6600' : '#ffe600');
    } else {
      outerCol = this.phase >= 3 ? '#ffffff' : (this.phase === 2 ? '#ff6600' : pt.outerColor);
    }
    ctx.shadowBlur  = this.isFinalBoss ? 60 : 35;
    ctx.shadowColor = this.isFinalBoss ? '#ffe600' : (this.shieldActive ? '#b026ff' : pt.glowColor);
    ctx.fillStyle   = this.flashTimer > 0 ? '#ffffff' : outerCol;
    ctx.beginPath(); ctx.arc(bx, by, drawR, 0, Math.PI * 2); ctx.fill();

    ctx.shadowBlur  = 15;
    ctx.fillStyle   = this.isFinalBoss
      ? (this.phase >= 2 ? '#ff2200' : '#ff0044')
      : (this.phase >= 2 ? '#ff8800' : pt.innerColor);
    ctx.beginPath(); ctx.arc(bx, by, drawR * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = this.isFinalBoss ? 3 : 2; ctx.stroke();

    // 보스 이름 + 타입 라벨
    ctx.font      = `bold ${this.isFinalBoss ? 13 : 11}px Orbitron, sans-serif`;
    ctx.fillStyle = this.isFinalBoss ? '#ffe600' : '#fff';
    ctx.textAlign = 'center';
    ctx.shadowBlur  = this.isFinalBoss ? 12 : 5;
    ctx.shadowColor = this.isFinalBoss ? '#ffe600' : pt.glowColor;
    ctx.fillText(this.name, bx, by - drawR - 20);
    ctx.font = '8px Orbitron, sans-serif';
    ctx.fillStyle = this.isFinalBoss ? '#ff0044' : pt.glowColor;
    ctx.fillText(`[${pt.label}]`, bx, by - drawR - 10);

    // HP 바
    let barW = this.radius * 2.5, barH = this.isFinalBoss ? 9 : 6;
    let barX = bx - barW / 2, barY = by - drawR - 30;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(barX, barY, barW, barH);
    let pct = Math.max(this.hp / this.maxHp, 0);
    ctx.fillStyle = pct > 0.5 ? (this.isFinalBoss ? '#ffe600' : pt.outerColor) : pct > 0.25 ? '#ff6600' : '#ff0000';
    ctx.fillRect(barX, barY, barW * pct, barH);
    // 페이즈 경계 표시
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(barX + barW * 0.5 - 1, barY, 2, barH);
    if (this.bossIdx >= 2 || this.isFinalBoss) ctx.fillRect(barX + barW * 0.25 - 1, barY, 2, barH);

    ctx.restore();
  }

  takeDamage(amount, sourceKey) {
    // 방어막 중: 피해 80% 감소
    if (this.shieldActive) amount *= 0.2;
    this.hp -= amount;
    this.flashTimer = 80;
    if (weaponStats[sourceKey]) weaponStats[sourceKey].damage += amount;
    createExplosionParticles(this.x, this.y, '#ff0044', 2);
    addFloatingText(this.x + (Math.random()-0.5)*30, this.y - this.radius, Math.floor(amount).toString(), '#ff4466', 13);
    if (this.hp <= 0) { this.hp = 0; this.die(sourceKey); return true; }
    return false;
  }

  die(sourceKey) {
    if (this.dead) return;
    this.dead = true;
    bossProjectiles.length = 0;
    createExplosionParticles(this.x, this.y, '#ff0044', 35);
    createExplosionParticles(this.x, this.y, '#ffe600', 25);
    createExplosionParticles(this.x, this.y, this.patternType.outerColor, 20);
    triggerScreenShake(18, 900);
    if (weaponStats[sourceKey]) weaponStats[sourceKey].kills++;
    for (let i = 0; i < 12; i++) {
      let ang = Math.random() * Math.PI * 2;
      let r   = Math.random() * 70;
      gems.push(new Gem(this.x + Math.cos(ang)*r, this.y + Math.sin(ang)*r, this.xpValue));
    }
    playBossDeathSound();
    spawnGoldCoins(this.x, this.y, 12 + Math.floor(Math.random() * 9));
    // 보스 처치 보너스 드롭: HP 또는 서지 아이템
    const bossDropType = ['health', 'health', 'surge', 'magnet'][Math.floor(Math.random() * 4)];
    fieldItems.push(new FieldItem(this.x + (Math.random() - 0.5) * 60, this.y + (Math.random() - 0.5) * 60, bossDropType));
    addFloatingText(this.x, this.y - this.radius - 20, '★ BOSS DROP!', '#ffe600', 15);
    _statAdd('totalBossKills', 1);
    // 미션 트래킹
    if (!this.isMini) {
      mTrack.mBossKills++;
      const bossElapsedSec = bossStageStartMs > 0 ? (Date.now() - bossStageStartMs) / 1000 : 999;
      if (bossElapsedSec <= 60) mTrack.mBossTimedKill = 1;
    }
    activeBoss = null;
    isBossStage = false;
    isMiniBossStage = false;
    bossStageStartMs = 0;
    if (!this.isMini) {
      if (!this.isFinalBoss) pendingBossCurse = true; // 최종 보스 후엔 저주 없음
    } else {
      for (let i = 0; i < 6; i++) {
        const ang = Math.random() * Math.PI * 2;
        gems.push(new Gem(this.x + Math.cos(ang) * 50, this.y + Math.sin(ang) * 50, this.xpValue * 2));
      }
      spawnGoldCoins(this.x, this.y, 8 + Math.floor(Math.random() * 5));
      addFloatingText(this.x, this.y - 80, LANG === 'en' ? '⚡ MINI BOSS DOWN!' : '⚡ MINI BOSS 처치!', '#ffe600', 16);
    }
    triggerStageClear();
  }
}

// 보스 발사체 클래스
class BossProjectile {
  constructor(x, y, vx, vy, damage, radius, color, homing) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.damage = damage; this.radius = radius; this.color = color;
    this.homing = homing;
    this.speed  = Math.sqrt(vx*vx + vy*vy);
    this.life   = homing ? 5000 : 3500;
  }
  update(dt) {
    if (this.homing && player) {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const d  = Math.sqrt(dx*dx + dy*dy);
      if (d > 0) {
        const tx = (dx/d) * this.speed;
        const ty = (dy/d) * this.speed;
        this.vx += (tx - this.vx) * 0.022 * (dt / 16.66);
        this.vy += (ty - this.vy) * 0.022 * (dt / 16.66);
      }
    }
    this.x += this.vx * (dt / 16.66);
    this.y += this.vy * (dt / 16.66);
    this.life -= dt;
  }
  draw(ctx, camera) {
    ctx.save();
    ctx.shadowBlur = 14; ctx.shadowColor = this.color;
    ctx.fillStyle  = this.color;
    ctx.beginPath();
    ctx.arc(this.x - camera.x, this.y - camera.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    if (this.homing) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.restore();
  }
}

