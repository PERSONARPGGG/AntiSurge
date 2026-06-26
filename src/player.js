// ============================================================
// 6. 플레이어 클래스
// ============================================================
class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.radius = 16;
    this.color  = '#00f0ff';

    // 클래스 스탯 적용
    const cls = CLASS_DEFS[selectedClass] || CLASS_DEFS.hacker;
    this.classId          = selectedClass;
    this.speed            = cls.speed;
    this.maxHp            = cls.hp;
    this.hp               = cls.hp;
    this.magnetRadius     = cls.magnetRadius;
    this.damageMultiplier = cls.damageMult;

    this.xp          = 0;
    this.nextLevelXp = 10;
    this.level       = 1;
    this.shieldTimer = 0;   // 필드 아이템 실드
    this.surgeTimer  = 0;   // 필드 아이템 속도 부스트

    // 스테이지 클리어 서지 보너스
    this.attackSurgeTimer = 0;
    this.attackSurgeMult  = 1.0;

    // 패시브 아이템
    this.passives        = { regen: 0, shield: 0, nanobots: 0, overclock: 0, resonance: 0, thorns: 0, critical: 0, explosive: 0, barrier: 0 };
    this.classPassives   = {}; // 클래스 전용 패시브 레벨 추적
    // 무기 융합
    this.fusions         = {};
    this.regenTimer      = 0;
    this.barrierTimer    = 0;
    this.damageReduction = 0.0;
    this.passiveXpMult   = 1.0;
    this.thornsTrigger   = false;

    // 골드
    this.gold = 0;

    // 액티브 스킬
    this.activeSkillCd     = 0;
    this.activeSkillTimer  = 0;
    this.skillShieldActive = false;
    this.skillInvincible   = false;
    this.skillSpeedBoost   = false;
    this._skillOrigDmgReduction = 0;
    this._skillOrigSpeed   = 0;
    this._sniperShotBoost  = 0;
    this._nearDeathCurseSent = false;

    // 히든 직업 상태
    this._parasiteStacks  = 0;
    this._totalAbsorptions = 0;
    this._jammerCharge   = 0;
    this._jamPrevX       = 0;
    this._jamPrevY       = 0;
    this._gdBurstTimer   = 0;

    // 부활 퍽
    this.revivals     = { restore: false, backup: false, lastStand: 0, counter: false, void: false };
    this.voidActive   = false;
    this.voidTimer    = 0;
    this._voidDmgMult = 1;

    this.weapons = {
      flare:     new FlareWeapon(this),
      orbiter:   new OrbiterWeapon(this),
      zone:      new ZoneWeapon(this),
      laser:     new LaserWeapon(this),
      boomerang: new BoomerangWeapon(this),
      drone:     new DroneWeapon(this),
      missile:   new MissileWeapon(this),
      ring:      new RingWeapon(this),
      chain:     new ChainWeapon(this),
      mine:          new MineWeapon(this),
      blackhole:     new BlackHoleWeapon(this),
      command_dance: new CommandDanceWeapon(this),
      echo_record:   new EchoRecordWeapon(this),
      viral_bomb:    new ViralBombWeapon(this),
      resonance:     new ResonanceWeapon(this),
      hack_gun:      new HackGunWeapon(this),
      overcharge:    new OverchargeWeapon(this)
    };
    const startW = cls.startWeapon || 'flare';
    this.weapons[startW].level = 1;
    weaponStats[startW].level  = 1;
  }

  update(dt) {
    if (mpSpectating) return;
    let dx = 0, dy = 0;
    if (keys['w'] || keys['W'] || keys['ArrowUp'])    dy -= 1;
    if (keys['s'] || keys['S'] || keys['ArrowDown'])  dy += 1;
    if (keys['a'] || keys['A'] || keys['ArrowLeft'])  dx -= 1;
    if (keys['d'] || keys['D'] || keys['ArrowRight']) dx += 1;
    // 모바일 터치 입력 병합
    if (isTouching && (Math.abs(touchDX) > 0.05 || Math.abs(touchDY) > 0.05)) {
      dx = touchDX; dy = touchDY;
    } else if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }

    if (dx !== 0 || dy !== 0) this._moveAngle = Math.atan2(dy, dx);
    let spd = this.speed * (this.surgeTimer > 0 ? 2.0 : 1.0) * (this._poolSpeedMult ?? 1.0);
    spd = Math.min(spd, this.surgeTimer > 0 ? 16 : 8); // 속도 하드캡 (서지 포함 16, 기본 8)
    this.x += dx * spd * (dt / 16.66);
    this.y += dy * spd * (dt / 16.66);
    this.x = Math.max(this.radius, Math.min(MAP_WIDTH  - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(MAP_HEIGHT - this.radius, this.y));

    if (this.shieldTimer > 0) this.shieldTimer -= dt;
    if (this.surgeTimer  > 0) this.surgeTimer  -= dt;
    if (this._gdBurstTimer > 0) this._gdBurstTimer -= dt;

    // 액티브 스킬 쿨다운 & 타이머
    if (this.activeSkillCd > 0) this.activeSkillCd = Math.max(0, this.activeSkillCd - dt);
    if (this.activeSkillTimer > 0) {
      this.activeSkillTimer -= dt;
      if (this.activeSkillTimer <= 0) this._deactivateSkill();
    }

    // 사망 직전 저주 계약 (HP 15% 이하, 1회)
    if (this.hp / this.maxHp <= 0.15 && !this._nearDeathCurseSent && !pendingBossCurse && !pendingNearDeathCurse && gameState === STATE_PLAYING) {
      this._nearDeathCurseSent = true;
      pendingNearDeathCurse = true;
      setTimeout(() => {
        if (player && player.hp > 0 && gameState === STATE_PLAYING) {
          pendingNearDeathCurse = false;
          showNearDeathCurseModal();
        } else {
          pendingNearDeathCurse = false;
        }
      }, 500);
    }
    if (this.hp / this.maxHp > 0.30) this._nearDeathCurseSent = false;

    if (this.attackSurgeTimer > 0) {
      this.attackSurgeTimer -= dt;
      if (this.attackSurgeTimer <= 0) {
        this.damageMultiplier /= this.attackSurgeMult;
        this.attackSurgeMult   = 1.0;
      }
    }

    // 패시브: 회생 코어
    if (this.passives.regen > 0 && this.hp < this.maxHp) {
      this.regenTimer += dt;
      const interval = 3000;
      const healAmt  = this.passives.regen === 2 ? 3 : 1;
      if (this.regenTimer >= interval) {
        this.regenTimer = 0;
        this.hp = Math.min(this.hp + healAmt, this.maxHp);
      }
    } else {
      this.regenTimer = 0;
    }

    // 패치봇 Q스킬 재생 버프
    if ((this._patchbotRegenTimer || 0) > 0) {
      this._patchbotRegenTimer -= dt;
      this._patchbotRegenTickTimer = (this._patchbotRegenTickTimer || 0) + dt;
      if (this._patchbotRegenTickTimer >= 1000) {
        this._patchbotRegenTickTimer -= 1000;
        this.hp = Math.min(this.hp + 3, this.maxHp);
      }
    }

    // 메타: 피격 후 재생 드라이브
    if ((this.regenAfterHit || 0) > 0 && (this._regenAfterHitTimer || 0) > 0) {
      this._regenAfterHitTimer -= dt;
      this._regenAfterHitTickTimer = (this._regenAfterHitTickTimer || 0) + dt;
      if (this._regenAfterHitTickTimer >= 1000) {
        this._regenAfterHitTickTimer -= 1000;
        this.hp = Math.min(this.hp + this.regenAfterHit, this.maxHp);
      }
    }

    // 클래스 패시브: 사이보그 자가 수복
    if ((this.classPassives.fw_regen || 0) > 0 && this.hp < this.maxHp) {
      this._fwRegenTick = (this._fwRegenTick || 0) + dt;
      if (this._fwRegenTick >= 1000) {
        this._fwRegenTick -= 1000;
        const regenAmt = ((this.classPassives.fw_regen >= 2) ? 4 : 2) * ((activeBoss && this.classPassives.fw_regen >= 2) ? 2 : 1);
        this.hp = Math.min(this.hp + regenAmt, this.maxHp);
      }
    }

    // 클래스 패시브: 패치봇 응급 처치 (피격 후 재생)
    if ((this.classPassives.pb_triage || 0) > 0 && (this._triageTimer || 0) > 0) {
      this._triageTimer -= dt;
      this._triageTick  = (this._triageTick || 0) + dt;
      if (this._triageTick >= 1000) {
        this._triageTick -= 1000;
        const r = this.classPassives.pb_triage >= 2 ? 8 : 4;
        this.hp = Math.min(this.hp + r, this.maxHp);
        addFloatingText(this.x, this.y - 30, `+${r}`, '#39ff14', 10);
      }
    } else {
      this._triageTick = 0;
    }

    // 수리 드론 이벤트: 매초 +5 HP
    if (activeFieldEvent?.id === 'repair_drone') {
      this._droneHealTimer = (this._droneHealTimer || 0) + dt;
      if (this._droneHealTimer >= 1000) {
        this._droneHealTimer -= 1000;
        this.hp = Math.min(this.hp + 5, this.maxHp);
        addFloatingText(this.x, this.y - 30, '+5 수리', '#39ff14', 11);
      }
    } else {
      this._droneHealTimer = 0;
    }

    // 패시브: 전기 방벽 — 주기적으로 주변 적 스턴
    if (this.passives.barrier > 0) {
      this.barrierTimer += dt;
      const barrierCD  = this.passives.barrier === 2 ? 3000 : 5000;
      const barrierR   = 150;
      const stunDur    = this.passives.barrier === 2 ? 2500 : 1500;
      if (this.barrierTimer >= barrierCD) {
        this.barrierTimer = 0;
        for (let e of enemies) {
          if (dist(this.x, this.y, e.x, e.y) < barrierR) e.stunTimer = stunDur;
        }
        if (activeBoss && dist(this.x, this.y, activeBoss.x, activeBoss.y) < barrierR)
          activeBoss.stunTimer = Math.min(stunDur * 0.4, 800);
        createExplosionParticles(this.x, this.y, '#00f0ff', 18);
        playSynthSound([300, 900, 200], 0.12, 'triangle', 0.07);
        addFloatingText(this.x, this.y - 40, '🛡 전기 방벽!', '#00f0ff', 13);
      }
    }

    // 부활 퍽: 긴급 백업 (HP 임계값 체크)
    if (this.revivals.backup && this.hp > 0 && this.hp <= this.maxHp * 0.15) {
      this.revivals.backup = false;
      this.hp = Math.ceil(this.maxHp * 0.50);
      addFloatingText(this.x, this.y - 50, '🔄 긴급 백업!', '#ffe600', 18);
      createExplosionParticles(this.x, this.y, '#ffe600', 15);
    }
    // 부활 퍽: 공허의 각성 타이머
    if (this.voidActive) {
      this.voidTimer -= dt;
      // 공허 활성 중 시각 효과
      if (Math.random() < 0.08) createExplosionParticles(this.x + (Math.random()-0.5)*40, this.y + (Math.random()-0.5)*40, '#b026ff', 2);
      if (this.voidTimer <= 0) {
        this.voidActive = false;
        this.damageMultiplier /= (this._voidDmgMult || 2.5);
        this._voidDmgMult = 1;
        this.hp = Math.max(1, this.hp - Math.floor(this.maxHp * 0.5));
        addFloatingText(this.x, this.y - 40, '공허 종료', '#b026ff', 14);
        triggerScreenShake(8, 400);
      }
    }

    // 패시브: 복수의 가시 (피격 지연 처리)
    if (this.thornsTrigger) {
      this.thornsTrigger = false;
      const thornDmg = this.passives.thorns === 2 ? 25 : 15;
      const thornR   = this.passives.thorns === 2 ? 160 : 120;
      for (const e of [...enemies]) {
        if (e && dist(this.x, this.y, e.x, e.y) < thornR) {
          if (e.takeDamage(thornDmg, 'thorns')) killCount++;
        }
      }
    }

    for (let key in this.weapons) {
      if (this.weapons[key].level > 0) this.weapons[key].update(dt);
    }
  }

  draw(ctx, camera) {
    ctx.save();
    const bx = this.x - camera.x, by = this.y - camera.y;
    const r  = this.radius;

    // 실드 링
    if (this.shieldTimer > 0) {
      ctx.shadowBlur=28; ctx.shadowColor='#00f0ff';
      ctx.strokeStyle='#00f0ff'; ctx.lineWidth=2;
      ctx.setLineDash([6,4]);
      ctx.beginPath(); ctx.arc(bx, by, r+12, 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
    }

    // 외곽 글로우 링
    ctx.shadowBlur=22; ctx.shadowColor=this.color;
    ctx.strokeStyle=this.color; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI*2); ctx.stroke();

    // 회전 마커 (4점)
    const rot = (Date.now()*0.0015) % (Math.PI*2);
    ctx.strokeStyle=this.color; ctx.lineWidth=2; ctx.shadowBlur=10;
    for (let i=0;i<4;i++){
      const a = rot + (i/4)*Math.PI*2;
      const ix = bx+Math.cos(a)*(r+5), iy = by+Math.sin(a)*(r+5);
      ctx.beginPath();
      ctx.moveTo(ix+Math.cos(a)*4, iy+Math.sin(a)*4);
      ctx.lineTo(ix-Math.cos(a)*4, iy-Math.sin(a)*4);
      ctx.stroke();
    }

    // 클래스별 내부 형태
    ctx.shadowBlur=18; ctx.shadowColor='#ffffff'; ctx.fillStyle='#ffffff';
    ctx.strokeStyle='#ffffff'; ctx.lineWidth=2.5;
    const _s = r * 0.5;
    const _cls = this.classId || 'hacker';
    if (_cls === 'cyborg') {
      // 방화벽: 육각형
      ctx.beginPath();
      for (let _i=0;_i<6;_i++){
        const _a = _i/6*Math.PI*2 - Math.PI/6;
        const _hx = bx+Math.cos(_a)*_s, _hy = by+Math.sin(_a)*_s;
        _i===0 ? ctx.moveTo(_hx,_hy) : ctx.lineTo(_hx,_hy);
      }
      ctx.closePath(); ctx.fill();
    } else if (_cls === 'ghost') {
      // 루트킷: 앞방향 화살표 삼각형 (이동 방향 추적)
      const _ma = this._moveAngle || 0;
      ctx.beginPath();
      ctx.moveTo(bx+Math.cos(_ma)*_s*1.1, by+Math.sin(_ma)*_s*1.1);
      ctx.lineTo(bx+Math.cos(_ma+2.4)*_s*0.85, by+Math.sin(_ma+2.4)*_s*0.85);
      ctx.lineTo(bx+Math.cos(_ma-2.4)*_s*0.85, by+Math.sin(_ma-2.4)*_s*0.85);
      ctx.closePath(); ctx.fill();
    } else if (_cls === 'engineer') {
      // 드론.exe: 회전 사각형
      const _sqR = (Date.now()*0.0012) % (Math.PI*2);
      ctx.beginPath();
      for (let _i=0;_i<4;_i++){
        const _a = _sqR + _i*Math.PI/2 + Math.PI/4;
        const _qx = bx+Math.cos(_a)*_s, _qy = by+Math.sin(_a)*_s;
        _i===0 ? ctx.moveTo(_qx,_qy) : ctx.lineTo(_qx,_qy);
      }
      ctx.closePath(); ctx.fill();
    } else if (_cls === 'sniper') {
      // 스캐너: 크로스헤어
      const _g = _s * 0.3;
      ctx.beginPath(); ctx.moveTo(bx-_s*1.05,by); ctx.lineTo(bx-_g,by); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx+_g,by); ctx.lineTo(bx+_s*1.05,by); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx,by-_s*1.05); ctx.lineTo(bx,by-_g); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx,by+_g); ctx.lineTo(bx,by+_s*1.05); ctx.stroke();
      ctx.beginPath(); ctx.arc(bx,by,_g*0.9,0,Math.PI*2); ctx.stroke();
    } else if (_cls === 'support') {
      // 패치봇: 의료 십자
      const _arm=_s*0.45, _th=_s*0.28;
      ctx.fillRect(bx-_th/2, by-_arm, _th, _arm*2);
      ctx.fillRect(bx-_arm, by-_th/2, _arm*2, _th);
    } else if (_cls === 'jammer') {
      // 재머: 레이더 동심원 + 4방향 안테나
      const _t = Date.now() * 0.002;
      ctx.beginPath(); ctx.arc(bx, by, _s*0.55, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.arc(bx, by, _s*0.22, 0, Math.PI*2); ctx.fill();
      for (let _i=0;_i<4;_i++){
        const _a = _i*Math.PI/2 + _t*0.4;
        ctx.beginPath(); ctx.moveTo(bx+Math.cos(_a)*_s*0.6, by+Math.sin(_a)*_s*0.6);
        ctx.lineTo(bx+Math.cos(_a)*_s*1.1, by+Math.sin(_a)*_s*1.1); ctx.stroke();
      }
    } else if (_cls === 'cracker') {
      // 크래커: 조이스틱 + 해킹 커서 (회전 링 + 중앙 상향 벡터)
      const _cr = (Date.now()*0.0014)%(Math.PI*2);
      ctx.beginPath();
      for (let _i=0;_i<8;_i++){
        const _a = _cr + _i*Math.PI/4;
        const _rd = _i%2===0 ? _s*0.9 : _s*0.55;
        _i===0 ? ctx.moveTo(bx+Math.cos(_a)*_rd, by+Math.sin(_a)*_rd) : ctx.lineTo(bx+Math.cos(_a)*_rd, by+Math.sin(_a)*_rd);
      }
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(bx, by, _s*0.25, 0, Math.PI*2); ctx.fill();
    } else if (_cls === 'glitch_dancer') {
      // 글리치 댄서: 5각 별 (춤추듯 진동)
      const _jt = Math.sin(Date.now()*0.008)*0.18;
      ctx.beginPath();
      for (let _i=0;_i<10;_i++){
        const _a = _i*Math.PI/5 - Math.PI/2 + _jt;
        const _rd = _i%2===0 ? _s*1.05 : _s*0.45;
        _i===0 ? ctx.moveTo(bx+Math.cos(_a)*_rd, by+Math.sin(_a)*_rd) : ctx.lineTo(bx+Math.cos(_a)*_rd, by+Math.sin(_a)*_rd);
      }
      ctx.closePath(); ctx.fill();
    } else if (_cls === 'parasite') {
      // 패러사이트: 유기체 세포 (원 + 촉수 3개)
      ctx.beginPath(); ctx.arc(bx, by, _s*0.55, 0, Math.PI*2); ctx.fill();
      const _pt = Date.now()*0.0018;
      for (let _i=0;_i<3;_i++){
        const _a = _i*Math.PI*2/3 + _pt;
        const _len = _s*(0.65 + 0.2*Math.sin(_pt*2+_i));
        ctx.beginPath(); ctx.moveTo(bx+Math.cos(_a)*_s*0.55, by+Math.sin(_a)*_s*0.55);
        ctx.lineTo(bx+Math.cos(_a)*(_s*0.55+_len), by+Math.sin(_a)*(_s*0.55+_len));
        ctx.lineWidth=3; ctx.stroke(); ctx.lineWidth=2.5;
      }
    } else {
      // 해커(default): 다이아몬드
      ctx.beginPath();
      ctx.moveTo(bx,      by-r*0.52);
      ctx.lineTo(bx+r*0.38, by);
      ctx.lineTo(bx,      by+r*0.52);
      ctx.lineTo(bx-r*0.38, by);
      ctx.closePath(); ctx.fill();
    }

    // 중심 도트
    ctx.fillStyle=this.color; ctx.shadowBlur=12;
    ctx.beginPath(); ctx.arc(bx, by, r*0.18, 0, Math.PI*2); ctx.fill();

    ctx.restore();

    for (let key in this.weapons) {
      if (this.weapons[key].level > 0 && typeof this.weapons[key].draw === 'function') {
        this.weapons[key].draw(ctx, camera);
      }
    }
  }

  gainXp(amount) {
    let mult = getXpMultiplier() * getEarlyGameXpMult();
    const cls = CLASS_DEFS[this.classId];
    if (cls) mult *= cls.xpBonus;
    mult *= this.passiveXpMult;
    mult *= (this.xpMultiplier || 1);
    if (mpMode && mpAuraActive) mult *= 1.05; // 오라 XP 보너스
    this.xp += amount * mult;
    while (this.xp >= this.nextLevelXp) {
      this.xp -= this.nextLevelXp;
      this.levelUp();
    }
  }

  levelUp() {
    this.level++;
    this.nextLevelXp = Math.floor(this.nextLevelXp * 1.35) + 8;
    if (!levelUpInProgress) {
      levelUpInProgress = true;
      playLevelUpSound();
      triggerLevelUpModal();
    } else {
      // 같은 프레임 내 다중 레벨업 → 큐에 적재
      pendingLevelUps++;
    }
  }

  _deactivateSkill() {
    if (this.skillShieldActive) {
      this.damageReduction = this._skillOrigDmgReduction;
      this.skillShieldActive = false;
    }
    if (this.skillSpeedBoost) {
      this.speed = this._skillOrigSpeed || this.speed;
      this.skillSpeedBoost = false;
      this.skillInvincible = false;
    }
  }

  takeDamage(amount) {
    if (mpSpectating) return;
    if (devGodMode) {
      addFloatingText(this.x, this.y - this.radius - 5, '♦GOD♦', '#39ff14', 9);
      return;
    }
    if (this.skillInvincible) {
      addFloatingText(this.x, this.y - this.radius, 'PHASE', '#39ff14', 12);
      return;
    }
    if (this.shieldTimer > 0) {
      addFloatingText(this.x, this.y - this.radius, 'BLOCKED', '#00f0ff', 12);
      return;
    }
    // 루트킷 위상 회피: 피격 자체 무효
    if ((this.classPassives.rk_evade || 0) > 0) {
      const evadeChance = this.classPassives.rk_evade >= 2 ? 0.18 : 0.08;
      if (Math.random() < evadeChance) {
        addFloatingText(this.x, this.y - this.radius, 'EVADE', '#b026ff', 13);
        return;
      }
    }
    let dmg = amount;
    // 코어 과부하 이벤트: 받는 피해 1.5배
    if (activeFieldEvent?.id === 'core_overload') dmg *= 1.5;
    // 저주: 받는 피해 증가
    if (this._curseDamageMult) dmg *= this._curseDamageMult;
    if (this.damageReduction > 0) dmg = Math.max(1, Math.floor(dmg * (1 - this.damageReduction)));
    this.hp -= dmg;
    mTrack._noDmgStreak = 0;
    if ((this.classPassives.pb_triage || 0) > 0) this._triageTimer = 5000;
    if (this.passives.thorns > 0) this.thornsTrigger = true;
    if ((this.regenAfterHit || 0) > 0) { this._regenAfterHitTimer = 3000; }
    playHitSound();
    createDamageOverlayParticles(this.x, this.y);
    triggerScreenShake(5, 250);
    if (this.hp <= 0) {
      this.hp = 0;
      // 공허 활성 중: 1HP 유지
      if (this.voidActive) { this.hp = 1; return; }
      // 부활 퍽 우선순위 체크
      if (this.revivals.void) {
        this.revivals.void = false;
        this.voidActive = true; this.voidTimer = 8000;
        this._voidDmgMult = 2.5; this.damageMultiplier *= 2.5;
        this.hp = 1;
        addFloatingText(this.x, this.y - 50, '🌀 공허의 각성!', '#b026ff', 20);
        triggerScreenShake(15, 600);
        createExplosionParticles(this.x, this.y, '#b026ff', 25);
        return;
      }
      if (this.revivals.lastStand > 0) {
        this.revivals.lastStand--;
        this.hp = Math.ceil(this.maxHp * 0.20);
        this.shieldTimer = 4000;
        addFloatingText(this.x, this.y - 50, '🛡 최후의 방어막!', '#00f0ff', 20);
        triggerScreenShake(10, 400);
        createExplosionParticles(this.x, this.y, '#00f0ff', 15);
        return;
      }
      if (this.revivals.counter) {
        this.revivals.counter = false;
        this.hp = Math.ceil(this.maxHp * 0.30);
        const allT = [...enemies]; if (activeBoss) allT.push(activeBoss);
        for (let e of allT) { if (dist(this.x, this.y, e.x, e.y) < 500 && e.takeDamage(200, 'counter')) killCount++; }
        addFloatingText(this.x, this.y - 50, '💥 절명 반격!', '#ff4466', 20);
        createExplosionParticles(this.x, this.y, '#ff4466', 30);
        triggerScreenShake(20, 600);
        return;
      }
      if (this.revivals.restore) {
        this.revivals.restore = false;
        this.hp = Math.ceil(this.maxHp * 0.30);
        addFloatingText(this.x, this.y - 50, '💾 데이터 복원!', '#39ff14', 20);
        createExplosionParticles(this.x, this.y, '#39ff14', 15);
        return;
      }
      if (mpMode && _mpHasAliveTeammates()) {
        mpEnterSpectator();
      } else {
        endGame(false);
      }
    }
  }
}
