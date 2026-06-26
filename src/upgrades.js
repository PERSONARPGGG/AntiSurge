// ============================================================
function rollRarity() {
  let r   = Math.random();
  let cum = 0;
  for (let [key, data] of Object.entries(RARITY_DATA)) {
    cum += data.prob;
    if (r < cum) return key;
  }
  return 'common';
}

function updateLevelUpFocus(cards) {
  cards.forEach((c, i) => c.classList.toggle('card-kb-focus', i === levelUpSelectedIdx));
}

function triggerLevelUpModal() {
  gameState = STATE_LEVEL_UP;
  levelUpModal.classList.add('active');
  renderUpgradeCards(generateUpgradeChoices());
  levelUpSelectedIdx = 0;
  updateLevelUpFocus([...document.querySelectorAll('#card-container .upgrade-card')]);

  const rerollBtn  = document.getElementById('reroll-btn');
  const rerollUsesEl = document.getElementById('reroll-uses');
  rerollBtn.disabled = (rerollUses <= 0);
  if (rerollUsesEl) rerollUsesEl.textContent = LANG === 'en' ? `(${rerollUses}×)` : `(${rerollUses}회)`;

  rerollBtn.onclick = () => {
    if (rerollUses <= 0) return;
    rerollUses--;
    renderUpgradeCards(generateUpgradeChoices());
    levelUpSelectedIdx = 0;
    updateLevelUpFocus([...document.querySelectorAll('#card-container .upgrade-card')]);
    rerollBtn.disabled = (rerollUses <= 0);
    if (rerollUsesEl) rerollUsesEl.textContent = LANG === 'en' ? `(${rerollUses}×)` : `(${rerollUses}회)`;
    playSynthSound([400, 600, 800], 0.15, 'square', 0.05);
  };
}

function generateUpgradeChoices() {
  let pool = [];

  // 무기 풀 (가중치: 보유 업그레이드 3x, 융합 파트너 2x, 신규 1x)
  const ownedWeapons = new Set(Object.keys(UPGRADES.weapons).filter(k => player.weapons[k]?.level > 0));
  const synergyWeapons = new Set();
  for (const fus of WEAPON_FUSIONS) {
    for (const w of fus.weapons) {
      if (!ownedWeapons.has(w) && fus.weapons.some(fw => fw !== w && ownedWeapons.has(fw))) {
        synergyWeapons.add(w);
      }
    }
  }
  for (let key in UPGRADES.weapons) {
    if (key === 'command_dance' && player.classId !== 'glitch_dancer') continue;
    let wData = UPGRADES.weapons[key];
    let lvl   = player.weapons[key].level;
    if (lvl === 0) {
      const entry = { type:'weapon', key, name:wData.name, icon:wData.icon, desc:wData.desc[0], isUpgrade:false, nextLevel:1 };
      const copies = synergyWeapons.has(key) ? 2 : 1;
      for (let c = 0; c < copies; c++) pool.push({...entry});
    } else if (lvl < wData.maxLevel) {
      const entry = { type:'weapon', key, name:wData.name, icon:wData.icon, desc:wData.desc[lvl], isUpgrade:true, nextLevel:lvl+1 };
      for (let c = 0; c < 3; c++) pool.push({...entry}); // 보유 무기 업그레이드 3x
    }
  }

  // 스탯 풀
  UPGRADES.stats.forEach(stat => {
    pool.push({ type:'stat', id:stat.id, name:stat.name, icon:stat.icon, desc:stat.desc });
  });

  // 패시브 풀
  for (let key in PASSIVE_DEFS) {
    const pd  = PASSIVE_DEFS[key];
    const lvl = player.passives[key];
    if (lvl < 2) {
      pool.push({ type:'passive', key, name:pd.name, icon:pd.icon, desc:pd.desc[lvl], isUpgrade: lvl > 0, nextLevel: lvl + 1 });
    }
  }

  // 클래스 전용 패시브 풀
  const classDefs = CLASS_PASSIVE_DEFS[player.classId] || [];
  for (const cp of classDefs) {
    const lvl = player.classPassives[cp.key] || 0;
    if (lvl < 2) {
      pool.push({ type:'class_passive', key: cp.key, name: cp.name, icon: cp.icon,
        desc: cp.desc[lvl], isUpgrade: lvl > 0, nextLevel: lvl + 1,
        classId: player.classId });
    }
  }

  // 무기 융합 카드 — 두 무기 모두 Lv5이고 미적용 시 최우선 삽입
  const fusionCards = [];
  for (const fus of WEAPON_FUSIONS) {
    if (player.fusions && player.fusions[fus.id]) continue;
    const ready = fus.weapons.every(w => player.weapons[w] && player.weapons[w].level >= 5);
    if (ready) fusionCards.push({ type:'fusion', id:fus.id, name:fus.name, icon:fus.icon, desc:fus.desc, rarity:'legendary', rarityMult:1.0 });
  }

  let choices = [];
  let tempPool = [...pool];

  // 융합 카드가 있으면 첫 슬롯 강제 배치
  if (fusionCards.length > 0) {
    choices.push(fusionCards[Math.floor(Math.random() * fusionCards.length)]);
  }

  for (let i = choices.length; i < 4; i++) {
    let rarity = rollRarity();

    if (rarity === 'legendary') {
      let legItem = LEGENDARY_POOL[Math.floor(Math.random() * LEGENDARY_POOL.length)];
      choices.push({ ...legItem, type:'legendary', rarity:'legendary' });
      continue;
    }

    // 에픽 등급 시 35% 확률로 부활 에픽 제공
    if (rarity === 'epic' && Math.random() < 0.35) {
      const available = REVIVAL_EPICS.filter(r => {
        const key = r.id.replace('rev_', '');
        return key === 'laststand' ? (player.revivals.lastStand < 4) : !player.revivals[key];
      });
      if (available.length > 0) {
        const rev = available[Math.floor(Math.random() * available.length)];
        choices.push({ ...rev, type: 'revival', rarity: 'epic', rarityMult: 2.0 });
        continue;
      }
    }

    if (tempPool.length === 0) break;
    let idx    = Math.floor(Math.random() * tempPool.length);
    let choice = { ...tempPool.splice(idx, 1)[0], rarity };
    // 같은 무기 중복 항목 제거 (가중치 복사본)
    if (choice.type === 'weapon') {
      tempPool = tempPool.filter(item => !(item.type === 'weapon' && item.key === choice.key));
    }
    choice.rarityMult = rarity === 'epic' ? 2.0 : rarity === 'rare' ? 1.5 : 1.0;
    choices.push(choice);
  }

  return choices;
}

