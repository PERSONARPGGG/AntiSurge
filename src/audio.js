// ============================================================
// 4. Web Audio API — 효과음
// ============================================================
let audioCtx = null;

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSynthSound(freqs, duration, type = 'sine', volume = 0.1, isNoise = false) {
  if (!audioCtx) return;
  try {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (isNoise) {
      const bufferSize = audioCtx.sampleRate * duration;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data   = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noiseNode = audioCtx.createBufferSource();
      noiseNode.buffer = buffer;
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(freqs[0] || 1000, audioCtx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(freqs[1] || 100, audioCtx.currentTime + duration);
      noiseNode.connect(filter);
      filter.connect(gain);
      gain.gain.setValueAtTime(volume, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      noiseNode.start();
      noiseNode.stop(audioCtx.currentTime + duration);
    } else {
      osc.type = type;
      osc.frequency.setValueAtTime(freqs[0], audioCtx.currentTime);
      if (freqs.length > 1) osc.frequency.exponentialRampToValueAtTime(freqs[1], audioCtx.currentTime + duration);
      gain.gain.setValueAtTime(volume, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    }
  } catch(e) { console.warn('오디오 재생 실패:', e); }
}

function playShotSound()          { playSynthSound([800, 200], 0.08, 'sawtooth', 0.05); }
function playGemSound()           { playSynthSound([523.25, 1046.50], 0.12, 'sine', 0.06); }
function playHitSound()           { playSynthSound([150, 40], 0.1, 'triangle', 0.08); }
function playEnemyExplosionSound(){ playSynthSound([600, 50], 0.15, 'sawtooth', 0.04, true); }

function playLevelUpSound() {
  if (!audioCtx) return;
  [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
    setTimeout(() => playSynthSound([f], 0.15, 'sine', 0.08), i * 90);
  });
}

function playGameOverSound() {
  if (!audioCtx) return;
  [392.00, 311.13, 261.63, 196.00].forEach((f, i) => {
    setTimeout(() => playSynthSound([f, f - 30], 0.3, 'sawtooth', 0.1), i * 200);
  });
}

function playVictorySound() {
  if (!audioCtx) return;
  [523.25, 523.25, 523.25, 523.25, 659.25, 587.33, 659.25, 783.99, 1046.50].forEach((f, i) => {
    setTimeout(() => playSynthSound([f, f + 5], 0.25, 'triangle', 0.08), i * 150);
  });
}

function playStageClearSound() {
  if (!audioCtx) return;
  [523, 659, 784, 1047].forEach((f, i) => {
    setTimeout(() => playSynthSound([f], 0.2, 'sine', 0.1), i * 120);
  });
}

function playBossDeathSound() {
  if (!audioCtx) return;
  [100, 150, 200, 300, 500].forEach((f, i) => {
    setTimeout(() => playSynthSound([f, f * 1.5], 0.3, 'sawtooth', 0.12), i * 80);
  });
}

// ============================================================
// 5. BGM 시퀀서 (D단조 신스웨이브)
// ============================================================
let bgmGainNode       = null;
let bgmAudioElement   = null;
let bgmMuted           = false;
let bgmTrackId         = 0;
let bgmTrackCheckTimer = 0;
let bgmSchedulerTimer = null;
let bgmCurrentStep    = 0;
let bgmNextNoteTime   = 0;
let bgmSnareBuffer    = null;
let bgmHihatBuffer    = null;

const BGM_BPM           = 138;
const BGM_STEP          = 60 / BGM_BPM / 4;
const BGM_TOTAL_STEPS   = 64;
const BGM_SCHEDULE_AHEAD = 0.12;
const BGM_SCHEDULER_MS  = 25;

function midiToFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

const BGM_BASS = [
  38,null,null,null,45,null,null,null,38,null,null,null,41,null,43,null,
  38,null,null,null,45,null,null,null,43,null,null,null,41,null,38,null,
  36,null,null,null,43,null,null,null,36,null,null,null,40,null,43,null,
  38,null,null,null,45,null,null,null,50,null,48,null, 45,null,null,null
];
const BGM_LEAD = [
  74,null,null,null,null,null,72,null,69,null,null,null,67,null,null,null,
  65,null,67,null,  69,null,null,null,65,null,null,null,62,null,null,null,
  67,null,null,null,69,null,72,null, 74,null,null,null,72,null,69,null,
  72,null,74,null,  null,null,69,null,72,null,69,null, 65,null,62,null
];
const BGM_PAD = [
  62,null,null,null,null,null,null,null,65,null,null,null,null,null,null,null,
  62,null,null,null,null,null,null,null,65,null,null,null,null,null,null,null,
  60,null,null,null,null,null,null,null,65,null,null,null,null,null,null,null,
  62,null,null,null,null,null,null,null,69,null,null,null,null,null,null,null
];
const BGM_KICK  = [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0];
const BGM_SNARE = [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0];
const BGM_HIHAT = [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0];

// ─── BGM Track 2: DEVA SYSTEM (Persona 2 inspired, C minor, heavy) ───
const BGM2_BASS = [
  36,null,36,null,39,null,null,null,43,null,null,null,41,null,43,null,
  36,null,null,null,36,null,39,null,41,null,null,null,43,null,null,null,
  44,null,null,null,44,null,48,null,51,null,null,null,48,null,46,null,
  43,null,null,null,43,null,46,null,36,null,null,null,39,null,36,null
];
const BGM2_LEAD = [
  72,null,null,null,null,null,75,null,79,null,null,null,77,null,75,null,
  74,null,75,null,77,null,null,null,75,null,null,null,72,null,null,null,
  80,null,null,null,79,null,77,null,80,null,null,null,82,null,80,null,
  79,null,77,null,75,null,null,null,77,null,75,null,72,null,null,null
];
const BGM2_PAD = [
  60,null,null,null,null,null,null,null,63,null,null,null,null,null,null,null,
  65,null,null,null,null,null,null,null,68,null,null,null,null,null,null,null,
  56,null,null,null,null,null,null,null,60,null,null,null,null,null,null,null,
  55,null,null,null,null,null,null,null,58,null,null,null,null,null,null,null
];
const BGM2_KICK  = [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,1,0,1,0,0,0];
const BGM2_SNARE = [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,1,0];

// ─── BGM Track 3: GHOST PROTOCOL (Dm, industrial / heavy, 138 BPM) ───
const BGM3_BASS = [
  38,null,38,null,41,null,null,null,38,null,38,null,43,null,41,null,
  36,null,null,null,36,null,41,null,38,null,38,null,43,null,null,null,
  38,null,null,null,36,null,38,null,41,null,null,null,43,null,45,null,
  46,null,null,null,43,null,null,null,38,null,36,null,38,null,null,null
];
const BGM3_LEAD = [
  74,null,77,null,null,null,74,null,72,null,null,null,70,null,null,null,
  72,null,70,null,69,null,null,null,72,null,null,null,74,null,null,null,
  77,null,null,null,74,null,72,null,74,null,77,null,79,null,null,null,
  77,null,74,null,null,null,77,null,79,null,77,null,74,null,72,null
];
const BGM3_PAD = [
  50,null,null,null,null,null,null,null,53,null,null,null,null,null,null,null,
  50,null,null,null,null,null,null,null,53,null,null,null,null,null,null,null,
  48,null,null,null,null,null,null,null,55,null,null,null,null,null,null,null,
  50,null,null,null,null,null,null,null,53,null,null,null,null,null,null,null
];
const BGM3_KICK  = [1,0,0,0,1,0,1,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,1,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,1,0,0,0,0,0,1,0,0,0,1,0,1,0,1,0,0,0,0,0,1,0,1,0,1,0];
const BGM3_SNARE = [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,1,0,1,0];
const BGM3_HIHAT = [1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,1,1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,1,1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,1,1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,1];

// ─── BGM Track 4: SHADOW OPS (Dm, atmospheric / sparse, daily run) ───
const BGM4_BASS = [
  38,null,null,null,null,null,null,null,41,null,null,null,null,null,null,null,
  38,null,null,null,null,null,null,null,43,null,null,null,45,null,null,null,
  36,null,null,null,null,null,null,null,41,null,null,null,null,null,null,null,
  38,null,null,null,null,null,41,null, 38,null,null,null,null,null,null,null
];
const BGM4_LEAD = [
  62,null,null,null,null,null,65,null,null,null,null,null,62,null,null,null,
  null,null,60,null,null,null,null,null,58,null,null,null,null,null,60,null,
  62,null,null,null,65,null,null,null,null,null,67,null,null,null,65,null,
  null,null,null,null,62,null,null,null,60,null,null,null,null,null,null,null
];
const BGM4_PAD = [
  50,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,
  53,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,
  48,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,
  50,null,null,null,null,null,null,null,53,null,null,null,null,null,null,null
];
const BGM4_KICK  = [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0];
const BGM4_SNARE = [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0];
const BGM4_HIHAT = [0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0];

function initBGMBuffers() {
  if (!audioCtx) return;
  const sr = audioCtx.sampleRate;
  bgmSnareBuffer = audioCtx.createBuffer(1, Math.floor(sr * 0.18), sr);
  const sd = bgmSnareBuffer.getChannelData(0);
  for (let i = 0; i < sd.length; i++) sd[i] = Math.random() * 2 - 1;
  bgmHihatBuffer = audioCtx.createBuffer(1, Math.floor(sr * 0.06), sr);
  const hd = bgmHihatBuffer.getChannelData(0);
  for (let i = 0; i < hd.length; i++) hd[i] = Math.random() * 2 - 1;
}

function bgmPlayTone(freq, dur, type, vol, t) {
  if (!audioCtx || !bgmGainNode) return;
  const osc = audioCtx.createOscillator();
  const g   = audioCtx.createGain();
  osc.connect(g); g.connect(bgmGainNode);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.start(t); osc.stop(t + dur + 0.02);
}

function bgmPlayKick(t) {
  if (!audioCtx || !bgmGainNode) return;
  const osc = audioCtx.createOscillator();
  const g   = audioCtx.createGain();
  osc.connect(g); g.connect(bgmGainNode);
  osc.frequency.setValueAtTime(170, t);
  osc.frequency.exponentialRampToValueAtTime(35, t + 0.18);
  g.gain.setValueAtTime(0.85, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  osc.start(t); osc.stop(t + 0.2);
  // 비트 시스템: 킥 타임스탬프 기록
  beatKickTimes.push(t);
}

function bgmPlaySnare(t) {
  if (!audioCtx || !bgmGainNode || !bgmSnareBuffer) return;
  const n = audioCtx.createBufferSource();
  n.buffer = bgmSnareBuffer;
  const f = audioCtx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 0.7;
  const g = audioCtx.createGain();
  n.connect(f); f.connect(g); g.connect(bgmGainNode);
  g.gain.setValueAtTime(0.42, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  n.start(t); n.stop(t + 0.18);
}

function bgmPlayHihat(t) {
  if (!audioCtx || !bgmGainNode || !bgmHihatBuffer) return;
  const n = audioCtx.createBufferSource();
  n.buffer = bgmHihatBuffer;
  const f = audioCtx.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = 7000;
  const g = audioCtx.createGain();
  n.connect(f); f.connect(g); g.connect(bgmGainNode);
  g.gain.setValueAtTime(0.065, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  n.start(t); n.stop(t + 0.06);
}

function bgmSchedule() {
  if (!audioCtx || !bgmGainNode) return;
  while (bgmNextNoteTime < audioCtx.currentTime + BGM_SCHEDULE_AHEAD) {
    const step  = bgmCurrentStep % BGM_TOTAL_STEPS;
    const t     = bgmNextNoteTime;
    let bass, lead, pad, kick, snare, hihat, bassVol, leadVol, leadType;
    if (bgmTrackId === 3) {
      bass = BGM4_BASS; lead = BGM4_LEAD; pad = BGM4_PAD;
      kick = BGM4_KICK; snare = BGM4_SNARE; hihat = BGM4_HIHAT;
      bassVol = 0.20; leadVol = 0.06; leadType = 'sine';
    } else if (bgmTrackId === 2) {
      bass = BGM3_BASS; lead = BGM3_LEAD; pad = BGM3_PAD;
      kick = BGM3_KICK; snare = BGM3_SNARE; hihat = BGM3_HIHAT;
      bassVol = 0.25; leadVol = 0.08; leadType = 'sawtooth';
    } else if (bgmTrackId === 1) {
      bass = BGM2_BASS; lead = BGM2_LEAD; pad = BGM2_PAD;
      kick = BGM2_KICK; snare = BGM2_SNARE; hihat = null;
      bassVol = 0.22; leadVol = 0.07; leadType = 'sawtooth';
    } else {
      bass = BGM_BASS; lead = BGM_LEAD; pad = BGM_PAD;
      kick = BGM_KICK; snare = BGM_SNARE; hihat = BGM_HIHAT;
      bassVol = 0.17; leadVol = 0.055; leadType = 'square';
    }
    if (bass[step]  !== null) bgmPlayTone(midiToFreq(bass[step] - 12), BGM_STEP * 1.7, 'sawtooth', bassVol, t);
    if (pad[step]   !== null) {
      bgmPlayTone(midiToFreq(pad[step]),     BGM_STEP * 3.8, 'sawtooth', 0.05, t);
      bgmPlayTone(midiToFreq(pad[step] + 7), BGM_STEP * 3.8, 'sawtooth', 0.03, t);
    }
    if (lead[step]  !== null) bgmPlayTone(midiToFreq(lead[step]), BGM_STEP * 0.85, leadType, leadVol, t);
    if (kick[step])  bgmPlayKick(t);
    if (snare[step]) bgmPlaySnare(t);
    if (hihat && hihat[step]) bgmPlayHihat(t);
    bgmCurrentStep++;
    bgmNextNoteTime += BGM_STEP;
  }
  bgmSchedulerTimer = setTimeout(bgmSchedule, BGM_SCHEDULER_MS);
}

// ============================================================
// 액티브 스킬 시스템 (Q 키)
// ============================================================
function useActiveSkill() {
  if (!player || player.activeSkillCd > 0) return;
  if (gameState !== STATE_PLAYING && gameState !== STATE_STAGE_CLEAR) return;
  const cls = CLASS_DEFS[player.classId];
  if (!cls?.activeSkill) return;
  player.activeSkillCd = cls.activeSkill.cd * (player._skillCdMult || 1.0);
  initAudio();
  switch (player.classId) {
    case 'hacker':
      enemies.forEach(e => {
        const dx = e.x - player.x, dy = e.y - player.y;
        if (dx*dx + dy*dy < 200*200) e.stunTimer = 3000;
      });
      if (activeBoss) {
        const dx = activeBoss.x - player.x, dy = activeBoss.y - player.y;
        if (dx*dx + dy*dy < 200*200) activeBoss.stunTimer = (activeBoss.stunTimer || 0) + 1500;
      }
      createExplosionParticles(player.x, player.y, '#00f0ff', 30);
      playSynthSound([800, 200, 100], 0.25, 'sawtooth', 0.12, true);
      addFloatingText(player.x, player.y - 60, '⚡ EMP 펄스!', '#00f0ff', 16);
      break;
    case 'cyborg': {
      player.skillShieldActive = true;
      player.activeSkillTimer  = 8000;
      player._skillOrigDmgReduction = player.damageReduction;
      player.damageReduction = Math.min(player.damageReduction + 0.60, 0.90);
      // 주변 적 밀쳐냄
      enemies.forEach(e => {
        const dx = e.x - player.x, dy = e.y - player.y, dist = Math.sqrt(dx*dx+dy*dy);
        if (dist < 220 && dist > 0) { e.x += (dx/dist)*180; e.y += (dy/dist)*180; }
      });
      createExplosionParticles(player.x, player.y, '#b026ff', 20);
      playSynthSound([400, 600], 0.2, 'triangle', 0.1);
      addFloatingText(player.x, player.y - 60, '🛡 방어막 가동!', '#b026ff', 16);
      break;
    }
    case 'ghost':
      player.skillInvincible   = true;
      player.skillSpeedBoost   = true;
      player.activeSkillTimer  = 4000;
      player._skillOrigSpeed   = player.speed;
      player.speed *= 2.0;
      playSynthSound([1000, 2000], 0.15, 'sine', 0.1);
      addFloatingText(player.x, player.y - 60, '👁 위상 침투!', '#39ff14', 16);
      break;
    case 'engineer': {
      // 드론 폭발: 반경 밀쳐내기 + 폭발 피해 + HP 회복
      const expDmg = 60 + (player.level || 1) * 8;
      enemies.forEach(e => {
        const dx = e.x - player.x, dy = e.y - player.y, dist = Math.sqrt(dx*dx+dy*dy);
        if (dist < 200 && dist > 0) {
          e.takeDamage(expDmg, 'drone');
          e.x += (dx/dist)*200; e.y += (dy/dist)*200;
        }
      });
      if (activeBoss) {
        const dx = activeBoss.x - player.x, dy = activeBoss.y - player.y, dist = Math.sqrt(dx*dx+dy*dy);
        if (dist < 200) activeBoss.hp -= expDmg * 0.5;
      }
      const healEng = Math.floor(player.maxHp * 0.20);
      player.hp = Math.min(player.hp + healEng, player.maxHp);
      createExplosionParticles(player.x, player.y, '#ffe600', 25);
      playSynthSound([200, 400, 600], 0.25, 'sawtooth', 0.1);
      addFloatingText(player.x, player.y - 60, `💥 드론 폭발! +${healEng}HP`, '#ffe600', 16);
      break;
    }
    case 'sniper':
      player._sniperShotBoost = 5;
      addFloatingText(player.x, player.y - 60, '🎯 정밀 스캔!', '#ff4466', 16);
      playSynthSound([1200, 800], 0.15, 'sawtooth', 0.1);
      break;
    case 'support': {
      const healSup = Math.floor(player.maxHp * 0.25);
      player.hp = Math.min(player.hp + healSup, player.maxHp);
      player._patchbotRegenTimer = 20000;
      if (player.weapons.drone) player.weapons.drone._repaired = true;
      addFloatingText(player.x, player.y - 60, `💊 비상 패치! +${healSup}HP`, '#00ffaa', 16);
      playSynthSound([500, 900, 1400], 0.2, 'triangle', 0.08);
      break;
    }
    case 'cracker': {
      const zombieLvl = player.classPassives?.ck_zombie || 0;
      const blastLvl  = player.classPassives?.ck_blast  || 0;
      const dur  = 8000 + (zombieLvl >= 2 ? 5000 : zombieLvl >= 1 ? 3000 : 0);
      const expl = blastLvl >= 2 ? 280 : blastLvl >= 1 ? 150 : 0;
      const targets = [...enemies]
        .filter(e => !e._hacked)
        .sort((a, b) => dist(player.x, player.y, a.x, a.y) - dist(player.x, player.y, b.x, b.y))
        .slice(0, 2);
      let hackCount = 0;
      for (const t of targets) {
        t._hacked = true; t._hackTimer = dur; t._hackDmgTimer = 0;
        t._hackExplosion = expl; t._hackEvolved = !!(player.fusions?.virus_takeover);
        addFloatingText(t.x, t.y - 40, '🖥️ 해킹!', '#ff6600', 13);
        hackCount++;
      }
      createExplosionParticles(player.x, player.y, '#ff6600', 20);
      playSynthSound([1000, 600, 300, 800], 0.22, 'square', 0.08);
      addFloatingText(player.x, player.y - 60, `🕹️ 바이러스 주입! ×${hackCount || '미스'}`, '#ff6600', 16);
      break;
    }
    case 'glitch_dancer': {
      const w = player.weapons.command_dance;
      const lvl = w?.level > 0 ? w.level : 1;
      const radius = [200,240,270,300,340][lvl-1] ?? 200;
      const baseDmg = ([350,380,430,470,540][lvl-1] ?? 350) * player.damageMultiplier;
      const rhythmLvl = player.classPassives?.gd_rhythm || 0;
      const dmg = baseDmg * (rhythmLvl >= 2 ? 1.6 : rhythmLvl >= 1 ? 1.3 : 1.0);
      createExplosionParticles(player.x, player.y, '#ff88ff', 30);
      triggerScreenShake(10, 450);
      playSynthSound([600,900,1200,800], 0.22, 'triangle', 0.1);
      addFloatingText(player.x, player.y - 65, '💃 즉흥 댄스!', '#ff88ff', 16);
      let allGD = [...enemies]; if (activeBoss) allGD.push(activeBoss);
      for (const e of allGD) {
        if (dist(player.x, player.y, e.x, e.y) < radius) {
          if (e === activeBoss) activeBoss.takeDamage(Math.floor(dmg * 0.45), 'command_dance');
          else if (e.takeDamage(dmg, 'command_dance')) { killCount++; stageKillProgress++; }
        }
      }
      if (player.fusions?.dance_master) {
        for (let i = 0; i < 8; i++) {
          const a = (i/8)*Math.PI*2;
          if (projectiles.length < MAX_PROJECTILES)
            projectiles.push(new Projectile(player.x, player.y, Math.cos(a)*7, Math.sin(a)*7, dmg*0.55, 8, '#ff88ff', 2, 'command_dance'));
        }
      }
      const burstDur = player.classPassives?.gd_burst >= 2 ? 5000 : player.classPassives?.gd_burst >= 1 ? 3000 : 0;
      if (burstDur > 0) player._gdBurstTimer = burstDur;
      checkStageProgress();
      break;
    }
    case 'parasite': {
      const stacks = player._parasiteStacks || 0;
      if (stacks === 0) {
        addFloatingText(player.x, player.y - 60, '🧬 흡수 없음!', '#88ff44', 14);
        player.activeSkillCd = 0;
        break;
      }
      const surgeLvl = player.classPassives?.ps_surge || 0;
      const baseR = 160 + (surgeLvl >= 2 ? 100 : surgeLvl >= 1 ? 50 : 0);
      const dmgPS = 200 * player.damageMultiplier * stacks;
      createExplosionParticles(player.x, player.y, '#88ff44', Math.min(25 + stacks*5, MAX_PARTICLES - particles.length));
      triggerScreenShake(6 + stacks*2, 400);
      playSynthSound([300, 600, 900, 400*stacks], 0.2, 'sawtooth', 0.09);
      addFloatingText(player.x, player.y - 65, `🦠 패턴 방출! ×${stacks}`, '#88ff44', 16);
      let allPS = [...enemies]; if (activeBoss) allPS.push(activeBoss);
      for (const e of allPS) {
        if (dist(player.x, player.y, e.x, e.y) < baseR) {
          if (e === activeBoss) activeBoss.takeDamage(Math.floor(dmgPS * 0.4), 'viral_bomb');
          else if (e.takeDamage(dmgPS, 'viral_bomb')) { killCount++; stageKillProgress++; }
        }
      }
      player._parasiteStacks = 0;
      checkStageProgress();
      break;
    }
    case 'jammer': {
      const faceA = player._moveAngle || 0;
      const coneHalf = Math.PI / 3;
      const coneR = 350;
      let stunCt = 0;
      for (const e of enemies) {
        const dx = e.x - player.x, dy = e.y - player.y;
        if (dx*dx + dy*dy > coneR*coneR) continue;
        let diff = Math.abs(Math.atan2(dy,dx) - faceA);
        if (diff > Math.PI) diff = Math.PI*2 - diff;
        if (diff <= coneHalf) { e.stunTimer = 3000; e._jammed = true; e._jamTimer = 5000; stunCt++; }
      }
      if (activeBoss) {
        const dx = activeBoss.x - player.x, dy = activeBoss.y - player.y;
        if (dx*dx+dy*dy <= coneR*coneR) {
          let diff = Math.abs(Math.atan2(dy,dx) - faceA);
          if (diff > Math.PI) diff = Math.PI*2 - diff;
          if (diff <= coneHalf) activeBoss.stunTimer = (activeBoss.stunTimer||0) + 1500;
        }
      }
      createExplosionParticles(player.x, player.y, '#aaffff', 20);
      playSynthSound([800,400,200,100], 0.2, 'sawtooth', 0.09);
      addFloatingText(player.x, player.y - 60, `📻 집중 방해파! ×${stunCt}`, '#aaffff', 16);
      break;
    }
  }
  triggerScreenShake(4, 250);
}

// ============================================================
// 난이도 / 일일 도전 / 승천
// ============================================================
function setDifficulty(d) {
  gameDifficulty = d;
  document.querySelectorAll('.diff-btn').forEach(b => b.classList.toggle('diff-active', b.dataset.diff === d));
  localStorage.setItem('ns_difficulty', d);
}

function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function getDailyRunDate() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}

function startDailyRun() {
  isDailyRun = true;
  const dateStr = getDailyRunDate();
  dailyRunSeed = [...dateStr].reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0);
  dailyRNG = mulberry32(dailyRunSeed);
  gameDifficulty = 'hard';
  bgmTrackId = 3; // 섀도우 옵스 — 일일 도전 전용
  startGame();
}

function getAscensionScale() {
  return 1.0 + (ascensionLevel || 0) * 0.25;
}

// ============================================================
// 세이브 슬롯
// ============================================================
function getSaveKey(slot) { return `ns_save_slot_${slot ?? currentSaveSlot}`; }

function selectSaveSlot(n) {
  saveSaveData();
  currentSaveSlot = n;
  saveData = loadSaveDataSlot(n);
  applyMetaUpgrades();
  renderMetaGrid();
  updateMenuMetaBadge();
  document.querySelectorAll('.slot-btn').forEach((b, i) => b.classList.toggle('slot-active', i === n));
}

function loadSaveDataSlot(slot) {
  try {
    const raw = localStorage.getItem(getSaveKey(slot));
    if (!raw) return { dataCores: 0, metaLevels: {}, achievements: [], bestKills: 0, bestStage: 0, bestTime: 0, ascensionLevel: 0 };
    const d = JSON.parse(raw);
    return {
      dataCores:      d.dataCores      || 0,
      metaLevels:     d.metaLevels     || {},
      achievements:   d.achievements   || [],
      bestKills:      d.bestKills      || 0,
      bestStage:      d.bestStage      || 0,
      bestTime:       d.bestTime       || 0,
      ascensionLevel: d.ascensionLevel || 0
    };
  } catch(e) { return { dataCores: 0, metaLevels: {}, achievements: [], bestKills: 0, bestStage: 0, bestTime: 0, ascensionLevel: 0 }; }
}

// ============================================================
// 메뉴 BGM 시작
// ============================================================
function tryStartMenuBgm() {
  // 메인화면 BGM은 현재 비활성화 (별도 메뉴 음악 추가 예정)
  return;
}

function startBGM() {
  if (!audioCtx) return;
  stopBGM();
  bgmGainNode = audioCtx.createGain();
  bgmGainNode.gain.value = bgmMuted ? 0 : 0.55;
  bgmGainNode.connect(audioCtx.destination);

  if (BGM_AUDIO_SRC) {
    // Suno MP3 재생 모드
    bgmAudioElement = new Audio(BGM_AUDIO_SRC);
    bgmAudioElement.loop = true;
    const src = audioCtx.createMediaElementSource(bgmAudioElement);
    src.connect(bgmGainNode);
    bgmAudioElement.play().catch(() => {});
    return;
  }

  // 기본 신스 시퀀서 모드
  initBGMBuffers();
  bgmCurrentStep = 0;
  bgmNextNoteTime = audioCtx.currentTime + 0.15;
  bgmSchedule();
}

function stopBGM() {
  if (bgmSchedulerTimer) { clearTimeout(bgmSchedulerTimer); bgmSchedulerTimer = null; }
  if (bgmAudioElement)   { bgmAudioElement.pause(); bgmAudioElement = null; }
  if (bgmGainNode) {
    const oldGain = bgmGainNode;
    bgmGainNode = null; // 즉시 null로 교체 (레이스 컨디션 방지)
    try { oldGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.08); } catch(e) {}
    setTimeout(() => { try { oldGain.disconnect(); } catch(e) {} }, 220);
  }
}

function toggleBGM() {
  bgmMuted = !bgmMuted;
  if (bgmGainNode && audioCtx) bgmGainNode.gain.setTargetAtTime(bgmMuted ? 0 : 0.55, audioCtx.currentTime, 0.1);
  const btn = document.getElementById('mute-btn');
  if (btn) btn.textContent = bgmMuted ? '🔇' : '🎵';
}
