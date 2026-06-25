// ============================================================
// 8. 투사체 및 레이저
// ============================================================
class Projectile {
  constructor(x, y, vx, vy, damage, radius, color, pierce = 1, weaponKey = '') {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.damage = damage; this.radius = radius; this.color = color;
    this.pierce = pierce; this.weaponKey = weaponKey;
    this.life = 3500;
    this.hitEnemies = new Set();
  }
  update(dt) { this.x += this.vx * (dt / 16.66); this.y += this.vy * (dt / 16.66); this.life -= dt; }
  draw(ctx, camera) {
    ctx.save();
    ctx.shadowBlur = 8; ctx.shadowColor = this.color; ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x - camera.x, this.y - camera.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class BoomerangProjectile extends Projectile {
  constructor(x, y, vx, vy, damage, color, owner) {
    super(x, y, vx, vy, damage, 8, color, 15, 'boomerang');
    this.owner       = owner;
    this.returning   = false;
    this.travelTime  = 0;
    this.returnDelay = 550;
    this.life        = 3000;
  }
  update(dt) {
    this.travelTime += dt;
    if (!this.returning && this.travelTime >= this.returnDelay) {
      this.returning = true;
      this.hitEnemies.clear();
      this.pierce = 15;
    }
    if (this.returning) {
      const dx = this.owner.x - this.x;
      const dy = this.owner.y - this.y;
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d < 22) { this.life = 0; return; }
      this.vx = (dx / d) * 11;
      this.vy = (dy / d) * 11;
    }
    this.x += this.vx * (dt / 16.66);
    this.y += this.vy * (dt / 16.66);
    this.life -= dt;
  }
  draw(ctx, camera) {
    const sx = this.x - camera.x, sy = this.y - camera.y;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(this.travelTime * 0.025);
    ctx.shadowBlur = 14; ctx.shadowColor = this.color;
    ctx.strokeStyle = this.color; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0.35, Math.PI * 2 - 0.35);
    ctx.stroke();
    ctx.strokeStyle = this.color + '66';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0.6, Math.PI * 2 - 0.6);
    ctx.stroke();
    ctx.restore();
  }
}

// 미사일 투사체 — 유도 + 폭발
class MissileProjectile extends Projectile {
  constructor(x, y, vx, vy, damage, radius, color, weaponKey, isEvo) {
    super(x, y, vx, vy, damage, radius, color, 1, weaponKey);
    this.speed   = Math.sqrt(vx*vx + vy*vy);
    this.life    = 4500;
    this.isEvo   = isEvo;
    this.trail   = [];
  }
  update(dt) {
    // 가장 가까운 적 추적
    let allT = [...enemies]; if (activeBoss) allT.push(activeBoss);
    let target = null, minD = Infinity;
    for (let e of allT) {
      const d = dist(this.x, this.y, e.x, e.y);
      if (d < minD) { minD = d; target = e; }
    }
    if (target) {
      const dx = target.x - this.x, dy = target.y - this.y;
      const d  = Math.sqrt(dx*dx + dy*dy) || 1;
      const tx = (dx / d) * this.speed;
      const ty = (dy / d) * this.speed;
      const steer = this.isEvo ? 0.06 : 0.04;
      this.vx += (tx - this.vx) * steer * (dt / 16.66);
      this.vy += (ty - this.vy) * steer * (dt / 16.66);
    }
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 8) this.trail.shift();
    this.x += this.vx * (dt / 16.66);
    this.y += this.vy * (dt / 16.66);
    this.life -= dt;
  }
  draw(ctx, camera) {
    ctx.save();
    // 잔상 트레일
    for (let i = 0; i < this.trail.length; i++) {
      const a = (i / this.trail.length) * 0.4;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ff8800';
      ctx.beginPath();
      ctx.arc(this.trail[i].x - camera.x, this.trail[i].y - camera.y, this.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 18; ctx.shadowColor = this.color;
    ctx.fillStyle  = this.color;
    ctx.beginPath();
    ctx.arc(this.x - camera.x, this.y - camera.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  explode() {
    const expR  = this.isEvo ? 90 : 60;
    const expDmg = this.damage * 0.7;
    createExplosionParticles(this.x, this.y, '#ff8800', this.isEvo ? 20 : 12);
    triggerScreenShake(this.isEvo ? 5 : 3, 200);
    let allT = [...enemies]; if (activeBoss) allT.push(activeBoss);
    for (let e of allT) {
      if (dist(this.x, this.y, e.x, e.y) < expR + e.radius) {
        const killed = e === activeBoss
          ? activeBoss.takeDamage(expDmg, 'missile')
          : e.takeDamage(expDmg, 'missile');
        if (killed && e !== activeBoss) killCount++;
      }
    }
    this.life = 0;
  }
}

let activeLasersArr = [];

function createLaserBeam(px, py, angle, width, damage, duration) {
  let dx = Math.cos(angle), dy = Math.sin(angle);
  let length = 2000;
  const laser = { startX: px, startY: py, endX: px + dx*length, endY: py + dy*length, width, damage, maxLife: duration, life: duration };
  activeLasersArr.push(laser);
  let allTargets = [...enemies];
  if (activeBoss) allTargets.push(activeBoss);
  for (let e of allTargets) {
    if (distToSegment(e.x, e.y, px, py, laser.endX, laser.endY) < e.radius + width / 2) {
      if (e.takeDamage(damage, 'laser')) killCount++;
    }
  }
}

function updateAndDrawLasers(ctx, camera, dt) {
  ctx.save();
  for (let i = activeLasersArr.length - 1; i >= 0; i--) {
    let l = activeLasersArr[i];
    l.life -= dt;
    let pct = l.life / l.maxLife;
    ctx.shadowBlur = 20; ctx.shadowColor = '#ffe600';
    ctx.strokeStyle = `rgba(255,230,0,${pct})`; ctx.lineWidth = l.width * pct;
    ctx.beginPath(); ctx.moveTo(l.startX - camera.x, l.startY - camera.y);
    ctx.lineTo(l.endX - camera.x, l.endY - camera.y); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${pct * 0.9})`; ctx.lineWidth = l.width * pct * 0.35;
    ctx.beginPath(); ctx.moveTo(l.startX - camera.x, l.startY - camera.y);
    ctx.lineTo(l.endX - camera.x, l.endY - camera.y); ctx.stroke();
    if (l.life <= 0) activeLasersArr.splice(i, 1);
  }
  ctx.restore();
}

// ============================================================
// 9. 적 클래스 (일반 Enemy + Boss)