function renderUpgradeCards(choices) {
  const container = document.getElementById('card-container');
  container.innerHTML = '';

  choices.forEach(choice => {
    let card = document.createElement('div');
    let rd   = RARITY_DATA[choice.rarity] || RARITY_DATA.common;

    // 기본 스타일 클래스
    let baseClass = 'new-weapon';
    if      (choice.type === 'fusion')                            baseClass = 'weapon-fusion';
    else if (choice.type === 'stat')                              baseClass = 'stat-boost';
    else if (choice.type === 'class_passive' && choice.isUpgrade) baseClass = 'class-passive-upgrade';
    else if (choice.type === 'class_passive')                     baseClass = 'class-passive-new';
    else if (choice.type === 'passive' && choice.isUpgrade)       baseClass = 'passive-upgrade';
    else if (choice.type === 'passive')                           baseClass = 'new-passive';
    else if (choice.isUpgrade)                                    baseClass = 'weapon-upgrade';
    else if (choice.type === 'legendary')                         baseClass = 'new-weapon';

    card.className = `upgrade-card ${baseClass} rarity-${choice.rarity || 'common'}`;

    // i18n: tag text
    let tagText  = t('card.tag.new_weapon');
    if      (choice.type === 'fusion')                                tagText = t('card.tag.fusion');
    else if (choice.type === 'revival')                               tagText = t('card.tag.revival');
    else if (choice.type === 'class_passive' && !choice.isUpgrade)    tagText = t('card.tag.class_new');
    else if (choice.type === 'class_passive' && choice.isUpgrade)     tagText = `⭐ ${LANG === 'en' ? 'Class' : '클래스'} Lv${choice.nextLevel}`;
    else if (choice.type === 'stat')                                   tagText = t('card.tag.stat');
    else if (choice.type === 'passive' && !choice.isUpgrade)          tagText = t('card.tag.passive_new');
    else if (choice.type === 'passive' && choice.isUpgrade)           tagText = `${LANG === 'en' ? 'Passive' : '패시브'} Lv${choice.nextLevel}`;
    else if (choice.isUpgrade)                                        tagText = `${LANG === 'en' ? 'Upgrade' : '업그레이드'} Lv.${choice.nextLevel}`;
    else if (choice.type === 'legendary')                             tagText = t('card.tag.legendary');

    // i18n: localized name
    let cardName = choice.name;
    if (choice.type === 'weapon' && choice.key)
      cardName = tGame('weapons', choice.key, 'name') || choice.name;
    else if (choice.type === 'stat' && choice.id)
      cardName = tGame('stats', choice.id, 'name') || choice.name;
    else if (choice.type === 'passive' && choice.key)
      cardName = tGame('passives', choice.key, 'name') || choice.name;
    else if (choice.type === 'class_passive' && choice.key)
      cardName = tGame('class_passives', choice.key, 'name') || choice.name;
    else if (choice.type === 'fusion' && choice.id)
      cardName = tGame('fusions', choice.id, 'name') || choice.name;
    else if (choice.type === 'legendary' && choice.id)
      cardName = tGame('legendaries', choice.id, 'name') || choice.name;
    else if (choice.type === 'revival' && choice.id)
      cardName = tGame('revivals', choice.id, 'name') || choice.name;

    // i18n: localized description
    let descText = choice.desc;
    if (choice.type === 'weapon' && choice.key) {
      const lvlIdx = (choice.nextLevel || 1) - 1;
      descText = tGame('weapons', choice.key, 'desc', lvlIdx) || choice.desc;
    } else if (choice.type === 'stat' && choice.id) {
      descText = tGame('stats', choice.id, 'desc') || choice.desc;
    } else if (choice.type === 'passive' && choice.key) {
      const lvlIdx = (choice.nextLevel || 1) - 1;
      descText = tGame('passives', choice.key, 'desc', lvlIdx) || choice.desc;
    } else if (choice.type === 'class_passive' && choice.key) {
      const lvlIdx = (choice.nextLevel || 1) - 1;
      descText = tGame('class_passives', choice.key, 'desc', lvlIdx) || choice.desc;
    } else if (choice.type === 'fusion' && choice.id) {
      descText = tGame('fusions', choice.id, 'desc') || choice.desc;
    } else if (choice.type === 'legendary' && choice.id) {
      descText = tGame('legendaries', choice.id, 'desc') || choice.desc;
    } else if (choice.type === 'revival' && choice.id) {
      descText = tGame('revivals', choice.id, 'desc') || choice.desc;
    }

    if (choice.rarityMult > 1.0 && choice.type === 'stat') {
      descText += ` <span style="color:${rd.color}">[${rd.name}: ${t('card.rarity.effect')}${choice.rarityMult}]</span>`;
    }

    // i18n: evolved weapon name in preview badge
    const baseEvoName = UPGRADES.weapons[choice.key]?.evolvedName || (LANG === 'en' ? 'EVOLVED' : '진화형');
    const evoName = (choice.type === 'weapon' && choice.key)
      ? (tGame('weapons', choice.key, 'evolvedName') || baseEvoName)
      : baseEvoName;
    const evoPreview = (choice.type === 'weapon' && choice.nextLevel === 5)
      ? `<div class="evo-preview-badge">✨ ${LANG === 'en' ? 'EVOLVED →' : '진화 →'} ${evoName}</div>`
      : '';
    card.innerHTML = `
      <div class="card-icon">${choice.icon}</div>
      <div class="card-details">
        <div class="card-title-row">
          <span class="card-name" style="color:${choice.rarity === 'legendary' ? '#ffe600' : '#fff'}">${cardName}</span>
          <span class="card-tag tag-${choice.rarity || 'common'}">${tagText}</span>
        </div>
        <div class="card-desc">${descText}</div>
        ${evoPreview}
      </div>
    `;

    card.addEventListener('click', () => {
      applyUpgrade(choice);
      closeLevelUpModal();
    });

    container.appendChild(card);
  });
}

