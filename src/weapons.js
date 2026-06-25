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
}

// 6. 데이터 드론
class DroneWeapon extends BaseWeapon {
  constructor(owner) { super(owner); this.angleOffset = 0; this.droneTimers = [0, 0, 0, 0, 0]; }
  update(dt) {
    const count  = ([1, 1, 2, 2, 3][this.level - 1] ?? 1) + (this.owner.classPassives?.dr_count || 0);
    const fireCD = [2000, 1500, 1500, 1100, 900][this.level - 1] ?? 2000;
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
        let nearest = null, minD = 350;
        for (let e of allT) {
          const d = dist(droneX, droneY, e.x, e.y);
          if (d < minD) { minD = d; nearest = e; }
        }
        if (nearest && projectiles.length < MAX_PROJECTILES) {
          const a     = Math.atan2(nearest.y - droneY, nearest.x - droneX);
          const dmgB  = [12, 16, 20, 30, 45][this.level - 1] ?? 12;
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
    const count  = [1, 1, 2, 2, 3][this.level - 1] ?? 1;
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
    if (this.level === 0) return;
    // 사거리 표시 없음 — 유도탄이라 범위 없음
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
class ChainWeapon extends BaseWeapon {
  constructor(owner) { super(owner); }
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
