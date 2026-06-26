// ============================================================
// Daily Challenge exclusive enemies
// Requires: enemies.js (Enemy class, globals)
// ============================================================
// ============================================================
// 일일도전 전용: 영웅 적 (제3세력) — 스킬 4종 + 플레이어·적 동시 공격
// ============================================================
class DailyHeroEnemy {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.radius   = 18;
    this.hp       = 560; this.maxHp = 560;
    this.speed    = 2.3;
    this.level    = 1;
    this.xp       = 0; this.xpToNext = 40;
    this.flashTimer = 0;
    this._phase = 1; // 1=일반 2=격노(HP<50%) 3=절박(HP<25%)

    // ── 스킬 타이머 ──
    this._shootTimer = 0;   // 자동 사격 950ms
    this._dashCD     = 0;   // 돌진     4500ms
    this._burstCD    = 0;   // 범위폭발 8500ms
    this._grenadeCD  = 0;   // 수류탄   5500ms
    this._healCD     = 0;   // 자가회복 13000ms (HP<30% 트리거)

    this._isDashing = false; this._dashVx = 0; this._dashVy = 0; this._dashTime = 0;

    this._wanderX = x; this._wanderY = y; this._wanderTimer = 0;
    this._lastItemPickup = 0;
    this.heroLabel = '라이벌';

    // ── 동맹/배신 시스템 ──
    this._lastPlayerHitTime = Date.now(); // 플레이어가 마지막으로 공격한 시간
    this.isAlly          = false;
    this._allianceTimer  = 0;
    this._alliancePending = false;
    this._alliancePendingTimer = 0;
    this._betrayed       = false;
    this._passive    = false; // true: 도망 모드 (성장하는 추격자)
    this.isStageBoss = false; // true: 처치 시 스테이지 클리어