// 레벨업 모달 닫기 — 대기 중인 레벨업 있으면 순차 처리
function closeLevelUpModal() {
  levelUpModal.classList.remove('active');
  if (pendingLevelUps > 0) {
    pendingLevelUps--;
    playLevelUpSound();
    triggerLevelUpModal(); // 다음 레벨업 모달 열기
  } else {
    levelUpInProgress = false;
    // 보너스 모달이 이미 열려 있으면 gameState 덮어쓰지 않음
    if (gameState !== STATE_STAGE_BONUS && gameState !== STATE_SHOP && gameState !== STATE_CURSE) {
      gameState = isStageClearAnim ? STATE_STAGE_CLEAR : STATE_PLAYING;
    }
    lastTime  = performance.now();
    ensureGameLoopRunning();
  }
}

// ─── 일시정지 시스템 ───
function pauseGame() {
  if (gameState !== STATE_PLAYING && gameState !== STATE_STAGE_CLEAR) return;
  prevStateBeforePause = gameState;
  gameState = STATE_PAUSED;
  openSettingsModal();
}

function resumeGame() {
  if (gameState !== STATE_PAUSED) return;
  gameState = prevStateBeforePause || STATE_PLAYING;
  const modal = document.getElementById('settings-modal');
  if (modal) modal.classList.remove('active');
  const ia = document.getElementById('settings-ingame-actions');
  if (ia) ia.style.display = 'none';
  lastTime = performance.now();
  ensureGameLoopRunning();
}

