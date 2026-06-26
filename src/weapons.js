// ============================================================
// 7. 무기 클래스들
// ============================================================
class BaseWeapon {
  constructor(owner) { this.owner = owner; this.level = 0; this.timer = 0; }
  update(dt) {}
}

// 1. 네온 플레어
class FlareWeapon extends BaseWeapon {
  constructor(owner) { super(owner); this.cooldown = 1500; }
  update(dt) {
    this.timer += dt;
    let cd = this.level === 5 ? 950 : this.cooldown;
    if (this.timer >= cd) { this.timer = 0; this.fire(); }
  }
  fire() {
    if (enemies.length === 0 && !activeBoss) return;
    if (projectiles.length >= MAX_PROJECTILES) return;
    let targets = [...enemies];
    if (activeBoss) targets.push(activeBoss);
    let target = null, minDist = Infinity;
    for (let e of targets) {
      let d = dist(this.owner.x, this.owner.y, e.x, e.y);
      if (d < minDist) { minDist = d; target = e; }
    }
    if (!target) return;
    let angle = Math.atan2(target.y - this.owner.y, target.x - this.owner.x);

    if (this.level === 5) {
      // 진화: 플라즈마 캐논 — 대형 폭발탄
      let damage = 90 * this.owner.damageMultiplier;
      playSynthSound([100, 400], 0.25, 'sawtooth', 0.1);
      createExplosionParticles(this.owner.x, this.owner.y, '#ff7700', 5);
      projectiles.push(new Projectile(this.owner.x, this.owner.y, Math.cos(angle)*5, Math.sin(angle)*5, damage, 12, '#ff7700', 25, 'flare'));
      return;
    }

    let count  = [1,2,2,3][this.level - 1] ?? 1;
    let damage = this.level >= 3 ? 26 : 15;
    damage *= this.owner.damageMultiplier;
    let speed  = this.level >= 3 ? 8.0 : 6.5;
    let pierce = this.level >= 4 ? 3   : 1;
    playShotSound();
    for (let i = 0; i < count; i++) {
      let sa = angle + (count > 1 ? (i - (count-1)/2) * 0.18 : 0);
      projectiles.push(new Projectile(this.owner.x, this.owner.y, Math.cos(sa)*speed, Math.sin(sa)*speed, damage, 4, '#00f0ff', pierce, 'flare'));
    }
  }
  draw(ctx, camera) {
    const cd  = this.level === 5 ? 950 : 1500;
    const pct = Math.min(1, this.timer / cd);
    if (pct < 0.12) return;
    const col = this.level === 5 ? '#ff7700' : '#00f0ff';
    const bx = this.owner.x - camera.x, by = this.owner.y - camera.y;
    ctx.save();
    ctx.globalAlpha = 0.45 + pct * 0.45;
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.shadowBlur = 8; ctx.shadowColor = col;
    ctx.beginPath();
    ctx.arc(bx, by, this.owner.radius + 5, -Math.PI/2, -Math.PI/2 + Math.PI*2*pct);
    ctx.stroke();
    if (pct > 0.55) {
      let allT = [...enemies]; if (activeBoss) allT.push(activeBoss);
      let target = null, minD = Infinity;
      for (const e of allT) { const d = dist(this.owner.x, this.owner.y, e.x, e.y); if (d < minD) { minD = d; target = e; } }
      if (target) {
        const tx = target.x - camera.x, ty = target.y - camera.y;
        const spin = Date.now() * 0.003;
        ctx.globalAlpha = (pct - 0.55) / 0.45 * 0.75;
        ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.shadowBlur = 10;
        const rs = target.radius + 7;
        for (let i = 0; i < 3; i++) {
          const a = spin + i * Math.PI * 2 / 3;
          ctx.beginPath(); ctx.arc(tx, ty, rs, a, a + Math.PI * 0.42); ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1; ctx.restore();
  }
}

// 2. 사이버 오비터
class OrbiterWeapon extends BaseWeapon {
  constructor(owner) { super(owner); this.angle = 0; }
  update(dt) {
    let spd    = this.level >= 3 ? 0.038 : 0.025;
    this.angle += spd * (dt / 16.66);
    let count  = [1,2,2,3,4][this.level - 1] ?? 1;
    let radius = this.level === 5 ? 95 : 70;
    let orbR   = this.level === 5 ? 14 : 8;
    let damage = [8,8,14,14,28][this.level - 1] ?? 8;
    damage *= this.owner.damageMultiplier;
    for (let i = 0; i < count; i++) {
      let ca   = this.angle + i * (Math.PI * 2 / count);
      let orbX = this.owner.x + Math.cos(ca) * radius;
      let orbY = this.owner.y + Math.sin(ca) * radius;
      let allTargets = [...enemies];
      if (activeBoss) allTargets.push(activeBoss);
      for (let e of allTargets) {
        if (dist(orbX, orbY, e.x, e.y) < e.radius + orbR) {
          if (e.takeDamage(damage, 'orbiter')) killCount++;
        }
      }
      // 진화 Lv5: 네온 잔상 파티클
      if (this.level === 5 && Math.random() < 0.55) {
        particles.push(new Particle(orbX, orbY, (Math.random()-0.5)*0.4, (Math.random()-0.5)*0.4, '#ff00ff', 180));
      }
      // mine_orbital 융합: 오비터가 적 접근 시 마인 투하
      if (this.owner.fusions && this.owner.fusions.mine_orbital) {
        this._mineDropCd = (this._mineDropCd || 0) - dt;
        if (this._mineDropCd <= 0) {
          const closeEnemy = enemies.find(e => dist(orbX, orbY, e.x, e.y) < 55);
          if (closeEnemy) {
            const mDmg = 55 * this.owner.damageMultiplier;
            mines.push(new Mine(orbX, orbY, mDmg, 95, false));
            this._mineDropCd = 1800;
          }
        }
      }
    }
  }
  draw(ctx, camera) {
    let count  = [1,2,2,3,4][this.level - 1] ?? 1;
    let radius = this.level === 5 ? 95 : 70;
    let orbR   = this.level === 5 ? 14 : 8;
    let color  = this.level === 5 ? '#ff00ff' : '#b026ff';
    ctx.save();
    ctx.shadowBlur = 10; ctx.shadowColor = color;
    ctx.strokeStyle = `rgba(${this.level === 5 ? '255,0,255' : '176,38,255'}, 0.15)`;
    ctx.lineWidth = 1; ctx.setLineDash([4,4]);
    ctx.beginPath();
    ctx.arc(this.owner.x - camera.x, this.owner.y - camera.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
      let ca = this.angle + i * (Math.PI * 2 / count);
      let dx = this.owner.x + Math.cos(ca) * radius - camera.x;
      let dy = this.owner.y + Math.sin(ca) * radius - camera.y;
      ctx.shadowBlur = this.level === 5 ? 20 : 10;
      ctx.beginPath(); ctx.arc(dx, dy, orbR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(dx, dy, orbR * 0.35, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color;
    }
    ctx.restore();
  }
}

// 3. 일렉트로 존
class ZoneWeapon extends BaseWeapon {
  constructor(owner) {
    super(owner);
    this.tickTimer      = 0;
    this.shockwaveTimer = 0;
    this.shockwaves     = [];
  }
  update(dt) {
    this.tickTimer += dt;
    let cd = this.level === 5 ? 350 : 500;
    if (this.tickTimer >= cd) { this.tickTimer = 0; this.tick(); }

    // 진화 Lv5: 충격파
    if (this.level === 5) {
      this.shockwaveTimer += dt;
      if (this.shockwaveTimer >= 3000) {
        this.shockwaveTimer = 0;
        this.shockwaves.push({ r: 20, life: 600, maxLife: 600 });
      }
      for (let i = this.shockwaves.length - 1; i >= 0; i--) {
        let sw = this.shockwaves[i];
        let prevR = sw.r;
        sw.life -= dt;
        sw.r = 20 + (1 - sw.life / sw.maxLife) * 220;
        let dmg = 18 * this.owner.damageMultiplier;
        let allTargets = [...enemies];
        if (activeBoss) allTargets.push(activeBoss);
        for (let e of allTargets) {
          let d = dist(this.owner.x, this.owner.y, e.x, e.y);
          if (d >= prevR && d < sw.r + e.radius) {
            if (e.takeDamage(dmg, 'zone')) killCount++;
          }
        }
        if (sw.life <= 0) this.shockwaves.splice(i, 1);
      }
    } else {
      this.shockwaves = [];
    }
  }
  tick() {
    let radius  = [80,110,110,145,145][this.level - 1] ?? 80;
    let damage  = [3,5,5,8,13][this.level - 1] ?? 3;
    damage *= this.owner.damageMultiplier;
    let slowFactor = this.level >= 5 ? 0.65 : this.level >= 3 ? 0.75 : 0.85;
    let allTargets = [...enemies];
    if (activeBoss) allTargets.push(activeBoss);
    for (let e of allTargets) {
      if (dist(this.owner.x, this.owner.y, e.x, e.y) < radius + e.radius) {
        e.speedMultiplier = slowFactor;
        if (e.takeDamage(damage, 'zone')) killCount++;
      }
    }
  }
  draw(ctx, camera) {
    let radius = [80,110,110,145,145][this.level - 1] ?? 80;
    let pulse  = Math.sin(Date.now() * 0.01) * 3;
    ctx.save();
    ctx.strokeStyle = this.level === 5 ? 'rgba(57, 255, 20, 0.6)' : 'rgba(57, 255, 20, 0.4)';
    ctx.shadowBlur  = this.level === 5 ? 14 : 8; ctx.shadowColor = '#39ff14';
    ctx.lineWidth   = this.level === 5 ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.arc(this.owner.x - camera.x, this.owner.y - camera.y, radius + pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(57, 255, 20, 0.03)';
    ctx.fill();
    // 충격파 링 렌더
    for (let sw of this.shockwaves) {
      let alpha = sw.life / sw.maxLife;
      ctx.strokeStyle = `rgba(57, 255, 20, ${alpha * 0.9})`;
      ctx.lineWidth   = 3 * alpha;
      ctx.shadowBlur  = 20 * alpha;
      ctx.beginPath();
      ctx.arc(this.owner.x - camera.x, this.owner.y - camera.y, sw.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// 4. 레이저 스트라이크
class LaserWeapon extends BaseWeapon {
  constructor(owner) { super(owner); this.cooldown = 3500; }
  update(dt) {
    this.timer += dt;
    let cd = this.level >= 4 ? 2200 : this.level >= 2 ? 2900 : 3500;
    if (this.timer >= cd) { this.timer = 0; this.fire(); }
  }
  fire() {
    let damage = [45,45,70,70,100][this.level - 1] ?? 45;
    damage *= this.owner.damageMultiplier;
    let width  = this.level >= 3 ? 42 : 24;
    let allTargets = [...enemies];
    if (activeBoss) allTargets.push(activeBoss);
    let angle  = Math.random() * Math.PI * 2;
    if (allTargets.length > 0) {
      let tgt = allTargets[Math.floor(Math.random() * allTargets.length)];
      angle = Math.atan2(tgt.y - this.owner.y, tgt.x - this.owner.x);
    }
    playSynthSound([150, 900], 0.25, 'sawtooth', 0.09);
    createLaserBeam(this.owner.x, this.owner.y, angle, width, damage, 400);
    if (this.level === 5) {
      // 진화: 십자 레이저 — 4방향 동시
      createLaserBeam(this.owner.x, this.owner.y, angle + Math.PI,     width, damage, 400);
      createLaserBeam(this.owner.x, this.owner.y, angle + Math.PI/2,   width, damage, 400);
      createLaserBeam(this.owner.x, this.owner.y, angle - Math.PI/2,   width, damage, 400);
    }
    // spectrum_blade 융합: 레이저 수직 방향 부메랑 2발
    if (this.owner.fusions && this.owner.fusions.spectrum_blade && projectiles.length < MAX_PROJECTILES - 2) {
      const bDmg = 65 * this.owner.damageMultiplier;
      const spd  = 9;
      projectiles.push(new BoomerangProjectile(this.owner.x, this.owner.y, Math.cos(angle+Math.PI/2)*spd, Math.sin(angle+Math.PI/2)*spd, bDmg, '#ff6600', this.owner));
      projectiles.push(new BoomerangProjectile(this.owner.x, this.owner.y, Math.cos(angle-Math.PI/2)*spd, Math.sin(angle-Math.PI/2)*spd, bDmg, '#ff6600', this.owner));
    }
  }
  draw(ctx, camera) {
    const cd  = this.level >= 4 ? 2200 : this.level >= 2 ? 2900 : 3500;
    const pct = Math.min(1, this.timer / cd);
    if (pct < 0.18) return;
    let allT = [...enemies]; if (activeBoss) allT.push(activeBoss);
    if (!allT.length) return;
    let target = allT[0];
    for (const e of allT) { if (dist(this.owner.x, this.owner.y, e.x, e.y) < dist(this.owner.x, this.owner.y, target.x, target.y)) target = e; }
    const bx = this.owner.x - camera.x, by = this.owner.y - camera.y;
    const angle = Math.atan2(target.y - this.owner.y, target.x - this.owner.x);
    const range = Math.min(dist(this.owner.x, this.owner.y, target.x, target.y), 600);
    const col = this.level === 5 ? '#ff0099' : '#ff3300';
    ctx.save();
    ctx.globalAlpha = (pct - 0.18) / 0.82 * 0.55;
    ctx.strokeStyle = col; ctx.lineWidth = pct * (this.level >= 3 ? 5 : 2.5);
    ctx.shadowBlur = 10 * pct; ctx.shadowColor = col;
    ctx.setLineDash([7, 9]);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + Math.cos(angle) * range, by + Math.sin(angle) * range);
    ctx.stroke(); ctx.setLineDash([]);
    if (pct > 0.75) {
      const tx = target.x - camera.x, ty = target.y - camera.y;
      const a2 = (pct - 0.75) / 0.25;
      ctx.globalAlpha = a2 * 0.7; ctx.lineWidth = 2;
      const rs = target.radius + 8;
      ctx.beginPath();
      ctx.moveTo(tx - rs, ty - rs); ctx.lineTo(tx - rs + 8, ty - rs);
      ctx.moveTo(tx - rs, ty - rs); ctx.lineTo(tx - rs, ty - rs + 8);
      ctx.moveTo(tx + rs, ty - rs); ctx.lineTo(tx + rs - 8, ty - rs);
      ctx.moveTo(tx + rs, ty - rs); ctx.lineTo(tx + rs, ty - rs + 8);
      ctx.moveTo(tx - rs, ty + rs); ctx.lineTo(tx - rs + 8, ty + rs);
      ctx.moveTo(tx - rs, ty + rs); ctx.lineTo(tx - rs, ty + rs - 8);
      ctx.moveTo(tx + rs, ty + rs); ctx.lineTo(tx + rs - 8, ty + rs);
      ctx.moveTo(tx + rs, ty + rs); ctx.lineTo(tx + rs, ty + rs - 8);
      ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.restore();
  }
}

// 5. 사이버 부메랑
class BoomerangWeapon extends BaseWeapon {
  constructor(owner) { super(owner); this.cooldown = 2200; }
  update(dt) {
    this.timer += dt;
    const cd = [2200, 2000, 1700, 1500, 1200][this.level - 1] ?? 2200;
    if (this.timer >= cd) { this.timer = 0; this.fire(); }
  }
  fire() {
    if (projectiles.length >= MAX_PROJECTILES) return;
    let targets = [...enemies]; if (activeBoss) targets.push(activeBoss);
    let angle = Math.random() * Math.PI * 2;
    if (targets.length > 0) {
      targets.sort((a, b) => dist(this.owner.x, this.owner.y, a.x, a.y) - dist(this.owner.x, this.owner.y, b.x, b.y));
      angle = Math.atan2(targets[0].y - this.owner.y, targets[0].x - this.owner.x);
    }
    const dmgBase = [18, 24, 32, 44, 60][this.level - 1] ?? 18;
    const damage  = dmgBase * this.owner.damageMultiplier;
    const speed   = this.level >= 4 ? 9 : 7;
    const count   = this.level === 5 ? 4 : 1;
    playSynthSound([900, 400], 0.18, 'sawtooth', 0.08);
    for (let i = 0; i < count; i++) {
      const a = this.level === 5 ? angle + i * (Math.PI / 2) : angle;
      projectiles.push(new BoomerangProjectile(this.owner.x, this.owner.y, Math.cos(a) * speed, Math.sin(a) * speed, damage, '#ff00cc', this.owner));
    }
  }
  draw(ctx, camera) {
    const cd  = [2200, 2000, 1700, 1500, 1200][this.level-1] ?? 2200;
    const pct = Math.min(1, this.timer / cd);
    if (pct < 0.08) return;
    const bx = this.owner.x - camera.x, by = this.owner.y - camera.y;
    const col = '#ff00cc';
    const spin = Date.now() * 0.004 * (0.5 + pct * 0.5);
    ctx.save();
    ctx.globalAlpha = pct * 0.72;
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.shadowBlur = 10; ctx.shadowColor = col;
    const arc = Math.PI * (0.5 + pct * 1.1);
    ctx.beginPath();
    ctx.arc(bx, by, this.owner.radius + 5 + pct * 6, spin, spin + arc);
    ctx.stroke();
    if (this.level === 5) {
      ctx.globalAlpha = pct * 0.45;
      ctx.beginPath();
      ctx.arc(bx, by, this.owner.radius + 5 + pct * 6, spin + Math.PI, spin + Math.PI + arc);
      ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.restore();
  }
}

// 6. 데이터 드론
class DroneWeapon extends BaseWeapon {
  constructor(owner) { super(owner); this.angleOffset = 0; this.droneTimers = [0, 0, 0, 0, 0]; }
  update(dt) {
    const count  = ([1, 1, 2, 2, 3][this.level - 1] ?? 1) + (this.owner.classPassives?.dr_count || 0);
    const fireCD = [1600, 1200, 1200, 900, 700][this.level - 1] ?? 1600;
    const radius = 115;
    this.angleOffset += 0.014 * (dt / 16.66);
    for (let i = 0; i < count; i++) {
      this.droneTimers[i] = (this.droneTimers[i] || 0) + dt;
      if (this.droneTimers[i] >= fireCD) {
        this.droneTimers[i] = 0;
        const angle  = this.angleOffset + (i / count) * Math.PI * 2;
        const droneX = this.owner.x + Math.cos(angle) * radius;
        const droneY = this.owner.y + Math.sin(angle) * radius;
        let allT = [...enemies]; if (activeBoss) allT.push(activeBoss);
        let nearest = null, minD = 450;
        for (let e of allT) {
          const d = dist(droneX, droneY, e.x, e.y);
          if (d < minD) { minD = d; nearest = e; }
        }
        if (nearest && projectiles.length < MAX_PROJECTILES) {
          const a     = Math.atan2(nearest.y - droneY, nearest.x - droneX);
          const dmgB  = [18, 24, 30, 44, 65][this.level - 1] ?? 18;
          const droneMult = 1 + (this.owner.classPassives?.dr_dmg || 0) * 0.30;
          const dmg   = dmgB * this.owner.damageMultiplier * droneMult;
          const shots = this.level === 5 ? 3 : 1;
          playSynthSound([700, 1100], 0.08, 'square', 0.05);
          // hellfire_drone 융합: 총알 대신 유도 미사일 발사
          if (this.owner.fusions && this.owner.fusions.hellfire_drone) {
            const mDmg = dmg * 2.8;
            projectiles.push(new MissileProjectile(droneX, droneY, Math.cos(a)*7, Math.sin(a)*7, mDmg, 7, '#ff4400', 'drone', false));
            playSynthSound([200, 500], 0.15, 'sawtooth', 0.08);
          } else {
            for (let s = 0; s < shots; s++) {
              const sa = a + (shots > 1 ? (s - 1) * 0.14 : 0);
              projectiles.push(new Projectile(droneX, droneY, Math.cos(sa) * 9, Math.sin(sa) * 9, dmg, 4, '#ff8800', 1, 'drone'));
            }
          }
        }
      }
    }
  }
  draw(ctx, camera) {
    const count  = ([1, 1, 2, 2, 3][this.level - 1] ?? 1) + (this.owner.classPassives?.dr_count || 0);
    const radius = 115;
    const color  = this.level === 5 ? '#ff6600' : '#ff8800';
    ctx.save();
    ctx.strokeStyle = 'rgba(255,136,0,0.1)';
    ctx.lineWidth = 1; ctx.setLineDash([3, 7]);
    ctx.beginPath();
    ctx.arc(this.owner.x - camera.x, this.owner.y - camera.y, radius, 0, Math.PI * 2);
    ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < count; i++) {
      const a  = this.angleOffset + (i / count) * Math.PI * 2;
      const dx = this.owner.x + Math.cos(a) * radius - camera.x;
      const dy = this.owner.y + Math.sin(a) * radius - camera.y;
      ctx.shadowBlur = 16; ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let j = 0; j < 6; j++) {
        const ja = (j / 6) * Math.PI * 2 + this.angleOffset * 2;
        if (j === 0) ctx.moveTo(dx + Math.cos(ja) * 8, dy + Math.sin(ja) * 8);
        else         ctx.lineTo(dx + Math.cos(ja) * 8, dy + Math.sin(ja) * 8);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(dx, dy, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

// 7. 신규 무기 — 사이버 미사일
class MissileWeapon extends BaseWeapon {
  constructor(owner) { super(owner); this.cooldown = 3000; }
  update(dt) {
    this.timer += dt;
    const cds = [3000, 2500, 2500, 2200, 1800];
    const cd  = cds[Math.min(this.level - 1, cds.length - 1)] ?? 3000;
    if (this.timer >= cd) { this.timer = 0; this.fire(); }
  }
  fire() {
    if (!player || projectiles.length >= MAX_PROJECTILES) return;
    let allT = [...enemies]; if (activeBoss) allT.push(activeBoss);
    if (allT.length === 0) return;
    const target = allT.reduce((best, e) => {
      const d = dist(this.owner.x, this.owner.y, e.x, e.y);
      return (!best || d < best.d) ? { e, d } : best;
    }, null);
    if (!target) return;
    const counts = [1, 1, 2, 2, 4];
    const count  = counts[Math.min(this.level - 1, counts.length - 1)];
    const dmgs   = [55, 65, 65, 85, 90];
    const dmg    = dmgs[Math.min(this.level - 1, dmgs.length - 1)] * this.owner.damageMultiplier;
    const angle  = Math.atan2(target.e.y - this.owner.y, target.e.x - this.owner.x);
    const isEvo  = this.level === 5;
    playSynthSound([300, 600, 900], 0.12, 'sawtooth', 0.06);
    for (let i = 0; i < count; i++) {
      const spread = count > 1 ? (i - (count-1)/2) * 0.22 : 0;
      const a = angle + spread;
      projectiles.push(new MissileProjectile(
        this.owner.x, this.owner.y,
        Math.cos(a) * 5, Math.sin(a) * 5,
        dmg, isEvo ? 10 : 7, '#ff6600', 'missile', isEvo
      ));
    }
  }
  draw(ctx, camera) {
    const cds = [3000, 2500, 2500, 2200, 1800];
    const cd  = cds[Math.min(this.level - 1, cds.length - 1)];
    const pct = Math.min(1, this.timer / cd);
    if (pct < 0.2) return;
    let allT = [...enemies]; if (activeBoss) allT.push(activeBoss);
    if (!allT.length) return;
    let target = allT[0];
    for (const e of allT) { if (dist(this.owner.x, this.owner.y, e.x, e.y) < dist(this.owner.x, this.owner.y, target.x, target.y)) target = e; }
    const tx = target.x - camera.x, ty = target.y - camera.y;
    const col = this.level === 5 ? '#ffaa00' : '#ff6600';
    const blink = pct >= 0.88 && (Math.floor(Date.now() / 180) % 2 === 0);
    ctx.save();
    ctx.globalAlpha = 0.35 + pct * 0.55;
    ctx.strokeStyle = blink ? '#ffffff' : col;
    ctx.lineWidth = 2; ctx.shadowBlur = 12; ctx.shadowColor = col;
    const rs = target.radius + 10, br = 9;
    for (const [ex, ey, sx, sy] of [[tx-rs,ty-rs,1,1],[tx+rs,ty-rs,-1,1],[tx-rs,ty+rs,1,-1],[tx+rs,ty+rs,-1,-1]]) {
      ctx.beginPath();
      ctx.moveTo(ex+sx*br, ey); ctx.lineTo(ex, ey); ctx.lineTo(ex, ey+sy*br);
      ctx.stroke();
    }
    const bx = this.owner.x - camera.x, by = this.owner.y - camera.y;
    ctx.globalAlpha = pct * 0.38;
    ctx.lineWidth = 1.2; ctx.setLineDash([5, 8]);
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1; ctx.restore();
  }
}

// 7b. 신규 무기 — 플라즈마 링
class RingWeapon extends BaseWeapon {
  constructor(owner) { super(owner); this.rings = []; }
  update(dt) {
    if (this.level === 0) return;
    this.timer += dt;
    const cds = [3500, 3000, 2500, 2200, 1800];
    const cd  = cds[Math.min(this.level - 1, cds.length - 1)] ?? 3500;
    if (this.timer >= cd) { this.timer = 0; this.spawnRings(); }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      ring.life -= dt;
      if (ring.life <= 0) { this.rings.splice(i, 1); continue; }
      const prog = 1 - ring.life / ring.maxLife;
      const prevR = ring.currentRadius;
      ring.currentRadius = ring.maxRadius * prog;

      // 반경 통과 시 적에게 피해 (hitEnemies로 중복 방지)
      const dmgs = [25, 30, 35, 40, 50];
      const dmg  = dmgs[Math.min(this.level - 1, dmgs.length - 1)] * this.owner.damageMultiplier;
      let allT = [...enemies]; if (activeBoss) allT.push(activeBoss);
      for (let e of allT) {
        if (ring.hitEnemies.has(e)) continue;
        const d = dist(ring.x, ring.y, e.x, e.y);
        if (d <= ring.currentRadius + e.radius && d >= prevR - e.radius) {
          ring.hitEnemies.add(e);
          const killed = e === activeBoss
            ? activeBoss.takeDamage(dmg, 'ring')
            : e.takeDamage(dmg, 'ring');
          if (killed && e !== activeBoss) killCount++;
          // 보이드 노바 진화: 링 안으로 당기기
          if (this.level === 5 && e !== activeBoss) {
            const dx = ring.x - e.x, dy = ring.y - e.y;
            const dd = Math.sqrt(dx*dx + dy*dy) || 1;
            e.x += (dx / dd) * 5;
            e.y += (dy / dd) * 5;
          }
        }
      }
    }
  }
  spawnRings() {
    const count    = this.level >= 3 ? (this.level === 5 ? 3 : 2) : 1;
    const maxRs    = [200, 280, 300, 330, 360];
    const maxR     = maxRs[Math.min(this.level - 1, maxRs.length - 1)];
    const dur      = 1400;
    playSynthSound([200, 800, 400], 0.15, 'sine', 0.07);
    for (let i = 0; i < count; i++) {
      this.rings.push({
        x: this.owner.x, y: this.owner.y,
        currentRadius: 0, maxRadius: maxR + i * 40,
        life: dur - i * 120, maxLife: dur - i * 120,
        hitEnemies: new Set()
      });
    }
  }
  draw(ctx, camera) {
    if (this.level === 0 || this.rings.length === 0) return;
    ctx.save();
    for (const ring of this.rings) {
      const alpha = (ring.life / ring.maxLife) * 0.85;
      const col   = this.level === 5 ? '#b026ff' : '#00f0ff';
      ctx.globalAlpha = alpha;
      ctx.shadowBlur  = 20; ctx.shadowColor = col;
      ctx.strokeStyle = col;
      ctx.lineWidth   = this.level === 5 ? 4 : 2.5;
      ctx.beginPath();
      ctx.arc(ring.x - camera.x, ring.y - camera.y, ring.currentRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

// ============================================================
// 7c. 바이러스 체인
// ============================================================
// 체인 번개 지그재그 경로 생성 (fire()에서 미리 계산, draw()에서 재사용)
function _makeZigzag(x1, y1, x2, y2, segs, spread) {
  const pts  = [{ x: x1, y: y1 }];
  const ang  = Math.atan2(y2 - y1, x2 - x1);
  const perp = ang + Math.PI / 2;
  for (let i = 1; i < segs; i++) {
    const t  = i / segs;
    const mx = x1 + (x2 - x1) * t;
    const my = y1 + (y2 - y1) * t;
    const off = (Math.random() - 0.5) * spread * 2;
    pts.push({ x: mx + Math.cos(perp) * off, y: my + Math.sin(perp) * off });
  }
  pts.push({ x: x2, y: y2 });
  return pts;
}

class ChainWeapon extends BaseWeapon {
  constructor(owner) { super(owner); this._chainVis = null; }
  update(dt) {
    this.timer += dt;
    const cds = [2200, 1900, 1900, 1600, 1200];
    const cd  = cds[Math.min(this.level - 1, cds.length - 1)];
    if (this.timer >= cd) { this.timer = 0; this.fire(); }
  }
  fire() {
    if (!player) return;
    let allT = [...enemies]; if (activeBoss) allT.push(activeBoss);
    if (allT.length === 0) return;
    let nearest = null, minD = Infinity;
    for (let e of allT) {
      const d = dist(this.owner.x, this.owner.y, e.x, e.y);
      if (d < minD) { minD = d; nearest = e; }
    }
    if (!nearest) return;
    const chainCounts = [2, 3, 3, 4, 5];
    const chains = chainCounts[Math.min(this.level - 1, chainCounts.length - 1)];
    const baseDmg = [28, 34, 42, 52, 65][Math.min(this.level - 1, 4)] * this.owner.damageMultiplier;
    const chainR  = this.level >= 3 ? 200 : 160;
    let hit = [nearest];
    for (let c = 1; c < chains; c++) {
      const last = hit[hit.length - 1];
      let next = null, nextD = Infinity;
      for (let e of allT) {
        if (hit.includes(e)) continue;
        const d = dist(last.x, last.y, e.x, e.y);
        if (d < chainR && d < nextD) { nextD = d; next = e; }
      }
      if (next) hit.push(next); else break;
    }
    playSynthSound([900, 1400, 600], 0.12, 'square', 0.05);
    for (let i = 0; i < hit.length; i++) {
      const e   = hit[i];
      const dmg = baseDmg * Math.pow(0.75, i);
      createExplosionParticles(e.x, e.y, '#00f0ff', 4);
      if (e === activeBoss) {
        activeBoss.takeDamage(dmg, 'chain');
      } else {
        if (e.takeDamage(dmg, 'chain')) {
          killCount++;
          // 진화: 뉴럴 바이러스 — 처치 시 주변 폭발
          if (this.level === 5) {
            const nearbyForChain = enemies.filter(en => en !== e && dist(e.x, e.y, en.x, en.y) < 130);
            for (let nb of nearbyForChain) {
              if (nb.takeDamage(dmg * 0.6, 'chain')) killCount++;
            }
            createExplosionParticles(e.x, e.y, '#00f0ff', 10);
          }
        }
      }
      if (i < hit.length - 1) {
        addFloatingText((e.x + hit[i+1].x)/2, (e.y + hit[i+1].y)/2 - 10, '⚡', '#00f0ff', 13);
      }
    }
    addFloatingText(nearest.x, nearest.y - nearest.radius - 12, `⚡×${hit.length}`, '#00f0ff', 10);

    // 체인 번개 시각 — 적 간 아크 경로 미리 계산
    if (hit.length >= 2) {
      const spread = this.level >= 3 ? 38 : 28;
      const segs   = this.level >= 4 ? 9  : 6;
      const arcs   = [];
      for (let i = 0; i < hit.length - 1; i++) {
        arcs.push(_makeZigzag(hit[i].x, hit[i].y, hit[i+1].x, hit[i+1].y, segs, spread));
      }
      this._chainVis = { arcs, end: Date.now() + 480, level: this.level };
    }
  }
  draw(ctx, camera) {
    if (!this._chainVis || Date.now() > this._chainVis.end) return;
    const fade  = Math.min(1, (this._chainVis.end - Date.now()) / 180);
    const isEvo = this._chainVis.level === 5;
    ctx.save();
    ctx.globalAlpha = fade;
    // 외곽선 (두꺼운 글로우)
    ctx.strokeStyle = isEvo ? '#ff66ff' : '#44ddff';
    ctx.shadowColor = isEvo ? '#ff66ff' : '#00f0ff';
    ctx.shadowBlur  = 22;
    ctx.lineWidth   = 3.5;
    ctx.lineCap     = 'round';
    for (const pts of this._chainVis.arcs) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x - camera.x, pts[0].y - camera.y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x - camera.x, pts[i].y - camera.y);
      ctx.stroke();
    }
    // 내부선 (흰 코어)
    ctx.strokeStyle = '#ffffff';
    ctx.shadowBlur  = 0;
    ctx.lineWidth   = 1.5;
    for (const pts of this._chainVis.arcs) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x - camera.x, pts[0].y - camera.y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x - camera.x, pts[i].y - camera.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

// ============================================================
// 7d. 랜드마인 엔티티 및 무기
// ============================================================
class Mine {
  constructor(x, y, damage, explodeR, isEvoSub) {
    this.x = x; this.y = y;
    this.damage    = damage;
    this.explodeR  = explodeR;
    this.triggerR  = Math.max(22, explodeR * 0.38);
    this.isEvoSub  = isEvoSub; // 진화 산란 마인 여부
    this.life      = isEvoSub ? 6000 : 15000;
    this.armTimer  = 400;
    this.armed     = false;
    this.exploded  = false;
  }
  update(dt) {
    if (this.exploded) return;
    this.life -= dt;
    if (this.life <= 0) { this.exploded = true; return; }
    if (!this.armed) { this.armTimer -= dt; if (this.armTimer <= 0) this.armed = true; return; }
    let allT = [...enemies]; if (activeBoss) allT.push(activeBoss);
    for (let e of allT) {
      if (dist(this.x, this.y, e.x, e.y) < this.triggerR + e.radius) { this.explode(); return; }
    }
  }
  explode() {
    this.exploded = true;
    createExplosionParticles(this.x, this.y, '#ff8800', 20);
    triggerScreenShake(4, 250);
    playSynthSound([180, 80], 0.18, 'sawtooth', 0.08, true);
    for (const e of [...enemies]) {
      if (e && dist(this.x, this.y, e.x, e.y) < this.explodeR + e.radius) {
        if (e.takeDamage(this.damage, 'mine')) killCount++;
      }
    }
    if (activeBoss && dist(this.x, this.y, activeBoss.x, activeBoss.y) < this.explodeR + activeBoss.radius) {
      activeBoss.takeDamage(this.damage * 0.6, 'mine');
    }
    // 진화: 플라즈마 클러스터 — 소형 마인 3개 산란
    if (!this.isEvoSub) {
      const ownerWeapon = player && player.weapons.mine;
      if (ownerWeapon && ownerWeapon.level === 5) {
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 + Math.random();
          mines.push(new Mine(this.x + Math.cos(a)*35, this.y + Math.sin(a)*35,
            this.damage * 0.55, this.explodeR * 0.65, true));
        }
      }
    }
    addFloatingText(this.x, this.y - 20, '💥 MINE!', '#ff8800', 11);
  }
  draw(ctx, camera) {
    if (this.exploded) return;
    const sx = this.x - camera.x, sy = this.y - camera.y;
    const pulse = 0.65 + Math.sin(Date.now() / 180) * 0.35;
    ctx.save();
    ctx.globalAlpha = this.armed ? pulse : 0.4;
    ctx.shadowBlur  = this.armed ? 14 : 5;
    ctx.shadowColor = '#ff8800';
    ctx.fillStyle   = this.armed ? '#ff8800' : '#664400';
    ctx.beginPath(); ctx.arc(sx, sy, this.isEvoSub ? 5 : 7, 0, Math.PI * 2); ctx.fill();
    if (this.armed) {
      ctx.globalAlpha   = 0.18;
      ctx.strokeStyle   = '#ff8800';
      ctx.lineWidth     = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.arc(sx, sy, this.triggerR, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

class MineWeapon extends BaseWeapon {
  constructor(owner) { super(owner); this.placeTimer = 0; }
  update(dt) {
    this.timer += dt;
    const cds = [4000, 3500, 3000, 2800, 2400];
    const cd  = cds[Math.min(this.level - 1, cds.length - 1)];
    if (this.timer >= cd) { this.timer = 0; this.placeMines(); }
  }
  placeMines() {
    if (!player) return;
    const counts = [1, 2, 2, 3, 4];
    const count  = counts[Math.min(this.level - 1, counts.length - 1)];
    const dmgs   = [55, 70, 85, 105, 130];
    const dmg    = dmgs[Math.min(this.level - 1, dmgs.length - 1)] * this.owner.damageMultiplier;
    const radii  = [90, 100, 120, 130, 140];
    const explR  = radii[Math.min(this.level - 1, radii.length - 1)];
    for (let i = 0; i < count; i++) {
      const spread = count > 1 ? (i - (count-1)/2) * 24 : 0;
      mines.push(new Mine(this.owner.x + spread, this.owner.y + (Math.random()-0.5)*16, dmg, explR, false));
    }
    playSynthSound([400, 200], 0.08, 'triangle', 0.04);
  }
}

// ============================================================
// 7e. 블랙홀 엔티티 및 무기
// ============================================================
class BlackHole {
  constructor(x, y, pullR, dmg, lifetime, isEvolved) {
    this.x = x; this.y = y;
    this.pullR     = pullR;
    this.dmg       = dmg;
    this.lifetime  = lifetime;
    this.maxLife   = lifetime;
    this.isEvolved = isEvolved;
    this.dmgTimer  = 0;
    this.dmgInt    = 600;
    this.dead      = false;
  }
  update(dt) {
    if (this.dead) return;
    this.lifetime -= dt;
    this.dmgTimer  += dt;
    const pullStr = 2.8 * (dt / 16.66);
    let allT = [...enemies]; if (activeBoss) allT.push(activeBoss);
    for (let e of allT) {
      const dx = this.x - e.x, dy = this.y - e.y;
      const d  = Math.sqrt(dx*dx + dy*dy) || 1;
      if (d < this.pullR) {
        const force = (1 - d / this.pullR) * pullStr;
        e.x += (dx / d) * force;
        e.y += (dy / d) * force;
        if (this.dmgTimer >= this.dmgInt && d < this.pullR * 0.4) {
          if (e === activeBoss) {
            activeBoss.takeDamage(this.dmg * 0.4, 'blackhole');
          } else {
            if (e.takeDamage(this.dmg, 'blackhole')) killCount++;
          }
        }
      }
    }
    if (this.dmgTimer >= this.dmgInt) this.dmgTimer = 0;
    if (this.lifetime <= 0) this.collapse();
  }
  collapse() {
    this.dead = true;
    const collapseR = this.pullR * 0.55;
    const collapseDmg = this.isEvolved ? 9999 : this.dmg * 6;
    createExplosionParticles(this.x, this.y, '#b026ff', 32);
    createExplosionParticles(this.x, this.y, '#ffffff', 12);
    triggerScreenShake(12, 700);
    playSynthSound([55, 140, 380], 0.28, 'sawtooth', 0.12);
    for (const e of [...enemies]) {
      if (e && dist(this.x, this.y, e.x, e.y) < collapseR + e.radius) {
        if (e.takeDamage(collapseDmg, 'blackhole')) killCount++;
      }
    }
    if (activeBoss && dist(this.x, this.y, activeBoss.x, activeBoss.y) < collapseR + activeBoss.radius) {
      activeBoss.takeDamage(Math.min(collapseDmg, activeBoss.maxHp * 0.4), 'blackhole');
    }
    addFloatingText(this.x, this.y - 30, '🌑 붕괴!', '#b026ff', 13);
    // nova_collapse 융합: 12방향 폭발 투사체
    if (player && player.fusions && player.fusions.nova_collapse) {
      const burstDmg = this.dmg * 2.5 * (player.damageMultiplier || 1);
      for (let ri = 0; ri < 12; ri++) {
        const ra = (ri / 12) * Math.PI * 2;
        projectiles.push(new Projectile(this.x, this.y, Math.cos(ra)*7, Math.sin(ra)*7, burstDmg, 9, '#b026ff', 4, 'blackhole'));
      }
      addFloatingText(this.x, this.y - 55, '💥 노바 콜랩스!', '#b026ff', 14);
      playSynthSound([60, 200, 800], 0.3, 'sawtooth', 0.15);
    }
  }
  draw(ctx, camera) {
    if (this.dead) return;
    const sx = this.x - camera.x, sy = this.y - camera.y;
    const prog = this.lifetime / this.maxLife;
    const rot  = (Date.now() / 600) % (Math.PI * 2);
    ctx.save();
    // 인력 범위 링
    ctx.globalAlpha = 0.22 * prog;
    ctx.strokeStyle = '#b026ff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 8]);
    ctx.beginPath(); ctx.arc(sx, sy, this.pullR, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    // 회전 파티클
    ctx.globalAlpha = 0.7 * prog;
    for (let i = 0; i < 5; i++) {
      const a   = rot + i * (Math.PI * 2 / 5);
      const orb = this.pullR * 0.22;
      ctx.shadowBlur  = 10; ctx.shadowColor = i % 2 === 0 ? '#b026ff' : '#00f0ff';
      ctx.fillStyle   = i % 2 === 0 ? '#b026ff' : '#00f0ff';
      ctx.beginPath();
      ctx.arc(sx + Math.cos(a)*orb, sy + Math.sin(a)*orb, 3.5, 0, Math.PI*2);
      ctx.fill();
    }
    // 코어
    ctx.globalAlpha = 0.9 * prog;
    ctx.shadowBlur  = 22; ctx.shadowColor = '#b026ff';
    ctx.fillStyle   = '#0d001a';
    ctx.beginPath(); ctx.arc(sx, sy, 13, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#b026ff'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

class BlackHoleWeapon extends BaseWeapon {
  constructor(owner) { super(owner); }
  update(dt) {
    this.timer += dt;
    const cds = [8000, 7000, 6000, 5500, 4500];
    const cd  = cds[Math.min(this.level - 1, cds.length - 1)];
    if (this.timer >= cd) { this.timer = 0; this.summon(); }
  }
  summon() {
    if (!player) return;
    const counts  = [1, 1, 1, 2, 2];
    const count   = this.level === 5 ? 2 : counts[Math.min(this.level - 1, counts.length - 1)];
    const radii   = [160, 190, 200, 210, 230];
    const pullR   = radii[Math.min(this.level - 1, radii.length - 1)];
    const dmgs    = [18, 22, 28, 34, 42];
    const dmg     = dmgs[Math.min(this.level - 1, dmgs.length - 1)] * this.owner.damageMultiplier;
    const lives   = [3500, 4000, 4500, 5000, 5500];
    const life    = lives[Math.min(this.level - 1, lives.length - 1)];
    const isEvo   = this.level === 5;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r   = 120 + Math.random() * 100;
      blackHoles.push(new BlackHole(
        this.owner.x + Math.cos(ang) * r,
        this.owner.y + Math.sin(ang) * r,
        pullR, dmg, life, isEvo
      ));
    }
    playSynthSound([60, 30], 0.22, 'sawtooth', 0.1);
    triggerScreenShake(5, 300);
    addFloatingText(this.owner.x, this.owner.y - 30, '🌑 블랙홀 생성!', '#b026ff', 11);
  }
}

// ============================================================
// 신규 무기 A — 커맨드 댄서
// ============================================================
class CommandDanceWeapon extends BaseWeapon {
  constructor(owner) {
    super(owner);
    this._seq      = [];
    this._progress = 0;
    this._prev     = { up:false, down:false, left:false, right:false };
    this._displayTimer = 0;
    this._cooldown = 0;
  }
  _genSeq() {
    const dirs = ['up','down','left','right'];
    const len  = [2,2,3,4,5][Math.min(this.level-1,4)];
    this._seq = [];
    for (let i = 0; i < len; i++) this._seq.push(dirs[Math.floor(Math.random()*4)]);
    this._progress = 0;
    this._displayTimer = 6000;
  }
  update(dt) {
    if (player?._gdBurstTimer > 0) this._cooldown = 0;
    if (this._cooldown > 0) { this._cooldown -= dt; return; }
    if (this._seq.length === 0) { this._genSeq(); return; }
    if (this._displayTimer > 0) this._displayTimer -= dt;
    // 방향 상태
    const cur = {
      up:    !!(keys['w']||keys['W']||keys['ArrowUp'])    || (isTouching && touchDY < -0.35),
      down:  !!(keys['s']||keys['S']||keys['ArrowDown'])  || (isTouching && touchDY > 0.35),
      left:  !!(keys['a']||keys['A']||keys['ArrowLeft'])  || (isTouching && touchDX < -0.35),
      right: !!(keys['d']||keys['D']||keys['ArrowRight']) || (isTouching && touchDX > 0.35),
    };
    for (const dir of ['up','down','left','right']) {
      if (cur[dir] && !this._prev[dir]) {
        if (dir === this._seq[this._progress]) {
          this._progress++;
          playSynthSound([400 + this._progress*100], 0.07, 'sine', 0.03);
          if (this._progress >= this._seq.length) {
            this._triggerDance();
            this._seq = [];
            this._cooldown = 3200;
          }
        } else {
          this._progress = 0;
          playSynthSound([200], 0.05, 'square', 0.02);
        }
        break;
      }
    }
    this._prev = { ...cur };
  }
  _triggerDance() {
    if (!player) return;
    const lvl = this.level;
    const radius = [200,240,270,300,340][lvl-1] ?? 200;
    const dmg    = ([350,380,430,470,540][lvl-1] ?? 350) * this.owner.damageMultiplier;
    createExplosionParticles(this.owner.x, this.owner.y, '#ff88ff', Math.min(22, MAX_PARTICLES - particles.length));
    triggerScreenShake(8, 320);
    playSynthSound([600,900,1200,800], 0.18, 'triangle', 0.09);
    addFloatingText(this.owner.x, this.owner.y - 65, '💃 댄스!', '#ff88ff', 15);
    let allT = [...enemies]; if (activeBoss) allT.push(activeBoss);
    const chainTargets = [];
    for (const e of allT) {
      if (dist(this.owner.x, this.owner.y, e.x, e.y) < radius) {
        if (e === activeBoss) activeBoss.takeDamage(Math.floor(dmg * 0.45), 'command_dance');
        else { if (e.takeDamage(dmg, 'command_dance')) { killCount++; stageKillProgress++; } if (lvl >= 3) chainTargets.push(e); }
      }
    }
    if (lvl >= 3) {
      for (let i = 0; i < Math.min(2, chainTargets.length); i++) {
        const ct = chainTargets[i];
        if (ct && ct.hp > 0) { if (ct.takeDamage(Math.floor(dmg * 0.3), 'command_dance')) { killCount++; stageKillProgress++; } }
      }
    }
    if (lvl >= 4) this.owner.hp = Math.min(this.owner.hp + 5, this.owner.maxHp);
    if (player.fusions?.dance_master) {
      for (let i = 0; i < 8; i++) {
        const a = (i/8)*Math.PI*2;
        if (projectiles.length < MAX_PROJECTILES)
          projectiles.push(new Projectile(this.owner.x, this.owner.y, Math.cos(a)*7, Math.sin(a)*7, dmg*0.55, 8, '#ff88ff', 2, 'command_dance'));
      }
    }
    checkStageProgress();
  }
  draw(ctx, camera) {
    if (!player) return;
    const bx = this.owner.x - camera.x;
    const by = this.owner.y - camera.y;
    ctx.save();
    // 쿨다운 중: 링 표시
    if (this._cooldown > 0) {
      const cdMax = 3200;
      const pct   = 1 - this._cooldown / cdMax;
      ctx.strokeStyle = '#ff88ff'; ctx.lineWidth = 2.5;
      ctx.shadowBlur = 8; ctx.shadowColor = '#ff88ff';
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(bx, by, this.owner.radius + 6, -Math.PI/2, -Math.PI/2 + Math.PI*2*pct);
      ctx.stroke();
      ctx.globalAlpha = 1; ctx.restore();
      return;
    }
    // 시퀀스 표시
    if (this._seq.length === 0) { ctx.restore(); return; }
    const ICONS = { up:'↑', down:'↓', left:'←', right:'→' };
    const arrowY = by - this.owner.radius - 28;
    const w = this._seq.length * 22;
    // 배경 패널
    ctx.fillStyle = 'rgba(0,0,0,0.52)';
    ctx.beginPath();
    const rx = bx - w/2 - 4, ry = arrowY - 15;
    ctx.roundRect(rx, ry, w + 8, 20, 3);
    ctx.fill();
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < this._seq.length; i++) {
      const x = bx - w/2 + i*22 + 11;
      if (i < this._progress) {
        ctx.shadowBlur = 12; ctx.shadowColor = '#ff88ff';
        ctx.fillStyle = '#ff88ff';
      } else if (i === this._progress) {
        ctx.shadowBlur = 18; ctx.shadowColor = '#ffffff';
        ctx.fillStyle = '#ffffff';
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#aaaaaa';
      }
      ctx.fillText(ICONS[this._seq[i]], x, arrowY);
    }
    ctx.restore();
  }
}

// ============================================================
// 신규 무기 B — 에코 레코더
// ============================================================
class EchoRecordWeapon extends BaseWeapon {
  constructor(owner) {
    super(owner);
    this._snaps    = [];   // {x, y, angle}
    this._snapT    = 0;
    this._echoes   = [];   // {snaps, idx, t, atkT}
    this._cd       = 0;
  }
  update(dt) {
    // 스냅샷 기록 (100ms마다)
    if (player) {
      this._snapT += dt;
      if (this._snapT >= 100) {
        this._snapT = 0;
        const maxS = [30,30,40,40,50][Math.min(this.level-1,4)];
        this._snaps.push({ x:player.x, y:player.y, angle:player._moveAngle||0 });
        if (this._snaps.length > maxS) this._snaps.shift();
      }
    }
    // 쿨다운
    const cdBase = [18000,16000,14000,12000,10000][Math.min(this.level-1,4)];
    this._cd += dt;
    if (this._cd >= cdBase && this._snaps.length >= 8) {
      this._cd = 0;
      const maxE = [1,1,1,2,3][Math.min(this.level-1,4)];
      if (this._echoes.length < maxE) {
        this._echoes.push({ snaps:[...this._snaps], idx:0, t:0, atkT:0 });
        addFloatingText(player.x, player.y - 70, '🔄 에코!', '#88ffff', 13);
        playSynthSound([600,400,800], 0.11, 'sine', 0.05);
      }
    }
    // 에코 재생
    const dmMult = [1.0,1.4,1.4,1.8,2.0][Math.min(this.level-1,4)];
    for (let i = this._echoes.length - 1; i >= 0; i--) {
      const ec = this._echoes[i];
      ec.t   += dt; ec.atkT += dt;
      if (ec.t >= 100) { ec.t -= 100; ec.idx++; }
      if (ec.idx >= ec.snaps.length) { this._echoes.splice(i, 1); continue; }
      if (ec.atkT >= 800 && projectiles.length < MAX_PROJECTILES) {
        ec.atkT = 0;
        const sn  = ec.snaps[ec.idx];
        const dmg = 55 * this.owner.damageMultiplier * dmMult;
        const a   = sn.angle || 0;
        projectiles.push(new Projectile(sn.x, sn.y, Math.cos(a)*7, Math.sin(a)*7, dmg, 5, '#88ffff', 1, 'echo_record'));
      }
    }
  }
  draw(ctx, camera) {
    for (const ec of this._echoes) {
      if (ec.idx >= ec.snaps.length) continue;
      const sn = ec.snaps[ec.idx];
      const bx = sn.x - camera.x, by = sn.y - camera.y;
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.shadowBlur = 14; ctx.shadowColor = '#88ffff';
      ctx.strokeStyle = '#88ffff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bx, by, 11, 0, Math.PI*2); ctx.stroke();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#88ffff';
      ctx.fill();
      ctx.restore();
    }
  }
}

// ============================================================
// 신규 무기 C — 바이러스 증식
// ============================================================
class ViralBombWeapon extends BaseWeapon {
  constructor(owner) { super(owner); }
  draw(ctx, camera) {
    if (!player) return;
    const infected = enemies.filter(e => e._infected && e._infectTimer > 0 && !e.dead);
    if (!infected.length) return;
    const bx = this.owner.x - camera.x, by = this.owner.y - camera.y;
    ctx.save();
    for (const e of infected) {
      const tx = e.x - camera.x, ty = e.y - camera.y;
      const fade = Math.min(1, e._infectTimer / 1500);
      ctx.globalAlpha = fade * 0.4 * (0.6 + 0.4 * Math.sin(Date.now() * 0.006));
      ctx.strokeStyle = '#33ff33'; ctx.lineWidth = 1;
      ctx.shadowBlur = 6; ctx.shadowColor = '#33ff33';
      ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.setLineDash([]);
      // 감염 잔여 링
      const pct = e._infectTimer / 4000;
      ctx.globalAlpha = fade * 0.7;
      ctx.strokeStyle = '#33ff33'; ctx.lineWidth = 2;
      ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(tx, ty, e.radius + 5, -Math.PI/2, -Math.PI/2 + Math.PI*2*pct); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    ctx.restore();
  }
  update(dt) {
    this.timer += dt;
    const cd = [4500,4000,3800,3500,3000][Math.min(this.level-1,4)];
    if (this.timer >= cd) { this.timer = 0; this._fire(); }
  }
  _fire() {
    if (!player) return;
    const lvl  = this.level;
    const maxI = [10,10,12,14,15][lvl-1] ?? 10;
    const cur  = enemies.filter(e => e._infected).length;
    if (cur >= maxI) return;
    let target = null, minD = 800;
    for (const e of enemies) {
      if (e._infected) continue;
      const d = dist(player.x, player.y, e.x, e.y);
      if (d < minD) { minD = d; target = e; }
    }
    if (!target) return;
    const dmg   = [130,155,195,225,270][lvl-1] * this.owner.damageMultiplier;
    const chain = [0,0,1,1,2][lvl-1] ?? 0;
    target._infected    = true;
    target._infectTimer = 4000;
    target._infectChain = chain;
    target._infectDmg   = dmg;
    addFloatingText(target.x, target.y - 35, '🦠 감염!', '#33ff33', 12);
    playSynthSound([200,150,80], 0.10, 'sawtooth', 0.05);
    // 시각용 투사체 (0 데미지, 빠름)
    if (projectiles.length < MAX_PROJECTILES) {
      const a = Math.atan2(target.y - player.y, target.x - player.x);
      projectiles.push(new Projectile(player.x, player.y, Math.cos(a)*14, Math.sin(a)*14, 0, 6, '#33ff33', 1, 'visual'));
    }
  }
}

// ============================================================
// 신규 무기 D — 공명 증폭기
// ============================================================
class ResonanceWeapon extends BaseWeapon {
  constructor(owner) { super(owner); this._visTarget = null; this._visTimer = 0; }
  update(dt) {
    if (this._visTimer > 0) this._visTimer -= dt;
    this.timer += dt;
    const cd = [900,800,750,700,600][Math.min(this.level-1,4)];
    if (this.timer >= cd) { this.timer = 0; this._fire(); }
  }
  _fire() {
    if (!player) return;
    let allT = [...enemies]; if (activeBoss) allT.push(activeBoss);
    if (!allT.length) return;
    const target = allT.reduce((best, e) => {
      const sB = (best._resStack||0)*500 - dist(player.x,player.y,best.x,best.y);
      const sE = (e._resStack||0)*500    - dist(player.x,player.y,e.x,   e.y);
      return sE > sB ? e : best;
    }, allT[0]);
    const a   = Math.atan2(target.y - player.y, target.x - player.x);
    const dmg = [18,22,28,34,40][Math.min(this.level-1,4)] * this.owner.damageMultiplier;
    if (projectiles.length < MAX_PROJECTILES)
      projectiles.push(new Projectile(player.x, player.y, Math.cos(a)*9.5, Math.sin(a)*9.5, dmg, 5, '#ffaa00', 1, 'resonance'));
    this._visTarget = target;
    this._visTimer  = 200;
    if (Math.random() < 0.25) playSynthSound([440,660], 0.04, 'sine', 0.02);
  }
  draw(ctx, camera) {
    if (!player) return;
    const bx = this.owner.x - camera.x, by = this.owner.y - camera.y;
    const pct  = Math.min(1, this.timer / ([900,800,750,700,600][Math.min(this.level-1,4)] || 900));
    const col  = this.level >= 4 ? '#ff8800' : '#ffaa00';
    ctx.save();
    // 충전 호 (타이머 기반)
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.shadowBlur = 10; ctx.shadowColor = col;
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.arc(bx, by, this.owner.radius + 10, -Math.PI/2, -Math.PI/2 + Math.PI*2*pct);
    ctx.stroke();
    // 조준 선 (발사 직후 잠깐)
    if (this._visTimer > 0 && this._visTarget && !this._visTarget.dead) {
      const fade = this._visTimer / 200;
      ctx.globalAlpha = fade * 0.6;
      ctx.strokeStyle = col; ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(this._visTarget.x - camera.x, this._visTarget.y - camera.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

// ============================================================
// 신규 무기 E — 해킹 이식기
// ============================================================
class HackGunWeapon extends BaseWeapon {
  constructor(owner) { super(owner); this._lineTarget = null; this._lineTimer = 0; }
  update(dt) {
    this.timer += dt;
    if (this._lineTimer > 0) this._lineTimer -= dt;
    const cd = [5000,4500,4000,3500,3000][Math.min(this.level-1,4)];
    if (this.timer >= cd) { this.timer = 0; this._fire(); }
  }
  _fire() {
    if (!player || !enemies.length) return;
    const lvl  = this.level;
    const maxH = [1,1,2,2,3][lvl-1] ?? 1;
    if (enemies.filter(e => e._hacked).length >= maxH) return;
    const target = [...enemies].filter(e => !e._hacked).sort((a,b) => b.hp - a.hp)[0];
    if (!target) return;
    const zombieLvl = player.classPassives?.ck_zombie || 0;
    const dur  = ([8000,12000,12000,16000,20000][lvl-1] ?? 8000) + (zombieLvl >= 2 ? 5000 : zombieLvl >= 1 ? 3000 : 0);
    const expl = [0,0,0,200,260][lvl-1] ?? 0;
    target._hacked      = true;
    target._hackTimer   = dur;
    target._hackDmgTimer= 0;
    target._hackExplosion = expl;
    addFloatingText(target.x, target.y - 40, '💻 해킹!', '#00ccff', 13);
    playSynthSound([1000,600,300], 0.13, 'square', 0.06);
    this._lineTarget = target;
    this._lineTimer  = 600;
    // 바이러스 장악 진화: 해킹 종료 시 주변 1체 연쇄 → 처리는 enemies.js hackTimer=0 블록에서
    // flag 전달
    target._hackEvolved = !!(player.fusions?.virus_takeover);
  }
  draw(ctx, camera) {
    if (!player) return;
    const bx = this.owner.x - camera.x, by = this.owner.y - camera.y;
    ctx.save();
    // 해킹 중인 적 전체에 연결선 (지속 표시)
    const hacked = enemies.filter(e => e._hacked && !e.dead);
    for (const t of hacked) {
      const tx = t.x - camera.x, ty = t.y - camera.y;
      const pulse = 0.35 + 0.25 * Math.sin(Date.now() * 0.008);
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#00ccff'; ctx.lineWidth = 1.5;
      ctx.shadowBlur = 8; ctx.shadowColor = '#00ccff';
      ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.setLineDash([]);
      // 해킹 잔여 시간 고리
      const hackPct = Math.max(0, (t._hackTimer || 0) / 20000);
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#00ccff'; ctx.lineWidth = 2;
      ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(tx, ty, t.radius + 6, -Math.PI/2, -Math.PI/2 + Math.PI*2*hackPct); ctx.stroke();
    }
    // 발사 직후 강조선
    if (this._lineTimer > 0 && this._lineTarget && !this._lineTarget.dead) {
      ctx.globalAlpha = this._lineTimer / 600;
      ctx.strokeStyle = '#88eeff'; ctx.lineWidth = 3;
      ctx.shadowBlur = 18; ctx.shadowColor = '#00ccff';
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(this._lineTarget.x - camera.x, this._lineTarget.y - camera.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// ============================================================
// 신규 무기 F — 오버차지 컨덴서
// ============================================================
class OverchargeWeapon extends BaseWeapon {
  constructor(owner) { super(owner); this.charge = 0; }
  update(dt) {
    const rate = [20,26,26,32,40][Math.min(this.level-1,4)];
    this.charge += rate * (dt/1000);
    const safe = this.level >= 4;
    if (this.charge >= 200) {
      this._discharge(!safe); // 과충전: 역폭발 (Lv4+ 면 안전)
      this.charge = 0;
      return;
    }
    if (this.charge >= 100) {
      // 근처 적이 있으면 방전
      const inRange = enemies.some(e => player && dist(player.x,player.y,e.x,e.y) < 380) ||
                      (activeBoss && player && dist(player.x,player.y,activeBoss.x,activeBoss.y) < 380);
      if (inRange) { this._discharge(false); this.charge = 0; }
    }
  }
  _discharge(penalty) {
    if (!player) return;
    const lvl    = this.level;
    const radius = [180,200,240,280,320][lvl-1] ?? 180;
    const base   = [300,360,420,500,580][lvl-1] ?? 300;
    const dmg    = Math.floor(base * (Math.min(this.charge,200)/100) * this.owner.damageMultiplier);
    createExplosionParticles(this.owner.x, this.owner.y, '#ffff00', Math.min(18, MAX_PARTICLES - particles.length));
    triggerScreenShake(penalty ? 12 : 7, 380);
    playSynthSound([100,200,500,1000], 0.19, 'sawtooth', 0.10);
    addFloatingText(this.owner.x, this.owner.y - 65,
      penalty ? '⚡ 역폭발!' : `⚡ 방전 ${Math.floor(this.charge)}%`,
      penalty ? '#ff4466' : '#ffff00', 14);
    let allT = [...enemies]; if (activeBoss) allT.push(activeBoss);
    const chainHit = [];
    for (const e of allT) {
      if (dist(this.owner.x, this.owner.y, e.x, e.y) < radius) {
        if (e === activeBoss) activeBoss.takeDamage(Math.floor(dmg*0.4), 'overcharge');
        else { if (e.takeDamage(dmg, 'overcharge')) { killCount++; stageKillProgress++; } chainHit.push(e); }
      }
    }
    if (penalty) this.owner.takeDamage(18);
    if (player.fusions?.critical_discharge && chainHit.length > 0) {
      for (let i = 0; i < Math.min(4, chainHit.length); i++) {
        const ct = chainHit[i];
        if (ct && ct.hp > 0) {
          createExplosionParticles(ct.x, ct.y, '#ffff00', 4);
          if (ct.takeDamage(Math.floor(dmg*0.4), 'overcharge')) { killCount++; stageKillProgress++; }
        }
      }
    }
    checkStageProgress();
  }
  draw(ctx, camera) {
    if (!player || this.charge < 8) return;
    const bx  = this.owner.x - camera.x, by = this.owner.y - camera.y;
    const pct = Math.min(this.charge, 200) / 200;
    const col = this.charge >= 160 ? '#ff4466' : this.charge >= 100 ? '#ffaa00' : '#ffff00';
    ctx.save();
    ctx.strokeStyle = col; ctx.lineWidth = 2.5;
    ctx.shadowBlur = 12; ctx.shadowColor = col;
    ctx.globalAlpha = 0.72;
    ctx.beginPath();
    ctx.arc(bx, by, this.owner.radius + 8, -Math.PI/2, -Math.PI/2 + Math.PI*2*pct);
    ctx.stroke();
    ctx.restore();
  }
}
