// 11. 필드 아이템 클래스
// ============================================================
class FieldItem {
  constructor(x, y, type) {
    this.x = x; this.y = y; this.type = type;
    this.radius    = 14;
    this.life      = 18000;
    this.maxLife   = 18000;
    this.bobTimer  = Math.random() * Math.PI * 2;
    this.collected = false;
    const data = FIELD_ITEM_TYPES[type];
    this.color = data.color;
    this.icon  = data.icon;
  }

  update(dt) {
    if (this.collected) return;
    this.life     -= dt;
    this.bobTimer += dt * 0.003;
    if (!player) return;
    let d = dist(this.x, this.y, player.x, player.y);
    if (d < player.radius + this.radius) this.collect();
  }

  collect() {
    if (this.collected) return;
    this.collected = true;
    applyFieldItemEffect(this.type, this.x, this.y);
    playSynthSound([800, 1200], 0.12, 'sine', 0.06);
  }

  draw(ctx, camera) {
    let bob   = Math.sin(this.bobTimer) * 5;
    let alpha = this.life < this.maxLife * 0.25 ? (this.life / (this.maxLife * 0.25)) : 1.0;
    let bx = this.x - camera.x, by = this.y - camera.y + bob;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur  = 18; ctx.shadowColor = this.color;
    ctx.fillStyle   = 'rgba(10,10,20,0.75)';
    ctx.beginPath(); ctx.arc(bx, by, this.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = this.color; ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font         = `${this.radius}px serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.icon, bx, by);
    ctx.restore();
  }
}

function applyFieldItemEffect(type, x, y) {
  if (type === 'health') {
    let healAmt = player.classId === 'engineer' ? 60 : 40;
    player.hp = Math.min(player.hp + healAmt, player.maxHp);
    addFloatingText(x, y, `+${healAmt} HP`, '#ff4466', 16);

  } else if (type === 'magnet') {
    for (let gem of gems) { gem.isAttracted = true; gem.speed = Math.max(gem.speed, 8); }
    addFloatingText(x, y, 'XP 흡수!', '#b026ff', 14);

  } else if (type === 'nuke') {
    let nuked = 0;
    for (let e of [...enemies]) {
      createExplosionParticles(e.x, e.y, '#ffe600', 8);
      stageKillProgress++;
      killCount++;
      onEnemyKilled();
      nuked++;
      gems.push(new Gem(e.x, e.y, e.xpValue));
    }
    if (activeBoss) {
      let bossKilled = activeBoss.takeDamage(activeBoss.maxHp * 0.3, 'nuke');
      if (bossKilled) killCount++;
      addFloatingText(activeBoss.x, activeBoss.y - 60, 'NUKE HIT!', '#ffe600', 16);
    }
    enemies.length = 0;
    addFloatingText(x, y, `☢ NUKE x${nuked}!`, '#ffe600', 18);
    triggerScreenShake(14, 700);
    checkStageProgress();

  } else if (type === 'shield') {
    player.shieldTimer = player.classId === 'cyborg' ? 8000 : 5000;
    addFloatingText(x, y, '실드 활성!', '#00f0ff', 14);

  } else if (type === 'surge') {
    player.surgeTimer = 8000;
    addFloatingText(x, y, '오버클럭!', '#39ff14', 14);
  }
}

// ============================================================
// 12. 플로팅 텍스트 클래스
// ============================================================
class FloatingText {
  constructor(x, y, text, color, size) {
    this.x = x; this.y = y;
    this.text  = text; this.color = color;
    this.size  = size || 13;
    this.vy    = -1.2;
    this.life  = 750;
    this.maxLife = 750;
  }
  update(dt) { this.y += this.vy * (dt / 16.66); this.vy *= 0.97; this.life -= dt; }
  draw(ctx, camera) {
    let alpha = Math.min(this.life / this.maxLife * 2, 1.0);
    ctx.save();
    ctx.globalAlpha  = alpha;
    ctx.font         = `bold ${this.size}px Orbitron, monospace`;
    ctx.fillStyle    = this.color;
    ctx.textAlign    = 'center';
    ctx.shadowBlur   = 6; ctx.shadowColor = this.color;
    ctx.fillText(this.text, this.x - camera.x, this.y - camera.y);
    ctx.restore();
  }
}

function addFloatingText(x, y, text, color, size) {
  floatingTexts.push(new FloatingText(x, y - 20, text, color, size));
}

// ============================================================
// 13. 경험치 젬 및 파티클
// ============================================================
class Gem {
  constructor(x, y, value) {
    this.x = x; this.y = y; this.value = value;
    this.radius = 5 + Math.min(value, 5);
    this.color  = value === 1 ? '#00f0ff' : value < 5 ? '#b026ff' : '#ffe600';
    this.isAttracted = false;
    this.speed  = 0.5;
  }
  update(dt) {
    if (!player) return;
    let d = dist(this.x, this.y, player.x, player.y);
    if (d < player.radius + this.radius) {
      player.gainXp(this.value);
      if (player.passives.nanobots > 0) {
        const chance = player.passives.nanobots === 2 ? 0.4 : 0.2;
        const heal   = player.passives.nanobots === 2 ? 5 : 3;
        if (Math.random() < chance) player.hp = Math.min(player.hp + heal, player.maxHp);
      }
      playGemSound();
      let idx = gems.indexOf(this);
      if (idx !== -1) gems.splice(idx, 1);
      return;
    }
    if (stageGemMagnet || this.isAttracted || d < player.magnetRadius) {
      this.isAttracted = true;
      let dx = player.x - this.x, dy = player.y - this.y;
      if (d > 0) { dx /= d; dy /= d; }
      const accel = stageGemMagnet ? 3.0 : 0.35;
      const maxSpd = stageGemMagnet ? 40  : 18;
      this.speed = Math.min(this.speed + accel * (dt / 16.66), maxSpd);
      this.x += dx * this.speed * (dt / 16.66);
      this.y += dy * this.speed * (dt / 16.66);
    }
  }
  draw(ctx, camera) {
    ctx.save();
    ctx.shadowBlur = 8; ctx.shadowColor = this.color; ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(this.x - camera.x,                  this.y - camera.y - this.radius);
    ctx.lineTo(this.x - camera.x + this.radius*0.7, this.y - camera.y);
    ctx.lineTo(this.x - camera.x,                  this.y - camera.y + this.radius);
    ctx.lineTo(this.x - camera.x - this.radius*0.7, this.y - camera.y);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

// ============================================================
// 골드 코인 클래스
// ============================================================
class GoldCoin {
  constructor(x, y) {
    this.x = x + (Math.random() - 0.5) * 50;
    this.y = y + (Math.random() - 0.5) * 50;
    this.radius    = 5;
    this.speed     = 0;
    this.collected = false;
    this.bobTimer  = Math.random() * Math.PI * 2;
  }
  update(dt) {
    if (!player || this.collected) return;
    this.bobTimer += dt * 0.004;
    const d = dist(this.x, this.y, player.x, player.y);
    if (d < player.radius + this.radius) {
      this.collected = true;
      player.gold++;
      playSynthSound([880, 1046], 0.06, 'sine', 0.04);
      return;
    }
    if (d < player.magnetRadius * 0.6) {
      const dx = player.x - this.x, dy = player.y - this.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      this.speed = Math.min(this.speed + 0.4 * (dt / 16.66), 10);
      this.x += (dx / len) * this.speed * (dt / 16.66);
      this.y += (dy / len) * this.speed * (dt / 16.66);
    }
  }
  draw(ctx, camera) {
    const bob = Math.sin(this.bobTimer) * 3;
    const bx  = this.x - camera.x, by = this.y - camera.y + bob;
    ctx.save();
    ctx.shadowBlur = 10; ctx.shadowColor = '#ffd700';
    ctx.fillStyle  = '#ffd700';
    ctx.beginPath(); ctx.arc(bx, by, this.radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.arc(bx - 1.5, by - 1.5, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function spawnGoldCoins(x, y, count) {
  for (let i = 0; i < count; i++) goldCoins.push(new GoldCoin(x, y));
}

class Particle {
  constructor(x, y, vx, vy, color, duration = 400) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.color = color; this.maxLife = duration; this.life = duration;
    this.radius = 2.5 + Math.random() * 2;
  }
  update(dt) { this.x += this.vx * (dt/16.66); this.y += this.vy * (dt/16.66); this.life -= dt; }
  draw(ctx, camera) {
    let alpha = this.life / this.maxLife;
    ctx.fillStyle = this.color; ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(this.x - camera.x, this.y - camera.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function createExplosionParticles(x, y, color, count) {
  const allowed = Math.min(count, MAX_PARTICLES - particles.length);
  for (let i = 0; i < allowed; i++) {
    let speed = 1.0 + Math.random() * 3.5;
    let angle = Math.random() * Math.PI * 2;
    particles.push(new Particle(x, y, Math.cos(angle)*speed, Math.sin(angle)*speed, color, 250 + Math.random()*250));
  }
}

function createBeatParticles(x, y) {
  if (particles.length >= MAX_PARTICLES - 8) return;
  for (let i = 0; i < 8; i++) {
    let speed = 1.5 + Math.random() * 3;
    let angle = Math.random() * Math.PI * 2;
    particles.push(new Particle(x, y, Math.cos(angle)*speed, Math.sin(angle)*speed, '#ffe600', 300 + Math.random()*150));
  }
}
function createDamageOverlayParticles(x, y) {
  for (let i = 0; i < 8; i++) {
    let speed = 2.0 + Math.random() * 2.0;
    let angle = Math.random() * Math.PI * 2;
    particles.push(new Particle(x, y, Math.cos(angle)*speed, Math.sin(angle)*speed, '#ff007f', 400));
  }
}

// ============================================================
// 14. 스테이지 시스템