function goToMenu() {
  showGameConfirm(
    LANG === 'en'
      ? 'Exit game and return to main menu.\nProgress will be auto-saved.'
      : '지금 게임을 종료하고 메인 메뉴로 돌아갑니다.\n진행 상황은 자동 저장됩니다.',
    () => {
      stopBGM();
      if (gameLoopId) { cancelAnimationFrame(gameLoopId); gameLoopId = null; }
      enemies.length = 0; projectiles.length = 0; activeBoss = null;
      isDailyRun = false; mpSpectating = false;
      const _modal = document.getElementById('settings-modal');
      if (_modal) _modal.classList.remove('active');
      const _ia = document.getElementById('settings-ingame-actions');
      if (_ia) _ia.style.display = 'none';
      const _hudEl2 = document.getElementById('hud');
      if (_hudEl2) _hudEl2.style.visibility = '';
      gameState = STATE_MENU;
      showScreen(STATE_MENU);
      menuBgmStarted = false;
      tryStartMenuBgm();
    },
    null,
    LANG === 'en'
      ? { title: 'EXIT GAME', icon: '⚡', okLabel: 'EXIT', cancelLabel: 'CONTINUE' }
      : { title: '게임 종료', icon: '⚡', okLabel: '나가기', cancelLabel: '계속하기' }
  );
}

function togglePause() {
  if (gameState === STATE_PAUSED) resumeGame();
  else pauseGame();
}

// ============================================================
// 저주/축복 시스템
// ============================================================
function showCurseModal() {
  gameState = STATE_CURSE;
  const curse = CURSE_DEFS[Math.floor(Math.random() * CURSE_DEFS.length)];
  const modal = document.getElementById('curse-modal');
  const card  = document.getElementById('curse-offer-card');
  if (!modal || !card) { gameState = STATE_STAGE_BONUS; showStageBonusModal(); return; }
  const cDebuff = (LANG === 'en' ? (curse.debuffEn || tGame('curses', curse.id, 'debuff')) : null) || curse.debuff;
  const cReward = (LANG === 'en' ? (curse.rewardEn || tGame('curses', curse.id, 'reward')) : null) || curse.reward;
  card.innerHTML = `
    <div class="curse-debuff">🦠 ${LANG === 'en' ? 'Infection:' : '감염:'} ${cDebuff}</div>
    <div class="curse-reward">⚡ ${LANG === 'en' ? 'Extract:' : '추출:'} ${cReward}</div>
  `;
  document.getElementById('curse-accept-btn').onclick = () => applyCurseChoice(curse, true);
  document.getElementById('curse-decline-btn').onclick = () => applyCurseChoice(curse, false);
  modal.classList.add('active');
  ensureGameLoopRunning();
}

// 근사망 저주: 선택 후 게임 플레이로 복귀 (스테이지 보너스 없음)
function showNearDeathCurseModal() {
  gameState = STATE_CURSE;
  const curse = CURSE_DEFS[Math.floor(Math.random() * CURSE_DEFS.length)];
  const modal = document.getElementById('curse-modal');
  const card  = document.getElementById('curse-offer-card');
  if (!modal || !card) { gameState = STATE_PLAYING; ensureGameLoopRunning(); return; }
  const ndDebuff = (LANG === 'en' ? (curse.debuffEn || tGame('curses', curse.id, 'debuff')) : null) || curse.debuff;
  const ndReward = (LANG === 'en' ? (curse.rewardEn || tGame('curses', curse.id, 'reward')) : null) || curse.reward;
  card.innerHTML = `
    <div style="color:#ff8800;font-size:0.75rem;margin-bottom:6px">${t('curse.neardeath')}</div>
    <div class="curse-debuff">🦠 ${LANG === 'en' ? 'Infection:' : '감염:'} ${ndDebuff}</div>
    <div class="curse-reward">⚡ ${LANG === 'en' ? 'Extract:' : '추출:'} ${ndReward}</div>
  `;
  document.getElementById('curse-accept-btn').onclick = () => applyNearDeathCurseChoice(curse, true);
  document.getElementById('curse-decline-btn').onclick = () => applyNearDeathCurseChoice(curse, false);
  modal.classList.add('active');
  ensureGameLoopRunning();
}

function applyNearDeathCurseChoice(curse, accepted) {
  document.getElementById('curse-modal').classList.remove('active');
  if (accepted && player) {
    curse.debuffFn(player);
    curse.rewardFn();
    addFloatingText(player.x, player.y - 40, LANG === 'en' ? '🦠 Infection Accepted!' : '🦠 감염 감수!', '#ff4466', 15);
    playSynthSound([150, 80, 200], 0.2, 'sawtooth', 0.1);
    triggerScreenShake(8, 400);
  } else {
    addFloatingText(player?.x ?? 0, (player?.y ?? 0) - 40, LANG === 'en' ? '🛡 Contained' : '🛡 격리 완료', '#94a3b8', 13);
  }
  // 근사망 저주는 스테이지 보너스 없이 바로 게임 복귀
  gameState = STATE_PLAYING;
  lastTime = performance.now();
  ensureGameLoopRunning();
}