    // 등장 링 이펙트
    this._spawnX = x; this._spawnY = y;
    this._spawnRings = [
      { r:0, maxR:320, life:950, maxLife:950, delay:0   },
      { r:0, maxR:210, life:700, maxLife:700, delay:220 },
      { r:0, maxR:130, life:480, maxLife:480, delay:420 },
    ];
  }

  // 투사체 회피: 가까운 투사체의 반발력 계산
  _getDodge() {
    let px = 0, py = 0;
    for (const p of projectiles) {
      const dx = this.x - p.x, dy = this.y - p.y;
      const d  = Math.sqrt(dx*dx+dy*dy);
      if (d < 100 && d > 0) { const w = 1 - d/100; px += (dx/d)*w; py += (dy/d)*w; }
    }
    for (const bp of bossProjectiles) {
      const dx = this.x - bp.x, dy = this.y - bp.y;
      const d  = Math.sqrt(dx*dx+dy*dy);
      if (d < 85 && d > 0) { const w = 1 - d/85; px += (dx/d)*w*1.4; py += (dy/d)*w*1.4; }
    }
    const mag = Math.sqrt(px*px+py*py);
    return mag > 0.05 ? { dx: px/mag, dy: py/mag, s: Math.min(mag, 1) } : null;
  }

  // 공격 대상 결정: 동맹 중이면 적만, 배신 후엔 플레이어 우선
  _chooseTarget() {
    let nearEnemy = null, nearEnemyD = Infinity;
    let nearEnemyCount = 0;
    for (const e of enemies) {
      const d = dist(this.x, this.y, e.x, e.y);
      if (d < 520) nearEnemyCount++;
      if (d < nearEnemyD) { nearEnemyD = d; nearEnemy = e; }
    }
    if (activeBoss) {
      const d = dist(this.x, this.y, activeBoss.x, activeBoss.y);
      if (d < nearEnemyD) { nearEnemyD = d; nearEnemy = activeBoss; }
    }
    // 동맹 중: 플레이어를 절대 타겟하지 않음
    if (this.isAlly) {
      if (nearEnemy) return { target: nearEnemy, isEnemy: true, d: nearEnemyD };
      return null;
    }
    const pDist = player ? dist(this.x, this.y, player.x, player.y) : Infinity;
    // 배신 후: 플레이어를 최우선 타겟
    if (this._betrayed) {
      if (player) return { target: player, isPlayer: true, d: pDist };
    }
    // 일반: 적 3명 이상이면 적 우선, 적 적거나 플레이어가 더 가까우면 플레이어도 공격
    const attackPlayer = player && (
      nearEnemyCount === 0 ||
      (nearEnemyCount <= 2 && pDist < nearEnemyD * 1.25)
    );
    if (attackPlayer) return { target: player, isPlayer: true, d: pDist };
    if (nearEnemy)    return { target: nearEnemy, isEnemy: true, d: nearEnemyD };
    return null;
  }

  // 스킬: 범위 폭발 (적+플레이어 동시 피해)
  _useBurst() {
    const R = 135;
    for (const e of enemies) {
      if (dist(this.x, this.y, e.x, e.y) < R + e.radius) e.takeDamage(36, 'rival_burst');
    }
    if (activeBoss && dist(this.x, this.y, activeBoss.x, activeBoss.y) < R + activeBoss.radius)
      activeBoss.takeDamage(16, 'rival_burst');
    if (player && dist(this.x, this.y, player.x, player.y) < R + player.radius) {
      player.takeDamage(26); lastDamageSource = LANG === 'en' ? 'Hero Explosion' : '영웅 폭발';
    }
    // 시각 이펙트: 링 + 파티클
    heroBullets.push({ x:this.x, y:this.y, vx:0, vy:0, damage:0, radius:0, life:380, isBurstRing:true, maxR:R, r:0 });
    createExplosionParticles(this.x, this.y, '#ffe600', 18);
    addFloatingText(this.x, this.y - 42, '💥 BURST!', '#ffe600', 13);
    playSynthSound([220, 140], 0.22, 'sawtooth', 0.08);
  }

  // 스킬: 수류탄 발사
  _launchGrenade(tx, ty) {
    const dx = tx - this.x, dy = ty - this.y;
    const d  = Math.sqrt(dx*dx+dy*dy) || 1;
    heroBullets.push({
      x: this.x, y: this.y,
      vx: (dx/d)*4.0, vy: (dy/d)*4.0,
      damage: 32, radius: 8, life: 1050,
      isGrenade: true, explodeR: 105
    });
    addFloatingText(this.x, this.y - 28, '💣', '#ff8800', 14);
  }

  update(dt) {
    if (this.flashTimer > 0) this.flashTimer -= dt;

    // ── 도망 모드 (추격자: 각성 전엔 도망) ──
    if (this._passive) {
      if (this.level >= 5) {
        this._passive = false;
        this.speed = 2.4;
        addFloatingText(this.x, this.y - 55, LANG === 'en' ? '👁 Pursuer Awakened!' : '👁 추격자 각성!', '#ff4466', 14);
        createExplosionParticles(this.x, this.y, '#ff4466', 18);
        triggerScreenShake(6, 350);
        playSynthSound([200, 300, 500], 0.18, 'triangle', 0.08);
      } else {
        if (player) {
          const dx = this.x - player.x, dy = this.y - player.y;
          const d  = Math.sqrt(dx*dx+dy*dy) || 1;
          const fl = d < 500 ? 1.2 : 0.3;
          this.x += (dx/d)*this.speed*fl*(dt/16.66);
          this.y += (dy/d)*this.speed*fl*(dt/16.66);
          this.x = Math.max(this.radius, Math.min(MAP_WIDTH-this.radius, this.x));
          this.y = Math.max(this.radius, Math.min(MAP_HEIGHT-this.radius, this.y));
        }
        for (let i = gems.length-1; i >= 0; i--) {
          if (dist(this.x, this.y, gems[i].x, gems[i].y) < this.radius+12) {
            this.xp += gems[i].value; gems.splice(i, 1);
            if (this.xp >= this.xpToNext) {
              this.xp -= this.xpToNext; this.level++;
              this.xpToNext = Math.floor(this.xpToNext*1.28);
              this.maxHp += 40; this.hp = Math.min(this.hp+55, this.maxHp);
            }
          }
        }
        if (this._spawnRings) {
          for (let i = this._spawnRings.length-1; i >= 0; i--) {
            const ring = this._spawnRings[i];
            if (ring.delay > 0) { ring.delay -= dt; continue; }
            ring.life -= dt;
            ring.r = ring.maxR * (1 - ring.life/ring.maxLife);
            if (ring.life <= 0) this._spawnRings.splice(i, 1);
          }
          if (this._spawnRings.length === 0) this._spawnRings = null;
        }
        return;
      }
    }

    // ── 동맹/배신 상태 머신 ──
    if (!this.isAlly && !this._alliancePending) {
      // 28초간 플레이어가 공격하지 않으면 동맹 제안
      if (Date.now() - this._lastPlayerHitTime > 28000) {
        this._alliancePending = true;
        this._alliancePendingTimer = 0;
        showStageOverlay('🤝 동맹 제안', `${this.heroLabel}이(가) 동맹을 제안합니다! (자동 수락)`, '#39ff14');
        setTimeout(hideStageOverlay, 3500);
      }
    }
    if (this._alliancePending) {
      this._alliancePendingTimer += dt;
      // 5초 후 자동 수락
      if (this._alliancePendingTimer >= 5000) {
        this.isAlly = true;
        this._alliancePending = false;
        this._allianceTimer = 35000;
        addFloatingText(this.x, this.y - 55, LANG === 'en' ? '🤝 Alliance Formed!' : '🤝 동맹 체결!', '#39ff14', 15);
        playSynthSound([400, 600, 800, 600], 0.15, 'sine', 0.07);
      }
    }
    if (this.isAlly) {
      this._allianceTimer -= dt;
      // 마지막 5초: 경고 플래시
      if (this._allianceTimer <= 5000 && this._allianceTimer > 0) {
        if (Math.floor(this._allianceTimer / 400) % 2 === 0)
          addFloatingText(this.x, this.y - 50, LANG === 'en' ? '⚠ Betrayal Imminent!' : '⚠ 배신 임박!', '#ff8800', 11);
      }
      if (this._allianceTimer <= 0) {
        // 배신!
        this.isAlly = false;
        this._betrayed = true;
        this.speed = Math.min(this.speed * 1.3, 4.0);
        this.maxHp = Math.floor(this.maxHp * 1.25);
        this.hp    = Math.min(this.hp + 130, this.maxHp);
        this._lastPlayerHitTime = Date.now(); // 재제안 방지
        showStageOverlay('💀 ' + (LANG === 'en' ? 'BETRAYAL!' : '배신!'), LANG === 'en' ? `${this.heroLabel} has betrayed you!` : `${this.heroLabel}이(가) 배신했습니다!`, '#ff4466');
        setTimeout(hideStageOverlay, 2800);
        triggerScreenShake(9, 450);
        createExplosionParticles(this.x, this.y, '#ff4466', 20);
        addFloatingText(this.x, this.y - 60, LANG === 'en' ? '💀 BETRAYAL!' : '💀 배신!', '#ff4466', 18);
        playSynthSound([120, 80, 60], 0.28, 'sawtooth', 0.13);
      }
    }

    // 등장 링 업데이트
    if (this._spawnRings) {
      for (let i = this._spawnRings.length - 1; i >= 0; i--) {
        const ring = this._spawnRings[i];
        if (ring.delay > 0) { ring.delay -= dt; continue; }
        ring.life -= dt;
        ring.r = ring.maxR * (1 - ring.life / ring.maxLife);
        if (ring.life <= 0) this._spawnRings.splice(i, 1);
      }
      if (this._spawnRings.length === 0) this._spawnRings = null;
    }

    // 페이즈 전환
    const hpR = this.hp / this.maxHp;
    if (hpR < 0.25 && this._phase < 3) {
      this._phase = 3;
      addFloatingText(this.x, this.y - 52, '⚔ RIVAL: DESPERATE!', '#ff4466', 13);
    } else if (hpR < 0.50 && this._phase < 2) {
      this._phase = 2; this.speed = 2.6;
      addFloatingText(this.x, this.y - 52, '⚔ RIVAL: ENRAGED!', '#ff8800', 12);
    }

    // 자가 회복 (HP 30% 미만, 13초 쿨)
    this._healCD = Math.max(0, this._healCD - dt);
    if (hpR < 0.30 && this._healCD <= 0) {
      this.hp = Math.min(this.maxHp, this.hp + 115);
      this._healCD = 13000;
      createExplosionParticles(this.x, this.y, '#39ff14', 10);
      addFloatingText(this.x, this.y - 36, '💚 HEAL!', '#39ff14', 12);
    }

    // 절박 도주 (HP 25% 미만 + 회복 대기 중)
    if (hpR < 0.25 && this._healCD > 10000 && player) {
      const dx = this.x - player.x, dy = this.y - player.y;
      const d  = Math.sqrt(dx*dx+dy*dy) || 1;
      this.x += (dx/d) * this.speed * 1.5 * (dt/16.66);
      this.y += (dy/d) * this.speed * 1.5 * (dt/16.66);
      this.x = Math.max(this.radius, Math.min(MAP_WIDTH-this.radius, this.x));
      this.y = Math.max(this.radius, Math.min(MAP_HEIGHT-this.radius, this.y));
      return;
    }

    // ── 돌진 처리 ──
    this._dashCD = Math.max(0, this._dashCD - dt);
    if (this._isDashing) {
      this._dashTime -= dt;
      this.x += this._dashVx * (dt/16.66);
      this.y += this._dashVy * (dt/16.66);
      if (player && dist(this.x, this.y, player.x, player.y) < this.radius + player.radius) {
        player.takeDamage(24); lastDamageSource = LANG === 'en' ? 'Hero Charge' : '영웅 돌진';
        this._isDashing = false;
      }
      for (const e of enemies) {
        if (dist(this.x, this.y, e.x, e.y) < this.radius + e.radius)
          e.takeDamage(40, 'rival_dash');
      }
      if (this._dashTime <= 0) this._isDashing = false;
      this.x = Math.max(this.radius, Math.min(MAP_WIDTH-this.radius, this.x));
      this.y = Math.max(this.radius, Math.min(MAP_HEIGHT-this.radius, this.y));
      return;
    }

    // ── 이동 ──
    const dodge  = this._getDodge();
    const target = this._chooseTarget();

    // 가장 가까운 젬 (적/플레이어 없을 때 우선 탐색)
    let nearGem = null, gemD = Infinity;
    for (const g of gems) {
      const d = dist(this.x, this.y, g.x, g.y);
      if (d < gemD) { gemD = d; nearGem = g; }
    }

    let mx = 0, my = 0;
    if (dodge && dodge.s > 0.28) {
      mx = dodge.dx * 1.5; my = dodge.dy * 1.5;
    } else if (target) {
      const ddx = target.target.x - this.x, ddy = target.target.y - this.y;
      const dd  = Math.sqrt(ddx*ddx+ddy*ddy) || 1;
      if (target.d > 80) {
        // 사선 이동 (사인파 스트레이프)
        const strafe = Math.sin(Date.now() * 0.0017) * 0.42;
        mx = (ddx/dd)*0.88 + (-ddy/dd)*strafe;
        my = (ddy/dd)*0.88 + ( ddx/dd)*strafe;
      } else {
        mx = -(ddx/dd)*0.35; my = -(ddy/dd)*0.35;
      }
      // 회피 보조
      if (dodge) { mx += dodge.dx*dodge.s*1.1; my += dodge.dy*dodge.s*1.1; }
    } else if (nearGem && gemD < 400) {
      const dx = nearGem.x - this.x, dy = nearGem.y - this.y;
      const d  = Math.sqrt(dx*dx+dy*dy) || 1;
      mx = dx/d; my = dy/d;
    } else {
      this._wanderTimer -= dt;
      if (this._wanderTimer <= 0) {
        this._wanderX = 200 + Math.random()*(MAP_WIDTH-400);
        this._wanderY = 200 + Math.random()*(MAP_HEIGHT-400);
        this._wanderTimer = 2500 + Math.random()*2000;
      }
      const dx = this._wanderX-this.x, dy = this._wanderY-this.y;
      const d  = Math.sqrt(dx*dx+dy*dy) || 1;
      mx = dx/d; my = dy/d;
    }

    const mag = Math.sqrt(mx*mx+my*my) || 1;
    this.x += (mx/mag)*this.speed*(dt/16.66);
    this.y += (my/mag)*this.speed*(dt/16.66);
    this.x = Math.max(this.radius, Math.min(MAP_WIDTH-this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(MAP_HEIGHT-this.radius, this.y));

    // ── 스킬 쿨다운 감소 ──
    this._burstCD   = Math.max(0, this._burstCD   - dt);
    this._grenadeCD = Math.max(0, this._grenadeCD - dt);

    if (target) {
      // 범위 폭발: 타겟이 135px 이내
      if (this._burstCD <= 0 && target.d < 135) {
        this._useBurst(); this._burstCD = 8500;
      }
      // 돌진: 타겟 200~460px
      if (this._dashCD <= 0 && target.d > 195 && target.d < 460) {
        this._isDashing = true; this._dashTime = 270;
        const ddx = target.target.x-this.x, ddy = target.target.y-this.y;
        const dd  = Math.sqrt(ddx*ddx+ddy*ddy) || 1;
        this._dashVx = (ddx/dd)*8.8; this._dashVy = (ddy/dd)*8.8;
        this._dashCD = 4500;
        addFloatingText(this.x, this.y-28, '⚡ DASH!', '#ffe600', 11);
        playSynthSound([400, 600], 0.14, 'square', 0.05);
      }
      // 수류탄: 타겟 240~470px
      if (this._grenadeCD <= 0 && target.d > 235 && target.d < 470) {
        this._launchGrenade(target.target.x, target.target.y);
        this._grenadeCD = 5500;
      }
    }

    // ── 자동 사격 (950ms) ──
    this._shootTimer += dt;
    if (target && target.d < 480 && this._shootTimer >= 950) {
      this._shootTimer = 0;
      const ddx = target.target.x-this.x, ddy = target.target.y-this.y;
      const dd  = Math.sqrt(ddx*ddx+ddy*ddy) || 1;
      const sp = 0.055; // 조준 흔들림
      heroBullets.push({
        x: this.x, y: this.y,
        vx: (ddx/dd + (Math.random()-0.5)*sp)*7.0,
        vy: (ddy/dd + (Math.random()-0.5)*sp)*7.0,
        damage: target.isPlayer ? 15 : 22,
        radius: 6, life: 1250,
        hitsPlayer: !!target.isPlayer
      });
    }

    // ── 젬 수집 ──
    for (let i = gems.length - 1; i >= 0; i--) {
      if (dist(this.x, this.y, gems[i].x, gems[i].y) < this.radius + 12) {
        this.xp += gems[i].value;
        gems.splice(i, 1);
        if (this.xp >= this.xpToNext) {
          this.xp -= this.xpToNext; this.level++;
          this.xpToNext = Math.floor(this.xpToNext*1.28);
          this.maxHp += 55; this.hp = Math.min(this.hp+75, this.maxHp);
          addFloatingText(this.x, this.y-36, `⚔ RIVAL LV.${this.level}!`, '#ffe600', 12);
        }
      }
    }

    // ── 필드 아이템 강탈 ──
    const now = Date.now();
    if (now - this._lastItemPickup > 380) {
      for (let i = fieldItems.length - 1; i >= 0; i--) {
        if (dist(this.x, this.y, fieldItems[i].x, fieldItems[i].y) < this.radius + 16) {
          this.hp = Math.min(this.maxHp, this.hp + 70);
          fieldItems.splice(i, 1);
          this._lastItemPickup = now;
          addFloatingText(this.x, this.y-26, '📦 STOLEN!', '#00f0ff', 10);
          break;
        }
      }
    }

    // ── 적 접촉 피해 ──
    for (const e of enemies) {
      if (dist(this.x, this.y, e.x, e.y) < this.radius + e.radius) {
        this.hp -= e.damage * (dt/1000) * 0.38;
        this.flashTimer = 100;
      }
    }
  }

  takeDamage(dmg, fromPlayer = false) {
    // 동맹 중엔 플레이어 공격 무효 (플레이어가 배신 시 즉시 동맹 해제)
    if (this.isAlly && fromPlayer) {
      this.isAlly = false;
      this._allianceTimer = 0;
      addFloatingText(this.x, this.y - 42, LANG === 'en' ? '⚡ Alliance Broken!' : '⚡ 동맹 파기!', '#ff8800', 13);
      this._lastPlayerHitTime = Date.now();
      return; // 피해 없이 동맹만 해제
    }
    this.hp -= dmg;
    this.flashTimer = 200;
    if (fromPlayer) this._lastPlayerHitTime = Date.now(); // 공격 시 재제안 타이머 리셋
    if (this._alliancePending && fromPlayer) this._alliancePending = false; // 제안 취소

    if (this.hp <= 0) {
      for (let i = 0; i < 12; i++) {
        const a = Math.random()*Math.PI*2;
        gems.push(new Gem(this.x+Math.cos(a)*40, this.y+Math.sin(a)*40, 5));
      }
      createExplosionParticles(this.x, this.y, '#ffe600', 22);
      addFloatingText(this.x, this.y-48, `⚔ ${this.heroLabel} DEFEATED`, '#ffe600', 17);
      playSynthSound([800, 400, 200], 0.24, 'sawtooth', 0.11);
      triggerScreenShake(5, 300);
      if (this.isStageBoss) {
        spawnGoldCoins(this.x, this.y, 8 + _bountyLevel * 2);
        setTimeout(() => { if (gameState === STATE_PLAYING) triggerStageClear(); }, 800);
      }
      const idx = dailyHeroes.indexOf(this);
      if (idx !== -1) dailyHeroes.splice(idx, 1);
    }
  }

  draw(ctx, camera) {
    // 등장 링
    if (this._spawnRings) {
      for (const ring of this._spawnRings) {
        if (ring.delay > 0 || ring.r <= 2) continue;
        const alpha = (ring.life / ring.maxLife) * 0.72;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.shadowBlur = 30; ctx.shadowColor = '#ffe600';
        ctx.strokeStyle = '#ffe600'; ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.arc(this._spawnX - camera.x, this._spawnY - camera.y, ring.r, 0, Math.PI*2);
        ctx.stroke();
        ctx.restore();
      }
    }

    const bx = this.x - camera.x, by = this.y - camera.y;
    const r  = this.radius;
    const fl = this.flashTimer > 0;
    const cc = this.isAlly ? '#39ff14' :
               this._betrayed ? '#ff0044' :
               this._phase === 3 ? '#ff4466' : this._phase === 2 ? '#ff8800' : '#ffe600';

    ctx.save();
    ctx.shadowBlur = this._phase >= 2 ? 32 : 22;
    ctx.shadowColor = cc;

    // 다이아몬드 몸체
    ctx.beginPath();
    ctx.moveTo(bx, by-r); ctx.lineTo(bx+r, by);
    ctx.lineTo(bx, by+r); ctx.lineTo(bx-r, by);
    ctx.closePath();
    ctx.fillStyle   = fl ? '#ffffff' : cc; ctx.fill();
    ctx.strokeStyle = '#fff8dc'; ctx.lineWidth = 2; ctx.stroke();

    // 내부 십자
    ctx.shadowBlur  = 0;
    ctx.strokeStyle = fl ? cc : 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx, by-r*0.55); ctx.lineTo(bx, by+r*0.55);
    ctx.moveTo(bx-r*0.55, by); ctx.lineTo(bx+r*0.55, by);
    ctx.stroke();

    // 돌진 잔상
    if (this._isDashing) {
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = cc;
      [1.5, 3, 4.5].forEach((m, i) => {
        ctx.beginPath();
        ctx.arc(bx-this._dashVx*m, by-this._dashVy*m, r*(0.7-i*0.15), 0, Math.PI*2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    ctx.shadowBlur = 0;
    ctx.font = 'bold 8px Orbitron, monospace';
    ctx.fillStyle = cc; ctx.textAlign = 'center';
    const statusTag = this.isAlly ? ' 🤝' : this._betrayed ? ' 💀' : '';
    ctx.fillText(`⚔ ${this.heroLabel}  Lv.${this.level}${statusTag}`, bx, by-r-7);

    const bw = 46, bh = 4, ratio = Math.max(0, this.hp/this.maxHp);
    const hcol = ratio > 0.5 ? '#39ff14' : ratio > 0.25 ? '#ffe600' : '#ff4466';
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(bx-bw/2-1, by+r+4, bw+2, bh+2);
    ctx.fillStyle = hcol;
    ctx.fillRect(bx-bw/2, by+r+5, bw*ratio, bh);

    ctx.restore();
  }
}

// ============================================================

// ============================================================
// 일일도전 10스테이지: 저격수 라이벌 (시안, 장거리)
// ============================================================
class DailyRivalSniper {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.radius  = 14;
    this.hp      = 440; this.maxHp = 440;
    this.speed   = 1.5;
    this.level   = 1; this.xp = 0; this.xpToNext = 50;
    this.flashTimer = 0;
    this.heroLabel   = '저격수';
    this.isStageBoss = false;
    this._spawnX = x; this._spawnY = y;
    this._shootTimer  = 0;
    this._sniperCD    = 0;
    this._teleportCD  = 0;
    this._wanderTimer = 0;
    this._wanderX = x; this._wanderY = y;
    this._lastPlayerHitTime = Date.now();
    this._spawnRings = [
      { r:0, maxR:280, life:800, maxLife:800, delay:0   },
      { r:0, maxR:160, life:550, maxLife:550, delay:200 },
    ];
  }
  _chooseTarget() {
    let nearEnemy = null, nearEnemyD = Infinity;
    for (const e of enemies) {
      const d = dist(this.x, this.y, e.x, e.y);
      if (d < nearEnemyD) { nearEnemyD = d; nearEnemy = e; }
    }
    if (activeBoss) {
      const d = dist(this.x, this.y, activeBoss.x, activeBoss.y);
      if (d < nearEnemyD) { nearEnemyD = d; nearEnemy = activeBoss; }
    }
    const pDist = player ? dist(this.x, this.y, player.x, player.y) : Infinity;
    if (player && (nearEnemyD === Infinity || pDist < 750)) return { target: player, isPlayer: true, d: pDist };
    if (nearEnemy) return { target: nearEnemy, isEnemy: true, d: nearEnemyD };
    return null;
  }
  update(dt) {
    if (this.flashTimer > 0) this.flashTimer -= dt;
    if (this._spawnRings) {
      for (let i = this._spawnRings.length-1; i >= 0; i--) {
        const ring = this._spawnRings[i];
        if (ring.delay > 0) { ring.delay -= dt; continue; }
        ring.life -= dt; ring.r = ring.maxR*(1-ring.life/ring.maxLife);
        if (ring.life <= 0) this._spawnRings.splice(i, 1);
      }
      if (this._spawnRings.length === 0) this._spawnRings = null;
    }
    const target = this._chooseTarget();
    const tDist  = target?.d ?? Infinity;
    const PREF = 540;
    let mx = 0, my = 0;
    if (target) {
      const ddx = target.target.x-this.x, ddy = target.target.y-this.y;
      const dd  = Math.sqrt(ddx*ddx+ddy*ddy)||1;
      if (tDist < PREF-100)       { mx = -ddx/dd*1.2; my = -ddy/dd*1.2; }
      else if (tDist > PREF+100)  { mx =  ddx/dd; my =  ddy/dd; }
      else                         { mx = -ddy/dd*0.8; my = ddx/dd*0.8; }
    } else {
      this._wanderTimer -= dt;
      if (this._wanderTimer <= 0) {
        this._wanderX = 200+Math.random()*(MAP_WIDTH-400);
        this._wanderY = 200+Math.random()*(MAP_HEIGHT-400);
        this._wanderTimer = 3000+Math.random()*2000;
      }
      const dx = this._wanderX-this.x, dy = this._wanderY-this.y;
      const d  = Math.sqrt(dx*dx+dy*dy)||1; mx = dx/d; my = dy/d;
    }
    const mag = Math.sqrt(mx*mx+my*my)||1;
    this.x += (mx/mag)*this.speed*(dt/16.66);
    this.y += (my/mag)*this.speed*(dt/16.66);
    this.x = Math.max(this.radius, Math.min(MAP_WIDTH-this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(MAP_HEIGHT-this.radius, this.y));
    this._sniperCD   = Math.max(0, this._sniperCD-dt);
    this._teleportCD = Math.max(0, this._teleportCD-dt);
    if (target && tDist < 750) {
      if (this._sniperCD <= 0) {
        const ddx = target.target.x-this.x, ddy = target.target.y-this.y;
        const dd  = Math.sqrt(ddx*ddx+ddy*ddy)||1;
        heroBullets.push({ x:this.x, y:this.y, vx:(ddx/dd)*13.5, vy:(ddy/dd)*13.5,
          damage: target.isPlayer ? 28 : 38, radius:5, life:1400,
          hitsPlayer:!!target.isPlayer, isSniper:true });
        addFloatingText(this.x, this.y-28, '🎯 SNIPE!', '#00ccff', 11);
        this._sniperCD = 3500; this._shootTimer = -800;
      }
      this._shootTimer += dt;
      if (this._shootTimer >= 2200) {
        this._shootTimer = 0;
        const ddx = target.target.x-this.x, ddy = target.target.y-this.y;
        const dd  = Math.sqrt(ddx*ddx+ddy*ddy)||1;
        heroBullets.push({ x:this.x, y:this.y,
          vx:(ddx/dd+(Math.random()-0.5)*0.04)*9.5,
          vy:(ddy/dd+(Math.random()-0.5)*0.04)*9.5,
          damage: target.isPlayer ? 22 : 30, radius:5, life:1300,
          hitsPlayer:!!target.isPlayer, isSniper:true });
      }
      if (this._teleportCD <= 0 && tDist < 200) {
        const a = Math.random()*Math.PI*2;
        const px = player?.x ?? this.x, py = player?.y ?? this.y;
        this.x = Math.max(100, Math.min(MAP_WIDTH-100, px+Math.cos(a)*550));
        this.y = Math.max(100, Math.min(MAP_HEIGHT-100, py+Math.sin(a)*550));
        createExplosionParticles(this.x, this.y, '#00ccff', 14);
        addFloatingText(this.x, this.y-36, '⚡ BLINK!', '#00ccff', 12);
        this._teleportCD = 6500;
      }
    }
    for (let i = gems.length-1; i >= 0; i--) {
      if (dist(this.x, this.y, gems[i].x, gems[i].y) < this.radius+12) {
        this.xp += gems[i].value; gems.splice(i, 1);
        if (this.xp >= this.xpToNext) {
          this.xp -= this.xpToNext; this.level++;
          this.xpToNext = Math.floor(this.xpToNext*1.28);
          this.maxHp += 45; this.hp = Math.min(this.hp+60, this.maxHp);
          addFloatingText(this.x, this.y-36, LANG === 'en' ? `🎯 SNIPER LV.${this.level}!` : `🎯 저격수 LV.${this.level}!`, '#00ccff', 11);
        }
      }
    }
    for (const e of enemies) {
      if (dist(this.x, this.y, e.x, e.y) < this.radius+e.radius)
        this.hp -= e.damage*(dt/1000)*0.3;
    }
  }
  takeDamage(dmg, fromPlayer = false) {
    this.hp -= dmg; this.flashTimer = 180;
    if (fromPlayer) this._lastPlayerHitTime = Date.now();
    if (this.hp <= 0) {
      for (let i=0; i<10; i++) { const a = Math.random()*Math.PI*2; gems.push(new Gem(this.x+Math.cos(a)*36, this.y+Math.sin(a)*36, 5)); }
      createExplosionParticles(this.x, this.y, '#00ccff', 18);
      addFloatingText(this.x, this.y-46, LANG === 'en' ? '🎯 SNIPER DOWN!' : '🎯 저격수 격파!', '#00ccff', 16);
      triggerScreenShake(4, 250);
      if (this.isStageBoss) {
        spawnGoldCoins(this.x, this.y, 8 + _bountyLevel * 2);
        setTimeout(() => { if (gameState === STATE_PLAYING) triggerStageClear(); }, 800);
      }
      const idx = dailyHeroes.indexOf(this); if (idx !== -1) dailyHeroes.splice(idx, 1);
    }
  }
  draw(ctx, camera) {
    if (this._spawnRings) {
      for (const ring of this._spawnRings) {
        if (ring.delay > 0 || ring.r <= 2) continue;
        ctx.save(); ctx.globalAlpha = (ring.life/ring.maxLife)*0.65;
        ctx.shadowBlur = 25; ctx.shadowColor = '#00ccff';
        ctx.strokeStyle = '#00ccff'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(this._spawnX-camera.x, this._spawnY-camera.y, ring.r, 0, Math.PI*2); ctx.stroke();
        ctx.restore();
      }
    }
    const bx = this.x-camera.x, by = this.y-camera.y, r = this.radius;
    const fl = this.flashTimer > 0;
    ctx.save(); ctx.shadowBlur = 20; ctx.shadowColor = '#00ccff';
    ctx.beginPath();
    ctx.moveTo(bx, by-r*1.3); ctx.lineTo(bx+r*0.7, by+r*0.6);
    ctx.lineTo(bx, by+r*0.1); ctx.lineTo(bx-r*0.7, by+r*0.6);
    ctx.closePath();
    ctx.fillStyle = fl ? '#ffffff' : '#00ccff'; ctx.fill();
    ctx.strokeStyle = '#aaffff'; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.shadowBlur = 0; ctx.font = 'bold 8px Orbitron, monospace';
    ctx.fillStyle = '#00ccff'; ctx.textAlign = 'center';
    ctx.fillText(`🎯 저격수  Lv.${this.level}`, bx, by-r-12);
    const bw = 42, bh = 4, ratio = Math.max(0, this.hp/this.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(bx-bw/2-1, by+r+4, bw+2, bh+2);
    ctx.fillStyle = ratio > 0.5 ? '#00ccff' : ratio > 0.25 ? '#ffe600' : '#ff4466';
    ctx.fillRect(bx-bw/2, by+r+5, bw*ratio, bh); ctx.restore();
  }
}

// ============================================================
// 일일도전 15스테이지: 광전사 라이벌 (마젠타, 근접 특화)
// ============================================================
class DailyRivalBerserker {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.radius  = 20;
    this.hp      = 950; this.maxHp = 950;
    this.speed   = 3.5;
    this.level   = 1; this.xp = 0; this.xpToNext = 60;
    this.flashTimer = 0;
    this.heroLabel   = '광전사';
    this.isStageBoss = false;
    this._spinCD    = 0;
    this._slamCD    = 0;
    this._slamWarn  = false;
    this._slamWarnX = 0; this._slamWarnY = 0; this._slamWarnTimer = 0;
    this._rageMode  = false;
    this._lastPlayerHitTime = Date.now();
    this._spawnRings = [{ r:0, maxR:360, life:900, maxLife:900, delay:0 }];
  }
  _melee(cx, cy, radius, dmgEnemy, dmgPlayer) {
    for (const e of [...enemies]) {
      if (dist(cx, cy, e.x, e.y) < radius+e.radius) e.takeDamage(dmgEnemy, 'rival_melee');
    }
    if (activeBoss && dist(cx, cy, activeBoss.x, activeBoss.y) < radius+activeBoss.radius)
      activeBoss.takeDamage(Math.floor(dmgEnemy*0.25), 'rival_melee');
    if (player && dist(cx, cy, player.x, player.y) < radius+player.radius) {
      player.takeDamage(dmgPlayer); lastDamageSource = LANG === 'en' ? 'Berserker Attack' : '광전사 공격';
    }
  }
  update(dt) {
    if (this.flashTimer > 0) this.flashTimer -= dt;
    if (this._spawnRings) {
      for (let i = this._spawnRings.length-1; i >= 0; i--) {
        const ring = this._spawnRings[i];
        if (ring.delay > 0) { ring.delay -= dt; continue; }
        ring.life -= dt; ring.r = ring.maxR*(1-ring.life/ring.maxLife);
        if (ring.life <= 0) this._spawnRings.splice(i, 1);
      }
      if (this._spawnRings.length === 0) this._spawnRings = null;
    }
    if (!this._rageMode && this.hp/this.maxHp < 0.35) {
      this._rageMode = true; this.speed = 5.2;
      addFloatingText(this.x, this.y-55, '💀 BERSERKER RAGE!', '#ff2255', 14);
      createExplosionParticles(this.x, this.y, '#ff2255', 20);
      playSynthSound([100, 60], 0.28, 'sawtooth', 0.12);
    }
    const pDist = player ? dist(this.x, this.y, player.x, player.y) : Infinity;
    let nearEnemy = null, nearEnemyD = Infinity;
    for (const e of enemies) {
      const d = dist(this.x, this.y, e.x, e.y);
      if (d < nearEnemyD) { nearEnemyD = d; nearEnemy = e; }
    }
    let tx, ty;
    if (this._rageMode && player)              { tx = player.x; ty = player.y; }
    else if (player && nearEnemyD > pDist*0.8) { tx = player.x; ty = player.y; }
    else if (nearEnemy)                        { tx = nearEnemy.x; ty = nearEnemy.y; }
    else if (player)                           { tx = player.x; ty = player.y; }
    else                                       { tx = this.x; ty = this.y; }
    if (!this._slamWarn) {
      const ddx = tx-this.x, ddy = ty-this.y;
      const dd = Math.sqrt(ddx*ddx+ddy*ddy)||1;
      this.x += (ddx/dd)*this.speed*(dt/16.66);
      this.y += (ddy/dd)*this.speed*(dt/16.66);
      this.x = Math.max(this.radius, Math.min(MAP_WIDTH-this.radius, this.x));
      this.y = Math.max(this.radius, Math.min(MAP_HEIGHT-this.radius, this.y));
    }
    this._spinCD = Math.max(0, this._spinCD-dt);
    this._slamCD = Math.max(0, this._slamCD-dt);
    if (this._spinCD <= 0 && (nearEnemyD < 140 || pDist < 130)) {
      this._melee(this.x, this.y, 130, 38, 28);
      heroBullets.push({ x:this.x, y:this.y, vx:0, vy:0, damage:0, radius:0, life:300, isBurstRing:true, maxR:130, r:0 });
      addFloatingText(this.x, this.y-38, '⚔ SPIN!', '#ff2255', 12);
      this._spinCD = 1500;
    }
    if (this._slamCD <= 0 && !this._slamWarn && player && pDist < 400 && pDist > 60) {
      this._slamWarn = true;
      this._slamWarnX = player.x; this._slamWarnY = player.y; this._slamWarnTimer = 700;
      addFloatingText(player.x, player.y-30, '⚠', '#ff2255', 18);
    }
    if (this._slamWarn) {
      this._slamWarnTimer -= dt;
      if (this._slamWarnTimer <= 0) {
        this.x = this._slamWarnX; this.y = this._slamWarnY;
        this._melee(this.x, this.y, 145, 55, 40);
        createExplosionParticles(this.x, this.y, '#ff2255', 18);
        triggerScreenShake(7, 350);
        heroBullets.push({ x:this.x, y:this.y, vx:0, vy:0, damage:0, radius:0, life:350, isBurstRing:true, maxR:145, r:0 });
        this._slamWarn = false; this._slamCD = 5000;
      }
    }
    for (let i = gems.length-1; i >= 0; i--) {
      if (dist(this.x, this.y, gems[i].x, gems[i].y) < this.radius+14) {
        this.xp += gems[i].value; gems.splice(i, 1);
        if (this.xp >= this.xpToNext) {
          this.xp -= this.xpToNext; this.level++;
          this.xpToNext = Math.floor(this.xpToNext*1.28);
          this.maxHp += 80; this.hp = Math.min(this.hp+100, this.maxHp);
          addFloatingText(this.x, this.y-38, LANG === 'en' ? `💀 BERSERKER LV.${this.level}!` : `💀 광전사 LV.${this.level}!`, '#ff2255', 11);
        }
      }
    }
    for (const e of enemies) {
      if (dist(this.x, this.y, e.x, e.y) < this.radius+e.radius)
        this.hp -= e.damage*(dt/1000)*0.22;
    }
  }
  takeDamage(dmg, fromPlayer = false) {
    this.hp -= dmg; this.flashTimer = 220;
    if (fromPlayer) this._lastPlayerHitTime = Date.now();
    if (this.hp <= 0) {
      for (let i=0; i<14; i++) { const a = Math.random()*Math.PI*2; gems.push(new Gem(this.x+Math.cos(a)*48, this.y+Math.sin(a)*48, 6)); }
      createExplosionParticles(this.x, this.y, '#ff2255', 26);
      addFloatingText(this.x, this.y-50, LANG === 'en' ? '💀 BERSERKER DOWN!' : '💀 광전사 격파!', '#ff2255', 17);
      triggerScreenShake(8, 400);
      playSynthSound([200, 100, 50], 0.3, 'sawtooth', 0.14);
      if (this.isStageBoss) {
        spawnGoldCoins(this.x, this.y, 8 + _bountyLevel * 2);
        setTimeout(() => { if (gameState === STATE_PLAYING) triggerStageClear(); }, 800);
      }
      const idx = dailyHeroes.indexOf(this); if (idx !== -1) dailyHeroes.splice(idx, 1);
    }
  }
  draw(ctx, camera) {
    if (this._spawnRings) {
      for (const ring of this._spawnRings) {
        if (ring.delay > 0 || ring.r <= 2) continue;
        ctx.save(); ctx.globalAlpha = (ring.life/ring.maxLife)*0.7;
        ctx.shadowBlur = 30; ctx.shadowColor = '#ff2255';
        ctx.strokeStyle = '#ff2255'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(this.x-camera.x, this.y-camera.y, ring.r, 0, Math.PI*2); ctx.stroke();
        ctx.restore();
      }
    }
    if (this._slamWarn) {
      ctx.save();
      const p = 1-this._slamWarnTimer/700;
      ctx.globalAlpha = 0.35+p*0.4; ctx.shadowBlur = 22; ctx.shadowColor = '#ff2255';
      ctx.strokeStyle = '#ff2255'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(this._slamWarnX-camera.x, this._slamWarnY-camera.y, 145*p, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    }
    const bx = this.x-camera.x, by = this.y-camera.y, r = this.radius;
    const fl = this.flashTimer > 0;
    const cc = this._rageMode ? '#ff0033' : '#ff2255';
    ctx.save(); ctx.shadowBlur = this._rageMode ? 42 : 26; ctx.shadowColor = cc;
    const spikes = 8;
    ctx.beginPath();
    for (let i = 0; i < spikes*2; i++) {
      const a  = (i/(spikes*2))*Math.PI*2 - Math.PI/2;
      const ir = i%2===0 ? r*1.1 : r*0.55;
      i===0 ? ctx.moveTo(bx+Math.cos(a)*ir, by+Math.sin(a)*ir)
            : ctx.lineTo(bx+Math.cos(a)*ir, by+Math.sin(a)*ir);
    }
    ctx.closePath();
    ctx.fillStyle = fl ? '#ffffff' : cc; ctx.fill();
    ctx.strokeStyle = '#ffaacc'; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.shadowBlur = 0; ctx.font = 'bold 8px Orbitron, monospace';
    ctx.fillStyle = cc; ctx.textAlign = 'center';
    ctx.fillText(`💀 광전사  Lv.${this.level}${this._rageMode?' 🔥':''}`, bx, by-r-12);
    const bw = 46, bh = 4, ratio = Math.max(0, this.hp/this.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(bx-bw/2-1, by+r+4, bw+2, bh+2);
    ctx.fillStyle = ratio > 0.5 ? '#ff2255' : ratio > 0.25 ? '#ffe600' : '#ff4466';
    ctx.fillRect(bx-bw/2, by+r+5, bw*ratio, bh); ctx.restore();
  }
}