function applyCurseChoice(curse, accepted) {
  document.getElementById('curse-modal').classList.remove('active');
  if (accepted && player) {
    curse.debuffFn(player);
    curse.rewardFn();
    addFloatingText(player.x, player.y - 40, LANG === 'en' ? '🦠 Infection Accepted!' : '🦠 감염 감수!', '#ff4466', 15);
    playSynthSound([150, 80, 200], 0.2, 'sawtooth', 0.1);
    triggerScreenShake(8, 400);
  } else {
    addFloatingText(player?.x ?? 0, (player?.y ?? 0) - 40, LANG === 'en' ? '🛡 Contained' : '🛡 격리 완료', '#94a3b8', 13);
  }
  gameState = STATE_STAGE_BONUS;
  showStageBonusModal();
}

// ============================================================
// 무기 시너지 시스템
// ============================================================
function checkSynergies() {
  if (!player) return;
  for (const syn of SYNERGY_DEFS) {
    if (activeSynergies.has(syn.id)) continue;
    const allActive = syn.weapons.every(key => {
      if (key in player.weapons) return player.weapons[key].level > 0;
      if (key in player.passives) return player.passives[key] > 0;
      return false;
    });
    if (allActive) {
      activeSynergies.add(syn.id);
      syn.apply(player);
      showSynergyBanner(syn.icon, syn.name);
      const _synName = (LANG === 'en' && syn.nameEn) ? syn.nameEn : syn.name;
      addFloatingText(player.x, player.y - 55, LANG === 'en' ? `✨ Synergy: ${_synName}!` : `✨ 시너지: ${_synName}!`, '#ffe600', 14);
      triggerScreenShake(6, 400);
      playSynthSound([600, 900, 1400, 800], 0.18, 'sine', 0.07);
    }
  }
}

function showSynergyBanner(icon, name) {
  const banner = document.getElementById('synergy-banner');
  if (!banner) return;
  document.getElementById('syn-icon').textContent = icon;
  document.getElementById('syn-name').textContent = name;
  banner.classList.add('active');
  clearTimeout(banner._timer);
  banner._timer = setTimeout(() => banner.classList.remove('active'), 2800);
}

function showEvolutionNotification(icon, name) {
  const banner = document.getElementById('evolution-banner');
  if (!banner) return;
  banner.querySelector('#evo-icon').textContent = icon;
  banner.querySelector('#evo-name').textContent = name;
  banner.classList.add('active');
  setTimeout(() => banner.classList.remove('active'), 2500);
  triggerScreenShake(10, 700);
  playSynthSound([200, 800, 1600], 0.22, 'sawtooth', 0.1);
}

function applyUpgrade(choice) {
  let mult = choice.rarityMult || 1.0;

  if (choice.type === 'legendary') {
    applyLegendaryUpgrade(choice.id);
    return;
  }

  if (choice.type === 'fusion') {
    if (!player.fusions) player.fusions = {};
    player.fusions[choice.id] = true;
    const fus = WEAPON_FUSIONS.find(f => f.id === choice.id);
    if (fus) {
      const _fusName = (LANG === 'en' && typeof tGame !== 'undefined' && tGame('fusions', fus.id, 'name')) || fus.name;
      showEvolutionNotification(fus.icon, _fusName + (LANG === 'en' ? ' Fusion Complete!' : ' 융합 완료!'));
      addFloatingText(player.x, player.y - 70, LANG === 'en' ? `🔮 Weapon Fusion: ${_fusName}!` : `🔮 무기 융합: ${_fusName}!`, '#ffe600', 16);
    }
    triggerScreenShake(14, 900);
    playSynthSound([200, 500, 1000, 2000, 800], 0.28, 'sine', 0.12);
    return;
  }

  if (choice.type === 'revival') {
    applyRevivalPerk(choice.id);
    return;
  }

  if (choice.type === 'weapon') {
    let weapon = player.weapons[choice.key];
    weapon.level = choice.nextLevel;
    weaponStats[choice.key].level = choice.nextLevel;
    if (choice.nextLevel === 5) {
      evolutionCount++;
      _statAdd('totalEvolutions', 1);
      let evolvedName = UPGRADES.weapons[choice.key].evolvedName || UPGRADES.weapons[choice.key].name;
      showEvolutionNotification(UPGRADES.weapons[choice.key].icon, evolvedName);
    } else {
      playSynthSound([600, 1200], 0.15, 'sine', 0.05);
    }
    checkSynergies();
  } else if (choice.type === 'stat') {
    switch (choice.id) {
      case 'stat_hp':
        player.maxHp += Math.floor(20 * mult);
        player.hp = Math.min(player.hp + Math.floor(30 * mult), player.maxHp); break;
      case 'stat_speed':
        player.speed *= 1 + 0.1 * mult; break;
      case 'stat_damage':
        player.damageMultiplier *= 1 + 0.15 * mult; break;
      case 'stat_magnet':
        player.magnetRadius *= 1 + 0.3 * mult; break;
    }
    playSynthSound([800, 1000], 0.1, 'triangle', 0.05);
  } else if (choice.type === 'passive') {
    player.passives[choice.key] = choice.nextLevel;
    applyPassiveEffect(choice.key, choice.nextLevel);
    playSynthSound([500, 900, 1200], 0.12, 'triangle', 0.05);
    checkSynergies();
  } else if (choice.type === 'class_passive') {
    player.classPassives[choice.key] = choice.nextLevel;
    applyClassPassiveEffect(choice.key, choice.nextLevel);
    playSynthSound([400, 800, 1400], 0.15, 'triangle', 0.06);
  }
}

function applyClassPassiveEffect(key, level) {
  switch (key) {
    case 'hk_skill':
      player._skillCdMult = level >= 2 ? 0.55 : 0.75;
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? `⏩ Hack Accelerator Lv${level}!` : `⏩ 해킹 가속 Lv${level}!`, '#00f0ff', 14);
      break;
    case 'hk_xp':
      player.passiveXpMult = (player.passiveXpMult || 1.0) + 0.20;
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? `💽 Data Harvest Lv${level}!` : `💽 데이터 수집 Lv${level}!`, '#00f0ff', 14);
      break;
    case 'fw_armor':
      player.damageReduction = Math.min(0.75, (player.damageReduction || 0) + (level === 1 ? 0.12 : 0.10));
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? `🧱 Reinforced Armor Lv${level}!` : `🧱 강화 방호 Lv${level}!`, '#b026ff', 14);
      break;
    case 'fw_regen':
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? `🔋 Self-Repair Lv${level}!` : `🔋 자가 수복 Lv${level}!`, '#b026ff', 14);
      break;
    case 'rk_evade':
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? `👻 Phase Dodge Lv${level}!` : `👻 위상 회피 Lv${level}!`, '#39ff14', 14);
      break;
    case 'rk_speed':
      player.speed += level === 1 ? 0.5 : 0.7;
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? `💨 High-Speed Breach Lv${level}!` : `💨 고속 침투 Lv${level}!`, '#39ff14', 14);
      break;
    case 'dr_dmg':
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? `⚡ Drone Overload Lv${level}!` : `⚡ 드론 과부하 Lv${level}!`, '#ffe600', 14);
      break;
    case 'dr_count':
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? `🛸 Extra Deploy Lv${level}!` : `🛸 추가 배치 Lv${level}!`, '#ffe600', 14);
      break;
    case 'sc_crit':
      player.critBonus = (player.critBonus || 0) + (level === 1 ? 0.15 : 0.13);
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? `🎯 Lethal Aim Lv${level}!` : `🎯 치명 조준 Lv${level}!`, '#ff4466', 14);
      break;
    case 'sc_magnet':
      player.magnetRadius += 60;
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? `🔭 Wide Scan Lv${level}!` : `🔭 광역 탐지 Lv${level}!`, '#ff4466', 14);
      break;
    case 'pb_maxhp':
      player.maxHp += 40;
      player.hp     = Math.min(player.hp + 40, player.maxHp);
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? `💪 Core Expansion Lv${level}!` : `💪 핵심 강화 Lv${level}!`, '#39ff14', 14);
      break;
    case 'pb_triage':
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? `🏥 Field Triage Lv${level}!` : `🏥 응급 처치 Lv${level}!`, '#39ff14', 14);
      break;
    case 'ck_zombie':
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? `🧟 Zombie Protocol Lv${level}!` : `🧟 좀비 프로토콜 Lv${level}!`, '#ff6600', 14);
      break;
    case 'ck_blast':
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? `💥 Suicide Command Lv${level}!` : `💥 자폭 명령 Lv${level}!`, '#ff6600', 14);
      break;
    case 'gd_rhythm':
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? `🎵 Rhythm Boost Lv${level}!` : `🎵 리듬 강화 Lv${level}!`, '#ff88ff', 14);
      break;
    case 'gd_burst':
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? `💫 Chain Burst Lv${level}!` : `💫 연속 폭발 Lv${level}!`, '#ff88ff', 14);
      break;
    case 'ps_absorb':
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? `💉 Enhanced Absorption Lv${level}!` : `💉 강화 흡수 Lv${level}!`, '#88ff44', 14);
      break;
    case 'ps_surge':
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? `🌊 Release Surge Lv${level}!` : `🌊 방출 급등 Lv${level}!`, '#88ff44', 14);
      break;
    case 'jm_wave':
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? `📶 Broadband Jam Lv${level}!` : `📶 광대역 간섭 Lv${level}!`, '#aaffff', 14);
      break;
    case 'jm_static':
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? `⚡ Static Buildup Lv${level}!` : `⚡ 정전기 누적 Lv${level}!`, '#aaffff', 14);
      break;
  }
}

function applyPassiveEffect(key, level) {
  switch (key) {
    case 'overclock':
      player.damageMultiplier *= level === 2 ? (1.4 / 1.12) : 1.12;
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? `⚙️ Overdrive Circuit Lv${level}!` : `⚙️ 과부하 회로 Lv${level}!`, '#ffe600', 14);
      break;
    case 'resonance':
      player.passiveXpMult = level === 2 ? 1.45 : 1.2;
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? `🔮 Resonance Core Lv${level}!` : `🔮 공명 코어 Lv${level}!`, '#b026ff', 14);
      break;
    case 'shield':
      player.damageReduction = level === 2 ? 0.22 : 0.10;
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? `💠 Defense Chip Lv${level}!` : `💠 방어막 Lv${level}!`, '#00f0ff', 14);
      break;
    case 'regen':
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? `🔋 Regen Core Lv${level}!` : `🔋 회생 코어 Lv${level}!`, '#39ff14', 14);
      break;
    case 'nanobots':
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? `🦠 Nanobot Swarm Lv${level}!` : `🦠 나노봇 Lv${level}!`, '#b026ff', 14);
      break;
    case 'thorns':
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? `⚔️ Revenge Spikes Lv${level}!` : `⚔️ 복수의 가시 Lv${level}!`, '#ff4466', 14);
      break;
    case 'critical':
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? `💥 Critical Core Lv${level}!` : `💥 크리티컬 코어 Lv${level}!`, '#ffe600', 14);
      break;
    case 'explosive':
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? `💣 Chain Explosion Lv${level}!` : `💣 폭발 연쇄 Lv${level}!`, '#ff8800', 14);
      break;
    case 'barrier':
      player.barrierTimer = 0;
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? `🛡 Electric Barrier Lv${level}!` : `🛡 전기 방벽 Lv${level}!`, '#00f0ff', 14);
      break;
  }
}

// ============================================================
// 상점 시스템
// ============================================================
function updateShopFocus(cards) {
  cards.forEach((c, i) => c.classList.toggle('shop-kb-focus', i === shopFocusIdx));
}

function triggerShopModal() {
  gameState = STATE_SHOP;
  shopFocusIdx = 0;
  const modal    = document.getElementById('shop-modal');
  const goldDisp = document.getElementById('shop-gold-display');
  if (goldDisp) goldDisp.textContent = LANG === 'en' ? `Gold: 💰 ${player.gold}G` : `보유 골드: 💰 ${player.gold}G`;
  const shuffled = [...SHOP_ITEMS].sort(() => Math.random() - 0.5).slice(0, 3);
  renderShopItems(shuffled);
  modal.classList.add('active');
  setTimeout(() => updateShopFocus([...document.querySelectorAll('#shop-items-list .shop-item-card')]), 50);
}

function getItemCost(item) {
  const bought    = player?._shopPurchases?.[item.id] || 0;
  const scaleMult = bought > 0 ? Math.pow(item.scale || 1.0, bought) : 1;
  const discount  = player?.shopDiscount || 0;
  return Math.max(1, Math.floor(item.cost * scaleMult * (1 - discount)));
}

function renderShopItems(items) {
  const list     = document.getElementById('shop-items-list');
  const goldDisp = document.getElementById('shop-gold-display');
  if (goldDisp) goldDisp.textContent = `${t('shop.gold')} ${player.gold}G`;
  list.innerHTML = '';
  items.forEach(item => {
    const cost       = getItemCost(item);
    const bought     = player?._shopPurchases?.[item.id] || 0;
    const canAfford  = player.gold >= cost;
    const nextCost   = Math.max(1, Math.floor(item.cost * Math.pow(item.scale || 1.0, bought + 1) * (1 - (player?.shopDiscount || 0))));
    const btn = document.createElement('button');
    btn.className = `shop-item-card${canAfford ? '' : ' shop-cant-afford'}`;
    const discountTag  = (player?.shopDiscount > 0) ? ` <span style="color:#39ff14;font-size:0.7em">(-${Math.round((player.shopDiscount)*100)}%)</span>` : '';
    const boughtLabel  = t('shop.bought').replace('{n}', bought);
    const nextLabel    = t('shop.next').replace('{n}', nextCost);
    const purchaseTag  = bought > 0 ? `<span style="color:rgba(255,200,0,0.7);font-size:0.72em;margin-left:4px">${boughtLabel}</span>` : '';
    const nextCostTag  = bought > 0 ? `<div style="font-size:0.68em;color:rgba(255,150,0,0.6);margin-top:2px">${nextLabel}</div>` : '';
    const itemName = tGame('shop', item.id, 'name') || item.name;
    const itemDesc = tGame('shop', item.id, 'desc') || item.desc;
    btn.innerHTML = `
      <div class="shop-item-icon">${item.icon}</div>
      <div class="shop-item-details">
        <div class="shop-item-name">${itemName}${purchaseTag}</div>
        <div class="shop-item-desc">${itemDesc}</div>
        ${nextCostTag}
      </div>
      <div class="shop-item-cost ${canAfford ? 'can-afford' : 'cant-afford'}">💰 ${cost}G${discountTag}</div>
    `;
    if (canAfford) {
      btn.addEventListener('click', () => {
        applyShopItem(item);
        renderShopItems(items);
      });
    }
    list.appendChild(btn);
  });
}

function applyShopItem(item) {
  const cost = getItemCost(item);
  if (player.gold < cost) return;
  player.gold -= cost;
  if (!player._shopPurchases) player._shopPurchases = {};
  player._shopPurchases[item.id] = (player._shopPurchases[item.id] || 0) + 1;
  switch (item.id) {
    case 'shop_hp': {
      const heal = Math.floor(player.maxHp * 0.5);
      player.hp = Math.min(player.hp + heal, player.maxHp);
      addFloatingText(player.x, player.y - 40, `+${heal} HP`, '#ff4466', 16);
      break;
    }
    case 'shop_damage':
      player.damageMultiplier *= 1.2;
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? '🔥 DMG +20%' : '🔥 피해 +20%', '#ff6600', 14);
      break;
    case 'shop_speed':
      player.speed *= 1.15;
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? '🏃 SPD +15%' : '🏃 속도 +15%', '#39ff14', 14);
      break;
    case 'shop_magnet':
      player.magnetRadius *= 1.4;
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? '🧲 Magnet +40%' : '🧲 자석 +40%', '#b026ff', 14);
      break;
    case 'shop_reroll':
      rerollUses += 2;
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? '🔄 Rerolls +2' : '🔄 리롤 +2', '#ffe600', 14);
      break;
    case 'shop_maxhp':
      player.maxHp += 30;
      player.hp = Math.min(player.hp + 30, player.maxHp);
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? '❤️ Max HP +30' : '❤️ 최대 HP +30', '#ff4466', 14);
      break;
  }
  playSynthSound([440, 880], 0.1, 'sine', 0.06);
}

function closeShopModal() {
  document.getElementById('shop-modal').classList.remove('active');
  gameState = isStageClearAnim ? STATE_STAGE_CLEAR : STATE_PLAYING;
  shopTimer = 0;
  lastTime  = performance.now();
  ensureGameLoopRunning();
}

function applyRevivalPerk(id) {
  if (!player) return;
  switch (id) {
    case 'rev_restore':
      player.revivals.restore = true;
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? '💾 Restore Chip Equipped!' : '💾 복원 칩 장착!', '#39ff14', 14); break;
    case 'rev_backup':
      player.revivals.backup  = true;
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? '🔄 Emergency Backup Equipped!' : '🔄 긴급 백업 장착!', '#ffe600', 14); break;
    case 'rev_laststand':
      player.revivals.lastStand += 2;
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? `🛡 Barrier Loaded! (${player.revivals.lastStand}×)` : `🛡 방어막 장전! (${player.revivals.lastStand}회)`, '#00f0ff', 14); break;
    case 'rev_counter':
      player.revivals.counter = true;
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? '💥 Last Counter Equipped!' : '💥 절명 반격 장착!', '#ff4466', 14); break;
    case 'rev_void':
      player.revivals.void    = true;
      addFloatingText(player.x, player.y - 40, LANG === 'en' ? '🌀 Void Core Equipped!' : '🌀 공허 코어 장착!', '#b026ff', 14); break;
  }
  playSynthSound([300, 600, 1000, 1500], 0.15, 'sine', 0.07);
  triggerScreenShake(5, 300);
}

function applyLegendaryUpgrade(id) {
  switch (id) {
    case 'leg_all_up':
      for (let key in player.weapons) {
        let w = player.weapons[key];
        if (w.level > 0 && w.level < UPGRADES.weapons[key].maxLevel) {
          w.level++;
          weaponStats[key].level = w.level;
        }
      }
      addFloatingText(player.x, player.y - 40, '✨ ALL WEAPONS UP!', '#ffe600', 16);
      break;
    case 'leg_hp':
      player.maxHp += 80;
      player.hp     = player.maxHp;
      addFloatingText(player.x, player.y - 40, '💎 CORE RESTORED!', '#ffe600', 16);
      break;
    case 'leg_nuke':
      applyFieldItemEffect('nuke', player.x, player.y);
      break;
    case 'leg_overclock':
      player.damageMultiplier *= 1.5;
      player.speed *= 1.25;
      addFloatingText(player.x, player.y - 40, '⚡ OVERCLOCK!', '#ffe600', 16);
      break;
  }
  playVictorySound();
  triggerScreenShake(6, 400);
}

// ============================================================
// 26. 게임 종료 / 결과 화면
// ============================================================
// ============================================================